import type { MeshEnvelope } from '../../shared/types/index';
import { validateEnvelope } from '../protocol/Envelope';

const MAX_INVENTORY_IDS = 256;

export type BleWirePacket =
  | { kind: 'INVENTORY'; messageIds: string[] }
  | { kind: 'REQUEST'; messageIds: string[] }
  | { kind: 'ENVELOPE'; envelope: MeshEnvelope<unknown> }
  | { kind: 'RECEIPT'; messageId: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validateIds(value: unknown): string[] {
  if (!Array.isArray(value) || value.length > MAX_INVENTORY_IDS) {
    throw new Error(`BLE inventory must contain at most ${MAX_INVENTORY_IDS} IDs.`);
  }
  if (!value.every((item) => typeof item === 'string' && item.length > 0)) {
    throw new Error('BLE inventory contains an invalid message ID.');
  }
  return [...new Set(value)];
}

export function serializeBleWirePacket(packet: BleWirePacket): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(packet));
}

export function deserializeBleWirePacket(bytes: Uint8Array): BleWirePacket {
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(bytes)) as unknown;
  } catch (error) {
    throw new Error('BLE packet is not valid JSON.', { cause: error });
  }
  if (!isRecord(parsed) || typeof parsed.kind !== 'string') {
    throw new Error('BLE packet is missing its kind.');
  }
  switch (parsed.kind) {
    case 'INVENTORY':
      return { kind: 'INVENTORY', messageIds: validateIds(parsed.messageIds) };
    case 'REQUEST':
      return { kind: 'REQUEST', messageIds: validateIds(parsed.messageIds) };
    case 'ENVELOPE':
      return { kind: 'ENVELOPE', envelope: validateEnvelope(parsed.envelope) };
    case 'RECEIPT':
      if (typeof parsed.messageId !== 'string' || parsed.messageId.length === 0) {
        throw new Error('BLE receipt is missing its message ID.');
      }
      return { kind: 'RECEIPT', messageId: parsed.messageId };
    default:
      throw new Error(`Unsupported BLE packet kind: ${parsed.kind}`);
  }
}

export function compareBleInventories(
  localIds: string[],
  remoteIds: string[],
): { sendToPeer: string[]; requestFromPeer: string[] } {
  const local = new Set(localIds);
  const remote = new Set(remoteIds);
  return {
    sendToPeer: localIds.filter((id) => !remote.has(id)),
    requestFromPeer: remoteIds.filter((id) => !local.has(id)),
  };
}

/**
 * File/content URIs only exist on the originating phone. BLE carries the report
 * capsule, not inaccessible local paths or full-resolution media.
 */
export function prepareEnvelopeForBle(
  envelope: MeshEnvelope<unknown>,
): MeshEnvelope<unknown> {
  const clone = JSON.parse(JSON.stringify(validateEnvelope(envelope))) as MeshEnvelope<unknown>;
  scrubLocalMedia(clone.payload);
  return clone;
}

function scrubLocalMedia(value: unknown): void {
  if (Array.isArray(value)) {
    for (const item of value) scrubLocalMedia(item);
    return;
  }
  if (!isRecord(value)) return;
  for (const [key, child] of Object.entries(value)) {
    if (
      key === 'photoUrl' &&
      typeof child === 'string' &&
      /^(file|content|ph|assets-library|blob):/i.test(child)
    ) {
      delete value[key];
    } else {
      scrubLocalMedia(child);
    }
  }
}
