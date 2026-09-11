import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validation';
import { syncBatchSchema } from './sync.validation';
import { syncController } from './sync.controller';

export const syncRouter = Router();

// POST /api/v1/sync/batch — Idempotent batch sync
syncRouter.post(
  '/batch',
  requireAuth,
  validate(syncBatchSchema),
  syncController.processBatch
);
