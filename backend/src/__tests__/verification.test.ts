import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import { createServer, Server } from 'http';
import app from '../server';
import prisma from '../config/database';
import { generateTestToken } from './test-helpers';
import { matchingService } from '../modules/matching/matching.service';

vi.mock('../config/database', () => {
  return {
    default: {
      case: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
      },
      matchCandidate: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      verification: {
        create: vi.fn(),
      },
      auditLog: {
        create: vi.fn().mockResolvedValue({ id: 'audit-1' }),
        findMany: vi.fn(),
      },
      $transaction: vi.fn(async (cb) => {
        const tx = {
          matchCandidate: { update: vi.fn() },
          case: { update: vi.fn() },
          verification: { create: vi.fn() },
        };
        return cb(tx);
      }),
    },
  };
});

describe('Verification & Human Review Workflow', () => {
  let server: Server;
  let baseUrl: string;

  const publicToken = generateTestToken('PUBLIC', 'user-pub');
  const volunteerToken = generateTestToken('VOLUNTEER', 'user-vol');
  const adminToken = generateTestToken('RESPONDER_ADMIN', 'admin-ruchit');

  beforeAll(async () => {
    server = createServer(app);
    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        const addr = server.address();
        const port = typeof addr === 'object' && addr ? addr.port : 3004;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('AI Matching Generation Safety Rules', () => {
    it('AI engine always produces PENDING_REVIEW candidate, never auto-confirmed', async () => {
      const missingCase: any = {
        id: 'case-miss-1',
        caseId: 'CASE-10291',
        personName: 'Rahul Sharma',
        personData: { name: 'Rahul Sharma', age: 22, gender: 'MALE', clothing: 'Blue shirt' },
        lastKnownLocation: { lat: 28.6139, lng: 77.2090, zone: 'Zone A' },
        lastKnownTime: new Date(),
        createdAt: new Date(),
      };

      const foundCase: any = {
        id: 'case-found-1',
        caseId: 'CASE-10305',
        personName: 'Rahool Sharma',
        personData: { name: 'Rahool Sharma', approximateAge: 23, gender: 'MALE', clothing: 'Blue shirt' },
        lastKnownLocation: { lat: 28.6180, lng: 77.2150, zone: 'Zone A' },
        createdAt: new Date(),
      };

      (prisma.case.findUnique as any).mockResolvedValue(foundCase);
      (prisma.case.findMany as any).mockResolvedValue([missingCase]);
      (prisma.matchCandidate.create as any).mockImplementation(({ data }: any) => ({
        id: 'candidate-db-1',
        ...data,
      }));

      const candidates = await matchingService.scanFoundCaseAgainstMissing('case-found-1');

      expect(candidates.length).toBe(1);
      const candidate = candidates[0];
      // CRITICAL RULE: AI candidate MUST BE PENDING_REVIEW
      expect(candidate.status).toBe('PENDING_REVIEW');
      expect(candidate.confidenceLevel).not.toBe('HUMAN_VERIFIED');
      expect(candidate.warnings.some(w => w.includes('Identity has not been human-verified'))).toBe(true);
    });
  });

  describe('Human Verification Endpoints', () => {
    it('rejects unauthorized user (PUBLIC or VOLUNTEER) from reviewing matches (403)', async () => {
      const res = await fetch(`${baseUrl}/api/v1/admin/matches/MATCH-123/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${volunteerToken}`, // Not RESPONDER_ADMIN
        },
        body: JSON.stringify({
          decision: 'VERIFY',
          reviewerId: 'VOLUNTEER-1',
          evidenceUsed: ['PHOTO'],
        }),
      });
      const data = await res.json();

      expect(res.status).toBe(403);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Access denied');
    });

    it('allows authorized RESPONDER_ADMIN to CONFIRM match (transitions status to VERIFIED & FAMILY_NOTIFIED)', async () => {
      const mockMatch = {
        id: 'db-match-1',
        matchId: 'MATCH-9001',
        targetMissingCaseId: 'db-case-missing-1',
        candidateFoundCaseId: 'db-case-found-1',
        overallScore: 91.2,
        status: 'PENDING_REVIEW',
      };

      (prisma.matchCandidate.findUnique as any)
        .mockResolvedValueOnce(mockMatch)
        .mockResolvedValueOnce({ ...mockMatch, status: 'VERIFIED' });

      const res = await fetch(`${baseUrl}/api/v1/admin/matches/MATCH-9001/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          decision: 'VERIFY',
          reviewerId: 'ADMIN-RUCHIT',
          evidenceUsed: ['EVID-PHOTO-01', 'EVID-HOSPITAL-ADM-44'],
          notes: 'Verified visually with family contact and hospital intake record.',
        }),
      });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.matchId).toBe('MATCH-9001');
      expect(data.decision).toBe('VERIFY');
      expect(prisma.$transaction).toHaveBeenCalledOnce();
    });

    it('allows authorized RESPONDER_ADMIN to REJECT a match candidate', async () => {
      const mockMatch = {
        id: 'db-match-2',
        matchId: 'MATCH-9002',
        targetMissingCaseId: 'db-case-missing-2',
        candidateFoundCaseId: 'db-case-found-2',
        overallScore: 45.0,
        status: 'PENDING_REVIEW',
      };

      (prisma.matchCandidate.findUnique as any)
        .mockResolvedValueOnce(mockMatch)
        .mockResolvedValueOnce({ ...mockMatch, status: 'REJECTED' });

      const res = await fetch(`${baseUrl}/api/v1/admin/matches/MATCH-9002/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          decision: 'REJECT',
          reviewerId: 'ADMIN-RUCHIT',
          evidenceUsed: ['EVID-PHOTO-02'],
          notes: 'Distinct facial features, false positive.',
        }),
      });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.decision).toBe('REJECT');
    });

    it('allows authorized RESPONDER_ADMIN to get pending matches queue', async () => {
      (prisma.matchCandidate.findMany as any).mockResolvedValue([
        {
          matchId: 'MATCH-9001',
          overallScore: 91.2,
          confidenceLevel: 'STRONG_CANDIDATE',
          breakdown: {},
          reasons: ['High phonetic name similarity'],
          warnings: ['Photograph requires human verification'],
          status: 'PENDING_REVIEW',
          createdAt: new Date(),
          targetCase: { caseId: 'CASE-10291', personName: 'Rahul Sharma', type: 'MISSING', status: 'SEARCHING' },
          candidateCase: { caseId: 'CASE-10305', personName: 'Rahool Sharma', type: 'FOUND', status: 'INFORMATION_RECEIVED' },
        },
      ]);

      const res = await fetch(`${baseUrl}/api/v1/admin/matches/pending`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.matches.length).toBe(1);
      expect(data.matches[0].matchId).toBe('MATCH-9001');
      expect(data.matches[0].status).toBe('PENDING_REVIEW');
    });

    it('allows authorized RESPONDER_ADMIN to get all matches', async () => {
      (prisma.matchCandidate.findMany as any).mockResolvedValue([
        {
          matchId: 'MATCH-9001',
          overallScore: 91.2,
          confidenceLevel: 'STRONG_CANDIDATE',
          breakdown: {},
          reasons: ['High phonetic name similarity'],
          warnings: ['Photograph requires human verification'],
          status: 'PENDING_REVIEW',
          createdAt: new Date(),
          targetCase: { caseId: 'CASE-10291', personName: 'Rahul Sharma', type: 'MISSING', status: 'SEARCHING' },
          candidateCase: { caseId: 'CASE-10305', personName: 'Rahool Sharma', type: 'FOUND', status: 'INFORMATION_RECEIVED' },
        },
      ]);

      const res = await fetch(`${baseUrl}/api/v1/admin/matches`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.matches.length).toBe(1);
    });

    it('allows authorized RESPONDER_ADMIN to get audit logs', async () => {
      (prisma.auditLog.findMany as any).mockResolvedValue([
        {
          id: 'audit-12345678',
          actor: 'ADMIN-RUCHIT',
          action: 'VERIFICATION_PERFORMED',
          resource: 'MatchCandidate',
          resourceId: 'MATCH-9001',
          metadata: { decision: 'VERIFY', candidateCaseId: 'CASE-10305', notes: 'Verified' },
          timestamp: new Date(),
          case: { caseId: 'CASE-10291', personName: 'Rahul Sharma' },
        },
      ]);

      const res = await fetch(`${baseUrl}/api/v1/admin/audit-logs`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.logs.length).toBe(1);
      expect(data.logs[0].decision).toBe('VERIFY');
      expect(data.logs[0].missingCaseId).toBe('CASE-10291');
    });
  });
});
