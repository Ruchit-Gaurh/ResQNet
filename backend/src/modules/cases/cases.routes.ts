import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { requireRole } from '../../middleware/role';
import { validate } from '../../middleware/validation';
import { createMissingCaseSchema, createFoundCaseSchema } from './cases.validation';
import { casesController } from './cases.controller';

export const casesRouter = Router();

// POST /api/v1/cases/missing — Create a missing person case
casesRouter.post(
  '/missing',
  requireAuth,
  validate(createMissingCaseSchema),
  casesController.createMissing
);

// POST /api/v1/cases/found — Register a found/unidentified person
casesRouter.post(
  '/found',
  requireAuth,
  requireRole('HOSPITAL', 'RELIEF_CAMP', 'RESPONDER_ADMIN'),
  validate(createFoundCaseSchema),
  casesController.createFound
);

// GET /api/v1/cases/:caseId — Get case details (role-filtered)
casesRouter.get(
  '/:caseId',
  requireAuth,
  casesController.getCase
);
