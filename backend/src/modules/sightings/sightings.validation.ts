import { z } from 'zod';

export const createSightingSchema = z.object({
  targetCaseId: z.string().optional(),
  personDescription: z.string().min(5, 'Person description must be at least 5 characters'),
  location: z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    zone: z.string().optional(),
    accuracyMeters: z.number().optional(),
    address: z.string().optional(),
  }),
  clothingDescription: z.string().optional(),
  directionOfMovement: z.string().optional(),
  confidenceScore: z.number().min(0).max(1).default(0.5),
});

export type CreateSightingInput = z.infer<typeof createSightingSchema>;
