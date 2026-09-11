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

export const deviceTelemetrySchema = z.object({
  nodeId: z.string().min(1).max(128),
  displayName: z.string().min(1).max(128),
  observedAt: z.number().nonnegative(),
  location: z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    accuracyMeters: z.number().nonnegative().optional(),
    address: z.string().max(500).optional(),
    zone: z.string().max(200).optional(),
  }).optional(),
  locationObservedAt: z.number().nonnegative().optional(),
  locationPermission: z.enum(['GRANTED', 'DENIED', 'UNAVAILABLE']),
  transportMode: z.enum(['MOCK_IN_PROCESS', 'DEV_EMULATOR_MESH', 'NATIVE_BLE']),
  nearbyPeerIds: z.array(z.string().min(1).max(128)).max(256),
  queuedMessageCount: z.number().int().nonnegative(),
});

export const syncBatchSchema = z.object({
  deviceId: z.string().min(1),
  lastSyncTimestamp: z.number(),
  outboundEnvelopes: z.array(meshEnvelopeSchema),
  deviceTelemetry: deviceTelemetrySchema.optional(),
});

export type SyncBatchInput = z.infer<typeof syncBatchSchema>;
