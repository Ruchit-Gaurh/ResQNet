import type {
  MeshEnvelope,
  NetworkHealthStatus,
  SyncBatchRequest,
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
  canForwardEnvelope,
  deserializeEnvelope,
  incrementEnvelopeHop,
  isEnvelopeExpired,
  serializeEnvelope,
  validateEnvelope,
} from '../protocol/Envelope';
import { MessageQueue } from '../queue/MessageQueue';
import {
  BleFrameAssembler,
  DEFAULT_ADVERTISEMENT_ROTATION_MS,
  RESQNET_BLE_INBOUND_UUID,
  RESQNET_BLE_OUTBOUND_UUID,
  RESQNET_BLE_SERVICE_UUID,
  frameBlePayload,
  type BleConnectionEvent,
  type BleRadioPort,
} from './BleRadioPort';

export interface NativeBleMeshTransportOptions {
  queue?: MessageQueue;
  deduplicator?: Deduplicator;
  gatewayClient?: GatewayClient;
  createEphemeralTag: () => string;
  now?: () => number;
}

/**
 * Real-radio MeshTransportService implementation. It is intentionally not selected
 * by the Expo Go mobile build: custom GATT central+peripheral code requires an Expo
 * development build and physical Android hardware. Inject that native driver here;
 * screens and report services remain unchanged.
 */
export class NativeBleMeshTransport implements MeshTransportService {
  private readonly queue: MessageQueue;
  private readonly deduplicator: Deduplicator;
  private readonly gatewayClient: GatewayClient;
  private readonly now: () => number;
  private readonly assembler = new BleFrameAssembler();
  private readonly peers = new Map<string, MeshPeer>();
  private readonly connectedFrameBytes = new Map<string, number>();
  private readonly listeners = new Set<(envelope: MeshEnvelope<unknown>) => void>();
  private readonly unsubscribers: Array<() => void> = [];
  private initialized = false;
  private internetAcknowledged = false;
  private lastSuccessfulSyncTimestamp: number | undefined;
  private lastTransportError: string | undefined;
  private queuedMessageCount = 0;

  constructor(
    readonly nodeId: string,
    private readonly radio: BleRadioPort,
    private readonly options: NativeBleMeshTransportOptions,
  ) {
    this.queue = options.queue ?? new MessageQueue();
    this.deduplicator = options.deduplicator ?? new Deduplicator();
    this.gatewayClient = options.gatewayClient ?? new FetchGatewayClient();
    this.now = options.now ?? Date.now;
  }

  async init(): Promise<void> {
    if (this.initialized) {
      return;
    }
    await this.queue.init();
    await this.deduplicator.init();
    this.queuedMessageCount = await this.queue.size();
    let permission = await this.radio.getPermissionState();
    if (permission === 'NOT_DETERMINED') {
      permission = await this.radio.requestPermissions();
    }
    if (permission !== 'GRANTED') {
      throw new Error(`Native BLE unavailable: ${permission}.`);
    }
    const capabilities = await this.radio.getCapabilities();
    if (!capabilities.canScan || !capabilities.canAdvertise || !capabilities.canGattClient || !capabilities.canGattServer) {
      throw new Error('Native BLE requires scan, advertise, GATT client, and GATT server support.');
    }

    this.unsubscribers.push(
      this.radio.onPeerFound((event) => {
        this.peers.set(event.peerId, { nodeId: event.peerId, lastSeenAt: event.lastSeenAt });
        void this.radio.connect(event.peerId).catch((error: unknown) => this.recordError(error));
      }),
      this.radio.onConnectionChanged((event) => {
        this.handleConnectionChanged(event);
      }),
      this.radio.onFrameReceived((event) => {
        void this.handleFrame(event.peerId, event.frame).catch((error: unknown) => this.recordError(error));
      }),
    );
    await this.radio.startAdvertising({
      serviceUuid: RESQNET_BLE_SERVICE_UUID,
      inboundCharacteristicUuid: RESQNET_BLE_INBOUND_UUID,
      outboundCharacteristicUuid: RESQNET_BLE_OUTBOUND_UUID,
      rotationMs: DEFAULT_ADVERTISEMENT_ROTATION_MS,
      ephemeralTag: this.options.createEphemeralTag(),
    });
    await this.radio.startScanning(RESQNET_BLE_SERVICE_UUID);
    this.initialized = true;
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
      return { queuedLocally: queued || (await this.queue.getAll()).some((item) => item.messageId === validated.messageId), immediateRelay: false };
    }
    const firstHop = incrementEnvelopeHop(validated, this.now());
    const relayed = firstHop ? await this.broadcast(firstHop) : 0;
    return { queuedLocally: true, immediateRelay: relayed > 0 };
  }

  async getNearbyPeers(): Promise<MeshPeer[]> {
    this.ensureInitialized();
    return [...this.peers.values()].map((peer) => ({ ...peer }));
  }

  async getQueuedMessages(): Promise<MeshEnvelope<unknown>[]> {
    this.ensureInitialized();
    return this.queue.getAll();
  }

  getNetworkHealth(): NetworkHealthStatus {
    this.ensureInitialized();
    const connectivity = this.internetAcknowledged
      ? 'INTERNET_CONNECTED'
      : this.connectedFrameBytes.size > 0
        ? 'MESH_CONNECTED'
        : this.queuedMessageCount > 0
          ? 'OFFLINE_QUEUED'
          : 'ISOLATED';
    return {
      connectivity,
      nearbyPeerCount: this.connectedFrameBytes.size,
      queuedMessageCount: this.queuedMessageCount,
      lastSuccessfulSyncTimestamp: this.lastSuccessfulSyncTimestamp,
      batteryMode: 'NORMAL',
    };
  }

  onMessageReceived(callback: (envelope: MeshEnvelope<unknown>) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  async syncWithGateway(gatewayUrl: string): Promise<SyncBatchResponse> {
    this.ensureInitialized();
    const outboundEnvelopes = await this.queue.getAll();
    const request: SyncBatchRequest = {
      deviceId: this.nodeId,
      lastSyncTimestamp: this.lastSuccessfulSyncTimestamp ?? 0,
      outboundEnvelopes,
    };
    const response = await this.gatewayClient.sync(gatewayUrl, request);
    const sentIds = new Set(outboundEnvelopes.map((item) => item.messageId));
    for (const messageId of response.acknowledgedMessageIds) {
      if (sentIds.has(messageId)) {
        await this.queue.acknowledge(messageId);
      }
    }
    this.queuedMessageCount = await this.queue.size();
    this.lastSuccessfulSyncTimestamp = response.serverTimestamp;
    this.internetAcknowledged = true;
    return response;
  }

  async shutdown(): Promise<void> {
    for (const unsubscribe of this.unsubscribers.splice(0)) {
      unsubscribe();
    }
    this.peers.clear();
    this.connectedFrameBytes.clear();
    this.assembler.clear();
    await this.radio.stop();
    this.initialized = false;
  }

  getLastTransportError(): string | undefined {
    return this.lastTransportError;
  }

  private handleConnectionChanged(event: BleConnectionEvent): void {
    if (event.connected) {
      this.connectedFrameBytes.set(event.peerId, event.negotiatedFrameBytes);
      this.peers.set(event.peerId, { nodeId: event.peerId, lastSeenAt: this.now() });
      void this.flushQueueToPeer(event.peerId).catch((error: unknown) => this.recordError(error));
    } else {
      this.connectedFrameBytes.delete(event.peerId);
      this.assembler.clearPeer(event.peerId);
    }
  }

  private async handleFrame(peerId: string, frame: Uint8Array): Promise<void> {
    const bytes = this.assembler.accept(peerId, frame);
    if (!bytes) {
      return;
    }
    const envelope = deserializeEnvelope(new TextDecoder().decode(bytes));
    if (isEnvelopeExpired(envelope, this.now()) || envelope.hopCount > envelope.maxHops) {
      return;
    }
    if (!(await this.deduplicator.checkAndMark(envelope.messageId))) {
      return;
    }
    await this.queue.enqueue(envelope);
    this.queuedMessageCount = await this.queue.size();
    for (const listener of this.listeners) {
      listener({ ...envelope });
    }
    if (canForwardEnvelope(envelope, this.now())) {
      const forwarded = incrementEnvelopeHop(envelope, this.now());
      if (forwarded) {
        await this.broadcast(forwarded, peerId);
      }
    }
  }

  private async broadcast(envelope: MeshEnvelope<unknown>, exceptPeerId?: string): Promise<number> {
    const payload = new TextEncoder().encode(serializeEnvelope(envelope));
    let sent = 0;
    for (const [peerId, frameBytes] of this.connectedFrameBytes) {
      if (peerId === exceptPeerId) {
        continue;
      }
      for (const frame of frameBlePayload(payload, frameBytes)) {
        await this.radio.writeFrame(peerId, RESQNET_BLE_INBOUND_UUID, frame);
      }
      sent += 1;
    }
    return sent;
  }

  private async flushQueueToPeer(peerId: string): Promise<void> {
    const frameBytes = this.connectedFrameBytes.get(peerId);
    if (!frameBytes) {
      return;
    }
    for (const envelope of await this.queue.getAll()) {
      const forwarded = incrementEnvelopeHop(envelope, this.now());
      if (!forwarded) {
        continue;
      }
      const payload = new TextEncoder().encode(serializeEnvelope(forwarded));
      for (const frame of frameBlePayload(payload, frameBytes)) {
        await this.radio.writeFrame(peerId, RESQNET_BLE_INBOUND_UUID, frame);
      }
    }
  }

  private recordError(error: unknown): void {
    this.lastTransportError = error instanceof Error ? error.message : 'Unknown native BLE error.';
    console.error(`[ResQNet BLE] ${this.lastTransportError}`);
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('NativeBleMeshTransport.init() must complete before use.');
    }
  }
}
