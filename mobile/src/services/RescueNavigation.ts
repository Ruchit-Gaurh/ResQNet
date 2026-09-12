import type { GeoLocation } from '../../../shared/types/index';

export interface RescueGuidance {
  arrived: boolean;
  bearing: number;
  direction: string;
  distanceMeters: number;
  relativeBearing: number;
}

export interface BluetoothApproachGuidance {
  label: string;
  detail: string;
  strength: 'NEARBY' | 'STRONG' | 'VERY_STRONG';
}

export interface TimedLocationSample {
  location: GeoLocation;
  observedAt: number;
}

/**
 * BLE RSSI is intentionally presented as coarse proximity, never meters or a
 * direction. Walls, pockets, antennas and the human body can change it sharply.
 */
export function bluetoothApproachGuidance(rssi: number): BluetoothApproachGuidance {
  if (rssi >= -55) {
    return {
      label: 'Target phone signal is very strong',
      detail: 'Move slowly and use the phone alert to pinpoint the person.',
      strength: 'VERY_STRONG',
    };
  }
  if (rssi >= -68) {
    return {
      label: 'Target phone is in close Bluetooth range',
      detail: 'Continue toward the reported point and watch for a stronger signal.',
      strength: 'STRONG',
    };
  }
  return {
    label: 'Target phone detected nearby',
    detail: 'Bluetooth confirms proximity, but cannot provide an exact direction.',
    strength: 'NEARBY',
  };
}

export function isGpsBearingReliable(
  distanceMeters: number,
  currentAccuracyMeters?: number,
  targetAccuracyMeters?: number,
): boolean {
  const currentUncertainty = Number.isFinite(currentAccuracyMeters) ? Math.max(0, currentAccuracyMeters!) : 15;
  const targetUncertainty = Number.isFinite(targetAccuracyMeters) ? Math.max(0, targetAccuracyMeters!) : 15;
  // If the target can plausibly be on either side of the phone, a compass arrow
  // may reverse even though the responder is moving correctly. Hide it until
  // the separation is safely larger than the combined GPS uncertainty.
  // Independent GPS errors combine by root-sum-square, not simple addition.
  // A small margin absorbs normal jitter without hiding useful 10–15 m guidance.
  const combinedUncertainty = Math.hypot(currentUncertainty, targetUncertainty);
  const uncertaintyRadius = Math.max(8, combinedUncertainty * 1.15);
  return distanceMeters >= uncertaintyRadius;
}

function radians(value: number): number {
  return value * Math.PI / 180;
}

function degrees(value: number): number {
  return value * 180 / Math.PI;
}

export function normalizeAngle(value: number): number {
  return ((value + 540) % 360) - 180;
}

export function smoothCircularDegrees(previous: number, next: number, factor = 0.2): number {
  const boundedFactor = Math.max(0, Math.min(1, factor));
  return (previous + normalizeAngle(next - previous) * boundedFactor + 360) % 360;
}

export function unwrapAngleDegrees(previous: number, next: number): number {
  return previous + normalizeAngle(next - previous);
}

export function smoothGeoLocation(
  previous: GeoLocation,
  next: GeoLocation,
  factor = 0.35,
): GeoLocation {
  const boundedFactor = Math.max(0, Math.min(1, factor));
  return {
    lat: previous.lat + (next.lat - previous.lat) * boundedFactor,
    lng: previous.lng + (next.lng - previous.lng) * boundedFactor,
    accuracyMeters: next.accuracyMeters,
  };
}

/**
 * Stabilizes a stationary requester's position from recent Android fixes.
 * Poor outliers are excluded and the result never claims better accuracy than
 * the best value reported by the device hardware.
 */
export function estimatePreciseLocation(
  samples: TimedLocationSample[],
  now: number,
  windowMs = 8_000,
): GeoLocation | undefined {
  const recent = samples.filter((sample) => (
    Number.isFinite(sample.location.lat)
    && Number.isFinite(sample.location.lng)
    && Number.isFinite(sample.observedAt)
    && now - sample.observedAt <= windowMs
  ));
  if (recent.length === 0) return undefined;

  const accuracyOf = (sample: TimedLocationSample) => (
    Number.isFinite(sample.location.accuracyMeters)
      ? Math.max(3, sample.location.accuracyMeters!)
      : 25
  );
  const bestAccuracy = Math.min(...recent.map(accuracyOf));
  const usable = recent.filter((sample) => accuracyOf(sample) <= Math.max(15, bestAccuracy * 1.8));
  let totalWeight = 0;
  let weightedLatitude = 0;
  let weightedLongitude = 0;
  for (const sample of usable) {
    const accuracy = accuracyOf(sample);
    const ageFactor = Math.max(0.35, 1 - Math.max(0, now - sample.observedAt) / windowMs);
    const weight = ageFactor / (accuracy * accuracy);
    totalWeight += weight;
    weightedLatitude += sample.location.lat * weight;
    weightedLongitude += sample.location.lng * weight;
  }
  if (totalWeight === 0) return recent[recent.length - 1]?.location;
  return {
    lat: weightedLatitude / totalWeight,
    lng: weightedLongitude / totalWeight,
    accuracyMeters: bestAccuracy,
  };
}

/** Follow real rescuer movement promptly while damping stationary GPS jitter. */
export function smoothMovingLocation(previous: GeoLocation, next: GeoLocation): GeoLocation {
  const movement = distanceBetweenMeters(previous, next);
  const previousAccuracy = Number.isFinite(previous.accuracyMeters) ? previous.accuracyMeters! : 20;
  const nextAccuracy = Number.isFinite(next.accuracyMeters) ? next.accuracyMeters! : 20;
  if (movement >= Math.max(4, Math.min(15, nextAccuracy * 0.75))) return next;
  return smoothGeoLocation(previous, next, nextAccuracy < previousAccuracy ? 0.65 : 0.3);
}

export function distanceBetweenMeters(from: GeoLocation, to: GeoLocation): number {
  const earthRadius = 6_371_000;
  const latitudeDelta = radians(to.lat - from.lat);
  const longitudeDelta = radians(to.lng - from.lng);
  const a = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(radians(from.lat)) * Math.cos(radians(to.lat)) * Math.sin(longitudeDelta / 2) ** 2;
  return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function bearingBetweenDegrees(from: GeoLocation, to: GeoLocation): number {
  const longitudeDelta = radians(to.lng - from.lng);
  const fromLatitude = radians(from.lat);
  const toLatitude = radians(to.lat);
  const y = Math.sin(longitudeDelta) * Math.cos(toLatitude);
  const x = Math.cos(fromLatitude) * Math.sin(toLatitude)
    - Math.sin(fromLatitude) * Math.cos(toLatitude) * Math.cos(longitudeDelta);
  return (degrees(Math.atan2(y, x)) + 360) % 360;
}

export function directionInstruction(relativeBearing: number, arrived: boolean): string {
  if (arrived) return 'Target area reached';
  const magnitude = Math.abs(relativeBearing);
  if (magnitude <= 18) return 'Continue ahead';
  if (magnitude >= 150) return 'Turn around';
  if (relativeBearing > 0) return magnitude < 70 ? 'Bear right' : 'Turn right';
  return magnitude < 70 ? 'Bear left' : 'Turn left';
}

export function calculateRescueGuidance(
  position: GeoLocation,
  target: GeoLocation,
  heading: number,
): RescueGuidance {
  const distanceMeters = distanceBetweenMeters(position, target);
  const bearing = bearingBetweenDegrees(position, target);
  const relativeBearing = normalizeAngle(bearing - heading);
  // The rescue alert is deliberately restricted to the final approach. GPS
  // accuracy is shown separately so a responder never mistakes uncertainty
  // for confirmed arrival.
  const arrivalRadius = 8;
  const arrived = distanceMeters <= arrivalRadius;
  return {
    arrived,
    bearing,
    direction: directionInstruction(relativeBearing, arrived),
    distanceMeters,
    relativeBearing,
  };
}
