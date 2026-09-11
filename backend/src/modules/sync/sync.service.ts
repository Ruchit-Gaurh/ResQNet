import prisma from '../../config/database';
import { generateCaseId, generateSightingId, generateCheckInId } from '../../utils/id-generator';
import { auditService, AuditActions } from '../audit/audit.service';
import { matchingService } from '../matching/matching.service';
import { deviceTelemetrySchema, type SyncBatchInput } from './sync.validation';
import type { MeshMessageType, PriorityLevel, ReportSource } from '@prisma/client';

type CreatedCaseForMatching = { id: string; type: 'MISSING' | 'FOUND' | 'UNIDENTIFIED_PATIENT' };
type DeviceTelemetry = NonNullable<SyncBatchInput['deviceTelemetry']>;

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

async function recordDevicePresence(
  telemetry: DeviceTelemetry,
  connectivitySource: 'DIRECT' | 'RELAYED',
  relayedByNodeId?: string,
): Promise<void> {
  const existing = await prisma.devicePresence.findUnique({ where: { nodeId: telemetry.nodeId } });
  const observedAt = new Date(telemetry.observedAt);
  const now = new Date();

  // A delayed store-carry-forward capsule must never overwrite a newer direct
  // observation. Its gateway receipt is still recorded by SyncMessage.
  if (existing && existing.presenceObservedAt > observedAt) return;

  const location = telemetry.location;
  await prisma.devicePresence.upsert({
    where: { nodeId: telemetry.nodeId },
    create: {
      nodeId: telemetry.nodeId,
      displayName: telemetry.displayName,
      transportMode: telemetry.transportMode,
      connectivitySource,
      latitude: location?.lat,
      longitude: location?.lng,
      accuracyMeters: location?.accuracyMeters,
      zone: location?.zone,
      locationObservedAt: telemetry.locationObservedAt
        ? new Date(telemetry.locationObservedAt)
        : location ? observedAt : undefined,
      presenceObservedAt: observedAt,
      lastGatewayContactAt: now,
      relayedByNodeId: connectivitySource === 'RELAYED' ? relayedByNodeId : undefined,
      nearbyPeerIds: telemetry.nearbyPeerIds,
      queuedMessageCount: telemetry.queuedMessageCount,
    },
    update: {
      displayName: telemetry.displayName,
      transportMode: telemetry.transportMode,
      connectivitySource,
      latitude: location?.lat,
      longitude: location?.lng,
      accuracyMeters: location?.accuracyMeters,
      zone: location?.zone,
      locationObservedAt: telemetry.locationObservedAt
        ? new Date(telemetry.locationObservedAt)
        : location ? observedAt : existing?.locationObservedAt ?? undefined,
      presenceObservedAt: observedAt,
      lastGatewayContactAt: now,
      relayedByNodeId: connectivitySource === 'RELAYED' ? relayedByNodeId : null,
      nearbyPeerIds: telemetry.nearbyPeerIds,
      queuedMessageCount: telemetry.queuedMessageCount,
    },
  });
}

function timelineCopy(action: string, metadata: unknown): { title: string; description: string } {
  const detail = metadata && typeof metadata === 'object'
    ? metadata as Record<string, unknown>
    : {};
  if (action === AuditActions.MATCH_CANDIDATE_GENERATED) {
    const score = typeof detail.score === 'number' ? ` (prototype score ${detail.score})` : '';
    return {
      title: 'Possible match identified',
      description: `The matching service found a candidate${score}. Human confirmation is still required.`,
    };
  }
  if (action === AuditActions.VERIFICATION_PERFORMED) {
    return {
      title: 'Human verification completed',
      description: `An authorized responder recorded: ${stringValue(detail.decision) ?? 'REVIEWED'}.`,
    };
  }
  if (action === AuditActions.CASE_STATUS_CHANGED) {
    return {
      title: 'Case status updated',
      description: `The verified case status is now ${stringValue(detail.newStatus)?.replaceAll('_', ' ') ?? 'updated'}.`,
    };
  }
  return { title: action.replaceAll('_', ' '), description: 'An auditable case update was recorded.' };
}

export const syncService = {
  async processBatch(request: SyncBatchInput) {
    const acknowledgedMessageIds: string[] = [];
    const errors: { messageId: string; error: string }[] = [];

    if (request.deviceTelemetry?.nodeId === request.deviceId) {
      await recordDevicePresence(request.deviceTelemetry, 'DIRECT');
    }

    for (const envelope of request.outboundEnvelopes) {
      try {
        if (envelope.messageType === 'NETWORK_STATUS') {
          const telemetryResult = deviceTelemetrySchema.safeParse(envelope.payload);
          if (telemetryResult.success) {
            const source = telemetryResult.data.nodeId === request.deviceId ? 'DIRECT' : 'RELAYED';
            await recordDevicePresence(
              telemetryResult.data,
              source,
              source === 'RELAYED' ? request.deviceId : undefined,
            );
          }
        }

        // Check if already processed (idempotency)
        const existing = await prisma.syncMessage.findUnique({
          where: { messageId: envelope.messageId },
        });

        if (existing) {
          // Already processed — skip but acknowledge
          acknowledgedMessageIds.push(envelope.messageId);
          continue;
        }

        // Process based on message type within a transaction
        const createdCase = await prisma.$transaction(async (tx): Promise<CreatedCaseForMatching | undefined> => {
          // Record the sync message FIRST (unique constraint prevents duplicates)
          await tx.syncMessage.create({
            data: {
              messageId: envelope.messageId,
              messageType: envelope.messageType as MeshMessageType,
              deviceId: request.deviceId,
              senderPseudonym: envelope.senderPseudonym,
              payload: envelope.payload as object,
            },
          });

          const payload = envelope.payload as Record<string, unknown>;

          // Delegate to appropriate handler
          switch (envelope.messageType) {
            case 'MISSING_PERSON': {
              const person = payload.person as Record<string, unknown> || payload;
              const created = await tx.case.create({
                data: {
                  caseId: stringValue(payload.caseId) ?? generateCaseId(),
                  type: 'MISSING',
                  status: 'SEARCHING',
                  priority: (envelope.priority || 'NORMAL') as PriorityLevel,
                  personName: (person.name as string) || 'Unknown',
                  personData: person as object,
                  lastKnownLocation: payload.lastKnownLocation as object | undefined,
                  lastKnownTime: payload.lastKnownTime ? new Date(payload.lastKnownTime as string) : undefined,
                  source: (payload.source as ReportSource) || 'PUBLIC',
                  sourceTrustScore: 0.5,
                  verificationState: 'UNVERIFIED',
                  createdById: envelope.senderPseudonym,
                },
              });
              return { id: created.id, type: created.type };
            }

            case 'FOUND_PERSON': {
              const person = payload.person as Record<string, unknown> || payload;
              const unknownIdentity = !stringValue(person.name) || person.name === 'UNKNOWN PERSON';
              const created = await tx.case.create({
                data: {
                  caseId: stringValue(payload.caseId) ?? generateCaseId(),
                  type: unknownIdentity ? 'UNIDENTIFIED_PATIENT' : 'FOUND',
                  status: 'INFORMATION_RECEIVED',
                  priority: 'NORMAL',
                  personName: (person.name as string) || 'Unknown Person',
                  personData: person as object,
                  lastKnownLocation: (payload.lastKnownLocation ?? payload.location) as object | undefined,
                  lastKnownTime: payload.lastKnownTime ? new Date(payload.lastKnownTime as string) : undefined,
                  source: (payload.source as ReportSource) || 'PUBLIC',
                  sourceTrustScore: 0.5,
                  verificationState: 'UNVERIFIED',
                  createdById: envelope.senderPseudonym,
                },
              });
              return { id: created.id, type: created.type };
            }

            case 'SIGHTING': {
              const sightingId = stringValue(payload.sightingId) ?? generateSightingId();
              // Resolve targetCaseId if provided
              let internalCaseId: string | null = null;
              if (payload.targetCaseId) {
                const targetCase = await tx.case.findUnique({
                  where: { caseId: payload.targetCaseId as string },
                });
                internalCaseId = targetCase?.id ?? null;
              }
              await tx.sighting.create({
                data: {
                  sightingId,
                  targetCaseId: internalCaseId,
                  personDescription: (payload.personDescription as string) || 'Sighting from mesh',
                  location: (payload.location as object) || {},
                  timestamp: payload.timestamp ? new Date(payload.timestamp as string) : undefined,
                  clothingDescription: payload.clothingDescription as string | undefined,
                  directionOfMovement: payload.directionOfMovement as string | undefined,
                  confidenceScore: (payload.confidenceScore as number) || 0.5,
                  photoUrl: stringValue(payload.photoUrl),
                  reportedByPseudonym: envelope.senderPseudonym,
                  verificationState: 'UNVERIFIED',
                },
              });
              return undefined;
            }

            case 'SAFE_STATUS': {
              const checkInId = stringValue(payload.checkInId) ?? generateCheckInId();
              await tx.safeCheckIn.create({
                data: {
                  checkInId,
                  personName: (payload.personName as string) || 'Unknown',
                  phoneNumber: payload.phoneNumber as string | undefined,
                  location: (payload.location as object) || {},
                  timestamp: payload.timestamp ? new Date(payload.timestamp as string) : undefined,
                  statusMessage: payload.statusMessage as string | undefined,
                  affectedFamilyMembers: (payload.affectedFamilyMembers as string[]) || [],
                  senderPseudonym: envelope.senderPseudonym,
                },
              });
              return undefined;
            }

            default:
              // Other message types — stored in SyncMessage only
              return undefined;
          }
        });

        // Matching remains advisory. A valid, persisted disaster report is ACKed
        // even if candidate generation is temporarily unavailable.
        if (createdCase) {
          try {
            if (createdCase.type === 'MISSING') {
              await matchingService.scanMissingCaseAgainstFound(createdCase.id);
            } else {
              await matchingService.scanFoundCaseAgainstMissing(createdCase.id);
            }
          } catch (error) {
            console.error(`[SYNC] Matching failed for case ${createdCase.id}:`, error);
          }
        }

        acknowledgedMessageIds.push(envelope.messageId);

        // Audit
        await auditService.log({
          actor: envelope.senderPseudonym,
          action: AuditActions.SYNC_MESSAGE_PROCESSED,
          resource: 'SyncMessage',
          resourceId: envelope.messageId,
          metadata: {
            messageType: envelope.messageType,
            deviceId: request.deviceId,
          },
        });
      } catch (error: any) {
        // Handle unique constraint violation (concurrent duplicate)
        if (error?.code === 'P2002') {
          acknowledgedMessageIds.push(envelope.messageId);
          continue;
        }
        console.error(`[SYNC] Error processing message ${envelope.messageId}:`, error);
        errors.push({ messageId: envelope.messageId, error: error.message || 'Processing failed' });
      }
    }

    // Gather inbound data since lastSyncTimestamp
    const sinceDate = new Date(request.lastSyncTimestamp);
    const ownerIds = [request.deviceId, `MOBILE-${request.deviceId}`];
    const ownedCases = await prisma.case.findMany({
      where: { createdById: { in: ownerIds } },
      select: { id: true },
    });
    const ownedInternalCaseIds = ownedCases.map((item) => item.id);

    const [inboundCases, inboundMatches, inboundTimelineEvents] = await Promise.all([
      prisma.case.findMany({
        where: {
          createdById: { in: ownerIds },
          updatedAt: { gt: sinceDate },
        },
        orderBy: { updatedAt: 'desc' },
        take: 100,
      }),
      prisma.matchCandidate.findMany({
        where: {
          updatedAt: { gt: sinceDate },
          OR: [
            { targetCase: { createdById: { in: ownerIds } } },
            { candidateCase: { createdById: { in: ownerIds } } },
          ],
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: {
          targetCase: { select: { caseId: true } },
          candidateCase: { select: { caseId: true } },
        },
      }),
      prisma.auditLog.findMany({
        where: {
          timestamp: { gt: sinceDate },
          caseId: { in: ownedInternalCaseIds },
        },
        orderBy: { timestamp: 'desc' },
        take: 100,
        select: {
          id: true,
          action: true,
          resource: true,
          resourceId: true,
          timestamp: true,
          metadata: true,
          case: { select: { caseId: true, verificationState: true } },
        },
      }),
    ]);

    return {
      acknowledgedMessageIds,
      inboundCases: inboundCases.map((c) => ({
        caseId: c.caseId,
        type: c.type,
        status: c.status,
        priority: c.priority,
        person: c.personData,
        lastKnownLocation: c.lastKnownLocation,
        lastKnownTime: c.lastKnownTime?.toISOString(),
        source: c.source,
        sourceTrustScore: c.sourceTrustScore,
        verificationState: c.verificationState,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
        createdById: c.createdById || undefined,
        evidenceIds: [],
      })),
      inboundMatches: inboundMatches.map((m) => ({
        matchId: m.matchId,
        targetMissingCaseId: m.targetCase.caseId,
        candidateFoundCaseId: m.candidateCase.caseId,
        overallScore: m.overallScore,
        confidenceLevel: m.confidenceLevel,
        breakdown: m.breakdown,
        reasons: m.reasons,
        warnings: m.warnings,
        status: m.status,
        reviewerId: m.reviewerId || undefined,
        reviewedAt: m.reviewedAt?.toISOString(),
        reviewNotes: m.reviewNotes || undefined,
        createdAt: m.createdAt.toISOString(),
      })),
      inboundTimelineEvents: inboundTimelineEvents.map((e) => {
        const copy = timelineCopy(e.action, e.metadata);
        return {
          eventId: e.id,
          caseId: e.case?.caseId ?? e.resourceId,
          timestamp: e.timestamp.toISOString(),
          source: 'RESPONDER' as const,
          title: copy.title,
          description: copy.description,
          verificationStatus:
            e.action === AuditActions.MATCH_CANDIDATE_GENERATED
              ? 'UNVERIFIED' as const
              : e.case?.verificationState ?? 'UNVERIFIED' as const,
        };
      }),
      serverTimestamp: Date.now(),
    };
  },
};
