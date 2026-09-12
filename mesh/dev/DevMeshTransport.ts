import type {
  MeshEnvelope,
  NetworkHealthStatus,
  SyncBatchRequest,
  DevicePresenceTelemetry,
  SyncBatchResponse,
} from '../../shared/types/index';
import {
  FetchGatewayClient,
  type GatewayClient,
  type MeshPeer,
  type MeshSendResult,
  type MeshTransportService,
} from '../MeshTransportService';
import { Deduplicator } from '../protocol/Deduplicator';
import { canForwardEnvelope, isEnvelopeExpired, validateEnvelope } from '../protocol/Envelope';
import { MessageQueue } from '../queue/MessageQueue';
import {
  parseDevMeshServerMessage,
  type DevMeshClientMessage,
} from './DevMeshProtocol';

export interface DevMeshActivity {
  transportMode: 'DEV_EMULATOR_MESH';
  nodeId: string;
  brokerUrl: string;
  brokerConnected: boolean;
  connectedPeerIds: string[];
  queuedCount: number;
  receivedCount: number;
  relayedCount: number;
  peerReceiptCount: number;
  gatewayState: 'NOT_CONNECTED' | 'ACKNOWLEDGED' | 'FAILED';
  lastActivity?: string;
  lastReceived?: {
    messageId: string;
    messageType: MeshEnvelope<unknown>['messageType'];
    fromNodeId: string;
    summary: string;
  };
}

interface SocketEvent {
  data?: unknown;
  code?: number;
}

export interface DevMeshSocket {
  readonly readyState: number;
  send(data: string): void;
  close(): void;
  onopen: ((event: SocketEvent) => void) | null;
  onmessage: ((event: SocketEvent) => void) | null;
  onerror: ((event: SocketEvent) => void) | null;
  onclose: ((event: SocketEvent) => void) | null;
}

export interface DevMeshTransportOptions {
  queue?: MessageQueue;
  deduplicator?: Deduplicator;
  gatewayClient?: GatewayClient;
  socketFactory?: (url: string) => DevMeshSocket;
  reconnectDelayMs?: number;
  now?: () => number;
  batteryMode?: NetworkHealthStatus['batteryMode'];
}

function payloadSummary(envelope: MeshEnvelope<unknown>): string {
  const payload = envelope.payload as Record<string, unknown>;
  const person = payload.person;
  if (
    typeof person === 'object' &&
    person !== null &&
    typeof (person as Record<string, unknown>).name === 'string'
  ) {
    return (person as Record<string, unknown>).name as string;
  }
  if (typeof payload.personName === 'string') return payload.personName;
  if (typeof payload.personDescription === 'string') return payload.personDescription;
  return envelope.messageType.replaceAll('_', ' ');
}

export class DevMeshTransport implements MeshTransportService {
  private readonly queue: MessageQueue;
  private readonly deduplicator: Deduplicator;
  private readonly gatewayClient: GatewayClient;
  private readonly socketFactory: (url: string) => DevMeshSocket;
  private readonly reconnectDelayMs: number;
  private readonly now: () => number;
  private readonly batteryMode: NetworkHealthStatus['batteryMode'];
  private readonly messageListeners = new Set<(envelope: MeshEnvelope<unknown>) => void>();
  private readonly activityListeners = new Set<(activity: DevMeshActivity) => void>();
  private readonly peerReceiptListeners = new Set<(messageId: string, peerId: string) => void>();
  private socket?: DevMeshSocket;
  private reconnectTimer?: ReturnType<typeof setTimeout>;
  private initialized = false;
  private stopped = false;
  private peerIds: string[] = [];
  private activity: DevMeshActivity;
  private lastSuccessfulSyncTimestamp?: number;

  constructor(
    readonly nodeId: string,
    readonly brokerUrl: string,
    options: DevMeshTransportOptions = {},
  ) {
    this.queue = options.queue ?? new MessageQueue();
    this.deduplicator = options.deduplicator ?? new Deduplicator();
    this.gatewayClient = options.gatewayClient ?? new FetchGatewayClient();
    this.socketFactory = options.socketFactory ?? ((url) => new WebSocket(url) as DevMeshSocket);
    this.reconnectDelayMs = options.reconnectDelayMs ?? 1_000;
    this.now = options.now ?? Date.now;
    this.batteryMode = options.batteryMode ?? 'NORMAL';
    this.activity = {
      transportMode: 'DEV_EMULATOR_MESH',
      nodeId,
      brokerUrl,
      brokerConnected: false,
      connectedPeerIds: [],
      queuedCount: 0,
      receivedCount: 0,
      relayedCount: 0,
      peerReceiptCount: 0,
      gatewayState: 'NOT_CONNECTED',
      lastActivity: 'Waiting for development mesh broker',
    };
  }

  async init(): Promise<void> {
    if (this.initialized) return;
    await Promise.all([this.queue.init(), this.deduplicator.init()]);
    this.activity.queuedCount = await this.queue.size();
    this.initialized = true;
    this.connect();
  }

  async sendMeshMessage(envelope: MeshEnvelope<unknown>): Promise<MeshSendResult> {
    this.ensureInitialized();
    const validated = validateEnvelope(envelope);
    if (isEnvelopeExpired(validated, this.now())) {
      throw new Error(`Cannot queue expired mesh envelope ${validated.messageId}.`);
    }
    const queued = await this.queue.enqueue(validated);
    const isNew = await this.deduplicator.checkAndMark(validated.messageId);
    await this.refreshQueueCount();
    if (!isNew) {
      return { queuedLocally: queued || (await this.hasQueued(validated.messageId)), immediateRelay: false };
    }
    const relayed = this.sendEnvelopeIfConnected(validated);
    this.setLastActivity(
      relayed
        ? `Relayed ${validated.messageType} ${validated.messageId.slice(0, 8)} to development mesh`
        : `Queued ${validated.messageType} ${validated.messageId.slice(0, 8)} while broker/peers unavailable`,
    );
    return { queuedLocally: true, immediateRelay: relayed };
  }

  async getNearbyPeers(): Promise<MeshPeer[]> {
    this.ensureInitialized();
    const lastSeenAt = this.now();
    return this.peerIds.map((nodeId) => ({ nodeId, lastSeenAt }));
  }

  async getQueuedMessages(): Promise<MeshEnvelope<unknown>[]> {
    this.ensureInitialized();
    const queued = await this.queue.getAll();
    this.activity.queuedCount = queued.length;
    return queued;
  }

  async removeQueuedMessage(messageId: string): Promise<void> {
    this.ensureInitialized();
    await this.queue.acknowledge(messageId);
    await this.refreshQueueCount();
  }

  getNetworkHealth(): NetworkHealthStatus {
    this.ensureInitialized();
    const connectivity = this.lastSuccessfulSyncTimestamp
      ? 'INTERNET_CONNECTED'
      : this.isOpen() && this.peerIds.length > 0
        ? 'MESH_CONNECTED'
        : this.activity.queuedCount > 0
          ? 'OFFLINE_QUEUED'
          : 'ISOLATED';
    return {
      connectivity,
      nearbyPeerCount: this.peerIds.length,
      queuedMessageCount: this.activity.queuedCount,
      lastSuccessfulSyncTimestamp: this.lastSuccessfulSyncTimestamp,
      batteryMode: this.batteryMode,
    };
  }

  onMessageReceived(callback: (envelope: MeshEnvelope<unknown>) => void): () => void {
    this.messageListeners.add(callback);
    return () => this.messageListeners.delete(callback);
  }

  onActivityChanged(callback: (activity: DevMeshActivity) => void): () => void {
    this.activityListeners.add(callback);
    callback(this.getActivity());
    return () => this.activityListeners.delete(callback);
  }

  onPeerReceipt(callback: (messageId: string, peerId: string) => void): () => void {
    this.peerReceiptListeners.add(callback);
    return () => this.peerReceiptListeners.delete(callback);
  }

  getActivity(): DevMeshActivity {
    return {
      ...this.activity,
      connectedPeerIds: [...this.activity.connectedPeerIds],
      lastReceived: this.activity.lastReceived ? { ...this.activity.lastReceived } : undefined,
    };
  }

  async syncWithGateway(
    gatewayUrl: string,
    deviceTelemetry?: DevicePresenceTelemetry,
  ): Promise<SyncBatchResponse> {
    this.ensureInitialized();
    const outboundEnvelopes = (await this.queue.getAll()).filter(
      (item) => item.destinationType !== 'SPECIFIC_NODE',
    );
    const request: SyncBatchRequest = {
      deviceId: this.nodeId,
      lastSyncTimestamp: this.lastSuccessfulSyncTimestamp ?? 0,
      outboundEnvelopes,
      deviceTelemetry,
    };
    try {
      const response = await this.gatewayClient.sync(gatewayUrl, request);
      const queuedIds = new Set(outboundEnvelopes.map((item) => item.messageId));
      for (const messageId of response.acknowledgedMessageIds) {
        if (queuedIds.has(messageId)) await this.queue.acknowledge(messageId);
      }
      this.lastSuccessfulSyncTimestamp = response.serverTimestamp;
      this.activity.gatewayState = 'ACKNOWLEDGED';
      this.setLastActivity(`Gateway acknowledged ${response.acknowledgedMessageIds.length} message(s)`);
      await this.refreshQueueCount();
      return response;
    } catch (error) {
      this.activity.gatewayState = 'FAILED';
      this.setLastActivity('Gateway sync failed; unacknowledged messages retained');
      throw error;
    }
  }

  /** Stops reconnect attempts. Primarily used by tests and development teardown. */
  shutdown(): void {
    this.stopped = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = undefined;
    this.socket?.close();
    this.socket = undefined;
    this.peerIds = [];
    this.activity.brokerConnected = false;
    this.activity.connectedPeerIds = [];
    this.emitActivity();
  }

  private connect(): void {
    if (this.stopped || this.socket) return;
    let socket: DevMeshSocket;
    try {
      socket = this.socketFactory(this.brokerUrl);
    } catch {
      this.scheduleReconnect();
      return;
    }
    this.socket = socket;
    socket.onopen = () => {
      this.activity.brokerConnected = true;
      this.setLastActivity('Connected to development mesh broker');
      this.send({ kind: 'HELLO', nodeId: this.nodeId });
    };
    socket.onmessage = (event) => {
      if (typeof event.data === 'string') {
        void this.handleServerMessage(event.data);
      }
    };
    socket.onerror = () => {
      this.setLastActivity('Development mesh broker unavailable; messages remain queued');
    };
    socket.onclose = (event) => {
      if (event.code === 4001) {
        this.stopped = true;
      }
      if (this.socket === socket) this.socket = undefined;
      this.peerIds = [];
      this.activity.brokerConnected = false;
      this.activity.connectedPeerIds = [];
      this.setLastActivity('Broker disconnected; retrying with durable queue');
      if (event.code !== 4001) this.scheduleReconnect();
    };
  }

  private async handleServerMessage(serialized: string): Promise<void> {
    const message = parseDevMeshServerMessage(serialized);
    if (message.kind === 'ERROR') {
      this.setLastActivity(`Broker rejected packet: ${message.message}`);
      return;
    }
    if (message.kind === 'WELCOME' || message.kind === 'PEERS') {
      const previousPeers = this.peerIds.join('\0');
      this.peerIds = [...message.peerIds];
      this.activity.connectedPeerIds = [...message.peerIds];
      this.setLastActivity(
        message.peerIds.length > 0
          ? `Connected to ${message.peerIds.length} development peer(s)`
          : 'Broker connected; waiting for a peer',
      );
      if (previousPeers !== this.peerIds.join('\0')) {
        await this.relayQueuedMessages();
      }
      return;
    }
    if (message.kind === 'PEER_RECEIPT') {
      this.activity.peerReceiptCount += 1;
      const queued = (await this.queue.getAll()).find((item) => item.messageId === message.messageId);
      const reachedDestination = queued?.destinationType === 'SPECIFIC_NODE'
        && queued.destinationId === message.fromNodeId;
      if (reachedDestination) await this.queue.acknowledge(message.messageId);
      await this.refreshQueueCount();
      this.setLastActivity(
        reachedDestination
          ? `Target phone ${message.fromNodeId} received ${message.messageId.slice(0, 8)}`
          : `${message.fromNodeId} received ${message.messageId.slice(0, 8)}; waiting for gateway`,
      );
      for (const listener of this.peerReceiptListeners) {
        listener(message.messageId, message.fromNodeId);
      }
      return;
    }

    const envelope = validateEnvelope(message.envelope);
    if (isEnvelopeExpired(envelope, this.now()) || envelope.hopCount > envelope.maxHops) return;
    if (!(await this.deduplicator.checkAndMark(envelope.messageId))) return;

    const reachedDestination = envelope.destinationType === 'SPECIFIC_NODE'
      && envelope.destinationId === this.nodeId;
    if (!reachedDestination) await this.queue.enqueue(envelope);
    await this.refreshQueueCount();
    this.activity.receivedCount += 1;
    this.activity.lastReceived = {
      messageId: envelope.messageId,
      messageType: envelope.messageType,
      fromNodeId: message.fromNodeId,
      summary: payloadSummary(envelope),
    };
    this.setLastActivity(
      `Received ${envelope.messageType} ${envelope.messageId.slice(0, 8)} from ${message.fromNodeId}`,
    );
    for (const listener of this.messageListeners) listener({ ...envelope });
    this.send({
      kind: 'PEER_RECEIPT',
      nodeId: this.nodeId,
      targetNodeId: message.fromNodeId,
      messageId: envelope.messageId,
      receivedAt: this.now(),
    });

    if (!reachedDestination && canForwardEnvelope(envelope, this.now())) {
      this.send({ kind: 'ENVELOPE', nodeId: this.nodeId, envelope });
      this.activity.relayedCount += 1;
      this.emitActivity();
    }
  }

  private async relayQueuedMessages(): Promise<void> {
    if (!this.isOpen() || this.peerIds.length === 0) return;
    for (const envelope of await this.queue.getAll()) {
      this.sendEnvelopeIfConnected(envelope);
    }
    this.emitActivity();
  }

  private sendEnvelopeIfConnected(envelope: MeshEnvelope<unknown>): boolean {
    if (!this.isOpen() || this.peerIds.length === 0) return false;
    this.send({ kind: 'ENVELOPE', nodeId: this.nodeId, envelope });
    this.activity.relayedCount += 1;
    this.emitActivity();
    return true;
  }

  private send(message: DevMeshClientMessage): void {
    if (this.isOpen()) this.socket?.send(JSON.stringify(message));
  }

  private isOpen(): boolean {
    return this.socket?.readyState === 1;
  }

  private scheduleReconnect(): void {
    if (this.stopped || this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined;
      this.connect();
    }, this.reconnectDelayMs);
  }

  private async refreshQueueCount(): Promise<void> {
    this.activity.queuedCount = await this.queue.size();
    this.emitActivity();
  }

  private async hasQueued(messageId: string): Promise<boolean> {
    return (await this.queue.getAll()).some((item) => item.messageId === messageId);
  }

  private setLastActivity(lastActivity: string): void {
    this.activity.lastActivity = lastActivity;
    this.emitActivity();
  }

  private emitActivity(): void {
    const snapshot = this.getActivity();
    for (const listener of this.activityListeners) listener(snapshot);
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error(`Development mesh node ${this.nodeId} must be initialized before use.`);
    }
  }
}
