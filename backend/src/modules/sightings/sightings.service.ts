import prisma from '../../config/database';
import { generateSightingId } from '../../utils/id-generator';
import { Errors } from '../../utils/errors';
import { auditService, AuditActions } from '../audit/audit.service';
import type { CreateSightingInput } from './sightings.validation';

export const sightingsService = {
  async createSighting(data: CreateSightingInput, userId: string, pseudonym: string) {
    // Verify target case exists if provided
    if (data.targetCaseId) {
      const targetCase = await prisma.case.findUnique({
        where: { caseId: data.targetCaseId },
      });
      if (!targetCase) {
        throw Errors.notFound('Case', data.targetCaseId);
      }
    }

    const sightingId = generateSightingId();

    // Resolve internal case ID from caseId string
    let internalCaseId: string | null = null;
    if (data.targetCaseId) {
      const targetCase = await prisma.case.findUnique({
        where: { caseId: data.targetCaseId },
      });
      internalCaseId = targetCase?.id ?? null;
    }

    const sighting = await prisma.sighting.create({
      data: {
        sightingId,
        targetCaseId: internalCaseId,
        personDescription: data.personDescription,
        location: data.location as object,
        clothingDescription: data.clothingDescription,
        directionOfMovement: data.directionOfMovement,
        confidenceScore: data.confidenceScore,
        reportedByPseudonym: pseudonym,
        verificationState: 'UNVERIFIED',
      },
    });

    await auditService.log({
      actor: userId,
      action: AuditActions.SIGHTING_SUBMITTED,
      resource: 'Sighting',
      resourceId: sightingId,
      caseId: internalCaseId ?? undefined,
      metadata: {
        targetCaseId: data.targetCaseId,
        confidenceScore: data.confidenceScore,
      },
    });

    // Async match trigger — don't block the response
    if (internalCaseId) {
      try {
        const { matchingService } = require('../matching/matching.service');
        matchingService.evaluateSightingMatch(sighting.id, internalCaseId).catch(
          (err: Error) => console.error('[MATCHING] Sighting match error:', err.message)
        );
      } catch { /* matching module may not be ready */ }
    }

    return {
      success: true,
      sightingId,
      verificationState: 'UNVERIFIED',
    };
  },
};
