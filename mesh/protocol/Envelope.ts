import type {
  MeshEnvelope,
  MeshMessageType,
  PriorityLevel,
} from '../../shared/types/index';

export const SIGHTING_TTL_MS = 6 * 60 * 60 * 1000;
export const DEFAULT_REPORT_TTL_MS = 24 * 60 * 60 * 1000;
export const DEFAULT_MAX_HOPS = 7;

const MESSAGE_TYPES = new Set<MeshMessageType>([
  'SAFE_STATUS',
  'MISSING_PERSON',
  'FOUND_PERSON',
  'SIGHTING',
  'EMERGENCY',
  'CASE_UPDATE',
  'MATCH_CANDIDATE',
  'VERIFICATION_REQUEST',
  'VERIFICATION_RESULT',
  'CASE_MERGE',
  'CASE_SPLIT',
  'HOSPITAL_ADMISSION',
  'CAMP_REGISTRATION',
  'SYNC_REQUEST',
  'SYNC_RESPONSE',
  'NETWORK_STATUS',
]);

const PRIORITIES = new Set<PriorityLevel>(['CRITICAL', 'HIGH', 'NORMAL', 'LOW']);
const DESTINATIONS = new Set(['BROADCAST', 'GATEWAY', 'SPECIFIC_NODE']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function validateEnvelope(value: unknown): MeshEnvelope<unknown> {
  if (!isRecord(value)) {
    throw new Error('Mesh envelope must be an object.');
  }

  const messageId = value.messageId;
  const messageType = value.messageType;
  const priority = value.priority;
  const destinationType = value.destinationType;

  if (typeof messageId !== 'string' || messageId.length === 0) {
    throw new Error('Mesh envelope messageId is required.');
  }
  if (typeof messageType !== 'string' || !MESSAGE_TYPES.has(messageType as MeshMessageType)) {
    throw new Error(`Unsupported mesh message type: ${String(messageType)}`);
  }
  if (typeof priority !== 'string' || !PRIORITIES.has(priority as PriorityLevel)) {
    throw new Error(`Unsupported mesh priority: ${String(priority)}`);
  }
  if (typeof value.createdAt !== 'number' || !Number.isFinite(value.createdAt)) {
    throw new Error('Mesh envelope createdAt must be a finite epoch timestamp.');
  }
  if (typeof value.expiresAt !== 'number' || !Number.isFinite(value.expiresAt)) {
    throw new Error('Mesh envelope expiresAt must be a finite epoch timestamp.');
  }
  if (value.expiresAt <= value.createdAt) {
    throw new Error('Mesh envelope must expire after it is created.');
  }
  if (!Number.isInteger(value.hopCount) || (value.hopCount as number) < 0) {
    throw new Error('Mesh envelope hopCount must be a non-negative integer.');
  }
  if (
    !Number.isInteger(value.maxHops) ||
    (value.maxHops as number) < 1 ||
    (value.maxHops as number) > 15
  ) {
    throw new Error('Mesh envelope maxHops must be an integer from 1 to 15.');
  }
  if (typeof value.senderPseudonym !== 'string' || value.senderPseudonym.length === 0) {
    throw new Error('Mesh envelope senderPseudonym is required.');
  }
  if (typeof destinationType !== 'string' || !DESTINATIONS.has(destinationType)) {
    throw new Error(`Unsupported mesh destination: ${String(destinationType)}`);
  }
  if (destinationType === 'SPECIFIC_NODE' && typeof value.destinationId !== 'string') {
    throw new Error('A SPECIFIC_NODE envelope requires destinationId.');
  }
  if (!isRecord(value.payload)) {
    throw new Error('Mesh envelope payload must be an object.');
  }

  return value as unknown as MeshEnvelope<unknown>;
}

export function serializeEnvelope(envelope: MeshEnvelope<unknown>): string {
  return JSON.stringify(validateEnvelope(envelope));
}

export function deserializeEnvelope(serialized: string): MeshEnvelope<unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized) as unknown;
  } catch (error) {
    throw new Error('Mesh envelope is not valid JSON.', { cause: error });
  }
  return validateEnvelope(parsed);
}

export function isEnvelopeExpired(envelope: MeshEnvelope<unknown>, now = Date.now()): boolean {
  return envelope.expiresAt <= now;
}

export function canForwardEnvelope(envelope: MeshEnvelope<unknown>, now = Date.now()): boolean {
  return !isEnvelopeExpired(envelope, now) && envelope.hopCount < envelope.maxHops;
}

export function incrementEnvelopeHop(
  envelope: MeshEnvelope<unknown>,
  now = Date.now(),
): MeshEnvelope<unknown> | null {
  if (!canForwardEnvelope(envelope, now)) {
    return null;
  }

  return {
    ...envelope,
    hopCount: envelope.hopCount + 1,
  };
}
