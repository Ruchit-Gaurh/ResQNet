import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import { createServer, Server } from 'http';
import app from '../server';
import prisma from '../config/database';
import { generateTestToken } from './test-helpers';

// Mock prisma database
vi.mock('../config/database', () => {
  return {
    default: {
      case: {
        create: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
      },
      auditLog: {
        create: vi.fn().mockResolvedValue({ id: 'audit-1' }),
      },
    },
  };
});

// Mock async matching scan
vi.mock('../modules/matching/matching.service', () => ({
  matchingService: {
    scanMissingCaseAgainstFound: vi.fn().mockResolvedValue([]),
    scanFoundCaseAgainstMissing: vi.fn().mockResolvedValue([]),
  },
}));

describe('Cases API Module', () => {
  let server: Server;
  let baseUrl: string;

  const publicToken = generateTestToken('PUBLIC', 'user-pub');
  const hospitalToken = generateTestToken('HOSPITAL', 'user-hosp');
  const adminToken = generateTestToken('RESPONDER_ADMIN', 'user-admin');

  beforeAll(async () => {
    server = createServer(app);
    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        const addr = server.address();
        const port = typeof addr === 'object' && addr ? addr.port : 3001;
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

  describe('POST /api/v1/cases/missing', () => {
    it('rejects unauthorized request without token (401)', async () => {
      const res = await fetch(`${baseUrl}/api/v1/cases/missing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ person: { name: 'Rahul Sharma', gender: 'MALE' }, source: 'FAMILY' }),
      });
      const data = await res.json();

      expect(res.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Authentication required');
    });

    it('rejects invalid request with missing required fields (400)', async () => {
      const res = await fetch(`${baseUrl}/api/v1/cases/missing`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${publicToken}`,
        },
        body: JSON.stringify({ person: { name: 'Rahul Sharma' } }),
      });
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Validation failed');
      expect(data.details).toBeDefined();
    });

    it('creates missing case successfully with valid payload (201)', async () => {
      const mockCreatedCase = {
        id: 'db-case-1',
        caseId: 'CASE-10291',
        type: 'MISSING',
        status: 'SEARCHING',
        verificationState: 'UNVERIFIED',
        createdAt: new Date('2026-09-11T09:00:00Z'),
      };

      (prisma.case.create as any).mockResolvedValue(mockCreatedCase);

      const res = await fetch(`${baseUrl}/api/v1/cases/missing`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${publicToken}`,
        },
        body: JSON.stringify({
          person: {
            name: 'Rahul Sharma',
            nickname: 'Bittu',
            age: 22,
            gender: 'MALE',
            fatherMotherName: 'Ramesh Sharma',
            phoneNumber: '+919876543210',
            clothing: 'Blue t-shirt, black denim jeans',
            photoUrl: 'data:image/jpeg;base64,...',
          },
          priority: 'HIGH',
          lastKnownLocation: {
            lat: 28.6139,
            lng: 77.2090,
            zone: 'Zone A - Sector 4',
          },
          lastKnownTime: '2026-09-11T08:30:00.000Z',
          source: 'FAMILY',
        }),
      });
      const data = await res.json();

      expect(res.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.caseId).toBeDefined();
      expect(data.status).toBe('SEARCHING');
      expect(data.verificationState).toBe('UNVERIFIED');
      expect(data.createdAt).toBeDefined();
      expect(prisma.case.create).toHaveBeenCalledOnce();
    });
  });

  describe('POST /api/v1/cases/found', () => {
    it('rejects unauthorized role attempting to register found case (403)', async () => {
      const res = await fetch(`${baseUrl}/api/v1/cases/found`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${publicToken}`, // PUBLIC not permitted
        },
        body: JSON.stringify({
          person: { name: 'UNKNOWN PERSON', gender: 'MALE' },
          location: { lat: 28.6180, lng: 77.2150, zone: 'Zone B' },
          source: 'PUBLIC',
        }),
      });
      const data = await res.json();

      expect(res.status).toBe(403);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Access denied');
    });

    it('allows authorized HOSPITAL to register found person (201)', async () => {
      const mockFoundCase = {
        id: 'db-case-2',
        caseId: 'CASE-10305',
        type: 'FOUND',
        status: 'INFORMATION_RECEIVED',
        createdAt: new Date(),
      };

      (prisma.case.create as any).mockResolvedValue(mockFoundCase);

      const res = await fetch(`${baseUrl}/api/v1/cases/found`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${hospitalToken}`,
        },
        body: JSON.stringify({
          person: {
            name: 'UNKNOWN PERSON',
            approximateAge: 23,
            gender: 'MALE',
            identifyingMarks: 'Scar on left forehead',
            clothing: 'Blue shirt',
          },
          location: {
            lat: 28.6180,
            lng: 77.2150,
            zone: 'Zone B - General Hospital',
          },
          source: 'HOSPITAL',
        }),
      });
      const data = await res.json();

      expect(res.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.caseId).toBeDefined();
      expect(data.status).toBe('INFORMATION_RECEIVED');
    });
  });

  describe('GET /api/v1/cases/:caseId — Role-based projection', () => {
    const mockCaseRow = {
      id: 'db-case-minor',
      caseId: 'CASE-10291',
      type: 'MISSING',
      status: 'SEARCHING',
      priority: 'HIGH',
      personName: 'Minor Child',
      personData: {
        name: 'Minor Child',
        age: 12,
        isMinor: true,
        gender: 'MALE',
        phoneNumber: '+919999999999',
        fatherMotherName: 'Parent Name',
        medicalNeeds: 'Insulin dependent',
        photoUrl: 'http://example.com/private-photo.jpg',
      },
      lastKnownLocation: {
        lat: 28.6139,
        lng: 77.2090,
        zone: 'Zone A - Sector 4',
      },
      lastKnownTime: new Date('2026-09-11T08:30:00Z'),
      source: 'FAMILY',
      sourceTrustScore: 0.8,
      verificationState: 'UNVERIFIED',
      createdAt: new Date('2026-09-11T09:00:00Z'),
      updatedAt: new Date('2026-09-11T09:00:00Z'),
      corroborationCount: 1,
      evidenceReports: [{ evidenceId: 'EVID-001' }],
    };

    it('redacts sensitive fields (phone, parent, medical, minor photo, exact GPS) for PUBLIC role', async () => {
      (prisma.case.findUnique as any).mockResolvedValue(mockCaseRow);

      const res = await fetch(`${baseUrl}/api/v1/cases/CASE-10291`, {
        headers: { Authorization: `Bearer ${publicToken}` },
      });
      const data = await res.json();

      expect(res.status).toBe(200);
      const person = data.person;
      // Protected minor info must be hidden from public
      expect(person.phoneNumber).toBeUndefined();
      expect(person.fatherMotherName).toBeUndefined();
      expect(person.medicalNeeds).toBeUndefined();
      expect(person.photoUrl).toBeUndefined(); // Minor photo hidden
      // Exact GPS hidden
      expect(data.lastKnownLocation.lat).toBeUndefined();
      expect(data.lastKnownLocation.lng).toBeUndefined();
      expect(data.lastKnownLocation.zone).toBe('Zone A - Sector 4');
      // Evidence IDs hidden
      expect(data.evidenceIds).toEqual([]);
    });

    it('returns full data including exact coordinates and evidence for RESPONDER_ADMIN', async () => {
      (prisma.case.findUnique as any).mockResolvedValue(mockCaseRow);

      const res = await fetch(`${baseUrl}/api/v1/cases/CASE-10291`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const data = await res.json();

      expect(res.status).toBe(200);
      const person = data.person;
      expect(person.phoneNumber).toBe('+919999999999');
      expect(person.medicalNeeds).toBe('Insulin dependent');
      expect(person.photoUrl).toBe('http://example.com/private-photo.jpg');
      expect(data.lastKnownLocation.lat).toBe(28.6139);
      expect(data.lastKnownLocation.lng).toBe(77.2090);
      expect(data.evidenceIds).toEqual(['EVID-001']);
    });
  });
});
