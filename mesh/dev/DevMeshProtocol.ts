import type { MeshEnvelope } from '../../shared/types/index';

export type DevMeshClientMessage =
  | { kind: 'HELLO'; nodeId: string }
  | { kind: 'ENVELOPE'; nodeId: string; envelope: MeshEnvelope<unknown> }
  | {
      kind: 'PEER_RECEIPT';
      nodeId: string;
      targetNodeId: string;
      messageId: string;
      receivedAt: number;
    };

export type DevMeshServerMessage =
  | { kind: 'WELCOME'; nodeId: string; peerIds: string[] }
  | { kind: 'PEERS'; peerIds: string[] }
  | { kind: 'ENVELOPE'; fromNodeId: string; envelope: MeshEnvelope<unknown> }
  | {
      kind: 'PEER_RECEIPT';
      fromNodeId: string;
      messageId: string;
      receivedAt: number;
    }
  | { kind: 'ERROR'; message: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseDevMeshClientMessage(serialized: string): DevMeshClientMessage {
  const value = JSON.parse(serialized) as unknown;
  if (!isRecord(value) || typeof value.kind !== 'string' || typeof value.nodeId !== 'string') {
    throw new Error('Invalid development mesh client message.');
  }
  return value as unknown as DevMeshClientMessage;
}

export function parseDevMeshServerMessage(serialized: string): DevMeshServerMessage {
  const value = JSON.parse(serialized) as unknown;
  if (!isRecord(value) || typeof value.kind !== 'string') {
    throw new Error('Invalid development mesh server message.');
  }
  return value as unknown as DevMeshServerMessage;
}
