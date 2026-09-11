/**
 * RESQNET — Timeline Matcher
 * Compares temporal relationship between missing and found/sighting events.
 * Checks if the timeline is plausible.
 */

interface MatchResult {
  score: number;
  reasons: string[];
  warnings: string[];
}

/**
 * Compare temporal relationship between last known time and found/sighting time.
 * A found/sighting time BEFORE the missing time is implausible.
 * Closer temporal proximity generally produces higher scores.
 */
export function matchTimeline(
  lastKnownTime?: string | Date | null,
  foundOrSightingTime?: string | Date | null
): MatchResult {
  const result: MatchResult = { score: 0, reasons: [], warnings: [] };

  // Handle missing timeline data
  if (!lastKnownTime || !foundOrSightingTime) {
    result.score = 50; // Neutral
    result.warnings.push('⚠ Timeline comparison unavailable (missing data)');
    return result;
  }

  const missingDate = new Date(lastKnownTime);
  const foundDate = new Date(foundOrSightingTime);

  // Validate dates
  if (isNaN(missingDate.getTime()) || isNaN(foundDate.getTime())) {
    result.score = 50;
    result.warnings.push('⚠ Invalid date format in timeline data');
    return result;
  }

  const diffMs = foundDate.getTime() - missingDate.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);

  // Found/sighted BEFORE going missing — implausible
  if (diffHours < -1) {
    result.score = 5;
    result.reasons.push(
      `✗ Implausible timeline: found/sighted ${Math.abs(Math.round(diffHours))} hours BEFORE reported missing`
    );
    result.warnings.push('⚠ Found/sighting timestamp is before missing report — likely different person or data error');
    return result;
  }

  // Small negative window (within 1 hour) — could be reporting delay
  if (diffHours < 0) {
    result.score = 60;
    result.reasons.push('○ Slight timeline overlap — possible reporting delay');
    result.warnings.push('⚠ Minor timestamp discrepancy (within 1 hour)');
    return result;
  }

  // Score based on time elapsed
  if (diffHours <= 2) {
    result.score = 100;
    result.reasons.push(`✓ Timeline is highly plausible: found/sighted ${Math.round(diffHours * 10) / 10} hours after last known`);
  } else if (diffHours <= 6) {
    result.score = 85;
    result.reasons.push(`✓ Timeline is plausible: ${Math.round(diffHours)} hours elapsed`);
  } else if (diffHours <= 24) {
    result.score = 70;
    result.reasons.push(`✓ Timeline is reasonable: ${Math.round(diffHours)} hours elapsed`);
  } else if (diffHours <= 72) {
    result.score = 50;
    result.reasons.push(`○ Moderate time gap: ${Math.round(diffHours / 24)} days elapsed`);
  } else if (diffHours <= 168) {
    result.score = 30;
    result.reasons.push(`△ Significant time gap: ${Math.round(diffHours / 24)} days elapsed`);
  } else {
    result.score = 20;
    result.reasons.push(`△ Large time gap: ${Math.round(diffHours / 24)} days elapsed`);
    result.warnings.push('⚠ Extended time gap may reduce match reliability');
  }

  return result;
}
