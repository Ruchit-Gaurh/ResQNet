import { z } from 'zod';

export const createSafeCheckinSchema = z.object({
  personName: z.string().min(2, 'Person name must be at least 2 characters'),
  phoneNumber: z.string().optional(),
  location: z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    zone: z.string().optional(),
  }),
  statusMessage: z.string().optional(),
  affectedFamilyMembers: z.array(z.string()).optional(),
});

export type CreateSafeCheckinInput = z.infer<typeof createSafeCheckinSchema>;
