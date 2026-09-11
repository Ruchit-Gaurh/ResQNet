import { requireOptionalNativeModule } from 'expo-modules-core';

export interface ResQNetBleStatus {
  sdkInt: number;
  supported: boolean;
  enabled: boolean;
  locationEnabled: boolean;
  canScan: boolean;
  canAdvertise: boolean;
  canGattClient: boolean;
  canGattServer: boolean;
}

export interface NativeEventSubscription {
  remove(): void;
}

export interface ResQNetBleNativeModule {
  getStatus(): Promise<ResQNetBleStatus>;
  startAdvertising(config: Record<string, string | number>): Promise<void>;
  startScanning(serviceUuid: string): Promise<void>;
  stop(): Promise<void>;
  connect(peerId: string): Promise<void>;
  disconnect(peerId: string): Promise<void>;
  writeFrame(peerId: string, characteristicUuid: string, frame: number[]): Promise<void>;
  playEmergencyAlert(): Promise<void>;
  stopEmergencyAlert(): Promise<void>;
  addListener(eventName: string, callback: (event: Record<string, unknown>) => void): NativeEventSubscription;
}

export default requireOptionalNativeModule<ResQNetBleNativeModule>('ResQNetBle');
