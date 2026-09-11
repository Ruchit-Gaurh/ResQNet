import prisma from '../../config/database';
import { generateCaseId } from '../../utils/id-generator';
import { Errors } from '../../utils/errors';
import { auditService, AuditActions } from '../audit/audit.service';
import { serializeCase } from './cases.serializer';
import type { CreateMissingCaseInput, CreateFoundCaseInput } from './cases.validation';

// Source trust scores
const SOURCE_TRUST: Record<string, number> = {
  FAMILY: 0.8,
  PUBLIC: 0.3,
  VOLUNTEER: 0.5,
  HOSPITAL: 0.9,
  RELIEF_CAMP: 0.7,
  RESPONDER: 1.0,
};

export const casesService = {
  async createMissingCase(data: CreateMissingCaseInput, userId: string) {
    const caseId = generateCaseId();

    const newCase = await prisma.case.create({
      data: {
        caseId,
        type: 'MISSING',
        status: 'SEARCHING',
        priority: data.priority,
        personName: data.person.name,
        personData: data.person as object,
        lastKnownLocation: data.lastKnownLocation ? (data.lastKnownLocation as object) : undefined,
        lastKnownTime: data.lastKnownTime ? new Date(data.lastKnownTime) : undefined,
        source: data.source,
        sourceTrustScore: SOURCE_TRUST[data.source] ?? 0.5,
        verificationState: 'UNVERIFIED',
        createdById: userId,
      },
    });

    await auditService.log({
      actor: userId,
      action: AuditActions.CASE_CREATED,
      resource: 'Case',
      resourceId: caseId,
      caseId: newCase.id,
      metadata: { type: 'MISSING', source: data.source, priority: data.priority },
    });

    // Trigger matching against found cases asynchronously
    try {
      const { matchingService } = require('../matching/matching.service');
      matchingService.scanMissingCaseAgainstFound(newCase.id).catch((err: Error) =>
        console.error('[MATCHING] Async scan error:', err.message)
      );
    } catch { /* matching module may not be ready */ }

    return {
      success: true,
      caseId,
      status: 'SEARCHING',
      verificationState: 'UNVERIFIED',
      createdAt: newCase.createdAt.toISOString(),
    };
  },

  async createFoundCase(data: CreateFoundCaseInput, userId: string) {
    const caseId = generateCaseId();
    const isUnidentified = /^unknown/i.test(data.person.name.trim());

    const newCase = await prisma.case.create({
      data: {
        caseId,
        type: isUnidentified ? 'UNIDENTIFIED_PATIENT' : 'FOUND',
        status: 'INFORMATION_RECEIVED',
        priority: 'NORMAL',
        personName: data.person.name,
        personData: data.person as object,
        lastKnownLocation: data.location as object,
        source: data.source,
        sourceTrustScore: SOURCE_TRUST[data.source] ?? 0.5,
        verificationState: 'UNVERIFIED',
        createdById: userId,
      },
    });

    await auditService.log({
      actor: userId,
      action: AuditActions.FOUND_PERSON_REGISTERED,
      resource: 'Case',
      resourceId: caseId,
      caseId: newCase.id,
      metadata: { type: newCase.type, source: data.source },
    });

    // Trigger matching against missing cases asynchronously
    try {
      const { matchingService } = require('../matching/matching.service');
      matchingService.scanFoundCaseAgainstMissing(newCase.id).catch((err: Error) =>
        console.error('[MATCHING] Async scan error:', err.message)
      );
    } catch { /* matching module may not be ready */ }

    return {
      success: true,
      caseId,
      status: 'INFORMATION_RECEIVED',
    };
  },

  async getCaseById(caseId: string, userRole: string) {
    const caseRecord = await prisma.case.findUnique({
      where: { caseId },
      include: {
        evidenceReports: true,
        sightings: true,
      },
    });

    if (!caseRecord) {
      throw Errors.notFound('Case', caseId);
    }

    // Audit sensitive case views
    await auditService.log({
      actor: 'system',
      action: AuditActions.CASE_VIEWED,
      resource: 'Case',
      resourceId: caseId,
      caseId: caseRecord.id,
      metadata: { viewerRole: userRole },
    });

    return serializeCase(caseRecord, userRole);
  },

  async listCases(filters: { type?: string; status?: string; zone?: string }, userRole: string) {
    const where: any = {};
    if (filters.type) {
      where.type = filters.type;
    }
    if (filters.status) {
      where.status = filters.status;
    }

    const cases = await prisma.case.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        evidenceReports: true,
        sightings: true,
      },
    });

    let results = cases.map((c) => serializeCase(c, userRole));
    if (filters.zone) {
      results = results.filter((c) => {
        const zoneStr = (c.lastKnownLocation as any)?.zone;
        return typeof zoneStr === 'string' && zoneStr.toLowerCase().includes(filters.zone!.toLowerCase());
      });
    }

    return results;
  },
};
