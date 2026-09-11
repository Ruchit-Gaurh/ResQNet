import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validation';
import { createSightingSchema } from './sightings.validation';
import { sightingsController } from './sightings.controller';

export const sightingsRouter = Router();

// POST /api/v1/reports/sighting — Submit a sighting report
sightingsRouter.post(
  '/sighting',
  requireAuth,
  validate(createSightingSchema),
  sightingsController.createSighting
);
