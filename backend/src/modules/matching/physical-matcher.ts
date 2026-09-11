/**
 * RESQNET — Physical / Clothing Matcher
 * Compares physical attributes and clothing descriptions.
 */

import * as fuzzball from 'fuzzball';

interface MatchResult {
  score: number;
  reasons: string[];
  warnings: string[];
}

interface PersonData {
  gender?: string;
  clothing?: string;
  identifyingMarks?: string;
  height?: string;
  build?: string;
}

/**
 * Compare clothing descriptions using fuzzy text similarity.
 */
function compareClothing(clothing1?: string, clothing2?: string): { score: number; reason: string } {
  if (!clothing1 || !clothing2) {
    return { score: 50, reason: '' };
  }

  // Normalize: lowercase, remove extra spaces
  const norm1 = clothing1.toLowerCase().trim();
  const norm2 = clothing2.toLowerCase().trim();

  // Use token sort ratio for clothing (order-independent)
  const similarity = fuzzball.token_sort_ratio(norm1, norm2);

  if (similarity >= 80) {
    return { score: similarity, reason: `✓ Clothing descriptions match well: "${clothing1}" vs "${clothing2}"` };
  } else if (similarity >= 50) {
    return { score: similarity, reason: `○ Partial clothing match: "${clothing1}" vs "${clothing2}"` };
  } else {
    return { score: similarity, reason: `△ Clothing descriptions differ: "${clothing1}" vs "${clothing2}"` };
  }
}

/**
 * Compare identifying marks.
 */
function compareMarks(marks1?: string, marks2?: string): { score: number; reason: string } {
  if (!marks1 || !marks2) {
    return { score: 50, reason: '' };
  }

  const similarity = fuzzball.token_sort_ratio(
    marks1.toLowerCase().trim(),
    marks2.toLowerCase().trim()
  );

  if (similarity >= 70) {
    return { score: Math.min(100, similarity + 10), reason: `✓ Identifying marks are similar: "${marks1}" vs "${marks2}"` };
  } else if (similarity >= 40) {
    return { score: similarity, reason: `○ Some similarity in identifying marks` };
  } else {
    return { score: similarity, reason: `△ Identifying marks differ` };
  }
}

/**
 * Compare gender.
 */
function compareGender(gender1?: string, gender2?: string): { score: number; reason: string } {
  if (!gender1 || !gender2 || gender1 === 'UNKNOWN' || gender2 === 'UNKNOWN') {
    return { score: 50, reason: '' };
  }

  if (gender1 === gender2) {
    return { score: 100, reason: `✓ Gender matches: ${gender1}` };
  }

  return { score: 0, reason: `✗ Gender mismatch: ${gender1} vs ${gender2}` };
}

/**
 * Compare height descriptions.
 */
function compareHeight(height1?: string, height2?: string): { score: number; reason: string } {
  if (!height1 || !height2) {
    return { score: 50, reason: '' };
  }

  // Try to extract numeric values
  const num1 = parseFloat(height1.replace(/[^\d.]/g, ''));
  const num2 = parseFloat(height2.replace(/[^\d.]/g, ''));

  if (!isNaN(num1) && !isNaN(num2)) {
    const diff = Math.abs(num1 - num2);
    if (diff <= 2) return { score: 95, reason: `✓ Heights are very close` };
    if (diff <= 5) return { score: 75, reason: `○ Heights are similar` };
    return { score: 30, reason: `△ Heights differ significantly` };
  }

  // Fallback to text comparison
  const similarity = fuzzball.ratio(
    height1.toLowerCase().trim(),
    height2.toLowerCase().trim()
  );
  return { score: similarity, reason: similarity >= 60 ? `○ Height descriptions are similar` : '' };
}

/**
 * Compare physical attributes between two persons.
 */
export function matchPhysical(target?: PersonData | null, candidate?: PersonData | null): MatchResult {
  const result: MatchResult = { score: 0, reasons: [], warnings: [] };

  if (!target || !candidate) {
    result.score = 50;
    result.warnings.push('⚠ Physical comparison unavailable (missing data)');
    return result;
  }

  const comparisons: { score: number; reason: string; weight: number }[] = [];

  // Gender is critical — mismatch should heavily penalize
  const genderResult = compareGender(target.gender, candidate.gender);
  if (genderResult.score === 0 && target.gender !== 'UNKNOWN' && candidate.gender !== 'UNKNOWN') {
    // Hard mismatch on gender — very low score
    result.score = 5;
    result.reasons.push(genderResult.reason);
    result.warnings.push('⚠ Gender mismatch is a strong indicator against match');
    return result;
  }
  if (genderResult.reason) comparisons.push({ ...genderResult, weight: 0.3 });

  // Clothing comparison
  const clothingResult = compareClothing(target.clothing, candidate.clothing);
  if (clothingResult.reason) comparisons.push({ ...clothingResult, weight: 0.3 });

  // Identifying marks
  const marksResult = compareMarks(target.identifyingMarks, candidate.identifyingMarks);
  if (marksResult.reason) comparisons.push({ ...marksResult, weight: 0.25 });

  // Height
  const heightResult = compareHeight(target.height, candidate.height);
  if (heightResult.reason) comparisons.push({ ...heightResult, weight: 0.15 });

  // Calculate weighted score
  if (comparisons.length === 0) {
    result.score = 50;
    result.warnings.push('⚠ No physical attributes available for comparison');
    return result;
  }

  let totalWeight = 0;
  let weightedSum = 0;
  for (const comp of comparisons) {
    weightedSum += comp.score * comp.weight;
    totalWeight += comp.weight;
    if (comp.reason) result.reasons.push(comp.reason);
  }

  result.score = Math.round(weightedSum / totalWeight);
  return result;
}
