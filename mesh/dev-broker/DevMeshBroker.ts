import { EventEmitter } from 'node:events';

import type { WebSocket } from 'ws';
import { WebSocketServer } from 'ws';

import {
  parseDevMeshClientMessage,
  type DevMeshServerMessage,
} from '../dev/DevMeshProtocol';
import { incrementEnvelopeHop } from '../protocol/Envelope';

export type DevMeshTopology = Record<string, string[]>;

export interface DevMeshBrokerOptions {
  host?: string;
  port?: number;
  topology?: DevMeshTopology;
  /** Development-test hook. A value of 2 simulates one duplicate radio delivery. */
  deliveryCopies?: number;
  now?: () => number;
  logger?: (line: string) => void;
}

interface RegisteredClient {
  nodeId: string;
  socket: WebSocket;
}

export class DevMeshBroker extends EventEmitter {
  private server?: WebSocketServer;
  private readonly clients = new Map<string, RegisteredClient>();
  private readonly host: string;
  private readonly requestedPort: number;
  private readonly topology?: DevMeshTopology;
  private readonly deliveryCopies: number;
  private readonly now: () => number;
  private readonly logger: (line: string) => void;

  constructor(options: DevMeshBrokerOptions = {}) {
    super();
    this.host = options.host ?? '0.0.0.0';
    this.requestedPort = options.port ?? 8787;
    this.topology = options.topology;
    this.deliveryCopies = Math.max(1, options.deliveryCopies ?? 1);
    this.now = options.now ?? Date.now;
    this.logger = options.logger ?? console.log;
  }

  async start(): Promise<number> {
    if (this.server) {
      return this.port;
    }
    const server = new WebSocketServer({ host: this.host, port: this.requestedPort });
    this.server = server;
    server.on('connection', (socket) => this.handleConnection(socket));
    await new Promise<void>((resolve, reject) => {
      server.once('listening', resolve);
      server.once('error', reject);
    });
    this.logger(`[BROKER] listening on ws://${this.host}:${this.port}`);
    return this.port;
  }

  get port(): number {
    const address = this.server?.address();
    if (!address || typeof address === 'string') {
      throw new Error('Development mesh broker is not listening.');
    }
    return address.port;
  }

  get connectedNodeIds(): string[] {
    return [...this.clients.keys()].sort();
  }

  async stop(): Promise<void> {
    const server = this.server;
    if (!server) {
      return;
    }
    this.server = undefined;
    for (const client of this.clients.values()) {
      client.socket.close();
    }
    this.clients.clear();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    this.logger('[BROKER] stopped');
  }

  private handleConnection(socket: WebSocket): void {
    let registeredNodeId: string | undefined;

    socket.on('message', (data) => {
      try {
        const message = parseDevMeshClientMessage(data.toString());
        if (message.kind === 'HELLO') {
          registeredNodeId = message.nodeId;
          const previous = this.clients.get(message.nodeId);
          if (previous && previous.socket !== socket) {
            previous.socket.close(4001, 'Superseded by a newer connection for this node ID.');
          }
          this.clients.set(message.nodeId, { nodeId: message.nodeId, socket });
          this.logger(`[${message.nodeId}] connected`);
          this.send(socket, {
            kind: 'WELCOME',
            nodeId: message.nodeId,
            peerIds: this.eligiblePeerIds(message.nodeId),
          });
          this.broadcastPeerLists();
          this.emit('node-connected', message.nodeId);
          return;
        }

        if (!registeredNodeId || registeredNodeId !== message.nodeId) {
          throw new Error('Client must identify itself with HELLO before sending traffic.');
        }

        if (message.kind === 'PEER_RECEIPT') {
          const target = this.clients.get(message.targetNodeId);
          if (target && this.areLinked(message.nodeId, message.targetNodeId)) {
            this.send(target.socket, {
              kind: 'PEER_RECEIPT',
              fromNodeId: message.nodeId,
              messageId: message.messageId,
              receivedAt: message.receivedAt,
            });
          }
          return;
        }

        if (message.kind === 'ENVELOPE') {
          const nextEnvelope = incrementEnvelopeHop(message.envelope, this.now());
          if (!nextEnvelope) {
            this.logger(`[${message.nodeId}] dropped expired/hop-limited ${message.envelope.messageId}`);
            return;
          }
          const peers = this.eligiblePeerIds(message.nodeId);
          for (const peerId of peers) {
            const peer = this.clients.get(peerId);
            if (!peer) continue;
            for (let copy = 0; copy < this.deliveryCopies; copy += 1) {
              this.send(peer.socket, {
                kind: 'ENVELOPE',
                fromNodeId: message.nodeId,
                envelope: nextEnvelope,
              });
            }
            this.logger(
              `[${message.nodeId} -> ${peerId}] relayed ${nextEnvelope.messageId} (hop ${nextEnvelope.hopCount}/${nextEnvelope.maxHops})`,
            );
            this.emit('envelope-relayed', message.nodeId, peerId, nextEnvelope);
          }
        }
      } catch (error) {
        this.send(socket, {
          kind: 'ERROR',
          message: error instanceof Error ? error.message : 'Invalid development mesh packet.',
        });
      }
    });

    socket.on('close', () => {
      if (registeredNodeId && this.clients.get(registeredNodeId)?.socket === socket) {
        this.clients.delete(registeredNodeId);
        this.logger(`[${registeredNodeId}] disconnected`);
        this.broadcastPeerLists();
        this.emit('node-disconnected', registeredNodeId);
      }
    });
  }

  private areLinked(left: string, right: string): boolean {
    if (left === right) return false;
    if (!this.topology) return true;
    return Boolean(
      this.topology[left]?.includes(right) || this.topology[right]?.includes(left),
    );
  }

  private eligiblePeerIds(nodeId: string): string[] {
    return this.connectedNodeIds.filter((peerId) => this.areLinked(nodeId, peerId));
  }

  private broadcastPeerLists(): void {
    for (const client of this.clients.values()) {
      this.send(client.socket, { kind: 'PEERS', peerIds: this.eligiblePeerIds(client.nodeId) });
    }
  }

  private send(socket: WebSocket, message: DevMeshServerMessage): void {
    if (socket.readyState === socket.OPEN) {
      socket.send(JSON.stringify(message));
    }
  }
}
