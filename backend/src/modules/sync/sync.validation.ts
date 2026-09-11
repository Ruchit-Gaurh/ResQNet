import { z } from 'zod';

const meshEnvelopeSchema = z.object({
  messageId: z.string().min(1),
  messageType: z.enum([
    'SAFE_STATUS', 'MISSING_PERSON', 'FOUND_PERSON', 'SIGHTING',
    'EMERGENCY', 'CASE_UPDATE', 'MATCH_CANDIDATE', 'VERIFICATION_REQUEST',
    'VERIFICATION_RESULT', 'CASE_MERGE', 'CASE_SPLIT', 'HOSPITAL_ADMISSION',
    'CAMP_REGISTRATION', 'SYNC_REQUEST', 'SYNC_RESPONSE', 'NETWORK_STATUS',
  ]),
  priority: z.enum(['CRITICAL', 'HIGH', 'NORMAL', 'LOW']),
  createdAt: z.number(),
  expiresAt: z.number(),
  hopCount: z.number().int().min(0),
  maxHops: z.number().int().min(1).max(15),
  senderPseudonym: z.string().min(1),
  destinationType: z.enum(['BROADCAST', 'GATEWAY', 'SPECIFIC_NODE']),
  destinationId: z.string().optional(),
  payload: z.record(z.unknown()),
  signature: z.string().optional(),
});

export const syncBatchSchema = z.object({
  deviceId: z.string().min(1),
  lastSyncTimestamp: z.number(),
  outboundEnvelopes: z.array(meshEnvelopeSchema),
});

export type SyncBatchInput = z.infer<typeof syncBatchSchema>;
