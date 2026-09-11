import type { GeoLocation } from '../../../shared/types/index';

export interface RescueGuidance {
  arrived: boolean;
  bearing: number;
  direction: string;
  distanceMeters: number;
  relativeBearing: number;
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
