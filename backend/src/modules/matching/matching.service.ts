/**
 * RESQNET — Matching Service (Orchestrator)
 * INSIDE THE MONOLITH — not a separate microservice.
 *
 * Coordinates all matchers and creates MatchCandidate records.
 * NEVER automatically confirms identity — all matches start as PENDING_REVIEW.
 */

import prisma from '../../config/database';
import { generateMatchId } from '../../utils/id-generator';
import { auditService, AuditActions } from '../audit/audit.service';
import { matchNames } from './name-matcher';
import { matchAge } from './age-matcher';
import { matchLocation } from './location-matcher';
import { matchTimeline } from './timeline-matcher';
import { matchPhysical } from './physical-matcher';
import { matchPhotos } from './photo-matcher';
import { calculateScore } from './scorer';
import { addSafetyWarnings } from './explainability';
import { config } from '../../config';
import {
  assessSimilarityWithOpenAi,
  type PersonEvidence,
} from './openai-similarity';
import { determineConfidenceLevel } from './scorer';

import type { Case, Sighting } from '@prisma/client';

interface PersonData {
  name?: string;
  nickname?: string;
  age?: number;
  approximateAge?: number;
  gender?: string;
  clothing?: string;
  identifyingMarks?: string;
  height?: string;
  photoUrl?: string;
  [key: string]: unknown;
}

interface GeoLocation {
  lat?: number;
  lng?: number;
  accuracyMeters?: number;
  zone?: string;
}

/**
 * Extract person data from a case record.
 */
function extractPersonData(caseRecord: Case): PersonData {
  const data = caseRecord.personData as Record<string, unknown>;
  return {
    name: caseRecord.personName || (data.name as string),
    nickname: data.nickname as string | undefined,
    age: data.age as number | undefined,
    approximateAge: data.approximateAge as number | undefined,
    gender: data.gender as string | undefined,
    clothing: data.clothing as string | undefined,
    identifyingMarks: data.identifyingMarks as string | undefined,
    height: data.height as string | undefined,
    photoUrl: data.photoUrl as string | undefined,
  };
}

/**
 * Extract location from a case or sighting.
 */
function extractLocation(locationData: unknown): GeoLocation | null {
  if (!locationData || typeof locationData !== 'object') return null;
  const loc = locationData as Record<string, unknown>;
  return {
    lat: loc.lat as number | undefined,
    lng: loc.lng as number | undefined,
    accuracyMeters: loc.accuracyMeters as number | undefined,
    zone: loc.zone as string | undefined,
  };
}

function openAiEvidence(
  person: PersonData,
  location: GeoLocation | null,
  observedAt?: string,
): PersonEvidence {
  return {
    name: person.name,
    nickname: person.nickname,
    age: person.age,
    approximateAge: person.approximateAge,
    gender: person.gender,
    clothing: person.clothing,
    identifyingMarks: person.identifyingMarks,
    height: person.height,
    photoAvailable: Boolean(person.photoUrl),
    locationZone: location?.zone,
    observedAt,
  };
}

export const matchingService = {
  /**
   * Evaluate a match between a missing case and a found/candidate case.
   * Returns the scored result but does NOT persist — caller decides.
   */
  async evaluateMatch(missingCase: Case, candidateCase: Case) {
    const target = extractPersonData(missingCase);
    const candidate = extractPersonData(candidateCase);
    const targetLocation = extractLocation(missingCase.lastKnownLocation);
    const candidateLocation = extractLocation(candidateCase.lastKnownLocation);

    // Run all matchers
    const nameResult = matchNames(target.name, candidate.name);
    const ageResult = matchAge(target.age, target.approximateAge, candidate.age, candidate.approximateAge);
    const locationResult = matchLocation(targetLocation, candidateLocation);
    const timelineResult = matchTimeline(
      missingCase.lastKnownTime?.toISOString(),
      candidateCase.createdAt.toISOString()
    );
    const physicalResult = matchPhysical(target, candidate);
    const photoResult = await matchPhotos(target.photoUrl, candidate.photoUrl);

    // Calculate weighted score
    const scored = calculateScore(nameResult, ageResult, locationResult, timelineResult, physicalResult, photoResult);

    const deterministic = addSafetyWarnings(scored);
    try {
      const aiAssessment = await assessSimilarityWithOpenAi(
        openAiEvidence(target, targetLocation, missingCase.lastKnownTime?.toISOString()),
        openAiEvidence(candidate, candidateLocation, candidateCase.createdAt.toISOString()),
        deterministic,
        {
          apiKey: config.matching.openAiApiKey,
          model: config.matching.openAiModel,
        },
      );
      if (!aiAssessment) return deterministic;

      return {
        ...deterministic,
        overallScore: aiAssessment.similarityPercentage,
        confidenceLevel: determineConfidenceLevel(aiAssessment.similarityPercentage),
        breakdown: {
          ...deterministic.breakdown,
          openAiSimilarityScore: aiAssessment.similarityPercentage,
        },
        reasons: [
          ...deterministic.reasons,
          `OpenAI report similarity assessment: ${aiAssessment.similarityPercentage}%`,
          ...aiAssessment.matchingEvidence.map((reason) => `AI evidence: ${reason}`),
        ],
        warnings: [
          ...deterministic.warnings,
          ...aiAssessment.conflictingEvidence.map((reason) => `⚠ AI noted conflict: ${reason}`),
          ...aiAssessment.missingEvidence.map((reason) => `⚠ Missing evidence: ${reason}`),
          '⚠ The OpenAI percentage is a prototype report-similarity score, not a scientific identity probability.',
        ],
      };
    } catch (error) {
      console.warn(
        '[MATCHING] OpenAI assessment unavailable; deterministic scoring retained:',
        error instanceof Error ? error.message : 'unknown error',
      );
      return deterministic;
    }
  },

  /**
   * Evaluate a sighting against a missing case.
   */
  async evaluateSightingMatch(sightingId: string, targetCaseId: string) {
    const sighting = await prisma.sighting.findUnique({ where: { id: sightingId } });
    const targetCase = await prisma.case.findFirst({
      where: { id: targetCaseId, type: 'MISSING' },
    });

    if (!sighting || !targetCase) return null;

    const target = extractPersonData(targetCase);
    const sightingLocation = extractLocation(sighting.location);
    const targetLocation = extractLocation(targetCase.lastKnownLocation);

    // Run matchers with available sighting data
    const nameResult = { score: 50, reasons: [] as string[], warnings: ['⚠ Sightings typically do not include names'] };
    const ageResult = { score: 50, reasons: [] as string[], warnings: ['⚠ Age comparison unavailable from sighting'] };
    const locationResult = matchLocation(targetLocation, sightingLocation);
    const timelineResult = matchTimeline(
      targetCase.lastKnownTime?.toISOString(),
      sighting.timestamp.toISOString()
    );
    const physicalResult = matchPhysical(target, {
      clothing: sighting.clothingDescription || undefined,
      identifyingMarks: undefined,
      gender: undefined,
    });
    const photoResult = await matchPhotos(
      target.photoUrl,
      sighting.photoUrl || undefined
    );

    const scored = calculateScore(nameResult, ageResult, locationResult, timelineResult, physicalResult, photoResult);
    const result = addSafetyWarnings(scored);

    // Only persist if score meets minimum threshold
    if (result.overallScore >= 30) {
      // We need a "candidate case" for the match record.
      // For sightings, we link to the target case itself with a note.
      // In a more complete system, the sighting might be linked to a found case.
      result.reasons.push(`Sighting report: "${sighting.personDescription}"`);
      if (sighting.directionOfMovement) {
        result.reasons.push(`Direction of movement: ${sighting.directionOfMovement}`);
      }
    }

    return result;
  },

  /**
   * Scan a newly created found/unidentified case against all active MISSING cases.
   * Creates MatchCandidate records for any significant matches.
   */
  async scanFoundCaseAgainstMissing(foundCaseId: string) {
    const foundCase = await prisma.case.findUnique({ where: { id: foundCaseId } });
    if (!foundCase) return [];

    // Get all active missing cases
    const missingCases = await prisma.case.findMany({
      where: {
        type: 'MISSING',
        status: { in: ['REGISTERED', 'SEARCHING', 'INFORMATION_RECEIVED', 'POSSIBLE_MATCH'] },
      },
    });

    const candidates = [];

    for (const missingCase of missingCases) {
      try {
        const result = await this.evaluateMatch(missingCase, foundCase);

        // Only create candidate for meaningful scores
        if (result.overallScore >= 30 && result.confidenceLevel !== 'NO_MATCH') {
          const matchId = generateMatchId();

          const matchCandidate = await prisma.matchCandidate.create({
            data: {
              matchId,
              targetMissingCaseId: missingCase.id,
              candidateFoundCaseId: foundCase.id,
              overallScore: result.overallScore,
              confidenceLevel: result.confidenceLevel,
              breakdown: result.breakdown as object,
              reasons: result.reasons,
              warnings: result.warnings,
              status: 'PENDING_REVIEW', // NEVER auto-confirm
            },
          });

          // Update case status to reflect potential match
          if (result.confidenceLevel === 'STRONG_CANDIDATE' || result.confidenceLevel === 'POSSIBLE_MATCH') {
            await prisma.case.update({
              where: { id: missingCase.id },
              data: { status: 'POSSIBLE_MATCH' },
            });
          }

          // Audit log
          await auditService.log({
            actor: 'SYSTEM_MATCHING',
            action: AuditActions.MATCH_CANDIDATE_GENERATED,
            resource: 'MatchCandidate',
            resourceId: matchId,
            caseId: missingCase.id,
            metadata: {
              score: result.overallScore,
              confidenceLevel: result.confidenceLevel,
              targetCaseId: missingCase.caseId,
              candidateCaseId: foundCase.caseId,
            },
          });

          candidates.push(matchCandidate);
        }
      } catch (error) {
        console.error(`[MATCHING] Error evaluating match for case ${missingCase.caseId}:`, error);
        // Continue with other cases — don't let one failure block all matches
      }
    }

    return candidates;
  },

  /**
   * Scan all found/unidentified cases against a newly created missing case.
   */
  async scanMissingCaseAgainstFound(missingCaseId: string) {
    const missingCase = await prisma.case.findUnique({ where: { id: missingCaseId } });
    if (!missingCase) return [];

    // Get all found/unidentified cases
    const foundCases = await prisma.case.findMany({
      where: {
        type: { in: ['FOUND', 'UNIDENTIFIED_PATIENT'] },
        status: { notIn: ['CLOSED', 'REUNITED', 'DUPLICATE', 'REJECTED'] },
      },
    });

    const candidates = [];

    for (const foundCase of foundCases) {
      try {
        const result = await this.evaluateMatch(missingCase, foundCase);

        if (result.overallScore >= 30 && result.confidenceLevel !== 'NO_MATCH') {
          const matchId = generateMatchId();

          const matchCandidate = await prisma.matchCandidate.create({
            data: {
              matchId,
              targetMissingCaseId: missingCase.id,
              candidateFoundCaseId: foundCase.id,
              overallScore: result.overallScore,
              confidenceLevel: result.confidenceLevel,
              breakdown: result.breakdown as object,
              reasons: result.reasons,
              warnings: result.warnings,
              status: 'PENDING_REVIEW',
            },
          });

          if (result.confidenceLevel === 'STRONG_CANDIDATE' || result.confidenceLevel === 'POSSIBLE_MATCH') {
            await prisma.case.update({
              where: { id: missingCase.id },
              data: { status: 'POSSIBLE_MATCH' },
            });
          }

          await auditService.log({
            actor: 'SYSTEM_MATCHING',
            action: AuditActions.MATCH_CANDIDATE_GENERATED,
            resource: 'MatchCandidate',
            resourceId: matchId,
            caseId: missingCase.id,
            metadata: {
              score: result.overallScore,
              confidenceLevel: result.confidenceLevel,
              targetCaseId: missingCase.caseId,
              candidateCaseId: foundCase.caseId,
            },
          });

          candidates.push(matchCandidate);
        }
      } catch (error) {
        console.error(`[MATCHING] Error evaluating match for found case ${foundCase.caseId}:`, error);
      }
    }

    return candidates;
  },
};
