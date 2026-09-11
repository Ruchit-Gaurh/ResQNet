import * as Location from 'expo-location';

import type { DevicePresenceTelemetry, GeoLocation } from '../../../shared/types/index';
import type { MobileMeshActivity, MobileMeshMode } from './createMobileServices';

const LOCATION_REFRESH_MS = 30_000;

function roundedCoordinate(value: number): number {
  // About 11 metres at the equator: useful for response coordination without
  // broadcasting raw sensor precision through every relay.
  return Math.round(value * 10_000) / 10_000;
}

export class DevicePresenceService {
  private location?: GeoLocation;
  private locationObservedAt?: number;
  private permission: DevicePresenceTelemetry['locationPermission'] = 'UNAVAILABLE';
  private lastLocationAttemptAt = 0;
  private refreshInFlight?: Promise<void>;

  constructor(
    private readonly nodeId: string,
    private readonly transportMode: MobileMeshMode,
    private readonly now: () => number = Date.now,
  ) {}

  get displayName(): string {
    const suffix = this.nodeId.replace(/[^a-zA-Z0-9]/g, '').slice(-6).toUpperCase();
    return `ResQNet-${suffix || 'DEVICE'}`;
  }

  async refreshLocation(force = false): Promise<void> {
    const timestamp = this.now();
    if (!force && timestamp - this.lastLocationAttemptAt < LOCATION_REFRESH_MS) return;
    if (this.refreshInFlight) return this.refreshInFlight;

    this.lastLocationAttemptAt = timestamp;
    this.refreshInFlight = this.readLocation().finally(() => {
      this.refreshInFlight = undefined;
    });
    return this.refreshInFlight;
  }

  snapshot(activity: MobileMeshActivity): DevicePresenceTelemetry {
    return {
      nodeId: this.nodeId,
      displayName: this.displayName,
      observedAt: this.now(),
      location: this.location,
      locationObservedAt: this.locationObservedAt,
      locationPermission: this.permission,
      transportMode: this.transportMode,
      nearbyPeerIds: [...new Set([
        ...(activity.discoveredPeerIds ?? []),
        ...activity.connectedPeerIds,
      ])],
      queuedMessageCount: activity.queuedCount,
    };
  }

  private async readLocation(): Promise<void> {
    try {
      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) {
        this.permission = 'UNAVAILABLE';
        return;
      }

      let permission = await Location.getForegroundPermissionsAsync();
      if (!permission.granted && permission.canAskAgain) {
        permission = await Location.requestForegroundPermissionsAsync();
      }
      if (!permission.granted) {
        this.permission = 'DENIED';
        return;
      }

      this.permission = 'GRANTED';
      const lastKnown = await Location.getLastKnownPositionAsync({
        maxAge: 5 * 60_000,
        requiredAccuracy: 1_000,
      });
      const position = lastKnown ?? await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        new Promise<never>((_resolve, reject) => {
          setTimeout(() => reject(new Error('Location lookup timed out.')), 8_000);
        }),
      ]);
      this.location = {
        lat: roundedCoordinate(position.coords.latitude),
        lng: roundedCoordinate(position.coords.longitude),
        accuracyMeters: Math.max(position.coords.accuracy ?? 0, 10),
      };
      this.locationObservedAt = position.timestamp;
    } catch (error) {
      console.warn('Device presence location unavailable; reporting remains operational.', error);
      this.permission = this.permission === 'DENIED' ? 'DENIED' : 'UNAVAILABLE';
    }
  }
}
