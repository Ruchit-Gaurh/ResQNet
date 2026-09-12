/**
 * Native Android BLE boundary for ResQNet.
 *
 * The shape follows the useful low-level separation in ProtestChat's MIT-licensed
 * ble-mesh module: native code is an opaque byte pipe; disaster envelopes,
 * persistence, TTL and deduplication stay in the TypeScript mesh layer.
 * This file contains no chat/product code and does not claim BLE is available in Expo Go.
 */

export const RESQNET_BLE_SERVICE_UUID = '52E35100-6E65-4E65-7449-64656E746974';
export const RESQNET_BLE_INBOUND_UUID = '52E35101-6E65-4E65-7449-64656E746974';
export const RESQNET_BLE_OUTBOUND_UUID = '52E35102-6E65-4E65-7449-64656E746974';
export const BLE_FRAME_HEADER_BYTES = 8;
export const BLE_FRAME_VERSION = 1;
export const DEFAULT_ADVERTISEMENT_ROTATION_MS = 15 * 60 * 1000;
export const MAX_BLE_ENVELOPE_BYTES = 48 * 1024;
export const DEFAULT_INCOMPLETE_FRAME_TIMEOUT_MS = 30 * 1000;

export const ANDROID_BLE_RUNTIME_PERMISSIONS = [
  'android.permission.BLUETOOTH_SCAN',
  'android.permission.BLUETOOTH_ADVERTISE',
  'android.permission.BLUETOOTH_CONNECT',
] as const;

export type BlePermissionState =
  | 'GRANTED'
  | 'NOT_DETERMINED'
  | 'DENIED'
  | 'BLUETOOTH_OFF'
  | 'LOCATION_OFF_LEGACY_ANDROID'
  | 'UNSUPPORTED';

export interface BleRadioCapabilities {
  canScan: boolean;
  canAdvertise: boolean;
  canGattClient: boolean;
  canGattServer: boolean;
}

export interface BleRadioStatus extends BleRadioCapabilities {
  permissionState: BlePermissionState;
  bluetoothEnabled: boolean;
}

export interface BlePeerEvent {
  peerId: string;
  lastSeenAt: number;
  /** Received signal strength from Android scanning. Proximity evidence only. */
  rssi?: number;
}

export interface BleConnectionEvent {
  peerId: string;
  connected: boolean;
  negotiatedFrameBytes: number;
}

export interface BleFrameEvent {
  peerId: string;
  frame: Uint8Array;
}

export interface BleRadioErrorEvent {
  operation: string;
  message: string;
}

export interface BleAdvertisingConfig {
  serviceUuid: string;
  inboundCharacteristicUuid: string;
  outboundCharacteristicUuid: string;
  rotationMs: number;
  /** Stable pseudonymous node tag only. Never advertise names, case IDs, or other PII. */
  ephemeralTag: string;
}

/**
 * A platform driver implements this port in an Expo development build or native
 * React Native app. Android implementation requirements:
 * - API 31+: request SCAN, ADVERTISE and CONNECT at runtime.
 * - API <=30: request fine location and require Location Services for scanning.
 * - advertise only service UUID + stable pseudonymous node tag; never report/person data.
 * - host a GATT server (inbound write + outbound notify) while also scanning as central.
 * - close every BluetoothGatt on disconnect/error and stop radio work on shutdown.
 */
export interface BleRadioPort {
  getPermissionState(): Promise<BlePermissionState>;
  requestPermissions(): Promise<BlePermissionState>;
  getCapabilities(): Promise<BleRadioCapabilities>;
  startAdvertising(config: BleAdvertisingConfig): Promise<void>;
  startScanning(serviceUuid: string): Promise<void>;
  stop(): Promise<void>;
  connect(peerId: string): Promise<void>;
  disconnect(peerId: string): Promise<void>;
  writeFrame(peerId: string, characteristicUuid: string, frame: Uint8Array): Promise<void>;
  onPeerFound(callback: (event: BlePeerEvent) => void): () => void;
  onConnectionChanged(callback: (event: BleConnectionEvent) => void): () => void;
  onFrameReceived(callback: (event: BleFrameEvent) => void): () => void;
  onRadioStateChanged?(callback: () => void): () => void;
  onRadioError?(callback: (event: BleRadioErrorEvent) => void): () => void;
}

function messageToken(bytes: Uint8Array): number {
  let hash = 0x811c9dc5;
  for (const byte of bytes) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function frameBlePayload(payload: Uint8Array, maxFrameBytes: number): Uint8Array[] {
  if (payload.byteLength === 0) {
    throw new Error('BLE payload must not be empty.');
  }
  if (payload.byteLength > MAX_BLE_ENVELOPE_BYTES) {
    throw new Error(`BLE payload exceeds ${MAX_BLE_ENVELOPE_BYTES} bytes.`);
  }
  const chunkBytes = maxFrameBytes - BLE_FRAME_HEADER_BYTES;
  if (chunkBytes < 1) {
    throw new Error('Negotiated BLE frame size is too small.');
  }
  const count = Math.ceil(payload.byteLength / chunkBytes);
  if (count > 255) {
    throw new Error('BLE payload requires more than 255 chunks.');
  }
  const token = messageToken(payload);
  const frames: Uint8Array[] = [];
  for (let index = 0; index < count; index += 1) {
    const slice = payload.slice(index * chunkBytes, Math.min((index + 1) * chunkBytes, payload.length));
    const frame = new Uint8Array(BLE_FRAME_HEADER_BYTES + slice.length);
    const view = new DataView(frame.buffer);
    view.setUint8(0, BLE_FRAME_VERSION);
    view.setUint8(1, index === count - 1 ? 1 : 0);
    view.setUint32(2, token);
    view.setUint8(6, index);
    view.setUint8(7, count);
    frame.set(slice, BLE_FRAME_HEADER_BYTES);
    frames.push(frame);
  }
  return frames;
}

interface PartialPayload {
  chunks: Array<Uint8Array | undefined>;
  received: number;
  updatedAt: number;
}

export class BleFrameAssembler {
  private readonly partial = new Map<string, PartialPayload>();

  constructor(
    private readonly now: () => number = Date.now,
    private readonly incompleteTimeoutMs = DEFAULT_INCOMPLETE_FRAME_TIMEOUT_MS,
  ) {
    if (incompleteTimeoutMs < 1) {
      throw new Error('BLE incomplete-frame timeout must be positive.');
    }
  }

  accept(peerId: string, frame: Uint8Array): Uint8Array | undefined {
    this.purgeExpired();
    if (frame.byteLength <= BLE_FRAME_HEADER_BYTES) {
      throw new Error('BLE frame has no payload.');
    }
    const view = new DataView(frame.buffer, frame.byteOffset, frame.byteLength);
    if (view.getUint8(0) !== BLE_FRAME_VERSION) {
      throw new Error('Unsupported BLE frame version.');
    }
    const token = view.getUint32(2);
    const index = view.getUint8(6);
    const count = view.getUint8(7);
    if (count < 1 || index >= count) {
      throw new Error('BLE frame has invalid chunk metadata.');
    }
    const key = `${peerId}:${token}`;
    let current = this.partial.get(key);
    if (!current || current.chunks.length !== count) {
      current = { chunks: Array.from({ length: count }), received: 0, updatedAt: this.now() };
      this.partial.set(key, current);
    }
    current.updatedAt = this.now();
    if (!current.chunks[index]) {
      current.chunks[index] = frame.slice(BLE_FRAME_HEADER_BYTES);
      current.received += 1;
    }
    if (current.received !== count) {
      return undefined;
    }
    this.partial.delete(key);
    const chunks = current.chunks as Uint8Array[];
    const size = chunks.reduce((total, chunk) => total + chunk.length, 0);
    const payload = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      payload.set(chunk, offset);
      offset += chunk.length;
    }
    if (messageToken(payload) !== token) {
      throw new Error('BLE payload integrity check failed.');
    }
    return payload;
  }

  purgeExpired(): number {
    const cutoff = this.now() - this.incompleteTimeoutMs;
    let removed = 0;
    for (const [key, value] of this.partial) {
      if (value.updatedAt <= cutoff) {
        this.partial.delete(key);
        removed += 1;
      }
    }
    return removed;
  }

  getPendingTransferCount(): number {
    return this.partial.size;
  }

  clearPeer(peerId: string): void {
    for (const key of this.partial.keys()) {
      if (key.startsWith(`${peerId}:`)) {
        this.partial.delete(key);
      }
    }
  }

  clear(): void {
    this.partial.clear();
  }
}
