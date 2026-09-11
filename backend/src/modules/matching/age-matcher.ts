/**
 * RESQNET — Age Matcher
 * Compares age/approximateAge between target and candidate.
 */

interface MatchResult {
  score: number;
  reasons: string[];
  warnings: string[];
}

/**
 * Compare ages and return a normalized score.
 * Handles both exact age and approximate age fields.
 */
export function matchAge(
  targetAge?: number,
  targetApproxAge?: number,
  candidateAge?: number,
  candidateApproxAge?: number
): MatchResult {
  const result: MatchResult = { score: 0, reasons: [], warnings: [] };

  const age1 = targetAge ?? targetApproxAge;
  const age2 = candidateAge ?? candidateApproxAge;

  // Handle missing age data
  if (age1 == null || age2 == null) {
    result.score = 50; // Neutral
    result.warnings.push('⚠ Age comparison unavailable (missing data)');
    return result;
  }

  // Validate age ranges
  if (age1 < 0 || age1 > 150 || age2 < 0 || age2 > 150) {
    result.score = 50;
    result.warnings.push('⚠ Age value out of expected range');
    return result;
  }

  const diff = Math.abs(age1 - age2);
  const isApproximate = (targetApproxAge != null && targetAge == null) ||
                        (candidateApproxAge != null && candidateAge == null);

  // Score based on age difference
  if (diff === 0) {
    result.score = 100;
    result.reasons.push(`✓ Exact age match: ${age1} years`);
  } else if (diff === 1) {
    result.score = 95;
    result.reasons.push(`✓ Age difference is within 1 year (${age1} vs ${age2})`);
  } else if (diff <= 2) {
    result.score = 85;
    result.reasons.push(`✓ Age difference is within 2 years (${age1} vs ${age2})`);
  } else if (diff <= 3) {
    result.score = 75;
    result.reasons.push(`○ Age difference is ${diff} years (${age1} vs ${age2})`);
  } else if (diff <= 5) {
    result.score = 60;
    result.reasons.push(`○ Moderate age difference: ${diff} years (${age1} vs ${age2})`);
  } else if (diff <= 10) {
    result.score = 30;
    result.reasons.push(`△ Significant age difference: ${diff} years (${age1} vs ${age2})`);
  } else {
    result.score = 10;
    result.reasons.push(`✗ Large age difference: ${diff} years (${age1} vs ${age2})`);
  }

  // If approximate age was used, add leniency and note
  if (isApproximate) {
    result.score = Math.min(100, result.score + 5);
    result.warnings.push('⚠ Age comparison uses approximate/estimated age');
  }

  return result;
}
