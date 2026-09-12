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
import {
  incrementEnvelopeHop,
  isEnvelopeExpired,
  validateEnvelope,
} from '../protocol/Envelope';
import { MessageQueue } from '../queue/MessageQueue';

interface RelayItem {
  nodeId: string;
  envelope: MeshEnvelope<unknown>;
}

export class MockMeshNetwork {
  private readonly nodes = new Map<string, MockMeshTransport>();
  private readonly links = new Map<string, Set<string>>();

  register(node: MockMeshTransport): void {
    const existing = this.nodes.get(node.nodeId);
    if (existing && existing !== node) {
      throw new Error(`Mock mesh node ${node.nodeId} is already registered.`);
    }
    this.nodes.set(node.nodeId, node);
    if (!this.links.has(node.nodeId)) {
      this.links.set(node.nodeId, new Set());
    }
    this.notifyTopologyChanged();
  }

  connect(leftNodeId: string, rightNodeId: string): void {
    this.requireNode(leftNodeId);
    this.requireNode(rightNodeId);
    if (leftNodeId === rightNodeId) {
      throw new Error('A mock mesh node cannot connect to itself.');
    }
    this.links.get(leftNodeId)?.add(rightNodeId);
    this.links.get(rightNodeId)?.add(leftNodeId);
    this.notifyTopologyChanged();
  }

  disconnect(leftNodeId: string, rightNodeId: string): void {
    this.links.get(leftNodeId)?.delete(rightNodeId);
    this.links.get(rightNodeId)?.delete(leftNodeId);
    this.notifyTopologyChanged();
  }

  getPeerIds(nodeId: string): string[] {
    return [...(this.links.get(nodeId) ?? [])];
  }

  async propagate(originNodeId: string, envelope: MeshEnvelope<unknown>): Promise<number> {
    const pending: RelayItem[] = [{ nodeId: originNodeId, envelope }];
    let acceptedCount = 0;

    while (pending.length > 0) {
      const item = pending.shift();
      if (!item) {
        break;
      }

      for (const peerId of this.getPeerIds(item.nodeId)) {
        const nextEnvelope = incrementEnvelopeHop(item.envelope);
        if (!nextEnvelope) {
          continue;
        }
        const peer = this.requireNode(peerId);
        if (await peer.receiveFromPeer(nextEnvelope)) {
          acceptedCount += 1;
          const reachedDestination = nextEnvelope.destinationType === 'SPECIFIC_NODE'
            && nextEnvelope.destinationId === peerId;
          if (!reachedDestination) pending.push({ nodeId: peerId, envelope: nextEnvelope });
        }
      }
    }

    return acceptedCount;
  }

  async applyGatewayAcknowledgements(
    gatewayNodeId: string,
    messageIds: string[],
    serverTimestamp: number,
  ): Promise<void> {
    await Promise.all(
      [...this.nodes.values()].map((node) =>
        node.receiveGatewayAcknowledgements(
          messageIds,
          serverTimestamp,
          node.nodeId === gatewayNodeId,
        ),
      ),
    );
  }

  private requireNode(nodeId: string): MockMeshTransport {
    const node = this.nodes.get(nodeId);
    if (!node) {
      throw new Error(`Mock mesh node ${nodeId} is not initialized.`);
    }
    return node;
  }

  private notifyTopologyChanged(): void {
    for (const node of this.nodes.values()) {
      node.handleTopologyChanged();
    }
  }
}

export interface MockMeshTransportOptions {
  queue?: MessageQueue;
  deduplicator?: Deduplicator;
  gatewayClient?: GatewayClient;
  now?: () => number;
  batteryMode?: NetworkHealthStatus['batteryMode'];
}

export class MockMeshTransport implements MeshTransportService {
  private readonly queue: MessageQueue;
  private readonly deduplicator: Deduplicator;
  private readonly gatewayClient: GatewayClient;
  private readonly now: () => number;
  private readonly listeners = new Set<(envelope: MeshEnvelope<unknown>) => void>();
  private initialized = false;
  private queuedMessageCount = 0;
  private lastSuccessfulSyncTimestamp: number | undefined;
  private internetAcknowledged = false;

  constructor(
    readonly nodeId: string,
    private readonly network: MockMeshNetwork,
    options: MockMeshTransportOptions = {},
  ) {
    this.queue = options.queue ?? new MessageQueue();
    this.deduplicator = options.deduplicator ?? new Deduplicator();
    this.gatewayClient = options.gatewayClient ?? new FetchGatewayClient();
    this.now = options.now ?? Date.now;
    this.batteryMode = options.batteryMode ?? 'NORMAL';
  }

  private readonly batteryMode: NetworkHealthStatus['batteryMode'];

  async init(): Promise<void> {
    if (this.initialized) {
      return;
    }
    await this.queue.init();
    await this.duplicatorInit();
    this.queuedMessageCount = await this.queue.size();
    this.initialized = true;
    this.network.register(this);
  }

  async sendMeshMessage(envelope: MeshEnvelope<unknown>): Promise<MeshSendResult> {
    this.ensureInitialized();
    const validated = validateEnvelope(envelope);
    if (isEnvelopeExpired(validated, this.now())) {
      throw new Error(`Cannot queue expired mesh envelope ${validated.messageId}.`);
    }

    const queued = await this.queue.enqueue(validated);
    this.queuedMessageCount = await this.queue.size();
    const isNew = await this.deduplicator.checkAndMark(validated.messageId);
    if (!isNew) {
      const alreadyQueued = (await this.queue.getAll()).some(
        (item) => item.messageId === validated.messageId,
      );
      return { queuedLocally: queued || alreadyQueued, immediateRelay: false };
    }

    const relayCount = await this.network.propagate(this.nodeId, validated);
    return { queuedLocally: true, immediateRelay: relayCount > 0 };
  }

  async getNearbyPeers(): Promise<MeshPeer[]> {
    this.ensureInitialized();
    const lastSeenAt = this.now();
    return this.network.getPeerIds(this.nodeId).map((nodeId) => ({ nodeId, lastSeenAt }));
  }

  async getQueuedMessages(): Promise<MeshEnvelope<unknown>[]> {
    this.ensureInitialized();
    const queued = await this.queue.getAll();
    this.queuedMessageCount = queued.length;
    return queued;
  }

  async removeQueuedMessage(messageId: string): Promise<void> {
    this.ensureInitialized();
    await this.queue.acknowledge(messageId);
    this.queuedMessageCount = await this.queue.size();
  }

  /** Replays durable outbox items after restart or when peers become available. */
  async relayQueuedMessages(): Promise<number> {
    this.ensureInitialized();
    let acceptedCount = 0;
    for (const envelope of await this.queue.getAll()) {
      acceptedCount += await this.network.propagate(this.nodeId, envelope);
    }
    return acceptedCount;
  }

  getNetworkHealth(): NetworkHealthStatus {
    this.ensureInitialized();
    const peerCount = this.network.getPeerIds(this.nodeId).length;
    const connectivity = this.internetAcknowledged
      ? 'INTERNET_CONNECTED'
      : peerCount > 0
        ? 'MESH_CONNECTED'
        : this.queuedMessageCount > 0
          ? 'OFFLINE_QUEUED'
          : 'ISOLATED';

    return {
      connectivity,
      nearbyPeerCount: peerCount,
      queuedMessageCount: this.queuedMessageCount,
      lastSuccessfulSyncTimestamp: this.lastSuccessfulSyncTimestamp,
      batteryMode: this.batteryMode,
    };
  }

  onMessageReceived(callback: (envelope: MeshEnvelope<unknown>) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
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

    const response = await this.gatewayClient.sync(gatewayUrl, request);
    const queuedIds = new Set(outboundEnvelopes.map((envelope) => envelope.messageId));
    const validAcknowledgements = response.acknowledgedMessageIds.filter((messageId) =>
      queuedIds.has(messageId),
    );
    await this.network.applyGatewayAcknowledgements(
      this.nodeId,
      validAcknowledgements,
      response.serverTimestamp,
    );
    return response;
  }

  async receiveGatewayAcknowledgements(
    messageIds: string[],
    serverTimestamp: number,
    hasDirectInternet: boolean,
  ): Promise<void> {
    this.ensureInitialized();
    for (const messageId of messageIds) {
      await this.queue.acknowledge(messageId);
    }
    this.queuedMessageCount = await this.queue.size();
    if (messageIds.length > 0) {
      this.lastSuccessfulSyncTimestamp = serverTimestamp;
      this.internetAcknowledged = this.internetAcknowledged || hasDirectInternet;
    }
  }

  async receiveFromPeer(envelope: MeshEnvelope<unknown>): Promise<boolean> {
    this.ensureInitialized();
    const validated = validateEnvelope(envelope);
    if (isEnvelopeExpired(validated, this.now()) || validated.hopCount > validated.maxHops) {
      return false;
    }
    if (!(await this.deduplicator.checkAndMark(validated.messageId))) {
      return false;
    }

    const reachedDestination = validated.destinationType === 'SPECIFIC_NODE'
      && validated.destinationId === this.nodeId;
    if (!reachedDestination) await this.queue.enqueue(validated);
    this.queuedMessageCount = await this.queue.size();
    for (const listener of this.listeners) {
      listener({ ...validated });
    }
    return true;
  }

  handleTopologyChanged(): void {
    // Network health is derived synchronously from the current topology.
  }

  private async duplicatorInit(): Promise<void> {
    await this.deduplicator.init();
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error(`Mock mesh node ${this.nodeId} must be initialized before use.`);
    }
  }
}
