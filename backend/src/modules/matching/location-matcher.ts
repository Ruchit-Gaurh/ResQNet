/**
 * RESQNET — Location Matcher
 * Geographic proximity scoring using Haversine distance.
 * Falls back to zone name comparison if coordinates are unavailable.
 */

interface MatchResult {
  score: number;
  reasons: string[];
  warnings: string[];
}

interface GeoLocation {
  lat?: number;
  lng?: number;
  accuracyMeters?: number;
  zone?: string;
}

function hasUsefulCoordinates(location: GeoLocation): location is GeoLocation & { lat: number; lng: number } {
  return (
    Number.isFinite(location.lat) &&
    Number.isFinite(location.lng) &&
    (location.accuracyMeters == null || location.accuracyMeters <= 50_000)
  );
}

/**
 * Calculate Haversine distance between two coordinates in kilometers.
 */
function haversineDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Compare zone names for basic similarity.
 */
function compareZones(zone1: string, zone2: string): number {
  const norm1 = zone1.toLowerCase().trim();
  const norm2 = zone2.toLowerCase().trim();

  if (norm1 === norm2) return 90; // Same zone but no exact coordinates

  // Extract zone letter/number if present (e.g., "Zone A" from "Zone A - Sector 4")
  const zonePattern = /zone\s*([a-z0-9]+)/i;
  const match1 = norm1.match(zonePattern);
  const match2 = norm2.match(zonePattern);

  if (match1 && match2 && match1[1] === match2[1]) {
    return 70; // Same zone designation
  }

  // Check for partial overlap
  const words1 = new Set(norm1.split(/\W+/));
  const words2 = new Set(norm2.split(/\W+/));
  const intersection = [...words1].filter(w => words2.has(w) && w.length > 2);

  if (intersection.length > 0) {
    return 50; // Some location overlap
  }

  return 20; // Different zones
}

/**
 * Compare two locations and return a normalized score.
 */
export function matchLocation(loc1?: GeoLocation | null, loc2?: GeoLocation | null): MatchResult {
  const result: MatchResult = { score: 0, reasons: [], warnings: [] };

  // Handle missing location data
  if (!loc1 || !loc2) {
    result.score = 50; // Neutral
    result.warnings.push('⚠ Location comparison unavailable (missing data)');
    return result;
  }

  // Try coordinate-based comparison first
  if (hasUsefulCoordinates(loc1) && hasUsefulCoordinates(loc2)) {
    const distance = haversineDistance(loc1.lat, loc1.lng, loc2.lat, loc2.lng);
    const distanceRounded = Math.round(distance * 100) / 100;

    if (distance < 0.5) {
      result.score = 100;
      result.reasons.push(`✓ Locations are very close: ${distanceRounded} km apart`);
    } else if (distance < 1) {
      result.score = 90;
      result.reasons.push(`✓ Locations are nearby: ${distanceRounded} km apart`);
    } else if (distance < 2) {
      result.score = 75;
      result.reasons.push(`✓ Locations are within reasonable proximity: ${distanceRounded} km apart`);
    } else if (distance < 5) {
      result.score = 50;
      result.reasons.push(`○ Locations are moderately distant: ${distanceRounded} km apart`);
    } else if (distance < 10) {
      result.score = 25;
      result.reasons.push(`△ Locations are fairly distant: ${distanceRounded} km apart`);
    } else {
      result.score = 10;
      result.reasons.push(`✗ Locations are far apart: ${distanceRounded} km apart`);
    }

    return result;
  }

  // Fallback: zone-based comparison
  if (loc1.zone && loc2.zone) {
    result.score = compareZones(loc1.zone, loc2.zone);
    if (result.score >= 70) {
      result.reasons.push(`✓ Same zone area: "${loc1.zone}" and "${loc2.zone}"`);
    } else if (result.score >= 50) {
      result.reasons.push(`○ Partially overlapping zones: "${loc1.zone}" and "${loc2.zone}"`);
    } else {
      result.reasons.push(`△ Different zones: "${loc1.zone}" and "${loc2.zone}"`);
    }
    result.warnings.push('⚠ Exact coordinates unavailable — zone-based comparison used');
    return result;
  }

  // No usable location data
  result.score = 50;
  result.warnings.push('⚠ Insufficient location data for comparison');
  return result;
}
