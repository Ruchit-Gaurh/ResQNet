import prisma from '../../config/database';

interface Coordinate {
  lat: number;
  lng: number;
  accuracyMeters?: number;
}

interface HelpState {
  requestId: string;
  requesterName?: string;
  note?: string;
  location: Coordinate;
  locationObservedAt: number;
  requestedAt: string;
  senderPseudonym: string;
  sourceMessageId: string;
  status: 'REQUESTING_HELP' | 'RESCUER_ASSIGNED' | 'RESCUER_NEARBY' | 'PERSON_FOUND';
  rescuerNodeId?: string;
  rescuerLocation?: Coordinate;
  rescuerLocationObservedAt?: number;
  updatedAt: string;
}

function objectValue(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function coordinate(value: unknown): Coordinate | undefined {
  const item = objectValue(value);
  if (!item || !Number.isFinite(item.lat) || !Number.isFinite(item.lng)) return undefined;
  return {
    lat: item.lat as number,
    lng: item.lng as number,
    accuracyMeters: Number.isFinite(item.accuracyMeters) ? item.accuracyMeters as number : undefined,
  };
}

async function readHelpStates(): Promise<Map<string, HelpState>> {
  const messages = await prisma.syncMessage.findMany({
    where: { messageType: 'EMERGENCY' },
    orderBy: { processedAt: 'asc' },
    take: 5_000,
  });
  const states = new Map<string, HelpState>();

  for (const message of messages) {
    const payload = objectValue(message.payload);
    if (!payload) continue;
    const requestLocation = coordinate(payload.location);
    if (
      payload.status === 'REQUESTING_HELP'
      && payload.consentToShareLocation === true
      && typeof payload.requestId === 'string'
      && typeof payload.timestamp === 'string'
      && Number.isFinite(payload.locationObservedAt)
      && requestLocation
    ) {
      states.set(payload.requestId, {
        requestId: payload.requestId,
        requesterName: typeof payload.requesterName === 'string' ? payload.requesterName : undefined,
        note: typeof payload.note === 'string' ? payload.note : undefined,
        location: requestLocation,
        locationObservedAt: payload.locationObservedAt as number,
        requestedAt: payload.timestamp,
        senderPseudonym: message.senderPseudonym,
        sourceMessageId: message.messageId,
        status: 'REQUESTING_HELP',
        updatedAt: message.processedAt.toISOString(),
      });
      continue;
    }

    if (payload.kind !== 'RESCUE_SIGNAL' || typeof payload.targetRequestId !== 'string') continue;
    const state = states.get(payload.targetRequestId);
    if (!state || payload.targetSenderPseudonym !== state.senderPseudonym) continue;
    const action = payload.action;
    if (!['RESCUE_ACCEPTED', 'RESCUER_LOCATION', 'RESCUER_NEARBY', 'PERSON_FOUND'].includes(String(action))) {
      continue;
    }
    state.rescuerNodeId = typeof payload.rescuerNodeId === 'string' ? payload.rescuerNodeId : state.rescuerNodeId;
    state.updatedAt = typeof payload.sentAt === 'string' ? payload.sentAt : message.processedAt.toISOString();
    const latestRescuerLocation = coordinate(payload.rescuerLocation);
    if (latestRescuerLocation) {
      state.rescuerLocation = latestRescuerLocation;
      state.rescuerLocationObservedAt = Number.isFinite(payload.rescuerLocationObservedAt)
        ? payload.rescuerLocationObservedAt as number
        : message.processedAt.getTime();
    }
    state.status = action === 'PERSON_FOUND'
      ? 'PERSON_FOUND'
      : action === 'RESCUER_NEARBY'
        ? 'RESCUER_NEARBY'
        : 'RESCUER_ASSIGNED';
  }
  return states;
}

export const rescueService = {
  async listActiveTargets() {
    const states = await readHelpStates();
    return [...states.values()]
      .filter((item) => item.status !== 'PERSON_FOUND')
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  },

  async getRequesterStatus(requestId: string, requesterNodeId: string) {
    const state = (await readHelpStates()).get(requestId);
    if (!state || state.senderPseudonym !== `MOBILE-${requesterNodeId}`) return undefined;
    return state;
  },
};
