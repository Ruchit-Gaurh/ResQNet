import prisma from '../../config/database';

/**
 * Audit service — records all important system events.
 * Audit logs are immutable and append-only.
 */
export const auditService = {
  /**
   * Record an audit event.
   */
  async log(params: {
    actor: string;
    action: string;
    resource: string;
    resourceId: string;
    caseId?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          actor: params.actor,
          action: params.action,
          resource: params.resource,
          resourceId: params.resourceId,
          caseId: params.caseId,
          metadata: params.metadata ? (params.metadata as any) : undefined,
        },
      });
    } catch (error) {
      // Audit logging should never crash the main operation.
      // Log to console as fallback.
      console.error('[AUDIT] Failed to write audit log:', error);
      console.error('[AUDIT] Event:', JSON.stringify(params));
    }
  },
};

// Audit action constants
export const AuditActions = {
  CASE_CREATED: 'CASE_CREATED',
  FOUND_PERSON_REGISTERED: 'FOUND_PERSON_REGISTERED',
  SIGHTING_SUBMITTED: 'SIGHTING_SUBMITTED',
  SAFE_CHECKIN_SUBMITTED: 'SAFE_CHECKIN_SUBMITTED',
  CASE_VIEWED: 'CASE_VIEWED',
  CASE_STATUS_CHANGED: 'CASE_STATUS_CHANGED',
  SYNC_MESSAGE_PROCESSED: 'SYNC_MESSAGE_PROCESSED',
  MATCH_CANDIDATE_GENERATED: 'MATCH_CANDIDATE_GENERATED',
  VERIFICATION_PERFORMED: 'VERIFICATION_PERFORMED',
  CASES_MERGED: 'CASES_MERGED',
} as const;
