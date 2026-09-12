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
  canForwardEnvelope,
  incrementEnvelopeHop,
  isEnvelopeExpired,
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
  type BlePermissionState,
  type BleRadioPort,
  type BleRadioStatus,
} from './BleRadioPort';
import {
  compareBleInventories,
  deserializeBleWirePacket,
  prepareEnvelopeForBle,
  serializeBleWirePacket,
  type BleWirePacket,
} from './BleWireProtocol';

export interface NativeBleMeshTransportOptions {
  queue?: MessageQueue;
  deduplicator?: Deduplicator;
  gatewayClient?: GatewayClient;
  createEphemeralTag: () => string;
  now?: () => number;
}

export interface NativeBleActivity {
  permissionState: BlePermissionState;
  bluetoothEnabled: boolean;
  radioReady: boolean;
  discoveredPeerIds: string[];
  connectedPeerIds: string[];
  receivedCount: number;
  relayedCount: number;
  peerReceiptCount: number;
  peerSignals: Array<{
    /** Stable ResQNet node identity learned from a directly received envelope. */
    nodeId: string;
    radioPeerId: string;
    rssi: number;
    lastSeenAt: number;
  }>;
  lastActivity?: string;
  lastReceived?: {
    messageId: string;
    messageType: MeshEnvelope<unknown>['messageType'];
    fromNodeId: string;
  };
}

const EMPTY_RADIO_STATUS: BleRadioStatus = {
  permissionState: 'NOT_DETERMINED',
  bluetoothEnabled: false,
  canScan: false,
  canAdvertise: false,
  canGattClient: false,
  canGattServer: false,
};

/**
 * Foreground Android BLE store-carry-forward transport. Native code is kept as
 * a byte radio: queue ordering, TTL, hop limits, deduplication, inventory sync,
 * peer receipts and gateway ACKs remain in this platform-independent layer.
 */
export class NativeBleMeshTransport implements MeshTransportService {
  private readonly queue: MessageQueue;
  private readonly deduplicator: Deduplicator;
  private readonly gatewayClient: GatewayClient;
  private readonly now: () => number;
  private readonly assembler: BleFrameAssembler;
  private readonly peers = new Map<string, MeshPeer>();
  private readonly connectedFrameBytes = new Map<string, number>();
  private readonly radioPeerSignals = new Map<string, { rssi: number; lastSeenAt: number }>();
  private readonly logicalNodeByRadioPeer = new Map<string, string>();
  private readonly listeners = new Set<(envelope: MeshEnvelope<unknown>) => void>();
  private readonly receiptListeners = new Set<(messageId: string) => void>();
  private readonly activityListeners = new Set<(activity: NativeBleActivity) => void>();
  private readonly unsubscribers: Array<() => void> = [];
  private initialized = false;
  private radioReady = false;
  private radioStatus: BleRadioStatus = { ...EMPTY_RADIO_STATUS };
  private internetAcknowledged = false;
  private lastSuccessfulSyncTimestamp: number | undefined;
  private lastTransportError: string | undefined;
  private queuedMessageCount = 0;
  private receivedCount = 0;
  private relayedCount = 0;
  private peerReceiptCount = 0;
  private lastActivity = 'Bluetooth transport has not started.';
  private lastReceived: NativeBleActivity['lastReceived'];

  constructor(
    readonly nodeId: string,
    private readonly radio: BleRadioPort,
    private readonly options: NativeBleMeshTransportOptions,
  ) {
    this.queue = options.queue ?? new MessageQueue();
    this.deduplicator = options.deduplicator ?? new Deduplicator();
    this.gatewayClient = options.gatewayClient ?? new FetchGatewayClient();
    this.now = options.now ?? Date.now;
    this.assembler = new BleFrameAssembler(this.now);
  }

  async init(): Promise<void> {
    if (this.initialized) return;
    await this.queue.init();
    await this.deduplicator.init();
    this.queuedMessageCount = await this.queue.size();

    this.unsubscribers.push(
      this.radio.onPeerFound((event) => {
        this.peers.set(event.peerId, { nodeId: event.peerId, lastSeenAt: event.lastSeenAt });
        if (typeof event.rssi === 'number' && Number.isFinite(event.rssi)) {
          const previous = this.radioPeerSignals.get(event.peerId);
          this.radioPeerSignals.set(event.peerId, {
            // Smooth normal BLE scan noise while retaining useful approach trend.
            rssi: previous ? previous.rssi * 0.7 + event.rssi * 0.3 : event.rssi,
            lastSeenAt: event.lastSeenAt,
          });
        }
        this.lastActivity = `Nearby ResQNet peer ${event.peerId} discovered.`;
        this.emitActivity();
        void this.radio.connect(event.peerId).catch((error: unknown) => this.recordError(error));
      }),
      this.radio.onConnectionChanged((event) => this.handleConnectionChanged(event)),
      this.radio.onFrameReceived((event) => {
        void this.handleFrame(event.peerId, event.frame).catch((error: unknown) => this.recordError(error));
      }),
    );
    if (this.radio.onRadioStateChanged) {
      this.unsubscribers.push(this.radio.onRadioStateChanged(() => {
        void this.refreshRadioState().catch((error: unknown) => this.recordError(error));
      }));
    }
    if (this.radio.onRadioError) {
      this.unsubscribers.push(this.radio.onRadioError((event) => {
        if (event.operation === 'advertising' || event.operation === 'scanning') {
          // Android reports some radio start failures asynchronously. Do not
          // continue presenting the transport as active after either half of
          // discovery has failed; durable reports remain in the shared queue.
          this.radioReady = false;
        }
        this.recordError(new Error(`${event.operation}: ${event.message}`));
      }));
    }

    // Permission denial or a disabled adapter must not block durable local reports.
    this.initialized = true;
    try {
      await this.activateRadio(true);
    } catch (error) {
      this.radioReady = false;
      this.recordError(error);
    }
  }

  async retryRadio(): Promise<void> {
    this.ensureInitialized();
    await this.radio.stop();
    this.connectedFrameBytes.clear();
    this.radioReady = false;
    await this.activateRadio(true);
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
    this.emitActivity();
    if (!isNew) {
      return {
        queuedLocally: queued || (await this.queue.getAll()).some((item) => item.messageId === validated.messageId),
        immediateRelay: false,
      };
    }
    const firstHop = incrementEnvelopeHop(validated, this.now());
    const relayed = firstHop ? await this.broadcastEnvelope(firstHop) : 0;
    if (relayed === 0) {
      this.lastActivity = this.radioReady
        ? 'Report saved locally; waiting for a nearby Bluetooth peer.'
        : 'Report saved locally; Bluetooth transport is unavailable.';
    }
    this.emitActivity();
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

  async removeQueuedMessage(messageId: string): Promise<void> {
    this.ensureInitialized();
    await this.queue.acknowledge(messageId);
    this.queuedMessageCount = await this.queue.size();
    this.emitActivity();
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

  onPeerReceipt(callback: (messageId: string) => void): () => void {
    this.receiptListeners.add(callback);
    return () => this.receiptListeners.delete(callback);
  }

  onActivityChanged(callback: (activity: NativeBleActivity) => void): () => void {
    this.activityListeners.add(callback);
    callback(this.getActivity());
    return () => this.activityListeners.delete(callback);
  }

  getActivity(): NativeBleActivity {
    return {
      permissionState: this.radioStatus.permissionState,
      bluetoothEnabled: this.radioStatus.bluetoothEnabled,
      radioReady: this.radioReady,
      discoveredPeerIds: [...this.peers.keys()],
      connectedPeerIds: [...this.connectedFrameBytes.keys()],
      receivedCount: this.receivedCount,
      relayedCount: this.relayedCount,
      peerReceiptCount: this.peerReceiptCount,
      peerSignals: [...this.radioPeerSignals.entries()].map(([radioPeerId, signal]) => ({
        // Current Android advertisements encode NODE-XXXXXXXX directly. The
        // learned mapping also supports a future rotating radio identifier.
        nodeId: this.logicalNodeByRadioPeer.get(radioPeerId) ?? radioPeerId,
        radioPeerId,
        ...signal,
      })),
      lastActivity: this.lastTransportError ?? this.lastActivity,
      lastReceived: this.lastReceived,
    };
  }

  async syncWithGateway(
    gatewayUrl: string,
    deviceTelemetry?: DevicePresenceTelemetry,
  ): Promise<SyncBatchResponse> {
    this.ensureInitialized();
    // Peer-addressed control messages must remain in the carry queue until the
    // intended phone receives them. A backend ACK must not consume them first.
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
    const sentIds = new Set(outboundEnvelopes.map((item) => item.messageId));
    for (const messageId of response.acknowledgedMessageIds) {
      if (sentIds.has(messageId)) await this.queue.acknowledge(messageId);
    }
    this.queuedMessageCount = await this.queue.size();
    this.lastSuccessfulSyncTimestamp = response.serverTimestamp;
    this.internetAcknowledged = true;
    this.emitActivity();
    return response;
  }

  async shutdown(): Promise<void> {
    for (const unsubscribe of this.unsubscribers.splice(0)) unsubscribe();
    this.peers.clear();
    this.connectedFrameBytes.clear();
    this.radioPeerSignals.clear();
    this.logicalNodeByRadioPeer.clear();
    this.assembler.clear();
    await this.radio.stop();
    this.radioReady = false;
    this.initialized = false;
  }

  getLastTransportError(): string | undefined {
    return this.lastTransportError;
  }

  private async activateRadio(requestWhenNeeded: boolean): Promise<void> {
    let permission = await this.radio.getPermissionState();
    if (requestWhenNeeded && (permission === 'NOT_DETERMINED' || permission === 'DENIED')) {
      permission = await this.radio.requestPermissions();
    }
    const capabilities = await this.radio.getCapabilities();
    this.radioStatus = {
      ...capabilities,
      permissionState: permission,
      bluetoothEnabled: permission !== 'BLUETOOTH_OFF' && permission !== 'UNSUPPORTED',
    };
    if (permission !== 'GRANTED') {
      this.radioReady = false;
      this.lastTransportError = undefined;
      this.lastActivity = this.radioStateMessage(permission);
      this.emitActivity();
      return;
    }
    if (!capabilities.canScan || !capabilities.canAdvertise || !capabilities.canGattClient || !capabilities.canGattServer) {
      this.radioReady = false;
      this.radioStatus.permissionState = 'UNSUPPORTED';
      this.lastActivity = 'This Android device cannot act as both a BLE central and peripheral.';
      this.emitActivity();
      return;
    }
    this.radioReady = false;
    this.lastTransportError = undefined;
    await this.radio.startAdvertising({
      serviceUuid: RESQNET_BLE_SERVICE_UUID,
      inboundCharacteristicUuid: RESQNET_BLE_INBOUND_UUID,
      outboundCharacteristicUuid: RESQNET_BLE_OUTBOUND_UUID,
      rotationMs: DEFAULT_ADVERTISEMENT_ROTATION_MS,
      // The persisted, pseudonymous node ID is encoded into the four-byte BLE
      // tag so this phone and its peers display one consistent device name.
      ephemeralTag: this.nodeId,
    });
    await this.radio.startScanning(RESQNET_BLE_SERVICE_UUID);
    // Advertising/scanning failures can arrive as native events while these
    // start calls are in flight. Preserve that failure instead of overwriting
    // it with an optimistic ready state.
    if (this.lastTransportError) {
      this.emitActivity();
      return;
    }
    this.radioReady = true;
    this.lastActivity = 'Bluetooth mesh active; scanning only for ResQNet peers.';
    this.emitActivity();
  }

  private async refreshRadioState(): Promise<void> {
    const permission = await this.radio.getPermissionState();
    const capabilities = await this.radio.getCapabilities();
    this.radioStatus = {
      ...capabilities,
      permissionState: permission,
      bluetoothEnabled: permission !== 'BLUETOOTH_OFF' && permission !== 'UNSUPPORTED',
    };
    if (permission !== 'GRANTED') {
      this.radioReady = false;
      this.connectedFrameBytes.clear();
      this.lastActivity = this.radioStateMessage(permission);
    } else if (!this.radioReady) {
      await this.activateRadio(false);
    }
    this.emitActivity();
  }

  private radioStateMessage(state: BlePermissionState): string {
    switch (state) {
      case 'DENIED': return 'Nearby devices permission denied. Reports remain safely queued.';
      case 'BLUETOOTH_OFF': return 'Bluetooth is off. Reports remain safely queued.';
      case 'LOCATION_OFF_LEGACY_ANDROID': return 'Location services are required for BLE scanning on this Android version.';
      case 'UNSUPPORTED': return 'BLE central/peripheral mode is not supported on this device.';
      default: return 'Bluetooth permission is required before nearby relay can start.';
    }
  }

  private handleConnectionChanged(event: BleConnectionEvent): void {
    if (event.connected) {
      this.connectedFrameBytes.set(event.peerId, Math.max(event.negotiatedFrameBytes, 20));
      this.peers.set(event.peerId, { nodeId: event.peerId, lastSeenAt: this.now() });
      this.lastActivity = `Connected to ResQNet peer ${event.peerId}; comparing message inventories.`;
      void this.sendInventory(event.peerId).catch((error: unknown) => this.recordError(error));
    } else {
      this.connectedFrameBytes.delete(event.peerId);
      this.assembler.clearPeer(event.peerId);
      this.lastActivity = `Bluetooth peer ${event.peerId} disconnected; unacknowledged reports remain queued.`;
    }
    this.emitActivity();
  }

  private async handleFrame(peerId: string, frame: Uint8Array): Promise<void> {
    const bytes = this.assembler.accept(peerId, frame);
    if (!bytes) return;
    const packet = deserializeBleWirePacket(bytes);
    switch (packet.kind) {
      case 'INVENTORY': {
        const queued = await this.queue.getAll();
        const byId = new Map(queued.map((item) => [item.messageId, item]));
        const comparison = compareBleInventories([...byId.keys()], packet.messageIds);
        if (comparison.requestFromPeer.length > 0) {
          await this.sendPacket(peerId, { kind: 'REQUEST', messageIds: comparison.requestFromPeer });
        }
        for (const messageId of comparison.sendToPeer) {
          const envelope = byId.get(messageId);
          const forwarded = envelope ? incrementEnvelopeHop(envelope, this.now()) : null;
          if (forwarded) await this.sendEnvelopeToPeer(peerId, forwarded);
        }
        return;
      }
      case 'REQUEST': {
        const byId = new Map((await this.queue.getAll()).map((item) => [item.messageId, item]));
        for (const messageId of packet.messageIds) {
          const envelope = byId.get(messageId);
          const forwarded = envelope ? incrementEnvelopeHop(envelope, this.now()) : null;
          if (forwarded) await this.sendEnvelopeToPeer(peerId, forwarded);
        }
        return;
      }
      case 'RECEIPT': {
        this.peerReceiptCount += 1;
        const queued = (await this.queue.getAll()).find((item) => item.messageId === packet.messageId);
        const reachedDestination = queued?.destinationType === 'SPECIFIC_NODE'
          && queued.destinationId === peerId;
        if (reachedDestination) await this.queue.acknowledge(packet.messageId);
        this.queuedMessageCount = await this.queue.size();
        this.lastActivity = reachedDestination
          ? `Target phone received ${packet.messageId}.`
          : `Nearby peer received ${packet.messageId}; waiting for gateway ACK.`;
        for (const listener of this.receiptListeners) listener(packet.messageId);
        this.emitActivity();
        return;
      }
      case 'ENVELOPE':
        await this.acceptEnvelope(peerId, packet.envelope);
    }
  }

  private async acceptEnvelope(peerId: string, envelope: MeshEnvelope<unknown>): Promise<void> {
    if (isEnvelopeExpired(envelope, this.now()) || envelope.hopCount > envelope.maxHops) return;
    // Android advertisements carry a compact radio identifier. A directly
    // received envelope lets us associate it with the sender's stable logical
    // node ID, which is required to identify the correct rescue target signal.
    const logicalNodeId = envelope.senderPseudonym.startsWith('MOBILE-')
      ? envelope.senderPseudonym.slice('MOBILE-'.length)
      : undefined;
    if (logicalNodeId && /^NODE-[A-F0-9]{8}$/.test(logicalNodeId)) {
      this.logicalNodeByRadioPeer.set(peerId, logicalNodeId);
    }
    const isNew = await this.deduplicator.checkAndMark(envelope.messageId);
    await this.sendPacket(peerId, { kind: 'RECEIPT', messageId: envelope.messageId });
    if (!isNew) return;

    const reachedDestination = envelope.destinationType === 'SPECIFIC_NODE'
      && envelope.destinationId === this.nodeId;
    if (!reachedDestination) await this.queue.enqueue(envelope);
    this.queuedMessageCount = await this.queue.size();
    this.receivedCount += 1;
    this.lastReceived = {
      messageId: envelope.messageId,
      messageType: envelope.messageType,
      fromNodeId: peerId,
    };
    this.lastActivity = `Received ${envelope.messageType} ${envelope.messageId} from ${peerId}.`;
    for (const listener of this.listeners) listener({ ...envelope });
    this.emitActivity();

    if (!reachedDestination && canForwardEnvelope(envelope, this.now())) {
      const forwarded = incrementEnvelopeHop(envelope, this.now());
      if (forwarded) await this.broadcastEnvelope(forwarded, peerId);
    }
  }

  private async sendInventory(peerId: string): Promise<void> {
    const ids = (await this.queue.getAll()).map((item) => item.messageId).slice(0, 256);
    await this.sendPacket(peerId, { kind: 'INVENTORY', messageIds: ids });
  }

  private async broadcastEnvelope(envelope: MeshEnvelope<unknown>, exceptPeerId?: string): Promise<number> {
    let sent = 0;
    for (const peerId of this.connectedFrameBytes.keys()) {
      if (peerId === exceptPeerId) continue;
      await this.sendEnvelopeToPeer(peerId, envelope);
      sent += 1;
    }
    return sent;
  }

  private async sendEnvelopeToPeer(peerId: string, envelope: MeshEnvelope<unknown>): Promise<void> {
    await this.sendPacket(peerId, { kind: 'ENVELOPE', envelope: prepareEnvelopeForBle(envelope) });
    this.relayedCount += 1;
    this.lastActivity = `Relayed ${envelope.messageType} ${envelope.messageId} to ${peerId}; waiting for receipt.`;
    this.emitActivity();
  }

  private async sendPacket(peerId: string, packet: BleWirePacket): Promise<void> {
    const frameBytes = this.connectedFrameBytes.get(peerId);
    if (!frameBytes) throw new Error(`Bluetooth peer ${peerId} is no longer connected.`);
    for (const frame of frameBlePayload(serializeBleWirePacket(packet), frameBytes)) {
      await this.radio.writeFrame(peerId, RESQNET_BLE_INBOUND_UUID, frame);
    }
  }

  private recordError(error: unknown): void {
    this.lastTransportError = error instanceof Error ? error.message : 'Unknown native BLE error.';
    console.error(`[ResQNet BLE] ${this.lastTransportError}`);
    this.emitActivity();
  }

  private emitActivity(): void {
    const activity = this.getActivity();
    for (const listener of this.activityListeners) listener(activity);
  }

  private ensureInitialized(): void {
    if (!this.initialized) throw new Error('NativeBleMeshTransport.init() must complete before use.');
  }
}
