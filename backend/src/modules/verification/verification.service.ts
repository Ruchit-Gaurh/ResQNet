import prisma from '../../config/database';
import { Errors } from '../../utils/errors';
import { auditService, AuditActions } from '../audit/audit.service';
import type { VerifyMatchInput, MergeCasesInput } from './verification.validation';
import type { UserRole } from '@prisma/client';

export const verificationService = {
  /**
   * Get all pending match candidates for human review.
   */
  async getPendingMatches() {
    const matches = await prisma.matchCandidate.findMany({
      where: { status: 'PENDING_REVIEW' },
      orderBy: { overallScore: 'desc' },
      include: {
        targetCase: {
          select: { caseId: true, personName: true, type: true, status: true },
        },
        candidateCase: {
          select: { caseId: true, personName: true, type: true, status: true },
        },
      },
    });

    return matches.map((m) => ({
      matchId: m.matchId,
      targetMissingCaseId: m.targetCase.caseId,
      candidateFoundCaseId: m.candidateCase.caseId,
      targetPersonName: m.targetCase.personName,
      candidatePersonName: m.candidateCase.personName,
      overallScore: m.overallScore,
      confidenceLevel: m.confidenceLevel,
      breakdown: m.breakdown,
      reasons: m.reasons,
      warnings: m.warnings,
      status: m.status,
      createdAt: m.createdAt.toISOString(),
    }));
  },

  /**
   * Verify or reject a match candidate.
   * ONLY authorized humans can verify — this is the critical safety gate.
   */
  async verifyMatch(
    matchId: string,
    data: VerifyMatchInput,
    reviewerRole: string
  ) {
    const match = await prisma.matchCandidate.findUnique({
      where: { matchId },
    });

    if (!match) {
      throw Errors.notFound('MatchCandidate', matchId);
    }

    const now = new Date();

    if (data.decision === 'VERIFY') {
      // Human VERIFY — update match and case statuses
      await prisma.$transaction(async (tx) => {
        // Update match status
        await tx.matchCandidate.update({
          where: { matchId },
          data: {
            status: 'VERIFIED',
            confidenceLevel: 'HUMAN_VERIFIED',
            reviewerId: data.reviewerId,
            reviewedAt: now,
            reviewNotes: data.notes,
          },
        });

        // Update target missing case status
        await tx.case.update({
          where: { id: match.targetMissingCaseId },
          data: { status: 'VERIFIED', verificationState: 'VERIFIED' },
        });

        // Then transition to FAMILY_NOTIFIED
        await tx.case.update({
          where: { id: match.targetMissingCaseId },
          data: { status: 'FAMILY_NOTIFIED' },
        });

        // Create verification record
        await tx.verification.create({
          data: {
            matchId: match.id,
            decision: 'VERIFY',
            reviewerId: data.reviewerId,
            reviewerRole: reviewerRole as UserRole,
            evidenceUsed: data.evidenceUsed,
            notes: data.notes,
          },
        });
      });

      // Audit log
      await auditService.log({
        actor: data.reviewerId,
        action: AuditActions.VERIFICATION_PERFORMED,
        resource: 'MatchCandidate',
        resourceId: matchId,
        caseId: match.targetMissingCaseId,
        metadata: {
          decision: 'VERIFY',
          evidenceUsed: data.evidenceUsed,
          score: match.overallScore,
        },
      });

      await auditService.log({
        actor: data.reviewerId,
        action: AuditActions.CASE_STATUS_CHANGED,
        resource: 'Case',
        resourceId: match.targetMissingCaseId,
        caseId: match.targetMissingCaseId,
        metadata: { newStatus: 'FAMILY_NOTIFIED', reason: 'Match verified' },
      });

    } else if (data.decision === 'REJECT') {
      await prisma.$transaction(async (tx) => {
        await tx.matchCandidate.update({
          where: { matchId },
          data: {
            status: 'REJECTED',
            reviewerId: data.reviewerId,
            reviewedAt: now,
            reviewNotes: data.notes,
          },
        });

        await tx.verification.create({
          data: {
            matchId: match.id,
            decision: 'REJECT',
            reviewerId: data.reviewerId,
            reviewerRole: reviewerRole as UserRole,
            evidenceUsed: data.evidenceUsed,
            notes: data.notes,
          },
        });
      });

      await auditService.log({
        actor: data.reviewerId,
        action: AuditActions.VERIFICATION_PERFORMED,
        resource: 'MatchCandidate',
        resourceId: matchId,
        metadata: { decision: 'REJECT' },
      });

    } else {
      // NEEDS_MORE_INFO
      await prisma.matchCandidate.update({
        where: { matchId },
        data: {
          status: 'NEEDS_MORE_INFO',
          reviewerId: data.reviewerId,
          reviewNotes: data.notes,
        },
      });

      await auditService.log({
        actor: data.reviewerId,
        action: AuditActions.VERIFICATION_PERFORMED,
        resource: 'MatchCandidate',
        resourceId: matchId,
        metadata: { decision: 'NEEDS_MORE_INFO' },
      });
    }

    // Return updated match
    const updated = await prisma.matchCandidate.findUnique({ where: { matchId } });
    return {
      success: true,
      matchId,
      status: updated?.status,
      decision: data.decision,
    };
  },

  /**
   * Merge duplicate cases into a canonical case.
   */
  async mergeCases(data: MergeCasesInput, reviewerId: string) {
    // Verify canonical case exists
    const canonical = await prisma.case.findUnique({
      where: { caseId: data.canonicalCaseId },
    });
    if (!canonical) {
      throw Errors.notFound('Case', data.canonicalCaseId);
    }

    await prisma.$transaction(async (tx) => {
      for (const dupCaseId of data.duplicateCaseIds) {
        const dupCase = await tx.case.findUnique({
          where: { caseId: dupCaseId },
        });
        if (!dupCase) continue;

        // Mark as duplicate
        await tx.case.update({
          where: { caseId: dupCaseId },
          data: { status: 'DUPLICATE' },
        });

        // Move evidence to canonical case
        await tx.evidenceReport.updateMany({
          where: { caseId: dupCase.id },
          data: { caseId: canonical.id },
        });
      }
    });

    // Audit
    await auditService.log({
      actor: reviewerId,
      action: AuditActions.CASES_MERGED,
      resource: 'Case',
      resourceId: data.canonicalCaseId,
      caseId: canonical.id,
      metadata: {
        duplicateCaseIds: data.duplicateCaseIds,
        reason: data.reason,
      },
    });

    return {
      success: true,
      canonicalCaseId: data.canonicalCaseId,
      mergedCount: data.duplicateCaseIds.length,
    };
  },
};
