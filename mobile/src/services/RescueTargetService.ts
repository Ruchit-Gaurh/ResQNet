import type { DisasterCase, MeshEnvelope } from '../../../shared/types/index';
import type { LocalQueueService, LocalStorageAdapter } from './LocalQueueService';
import type { EmergencyHelpRequest } from './ReportSubmissionService';

const RESCUE_TARGET_CACHE_KEY = '@resqnet/rescue-targets/v1';
const RESOLVED_TARGETS_KEY = '@resqnet/resolved-rescue-targets/v1';

interface RemoteHelpTarget {
  requestId: string;
  requesterName?: string;
  note?: string;
  location: { lat: number; lng: number; accuracyMeters?: number };
  locationObservedAt: number;
  requestedAt: string;
  senderPseudonym: string;
  sourceMessageId: string;
  updatedAt: string;
}

export function hasUsableCoordinate(item: DisasterCase): boolean {
  const location = item.lastKnownLocation;
  return Boolean(
    location
    && Number.isFinite(location.lat)
    && Number.isFinite(location.lng)
    && !(location.lat === 0 && location.lng === 0),
  );
}

function isActiveMissingCase(item: DisasterCase): boolean {
  return item.type === 'MISSING'
    && !['REUNITED', 'CLOSED', 'REJECTED', 'DUPLICATE'].includes(item.status);
}

export class RescueTargetService {
  private responderToken?: string;

  constructor(
    private readonly storage: LocalStorageAdapter,
    private readonly localQueue: LocalQueueService,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async authenticateRescuer(backendBaseUrl: string, username: string, password: string): Promise<boolean> {
    try {
      const response = await this.fetchImpl(`${backendBaseUrl.replace(/\/$/, '')}/api/v1/auth/rescuer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      if (!response.ok) return false;
      const result = await response.json() as { success?: boolean; token?: string };
      if (!result.success || !result.token) return false;
      this.responderToken = result.token;
      return true;
    } catch {
      return false;
    }
  }

  async getTargets(backendBaseUrl: string): Promise<{ targets: DisasterCase[]; fromCache: boolean }> {
    const localTargets = await this.getLocalTargets();
    const resolvedIds = await this.getResolvedIds();
    try {
      if (!this.responderToken) throw new Error('Remote rescue targets require responder authentication.');
      const response = await this.fetchImpl(`${backendBaseUrl.replace(/\/$/, '')}/api/v1/rescue/targets`, {
        headers: { Authorization: `Bearer ${this.responderToken}` },
      });
      if (!response.ok) throw new Error(`Target request failed with HTTP ${response.status}.`);
      const result = await response.json() as { success?: boolean; targets?: RemoteHelpTarget[] };
      if (!result.success || !Array.isArray(result.targets)) throw new Error('Invalid target response.');
      const targets = this.mergeTargets(
        localTargets,
        result.targets.map((item) => this.remoteEmergencyTarget(item)).filter(hasUsableCoordinate),
      ).filter((item) => !resolvedIds.has(item.caseId));
      await this.storage.setItem(RESCUE_TARGET_CACHE_KEY, JSON.stringify(targets));
      return { targets, fromCache: false };
    } catch (error) {
      const cached = await this.storage.getItem(RESCUE_TARGET_CACHE_KEY);
      if (!cached && localTargets.length === 0) throw error;
      const parsed = cached ? JSON.parse(cached) as DisasterCase[] : [];
      return {
        targets: this.mergeTargets(
          localTargets,
          parsed.filter((item) => isActiveMissingCase(item) && hasUsableCoordinate(item)),
        ).filter((item) => !resolvedIds.has(item.caseId)),
        fromCache: true,
      };
    }
  }

  private remoteEmergencyTarget(item: RemoteHelpTarget): DisasterCase {
    return {
      caseId: `EMERGENCY-${item.requestId}`,
      type: 'MISSING',
      status: 'INFORMATION_RECEIVED',
      priority: 'CRITICAL',
      person: {
        name: item.requesterName ?? 'Person requesting urgent help',
        gender: 'UNKNOWN',
        identifyingMarks: item.note,
      },
      lastKnownLocation: item.location,
      lastKnownTime: new Date(item.locationObservedAt).toISOString(),
      source: 'PUBLIC',
      sourceTrustScore: 0,
      verificationState: 'UNVERIFIED',
      createdAt: item.requestedAt,
      updatedAt: item.updatedAt,
      createdById: item.senderPseudonym,
      evidenceIds: [item.sourceMessageId],
    };
  }

  async markFound(caseId: string): Promise<void> {
    const resolvedIds = await this.getResolvedIds();
    resolvedIds.add(caseId);
    const cached = await this.storage.getItem(RESCUE_TARGET_CACHE_KEY);
    let remainingTargets: DisasterCase[] = [];
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as unknown;
        remainingTargets = Array.isArray(parsed)
          ? parsed.filter((item): item is DisasterCase => this.isDisasterCase(item) && item.caseId !== caseId)
          : [];
      } catch {
        remainingTargets = [];
      }
    }
    // Do not leave an exact completed target location in the responder's
    // offline cache after visual contact has been confirmed.
    await Promise.all([
      this.storage.setItem(RESOLVED_TARGETS_KEY, JSON.stringify([...resolvedIds])),
      this.storage.setItem(RESCUE_TARGET_CACHE_KEY, JSON.stringify(remainingTargets)),
    ]);
  }

  private async getLocalTargets(): Promise<DisasterCase[]> {
    const owned = (await this.localQueue.getCases())
      .filter((item) => isActiveMissingCase(item) && hasUsableCoordinate(item));
    const outgoingEmergency = (await this.localQueue.getRecords()).flatMap((record) => {
      const target = this.emergencyTarget(record.envelope);
      return target ? [target] : [];
    });
    const received = (await this.localQueue.getReceivedRecords()).flatMap((record) => {
      const payload = record.envelope.payload;
      const emergency = this.emergencyTarget(record.envelope);
      if (emergency) return [emergency];
      if (!this.isDisasterCase(payload) || !isActiveMissingCase(payload) || !hasUsableCoordinate(payload)) {
        return [];
      }
      return [payload];
    });
    return this.mergeTargets(owned, outgoingEmergency, received);
  }

  private emergencyTarget(envelope: MeshEnvelope<unknown>): DisasterCase | undefined {
    if (envelope.messageType !== 'EMERGENCY' || !this.isEmergencyHelpRequest(envelope.payload)) {
      return undefined;
    }
    const payload = envelope.payload;
    return {
      caseId: `EMERGENCY-${payload.requestId}`,
      type: 'MISSING',
      status: 'INFORMATION_RECEIVED',
      priority: 'CRITICAL',
      person: {
        name: payload.requesterName ?? 'Person requesting urgent help',
        gender: 'UNKNOWN',
        identifyingMarks: payload.note,
      },
      lastKnownLocation: payload.location,
      lastKnownTime: new Date(payload.locationObservedAt).toISOString(),
      source: 'PUBLIC',
      sourceTrustScore: 0,
      verificationState: 'UNVERIFIED',
      createdAt: payload.timestamp,
      updatedAt: payload.timestamp,
      createdById: envelope.senderPseudonym,
      evidenceIds: [envelope.messageId],
    };
  }

  private async getResolvedIds(): Promise<Set<string>> {
    const value = await this.storage.getItem(RESOLVED_TARGETS_KEY);
    if (!value) return new Set();
    try {
      const parsed = JSON.parse(value) as unknown;
      return new Set(Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : []);
    } catch {
      return new Set();
    }
  }

  private mergeTargets(...groups: DisasterCase[][]): DisasterCase[] {
    const byId = new Map<string, DisasterCase>();
    for (const item of groups.flat()) {
      const current = byId.get(item.caseId);
      if (!current || item.updatedAt > current.updatedAt) byId.set(item.caseId, item);
    }
    return [...byId.values()].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  private isDisasterCase(value: unknown): value is DisasterCase {
    if (typeof value !== 'object' || value === null) return false;
    const item = value as Partial<DisasterCase>;
    return typeof item.caseId === 'string' && item.type === 'MISSING' && typeof item.person === 'object';
  }

  private isEmergencyHelpRequest(value: unknown): value is EmergencyHelpRequest {
    if (typeof value !== 'object' || value === null) return false;
    const item = value as Partial<EmergencyHelpRequest>;
    return item.status === 'REQUESTING_HELP'
      && item.consentToShareLocation === true
      && typeof item.requestId === 'string'
      && typeof item.timestamp === 'string'
      && Number.isFinite(item.locationObservedAt)
      && typeof item.location === 'object'
      && item.location !== null
      && Number.isFinite(item.location.lat)
      && Number.isFinite(item.location.lng)
      && !(item.location.lat === 0 && item.location.lng === 0);
  }
}
