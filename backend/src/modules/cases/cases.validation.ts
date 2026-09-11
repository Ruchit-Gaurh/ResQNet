import { z } from 'zod';

const geoLocationSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  accuracyMeters: z.number().optional(),
  address: z.string().optional(),
  zone: z.string().optional(),
});

const personProfileSchema = z.object({
  name: z.string().min(1, 'Person name is required'),
  nickname: z.string().optional(),
  age: z.number().int().min(0).max(150).optional(),
  approximateAge: z.number().int().min(0).max(150).optional(),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER', 'UNKNOWN']),
  fatherMotherName: z.string().optional(),
  phoneNumber: z.string().optional(),
  alternateContact: z.string().optional(),
  identifyingMarks: z.string().optional(),
  height: z.string().optional(),
  clothing: z.string().optional(),
  medicalNeeds: z.string().optional(),
  isMinor: z.boolean().optional(),
  photoUrl: z.string().optional(),
  languageSpoken: z.string().optional(),
});

export const createMissingCaseSchema = z.object({
  person: personProfileSchema,
  priority: z.enum(['CRITICAL', 'HIGH', 'NORMAL', 'LOW']).default('NORMAL'),
  lastKnownLocation: geoLocationSchema.optional(),
  lastKnownTime: z.string().datetime().optional(),
  source: z.enum(['FAMILY', 'PUBLIC', 'VOLUNTEER', 'HOSPITAL', 'RELIEF_CAMP', 'RESPONDER']),
});

export const createFoundCaseSchema = z.object({
  person: personProfileSchema,
  location: geoLocationSchema,
  source: z.enum(['FAMILY', 'PUBLIC', 'VOLUNTEER', 'HOSPITAL', 'RELIEF_CAMP', 'RESPONDER']),
});

export type CreateMissingCaseInput = z.infer<typeof createMissingCaseSchema>;
export type CreateFoundCaseInput = z.infer<typeof createFoundCaseSchema>;
