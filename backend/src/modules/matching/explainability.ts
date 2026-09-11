/**
 * RESQNET — Explainability Module
 * Formats match results into human-readable explanations.
 */

import type { ScoredMatch } from './scorer';

/**
 * Add standard safety warnings to match results.
 * Ensures every AI-generated candidate includes the human verification warning.
 */
export function addSafetyWarnings(match: ScoredMatch): ScoredMatch {
  const safetyWarnings = [
    '⚠ Identity has not been human-verified.',
    '⚠ AI matching is evidence-based recommendation only — not identity confirmation.',
  ];

  // Add safety warnings that aren't already present
  const existingWarnings = new Set(match.warnings);
  for (const warning of safetyWarnings) {
    if (!existingWarnings.has(warning)) {
      match.warnings.push(warning);
    }
  }

  return match;
}

/**
 * Generate a confidence summary for the match result.
 */
export function generateConfidenceSummary(match: ScoredMatch): string {
  switch (match.confidenceLevel) {
    case 'STRONG_CANDIDATE':
      return `Strong match candidate (${match.overallScore}%) — multiple attributes align. Requires human verification.`;
    case 'POSSIBLE_MATCH':
      return `Possible match (${match.overallScore}%) — some attributes align. Human review recommended.`;
    case 'WEAK_CANDIDATE':
      return `Weak match candidate (${match.overallScore}%) — limited attribute alignment. Further investigation needed.`;
    case 'NO_MATCH':
      return `Low match score (${match.overallScore}%) — few attributes align.`;
    case 'HUMAN_VERIFIED':
      return `Match has been verified by an authorized human reviewer.`;
    default:
      return `Match score: ${match.overallScore}%`;
  }
}
