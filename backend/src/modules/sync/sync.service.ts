import prisma from '../../config/database';
import { generateCaseId, generateSightingId, generateCheckInId } from '../../utils/id-generator';
import { auditService, AuditActions } from '../audit/audit.service';
import type { SyncBatchInput } from './sync.validation';
import type { MeshMessageType, PriorityLevel, ReportSource } from '@prisma/client';

export const syncService = {
  async processBatch(request: SyncBatchInput) {
    const acknowledgedMessageIds: string[] = [];
    const errors: { messageId: string; error: string }[] = [];

    for (const envelope of request.outboundEnvelopes) {
      try {
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
        await prisma.$transaction(async (tx) => {
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
              const caseId = generateCaseId();
              await tx.case.create({
                data: {
                  caseId,
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
              break;
            }

            case 'FOUND_PERSON': {
              const person = payload.person as Record<string, unknown> || payload;
              const caseId = generateCaseId();
              await tx.case.create({
                data: {
                  caseId,
                  type: 'FOUND',
                  status: 'INFORMATION_RECEIVED',
                  priority: 'NORMAL',
                  personName: (person.name as string) || 'Unknown Person',
                  personData: person as object,
                  lastKnownLocation: payload.location as object | undefined,
                  source: (payload.source as ReportSource) || 'PUBLIC',
                  sourceTrustScore: 0.5,
                  verificationState: 'UNVERIFIED',
                  createdById: envelope.senderPseudonym,
                },
              });
              break;
            }

            case 'SIGHTING': {
              const sightingId = generateSightingId();
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
                  clothingDescription: payload.clothingDescription as string | undefined,
                  directionOfMovement: payload.directionOfMovement as string | undefined,
                  confidenceScore: (payload.confidenceScore as number) || 0.5,
                  reportedByPseudonym: envelope.senderPseudonym,
                  verificationState: 'UNVERIFIED',
                },
              });
              break;
            }

            case 'SAFE_STATUS': {
              const checkInId = generateCheckInId();
              await tx.safeCheckIn.create({
                data: {
                  checkInId,
                  personName: (payload.personName as string) || 'Unknown',
                  phoneNumber: payload.phoneNumber as string | undefined,
                  location: (payload.location as object) || {},
                  statusMessage: payload.statusMessage as string | undefined,
                  affectedFamilyMembers: (payload.affectedFamilyMembers as string[]) || [],
                  senderPseudonym: envelope.senderPseudonym,
                },
              });
              break;
            }

            default:
              // Other message types — stored in SyncMessage only
              break;
          }
        });

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

    const [inboundCases, inboundMatches, inboundTimelineEvents] = await Promise.all([
      prisma.case.findMany({
        where: { updatedAt: { gt: sinceDate } },
        orderBy: { updatedAt: 'desc' },
        take: 100,
      }),
      prisma.matchCandidate.findMany({
        where: { createdAt: { gt: sinceDate } },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      prisma.auditLog.findMany({
        where: { timestamp: { gt: sinceDate } },
        orderBy: { timestamp: 'desc' },
        take: 100,
        select: {
          id: true,
          action: true,
          resource: true,
          resourceId: true,
          timestamp: true,
          metadata: true,
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
        evidenceIds: [],
      })),
      inboundMatches: inboundMatches.map((m) => ({
        matchId: m.matchId,
        targetMissingCaseId: m.targetMissingCaseId,
        candidateFoundCaseId: m.candidateFoundCaseId,
        overallScore: m.overallScore,
        confidenceLevel: m.confidenceLevel,
        breakdown: m.breakdown,
        reasons: m.reasons,
        warnings: m.warnings,
        status: m.status,
        createdAt: m.createdAt.toISOString(),
      })),
      inboundTimelineEvents: inboundTimelineEvents.map((e) => ({
        eventId: e.id,
        caseId: e.resourceId,
        timestamp: e.timestamp.toISOString(),
        source: 'RESPONDER' as const,
        title: e.action,
        description: JSON.stringify(e.metadata),
        verificationStatus: 'UNVERIFIED' as const,
      })),
      serverTimestamp: Date.now(),
    };
  },
};
