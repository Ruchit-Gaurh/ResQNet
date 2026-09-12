/**
 * RESQNET — Scorer
 * Weighted multi-attribute score aggregator.
 * Determines overall score and confidence level.
 */

import type { MatchConfidence } from '@prisma/client';

interface MatchResult {
  score: number;
  reasons: string[];
  warnings: string[];
}

export interface MatchScoreBreakdown {
  nameScore: number;
  ageScore: number;
  locationScore: number;
  timelineScore: number;
  physicalScore: number;
  photoScore: number;
}

export interface ScoredMatch {
  overallScore: number;
  confidenceLevel: MatchConfidence;
  breakdown: MatchScoreBreakdown;
  reasons: string[];
  warnings: string[];
}

// Weights from the specification
const WEIGHTS = {
  name: 0.20,
  age: 0.10,
  location: 0.20,
  timeline: 0.15,
  physical: 0.10,
  photo: 0.25,
} as const;

/**
 * Determine confidence level from overall score.
 * HUMAN_VERIFIED is NEVER assigned by the scorer — only by human review.
 */
export function determineConfidenceLevel(score: number): MatchConfidence {
  if (score >= 80) return 'STRONG_CANDIDATE';
  if (score >= 60) return 'POSSIBLE_MATCH';
  if (score >= 40) return 'WEAK_CANDIDATE';
  return 'NO_MATCH';
}

/**
 * Calculate weighted overall score from individual matcher results.
 */
export function calculateScore(
  nameResult: MatchResult,
  ageResult: MatchResult,
  locationResult: MatchResult,
  timelineResult: MatchResult,
  physicalResult: MatchResult,
  photoResult: MatchResult
): ScoredMatch {
  const breakdown: MatchScoreBreakdown = {
    nameScore: Math.round(nameResult.score * 10) / 10,
    ageScore: Math.round(ageResult.score * 10) / 10,
    locationScore: Math.round(locationResult.score * 10) / 10,
    timelineScore: Math.round(timelineResult.score * 10) / 10,
    physicalScore: Math.round(physicalResult.score * 10) / 10,
    photoScore: Math.round(photoResult.score * 10) / 10,
  };

  const overallScore = Math.round(
    (nameResult.score * WEIGHTS.name +
     ageResult.score * WEIGHTS.age +
     locationResult.score * WEIGHTS.location +
     timelineResult.score * WEIGHTS.timeline +
     physicalResult.score * WEIGHTS.physical +
     photoResult.score * WEIGHTS.photo) * 10
  ) / 10;

  // Aggregate reasons and warnings (deduplicated)
  const allReasons = [
    ...nameResult.reasons,
    ...ageResult.reasons,
    ...locationResult.reasons,
    ...timelineResult.reasons,
    ...physicalResult.reasons,
    ...photoResult.reasons,
  ].filter(Boolean);

  const allWarnings = [
    ...nameResult.warnings,
    ...ageResult.warnings,
    ...locationResult.warnings,
    ...timelineResult.warnings,
    ...physicalResult.warnings,
    ...photoResult.warnings,
  ].filter(Boolean);

  // Deduplicate
  const reasons = [...new Set(allReasons)];
  const warnings = [...new Set(allWarnings)];

  return {
    overallScore,
    confidenceLevel: determineConfidenceLevel(overallScore),
    breakdown,
    reasons,
    warnings,
  };
}
