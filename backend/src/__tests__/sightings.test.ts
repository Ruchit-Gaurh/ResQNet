import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import { createServer, Server } from 'http';
import app from '../server';
import prisma from '../config/database';
import { generateTestToken } from './test-helpers';

vi.mock('../config/database', () => {
  return {
    default: {
      case: {
        findUnique: vi.fn(),
      },
      sighting: {
        create: vi.fn(),
      },
      safeCheckIn: {
        create: vi.fn(),
      },
      auditLog: {
        create: vi.fn().mockResolvedValue({ id: 'audit-1' }),
      },
    },
  };
});

describe('Sightings & Safe Check-in API', () => {
  let server: Server;
  let baseUrl: string;

  const publicToken = generateTestToken('PUBLIC', 'user-pub');

  beforeAll(async () => {
    server = createServer(app);
    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        const addr = server.address();
        const port = typeof addr === 'object' && addr ? addr.port : 3002;
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

  describe('POST /api/v1/reports/sighting', () => {
    it('rejects unauthorized sighting submission (401)', async () => {
      const res = await fetch(`${baseUrl}/api/v1/reports/sighting`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personDescription: 'Young male walking towards relief camp',
          location: { lat: 28.6150, lng: 77.2100 },
        }),
      });
      const data = await res.json();

      expect(res.status).toBe(401);
      expect(data.success).toBe(false);
    });

    it('rejects invalid sighting with missing or too-short description (400)', async () => {
      const res = await fetch(`${baseUrl}/api/v1/reports/sighting`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${publicToken}`,
        },
        body: JSON.stringify({
          personDescription: 'Hi', // Less than 5 chars
          location: { lat: 28.6150, lng: 77.2100 },
        }),
      });
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Validation failed');
    });

    it('creates sighting report successfully (201)', async () => {
      (prisma.case.findUnique as any).mockResolvedValue({
        id: 'db-case-10291',
        caseId: 'CASE-10291',
      });

      (prisma.sighting.create as any).mockResolvedValue({
        id: 'db-sight-1',
        sightingId: 'SIGHT-5510',
        verificationState: 'UNVERIFIED',
      });

      const res = await fetch(`${baseUrl}/api/v1/reports/sighting`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${publicToken}`,
        },
        body: JSON.stringify({
          targetCaseId: 'CASE-10291',
          personDescription: 'Young male walking towards relief camp',
          location: { lat: 28.6150, lng: 77.2100, zone: 'Zone A' },
          clothingDescription: 'Torn blue shirt',
          directionOfMovement: 'North toward Sector 5',
          confidenceScore: 0.85,
        }),
      });
      const data = await res.json();

      expect(res.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.sightingId).toBeDefined();
      expect(data.verificationState).toBe('UNVERIFIED');
      expect(prisma.sighting.create).toHaveBeenCalledOnce();
    });
  });

  describe('POST /api/v1/safe-checkin', () => {
    it('creates safe check-in broadcast successfully (200 OK)', async () => {
      (prisma.safeCheckIn.create as any).mockResolvedValue({
        id: 'db-checkin-1',
        checkInId: 'SAFE-9012',
      });

      const res = await fetch(`${baseUrl}/api/v1/safe-checkin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${publicToken}`,
        },
        body: JSON.stringify({
          personName: 'Aman Verma',
          phoneNumber: '+919812345678',
          location: { lat: 28.6120, lng: 77.2050, zone: 'Zone A' },
          statusMessage: 'Sheltered at City High School, safe and unhurt',
          affectedFamilyMembers: ['Sunita Verma', 'Rohan Verma'],
        }),
      });
      const data = await res.json();

      expect(res.status).toBe(200); // 200 per API contract
      expect(data.success).toBe(true);
      expect(data.checkInId).toBeDefined();
      expect(prisma.safeCheckIn.create).toHaveBeenCalledOnce();
    });
  });
});
