import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { requireRole } from '../../middleware/role';
import { validate } from '../../middleware/validation';
import { verifyMatchSchema, mergeCasesSchema } from './verification.validation';
import { verificationController } from './verification.controller';

export const verificationRouter = Router();

// GET /api/v1/admin/matches/pending — Pending matches for human review
verificationRouter.get(
  '/matches/pending',
  requireAuth,
  requireRole('RESPONDER_ADMIN'),
  verificationController.getPendingMatches
);

// POST /api/v1/admin/matches/:matchId/verify — Verify/reject a match
verificationRouter.post(
  '/matches/:matchId/verify',
  requireAuth,
  requireRole('RESPONDER_ADMIN'),
  validate(verifyMatchSchema),
  verificationController.verifyMatch
);

// POST /api/v1/admin/cases/merge — Merge duplicate cases
verificationRouter.post(
  '/cases/merge',
  requireAuth,
  requireRole('RESPONDER_ADMIN'),
  validate(mergeCasesSchema),
  verificationController.mergeCases
);
