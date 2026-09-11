import type { DisasterCase, MeshEnvelope } from '../../../shared/types/index';

export type RescueSignalAction =
  | 'RESCUE_ACCEPTED'
  | 'RESCUER_LOCATION'
  | 'RESCUER_NEARBY'
  | 'PERSON_FOUND';

export interface RescueSignalPayload {
  kind: 'RESCUE_SIGNAL';
  action: RescueSignalAction;
  targetRequestId: string;
  targetSenderPseudonym: string;
  rescuerNodeId: string;
  rescuerLocation?: {
    lat: number;
    lng: number;
    accuracyMeters?: number;
  };
  rescuerLocationObservedAt?: number;
  sentAt: string;
}

export interface HelpRescueStatus {
  requestId: string;
  status: 'REQUESTING_HELP' | 'RESCUER_ASSIGNED' | 'RESCUER_NEARBY' | 'PERSON_FOUND';
  rescuerNodeId?: string;
  rescuerLocation?: {
    lat: number;
    lng: number;
    accuracyMeters?: number;
  };
  rescuerLocationObservedAt?: number;
  updatedAt: string;
}

export function rescueSignalTarget(target: DisasterCase): {
  requestId: string;
  senderPseudonym: string;
  nodeId: string;
} | undefined {
  if (!target.caseId.startsWith('EMERGENCY-') || !target.createdById) return undefined;
  const requestId = target.caseId.slice('EMERGENCY-'.length);
  const senderPseudonym = target.createdById;
  const nodeId = senderPseudonym.startsWith('MOBILE-')
    ? senderPseudonym.slice('MOBILE-'.length)
    : senderPseudonym;
  if (!requestId || !nodeId) return undefined;
  return { requestId, senderPseudonym, nodeId };
}

export function isRescueSignalEnvelope(
  envelope: MeshEnvelope<unknown>,
): envelope is MeshEnvelope<RescueSignalPayload> {
  if (envelope.messageType !== 'EMERGENCY' || typeof envelope.payload !== 'object' || envelope.payload === null) {
    return false;
  }
  const payload = envelope.payload as Partial<RescueSignalPayload>;
  return payload.kind === 'RESCUE_SIGNAL'
    && ['RESCUE_ACCEPTED', 'RESCUER_LOCATION', 'RESCUER_NEARBY', 'PERSON_FOUND'].includes(String(payload.action))
    && typeof payload.targetRequestId === 'string'
    && typeof payload.targetSenderPseudonym === 'string'
    && typeof payload.rescuerNodeId === 'string'
    && typeof payload.sentAt === 'string';
}
