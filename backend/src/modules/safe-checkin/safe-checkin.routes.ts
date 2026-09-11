import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validation';
import { createSafeCheckinSchema } from './safe-checkin.validation';
import { safeCheckinController } from './safe-checkin.controller';

export const safeCheckinRouter = Router();

// POST /api/v1/safe-checkin — Register an "I'M SAFE" broadcast
safeCheckinRouter.post(
  '/safe-checkin',
  requireAuth,
  validate(createSafeCheckinSchema),
  safeCheckinController.createCheckIn
);
