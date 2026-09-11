import type {
  DisasterCase,
  DevicePresenceTelemetry,
  GeoLocation,
  MeshEnvelope,
  SafeCheckIn,
  SightingReport,
  SyncBatchResponse,
} from '../../../shared/types/index';
import type { MeshTransportService } from '../../../mesh/MeshTransportService';
import {
  DEFAULT_MAX_HOPS,
  DEFAULT_REPORT_TTL_MS,
  SIGHTING_TTL_MS,
} from '../../../mesh/protocol/Envelope';
import { type DeliveryState, LocalQueueService } from './LocalQueueService';

export interface MissingReportInput {
  name?: string;
  approximateAge?: number;
  photoUri?: string;
  clothing?: string;
  zone?: string;
  details?: string;
}

export interface FoundReportInput {
  name?: string;
  approximateAge?: number;
  photoUri?: string;
  physicalDescription?: string;
  physicalCondition?: string;
  zone?: string;
  notes?: string;
}

export interface SafeCheckInInput {
  name: string;
  phoneNumber?: string;
  zone: string;
  note?: string;
  familyMembers?: string[];
}

export interface SightingInput {
  targetCaseId?: string;
  personDescription: string;
  zone: string;
  timestamp?: string;
  clothingDescription?: string;
  directionOfMovement?: string;
  photoUri?: string;
  notes?: string;
}

export interface SubmissionResult {
  messageId: string;
  deliveryState: DeliveryState;
  transportError?: string;
}

export interface ReportSubmissionOptions {
  senderPseudonym: string;
  createId: () => string;
  now?: () => number;
}

function clean(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function makeZoneLocation(zone: string): GeoLocation {
  return {
    lat: 0,
    lng: 0,
    accuracyMeters: 40_075_000,
    zone: zone.trim(),
  };
}

export class ReportSubmissionService {
  private readonly now: () => number;

  constructor(
    private readonly localQueue: LocalQueueService,
    private readonly mesh: MeshTransportService,
    private readonly options: ReportSubmissionOptions,
  ) {
    this.now = options.now ?? Date.now;
  }

  async submitMissing(input: MissingReportInput): Promise<SubmissionResult> {
    const createdAt = new Date(this.now()).toISOString();
    const caseId = `CASE-${this.options.createId()}`;
    const payload: DisasterCase = {
      caseId,
      type: 'MISSING',
      status: 'REGISTERED',
      priority: 'HIGH',
      person: {
        name: clean(input.name) ?? 'UNKNOWN PERSON',
        approximateAge: input.approximateAge,
        gender: 'UNKNOWN',
        clothing: clean(input.clothing),
        identifyingMarks: clean(input.details),
        photoUrl: clean(input.photoUri),
      },
      lastKnownLocation: clean(input.zone) ? makeZoneLocation(input.zone ?? '') : undefined,
      source: 'FAMILY',
      sourceTrustScore: 0,
      verificationState: 'UNVERIFIED',
      createdAt,
      updatedAt: createdAt,
      evidenceIds: [],
    };
    return this.submitEnvelope('MISSING_PERSON', 'HIGH', payload, DEFAULT_REPORT_TTL_MS);
  }

  async submitFound(input: FoundReportInput): Promise<SubmissionResult> {
    const createdAt = new Date(this.now()).toISOString();
    const details = [clean(input.physicalDescription), clean(input.notes)].filter(
      (value): value is string => Boolean(value),
    );
    const payload: DisasterCase = {
      caseId: `CASE-${this.options.createId()}`,
      type: 'FOUND',
      status: 'INFORMATION_RECEIVED',
      priority: 'HIGH',
      person: {
        name: clean(input.name) ?? 'UNKNOWN PERSON',
        approximateAge: input.approximateAge,
        gender: 'UNKNOWN',
        identifyingMarks: details.length > 0 ? details.join(' • ') : undefined,
        medicalNeeds: clean(input.physicalCondition),
        photoUrl: clean(input.photoUri),
      },
      lastKnownLocation: clean(input.zone) ? makeZoneLocation(input.zone ?? '') : undefined,
      source: 'PUBLIC',
      sourceTrustScore: 0,
      verificationState: 'UNVERIFIED',
      createdAt,
      updatedAt: createdAt,
      evidenceIds: [],
    };
    return this.submitEnvelope('FOUND_PERSON', 'HIGH', payload, DEFAULT_REPORT_TTL_MS);
  }

  async submitSafe(input: SafeCheckInInput): Promise<SubmissionResult> {
    const payload: SafeCheckIn = {
      checkInId: `SAFE-${this.options.createId()}`,
      personName: input.name.trim(),
      phoneNumber: clean(input.phoneNumber),
      location: makeZoneLocation(input.zone),
      timestamp: new Date(this.now()).toISOString(),
      statusMessage: clean(input.note),
      affectedFamilyMembers: input.familyMembers?.map((name) => name.trim()).filter(Boolean),
      senderPseudonym: this.options.senderPseudonym,
    };
    return this.submitEnvelope('SAFE_STATUS', 'CRITICAL', payload, DEFAULT_REPORT_TTL_MS);
  }

  async submitSighting(input: SightingInput): Promise<SubmissionResult> {
    const description = [clean(input.personDescription), clean(input.notes)].filter(
      (value): value is string => Boolean(value),
    );
    const payload: SightingReport = {
      sightingId: `SIGHT-${this.options.createId()}`,
      targetCaseId: clean(input.targetCaseId),
      personDescription: description.join(' • '),
      location: makeZoneLocation(input.zone),
      timestamp: input.timestamp ?? new Date(this.now()).toISOString(),
      clothingDescription: clean(input.clothingDescription),
      directionOfMovement: clean(input.directionOfMovement),
      confidenceScore: 0,
      photoUrl: clean(input.photoUri),
      reportedByPseudonym: this.options.senderPseudonym,
      verificationState: 'UNVERIFIED',
    };
    return this.submitEnvelope('SIGHTING', 'NORMAL', payload, SIGHTING_TTL_MS);
  }

  async syncWithGateway(
    gatewayUrl: string,
    deviceTelemetry?: DevicePresenceTelemetry,
  ): Promise<SyncBatchResponse> {
    const response = await this.mesh.syncWithGateway(gatewayUrl, deviceTelemetry);
    await this.localQueue.applySyncResponse(response);
    return response;
  }

  private async submitEnvelope<T extends object>(
    messageType: MeshEnvelope<T>['messageType'],
    priority: MeshEnvelope<T>['priority'],
    payload: T,
    ttlMs: number,
  ): Promise<SubmissionResult> {
    const createdAt = this.now();
    const envelope: MeshEnvelope<T> = {
      messageId: this.options.createId(),
      messageType,
      priority,
      createdAt,
      expiresAt: createdAt + ttlMs,
      hopCount: 0,
      maxHops: DEFAULT_MAX_HOPS,
      senderPseudonym: this.options.senderPseudonym,
      destinationType: 'GATEWAY',
      payload,
    };

    await this.localQueue.saveEnvelope(envelope);

    try {
      const result = await this.mesh.sendMeshMessage(envelope);
      if (result.immediateRelay) {
        await this.localQueue.markRelaying(envelope.messageId);
        return { messageId: envelope.messageId, deliveryState: 'RELAYING' };
      }
      return { messageId: envelope.messageId, deliveryState: 'SAVED_LOCALLY' };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Mesh relay failed.';
      await this.localQueue.markTransportError(envelope.messageId, message);
      return {
        messageId: envelope.messageId,
        deliveryState: 'SAVED_LOCALLY',
        transportError: message,
      };
    }
  }
}
