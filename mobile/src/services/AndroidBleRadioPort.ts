import { PermissionsAndroid, Platform, type Permission } from 'react-native';

import type {
  BleAdvertisingConfig,
  BleConnectionEvent,
  BleFrameEvent,
  BlePeerEvent,
  BlePermissionState,
  BleRadioCapabilities,
  BleRadioErrorEvent,
  BleRadioPort,
} from '../../../mesh/native/BleRadioPort';
import ResQNetBle from '../../modules/resqnet-ble';

const LEGACY_LOCATION_PERMISSION = 'android.permission.ACCESS_FINE_LOCATION' as Permission;
const MODERN_PERMISSIONS = [
  'android.permission.BLUETOOTH_SCAN',
  'android.permission.BLUETOOTH_CONNECT',
  'android.permission.BLUETOOTH_ADVERTISE',
] as Permission[];

function numberValue(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export class AndroidBleRadioPort implements BleRadioPort {
  static isAvailable(): boolean {
    return Platform.OS === 'android' && ResQNetBle !== null;
  }

  async getPermissionState(): Promise<BlePermissionState> {
    if (!AndroidBleRadioPort.isAvailable() || !ResQNetBle) return 'UNSUPPORTED';
    const status = await ResQNetBle.getStatus();
    if (!status.supported) return 'UNSUPPORTED';

    const permissions = status.sdkInt >= 31 ? MODERN_PERMISSIONS : [LEGACY_LOCATION_PERMISSION];
    const grants = await Promise.all(permissions.map((permission) => PermissionsAndroid.check(permission)));
    if (!grants.every(Boolean)) return 'NOT_DETERMINED';
    if (!status.enabled) return 'BLUETOOTH_OFF';
    if (status.sdkInt <= 30 && !status.locationEnabled) return 'LOCATION_OFF_LEGACY_ANDROID';
    return 'GRANTED';
  }

  async requestPermissions(): Promise<BlePermissionState> {
    if (!AndroidBleRadioPort.isAvailable() || !ResQNetBle) return 'UNSUPPORTED';
    const status = await ResQNetBle.getStatus();
    if (!status.supported) return 'UNSUPPORTED';
    const permissions = status.sdkInt >= 31 ? MODERN_PERMISSIONS : [LEGACY_LOCATION_PERMISSION];
    const result = await PermissionsAndroid.requestMultiple(permissions);
    if (!permissions.every((permission) => result[permission] === PermissionsAndroid.RESULTS.GRANTED)) {
      return 'DENIED';
    }
    return this.getPermissionState();
  }

  async getCapabilities(): Promise<BleRadioCapabilities> {
    if (!AndroidBleRadioPort.isAvailable() || !ResQNetBle) {
      return { canScan: false, canAdvertise: false, canGattClient: false, canGattServer: false };
    }
    const status = await ResQNetBle.getStatus();
    return {
      canScan: status.canScan,
      canAdvertise: status.canAdvertise,
      canGattClient: status.canGattClient,
      canGattServer: status.canGattServer,
    };
  }

  async startAdvertising(config: BleAdvertisingConfig): Promise<void> {
    if (!ResQNetBle) throw new Error('ResQNet Android BLE module is unavailable.');
    await ResQNetBle.startAdvertising({ ...config });
  }

  async startScanning(serviceUuid: string): Promise<void> {
    if (!ResQNetBle) throw new Error('ResQNet Android BLE module is unavailable.');
    await ResQNetBle.startScanning(serviceUuid);
  }

  async stop(): Promise<void> {
    await ResQNetBle?.stop();
  }

  async connect(peerId: string): Promise<void> {
    if (!ResQNetBle) throw new Error('ResQNet Android BLE module is unavailable.');
    await ResQNetBle.connect(peerId);
  }

  async disconnect(peerId: string): Promise<void> {
    await ResQNetBle?.disconnect(peerId);
  }

  async writeFrame(peerId: string, characteristicUuid: string, frame: Uint8Array): Promise<void> {
    if (!ResQNetBle) throw new Error('ResQNet Android BLE module is unavailable.');
    await ResQNetBle.writeFrame(peerId, characteristicUuid, Array.from(frame));
  }

  onPeerFound(callback: (event: BlePeerEvent) => void): () => void {
    if (!ResQNetBle) return () => undefined;
    const subscription = ResQNetBle.addListener('onPeerFound', (event) => callback({
      peerId: stringValue(event.peerId),
      lastSeenAt: numberValue(event.lastSeenAt, Date.now()),
      rssi: typeof event.rssi === 'number' ? numberValue(event.rssi, -127) : undefined,
    }));
    return () => subscription.remove();
  }

  onConnectionChanged(callback: (event: BleConnectionEvent) => void): () => void {
    if (!ResQNetBle) return () => undefined;
    const subscription = ResQNetBle.addListener('onConnectionChanged', (event) => callback({
      peerId: stringValue(event.peerId),
      connected: event.connected === true,
      negotiatedFrameBytes: numberValue(event.negotiatedFrameBytes, 20),
    }));
    return () => subscription.remove();
  }

  onFrameReceived(callback: (event: BleFrameEvent) => void): () => void {
    if (!ResQNetBle) return () => undefined;
    const subscription = ResQNetBle.addListener('onFrameReceived', (event) => callback({
      peerId: stringValue(event.peerId),
      frame: new Uint8Array(Array.isArray(event.frame) ? event.frame.map((item) => numberValue(item, 0)) : []),
    }));
    return () => subscription.remove();
  }

  onRadioStateChanged(callback: () => void): () => void {
    if (!ResQNetBle) return () => undefined;
    const subscription = ResQNetBle.addListener('onRadioStateChanged', callback);
    return () => subscription.remove();
  }

  onRadioError(callback: (event: BleRadioErrorEvent) => void): () => void {
    if (!ResQNetBle) return () => undefined;
    const subscription = ResQNetBle.addListener('onRadioError', (event) => callback({
      operation: stringValue(event.operation) || 'native BLE',
      message: stringValue(event.message) || 'Unknown native BLE error.',
    }));
    return () => subscription.remove();
  }
}
