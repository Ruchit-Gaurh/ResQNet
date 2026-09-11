/**
 * RESQNET — Name Matcher
 * Fuzzy and phonetic name comparison.
 * Handles: exact, partial, initials, phonetic similarity.
 */

import * as fuzzball from 'fuzzball';

// double-metaphone is ESM-only; we use a simple phonetic fallback
// that works with CommonJS. The logic below implements a basic
// Double Metaphone approximation for Indian/English names.

interface MatchResult {
  score: number;
  reasons: string[];
  warnings: string[];
}

/**
 * Simple phonetic encoding for name comparison.
 * Maps common phonetic equivalences in Indian/English names.
 */
function phoneticEncode(name: string): string {
  let encoded = name.toLowerCase().trim();
  // Common Indian name phonetic equivalences
  encoded = encoded.replace(/ph/g, 'f');
  encoded = encoded.replace(/gh/g, 'g');
  encoded = encoded.replace(/kh/g, 'k');
  encoded = encoded.replace(/th/g, 't');
  encoded = encoded.replace(/sh/g, 's');
  encoded = encoded.replace(/ch/g, 'c');
  encoded = encoded.replace(/ee/g, 'i');
  encoded = encoded.replace(/oo/g, 'u');
  encoded = encoded.replace(/aa/g, 'a');
  // Remove double letters
  encoded = encoded.replace(/(.)\1+/g, '$1');
  // Remove trailing vowels (common in transliteration variants)
  encoded = encoded.replace(/[aeiou]$/g, '');
  // Remove silent h
  encoded = encoded.replace(/h/g, '');
  return encoded;
}

function phoneticSimilarity(name1: string, name2: string): number {
  const enc1 = phoneticEncode(name1);
  const enc2 = phoneticEncode(name2);
  if (enc1 === enc2) return 100;
  return fuzzball.ratio(enc1, enc2);
}

/**
 * Normalize a name for comparison.
 * Handles initials like "R. Sharma" vs "Rahul Sharma".
 */
function normalizeName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s]/g, ''); // Remove punctuation
}

/**
 * Check if one name could be an initial of another.
 * E.g., "R. Sharma" matches "Rahul Sharma"
 */
function checkInitialMatch(name1: string, name2: string): { isMatch: boolean; confidence: number } {
  const parts1 = name1.trim().split(/\s+/);
  const parts2 = name2.trim().split(/\s+/);

  // Check if any part is a single letter (initial)
  let initialsMatch = 0;
  let totalParts = Math.max(parts1.length, parts2.length);

  for (let i = 0; i < Math.min(parts1.length, parts2.length); i++) {
    const p1 = parts1[i].replace(/\./g, '').toLowerCase();
    const p2 = parts2[i].replace(/\./g, '').toLowerCase();

    if (p1.length === 1 || p2.length === 1) {
      // One is an initial
      if (p1[0] === p2[0]) {
        initialsMatch++;
      }
    } else if (p1 === p2) {
      initialsMatch++;
    }
  }

  if (initialsMatch > 0) {
    return { isMatch: true, confidence: (initialsMatch / totalParts) * 80 };
  }

  return { isMatch: false, confidence: 0 };
}

/**
 * Compare two names and return a normalized match score.
 */
export function matchNames(name1?: string, name2?: string): MatchResult {
  const result: MatchResult = { score: 0, reasons: [], warnings: [] };

  // Handle missing names
  if (!name1 || !name2) {
    result.score = 50; // Neutral — don't penalize or reward
    result.warnings.push('⚠ Name comparison unavailable (missing data)');
    return result;
  }

  // Handle UNKNOWN/placeholder names
  const unknownPatterns = ['unknown', 'unknown person', 'unidentified', 'n/a', 'na'];
  if (unknownPatterns.includes(name1.toLowerCase().trim()) ||
      unknownPatterns.includes(name2.toLowerCase().trim())) {
    result.score = 50;
    result.warnings.push('⚠ One or both names are unknown/unidentified');
    return result;
  }

  const norm1 = normalizeName(name1);
  const norm2 = normalizeName(name2);

  // Exact match
  if (norm1 === norm2) {
    result.score = 100;
    result.reasons.push(`✓ Exact name match: "${name1}"`);
    return result;
  }

  // Fuzzy matching scores
  const fuzzyRatio = fuzzball.ratio(norm1, norm2);
  const partialRatio = fuzzball.partial_ratio(norm1, norm2);
  const tokenSortRatio = fuzzball.token_sort_ratio(norm1, norm2);

  // Phonetic similarity
  const phoneticScore = phoneticSimilarity(name1, name2);

  // Initial matching (R. Sharma vs Rahul Sharma)
  const initialCheck = checkInitialMatch(name1, name2);

  // Combine scores — take weighted best
  let combinedScore: number;
  const bestFuzzy = Math.max(fuzzyRatio, partialRatio, tokenSortRatio);

  if (initialCheck.isMatch) {
    combinedScore = Math.max(initialCheck.confidence, bestFuzzy * 0.4 + phoneticScore * 0.6);
    result.reasons.push(`✓ Initial/abbreviated name match detected`);
  } else {
    // Weight: 60% best fuzzy, 40% phonetic
    combinedScore = bestFuzzy * 0.6 + phoneticScore * 0.4;
  }

  result.score = Math.min(100, Math.round(combinedScore));

  // Generate reasons
  if (combinedScore >= 80) {
    result.reasons.push(`✓ High name similarity: "${name1}" vs "${name2}" (${Math.round(combinedScore)}%)`);
    if (phoneticScore >= 80) {
      result.reasons.push(`✓ Names sound phonetically similar`);
    }
  } else if (combinedScore >= 60) {
    result.reasons.push(`○ Moderate name similarity: "${name1}" vs "${name2}" (${Math.round(combinedScore)}%)`);
  } else if (combinedScore >= 40) {
    result.reasons.push(`△ Weak name similarity: "${name1}" vs "${name2}" (${Math.round(combinedScore)}%)`);
  } else {
    result.reasons.push(`✗ Low name similarity: "${name1}" vs "${name2}" (${Math.round(combinedScore)}%)`);
  }

  // Always warn that name similarity is NOT identity verification
  if (combinedScore >= 60) {
    result.warnings.push('⚠ Name similarity is evidence only, not identity verification');
  }

  return result;
}
