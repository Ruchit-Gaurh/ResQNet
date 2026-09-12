import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createServer, type Server } from 'http';

import app from '../server';
import prisma from '../config/database';
import { generateTestToken } from './test-helpers';

vi.mock('../config/database', () => ({
  default: {
    syncMessage: { findMany: vi.fn() },
  },
}));

describe('Remote rescue coordination', () => {
  let server: Server;
  let baseUrl: string;
  const volunteerToken = generateTestToken('VOLUNTEER', 'rescuer-1');
  const requesterToken = generateTestToken('PUBLIC', 'mobile-NODE-A1B2C3D4');

  beforeAll(async () => {
    server = createServer(app);
    await new Promise<void>((resolve) => server.listen(0, () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 3003;
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    }));
  });

  afterAll(async () => new Promise<void>((resolve) => server.close(() => resolve())));

  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.syncMessage.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        messageId: 'help-envelope',
        messageType: 'EMERGENCY',
        senderPseudonym: 'MOBILE-NODE-A1B2C3D4',
        processedAt: new Date('2026-09-12T10:00:00.000Z'),
        payload: {
          requestId: 'HELP-1',
          requesterName: 'Aman',
          location: { lat: 26.9124, lng: 75.7873, accuracyMeters: 8 },
          locationObservedAt: Date.parse('2026-09-12T10:00:00.000Z'),
          timestamp: '2026-09-12T10:00:00.000Z',
          consentToShareLocation: true,
          status: 'REQUESTING_HELP',
        },
      },
      {
        messageId: 'assignment-envelope',
        messageType: 'EMERGENCY',
        senderPseudonym: 'MOBILE-NODE-RESCUE1',
        processedAt: new Date('2026-09-12T10:01:00.000Z'),
        payload: {
          kind: 'RESCUE_SIGNAL',
          action: 'RESCUE_ACCEPTED',
          targetRequestId: 'HELP-1',
          targetSenderPseudonym: 'MOBILE-NODE-A1B2C3D4',
          rescuerNodeId: 'NODE-RESCUE1',
          rescuerLocation: { lat: 26.913, lng: 75.788, accuracyMeters: 6 },
          rescuerLocationObservedAt: Date.parse('2026-09-12T10:01:00.000Z'),
          sentAt: '2026-09-12T10:01:00.000Z',
        },
      },
    ]);
  });

  it('does not expose precise rescue targets without authorization', async () => {
    const response = await fetch(`${baseUrl}/api/v1/rescue/targets`);
    expect(response.status).toBe(401);
  });

  it('returns internet-origin help targets to an authenticated field rescuer', async () => {
    const response = await fetch(`${baseUrl}/api/v1/rescue/targets`, {
      headers: { Authorization: `Bearer ${volunteerToken}` },
    });
    const body = await response.json() as { targets: Array<{ requestId: string }> };
    expect(response.status).toBe(200);
    expect(body.targets[0]?.requestId).toBe('HELP-1');
  });

  it('returns the assigned rescuer location only to the requesting device', async () => {
    const response = await fetch(`${baseUrl}/api/v1/rescue/help/HELP-1/status`, {
      headers: { Authorization: `Bearer ${requesterToken}` },
    });
    const body = await response.json() as { status: { status: string; rescuerNodeId: string } };
    expect(response.status).toBe(200);
    expect(body.status.status).toBe('RESCUER_ASSIGNED');
    expect(body.status.rescuerNodeId).toBe('NODE-RESCUE1');
  });

  it('does not return a completed target location after privacy redaction', async () => {
    (prisma.syncMessage.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        messageId: 'help-envelope',
        messageType: 'EMERGENCY',
        senderPseudonym: 'MOBILE-NODE-A1B2C3D4',
        processedAt: new Date('2026-09-12T10:02:00.000Z'),
        payload: {
          requestId: 'HELP-1',
          requesterName: 'Aman',
          timestamp: '2026-09-12T10:00:00.000Z',
          status: 'PERSON_FOUND',
          locationRedacted: true,
          locationRedactedAt: '2026-09-12T10:02:00.000Z',
        },
      },
    ]);

    const targetResponse = await fetch(`${baseUrl}/api/v1/rescue/targets`, {
      headers: { Authorization: `Bearer ${volunteerToken}` },
    });
    const targetBody = await targetResponse.json() as { targets: unknown[] };
    expect(targetBody.targets).toEqual([]);

    const statusResponse = await fetch(`${baseUrl}/api/v1/rescue/help/HELP-1/status`, {
      headers: { Authorization: `Bearer ${requesterToken}` },
    });
    const statusBody = await statusResponse.json() as { status: Record<string, unknown> };
    expect(statusBody.status.status).toBe('PERSON_FOUND');
    expect(statusBody.status.location).toBeUndefined();
    expect(statusBody.status.rescuerLocation).toBeUndefined();
  });
});
