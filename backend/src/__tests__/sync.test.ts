import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import { createServer, Server } from 'http';
import app from '../server';
import prisma from '../config/database';
import { generateTestToken } from './test-helpers';

vi.mock('../config/database', () => {
  const transactionClient = {
    syncMessage: {
      create: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn(),
    },
    devicePresence: { updateMany: vi.fn() },
    case: {
      create: vi.fn().mockResolvedValue({ id: 'case-internal-1', type: 'MISSING' }),
    },
    sighting: { create: vi.fn() },
    safeCheckIn: { create: vi.fn() },
  };
  return {
    default: {
      __transactionClient: transactionClient,
      syncMessage: {
        findUnique: vi.fn(),
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn(),
      },
      devicePresence: {
        findUnique: vi.fn().mockResolvedValue(null),
        upsert: vi.fn().mockResolvedValue({}),
        findMany: vi.fn().mockResolvedValue([]),
      },
      case: {
        create: vi.fn(),
        findUnique: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
      },
      sighting: {
        create: vi.fn(),
      },
      safeCheckIn: {
        create: vi.fn(),
      },
      matchCandidate: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      auditLog: {
        create: vi.fn().mockResolvedValue({ id: 'audit-1' }),
        findMany: vi.fn().mockResolvedValue([]),
      },
      $transaction: vi.fn(async (cb) => cb(transactionClient)),
    },
  };
});

describe('Sync Module API (Idempotent Mesh Gateway)', () => {
  let server: Server;
  let baseUrl: string;

  const publicToken = generateTestToken('PUBLIC', 'mobile-DEVICE-NODE-1');

  beforeAll(async () => {
    server = createServer(app);
    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        const addr = server.address();
        const port = typeof addr === 'object' && addr ? addr.port : 3003;
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
    (prisma.syncMessage.findMany as any).mockResolvedValue([]);
    (prisma as any).__transactionClient.syncMessage.findMany.mockResolvedValue([]);
  });

  const sampleEnvelope = {
    messageId: 'msg-uuid-001',
    messageType: 'MISSING_PERSON',
    priority: 'HIGH',
    createdAt: 1726050100000,
    expiresAt: 1726136500000,
    hopCount: 2,
    maxHops: 7,
    senderPseudonym: 'PSEUDO-88F',
    destinationType: 'GATEWAY',
    payload: {
      name: 'Pooja Patel',
      age: 25,
      gender: 'FEMALE',
    },
  };

  it('processes new mesh message successfully and returns acknowledgement', async () => {
    // Message does NOT exist yet
    (prisma.syncMessage.findUnique as any).mockResolvedValue(null);

    const res = await fetch(`${baseUrl}/api/v1/sync/batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${publicToken}`,
      },
      body: JSON.stringify({
        deviceId: 'DEVICE-NODE-1',
        lastSyncTimestamp: 1726050000000,
        outboundEnvelopes: [sampleEnvelope],
      }),
    });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.acknowledgedMessageIds).toContain('msg-uuid-001');
    expect(data.serverTimestamp).toBeDefined();
    expect(Array.isArray(data.inboundCases)).toBe(true);
    expect(prisma.$transaction).toHaveBeenCalledOnce();
  });

  it('skips duplicate message without re-inserting, but acknowledges it (Idempotent)', async () => {
    // Message ALREADY exists in database
    (prisma.syncMessage.findUnique as any).mockResolvedValue({
      id: 'existing-id',
      messageId: 'msg-uuid-001',
      processedAt: new Date(),
    });

    const res = await fetch(`${baseUrl}/api/v1/sync/batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${publicToken}`,
      },
      body: JSON.stringify({
        deviceId: 'DEVICE-NODE-1',
        lastSyncTimestamp: 1726050000000,
        outboundEnvelopes: [sampleEnvelope],
      }),
    });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.acknowledgedMessageIds).toContain('msg-uuid-001');
    // Transaction should NOT have been executed for duplicate!
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('safely handles concurrent duplicate via database-level unique constraint (P2002)', async () => {
    (prisma.syncMessage.findUnique as any).mockResolvedValue(null);
    // Simulate concurrent insert failing with Prisma unique constraint code P2002
    (prisma.$transaction as any).mockRejectedValueOnce({
      code: 'P2002',
      message: 'Unique constraint failed on the fields: (`messageId`)',
    });

    const res = await fetch(`${baseUrl}/api/v1/sync/batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${publicToken}`,
      },
      body: JSON.stringify({
        deviceId: 'DEVICE-NODE-1',
        lastSyncTimestamp: 1726050000000,
        outboundEnvelopes: [sampleEnvelope],
      }),
    });
    const data = await res.json();

    expect(res.status).toBe(200);
    // Even on concurrent collision, the message is safely acknowledged without 500 error
    expect(data.acknowledgedMessageIds).toContain('msg-uuid-001');
  });

  it('processes batch idempotently when sending same batch twice', async () => {
    // First attempt: new message
    (prisma.syncMessage.findUnique as any)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ messageId: 'msg-uuid-001' });

    // Request 1
    const res1 = await fetch(`${baseUrl}/api/v1/sync/batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${publicToken}`,
      },
      body: JSON.stringify({
        deviceId: 'DEVICE-NODE-1',
        lastSyncTimestamp: 1726050000000,
        outboundEnvelopes: [sampleEnvelope],
      }),
    });
    const data1 = await res1.json();
    expect(data1.acknowledgedMessageIds).toEqual(['msg-uuid-001']);

    // Request 2 (Exact duplicate batch)
    const res2 = await fetch(`${baseUrl}/api/v1/sync/batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${publicToken}`,
      },
      body: JSON.stringify({
        deviceId: 'DEVICE-NODE-1',
        lastSyncTimestamp: 1726050000000,
        outboundEnvelopes: [sampleEnvelope],
      }),
    });
    const data2 = await res2.json();
    expect(data2.acknowledgedMessageIds).toEqual(['msg-uuid-001']);
    // Transaction called only once across the two batches
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('rejects a mobile token that claims another device identity', async () => {
    const wrongDeviceToken = generateTestToken('PUBLIC', 'mobile-OTHER-DEVICE');
    const res = await fetch(`${baseUrl}/api/v1/sync/batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${wrongDeviceToken}`,
      },
      body: JSON.stringify({
        deviceId: 'DEVICE-NODE-1',
        lastSyncTimestamp: 0,
        outboundEnvelopes: [],
      }),
    });
    expect(res.status).toBe(403);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('records direct device presence without requiring an outbound report', async () => {
    const res = await fetch(`${baseUrl}/api/v1/sync/batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${publicToken}`,
      },
      body: JSON.stringify({
        deviceId: 'DEVICE-NODE-1',
        lastSyncTimestamp: 0,
        outboundEnvelopes: [],
        deviceTelemetry: {
          nodeId: 'DEVICE-NODE-1',
          displayName: 'ResQNet-NODE01',
          observedAt: Date.now(),
          locationObservedAt: Date.now(),
          location: { lat: 26.9124, lng: 75.7873, accuracyMeters: 25 },
          locationPermission: 'GRANTED',
          transportMode: 'NATIVE_BLE',
          nearbyPeerIds: ['OFFLINE-NODE-2'],
          queuedMessageCount: 2,
        },
      }),
    });

    expect(res.status).toBe(200);
    expect(prisma.devicePresence.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({
        nodeId: 'DEVICE-NODE-1',
        connectivitySource: 'DIRECT',
        latitude: 26.9124,
      }),
    }));
  });

  it('records an offline node presence capsule as carried by the syncing gateway', async () => {
    (prisma.syncMessage.findUnique as any).mockResolvedValue(null);
    const observedAt = Date.now() - 60_000;
    const res = await fetch(`${baseUrl}/api/v1/sync/batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${publicToken}`,
      },
      body: JSON.stringify({
        deviceId: 'DEVICE-NODE-1',
        lastSyncTimestamp: 0,
        outboundEnvelopes: [{
          ...sampleEnvelope,
          messageId: 'presence-offline-node-2',
          messageType: 'NETWORK_STATUS',
          priority: 'LOW',
          payload: {
            nodeId: 'OFFLINE-NODE-2',
            displayName: 'ResQNet-OFF002',
            observedAt,
            location: { lat: 26.913, lng: 75.788, accuracyMeters: 50 },
            locationObservedAt: observedAt,
            locationPermission: 'GRANTED',
            transportMode: 'NATIVE_BLE',
            nearbyPeerIds: ['DEVICE-NODE-1'],
            queuedMessageCount: 4,
          },
        }],
      }),
    });

    expect(res.status).toBe(200);
    expect(prisma.devicePresence.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({
        nodeId: 'OFFLINE-NODE-2',
        connectivitySource: 'RELAYED',
        relayedByNodeId: 'DEVICE-NODE-1',
      }),
    }));
  });

  it('redacts persisted rescue coordinates when a person-found signal is acknowledged', async () => {
    (prisma.syncMessage.findUnique as any).mockResolvedValue(null);
    const tx = (prisma as any).__transactionClient;
    tx.syncMessage.findMany.mockResolvedValue([
      {
        messageId: 'help-request-1',
        senderPseudonym: 'MOBILE-DEVICE-NODE-1',
        payload: {
          requestId: 'HELP-1',
          status: 'REQUESTING_HELP',
          timestamp: '2026-09-12T10:00:00.000Z',
          location: { lat: 26.9124, lng: 75.7873, accuracyMeters: 8 },
          locationObservedAt: 1_700_000_000_000,
        },
      },
      {
        messageId: 'person-found-1',
        senderPseudonym: 'MOBILE-NODE-RESCUE1',
        payload: {
          kind: 'RESCUE_SIGNAL',
          action: 'PERSON_FOUND',
          targetRequestId: 'HELP-1',
          targetSenderPseudonym: 'MOBILE-DEVICE-NODE-1',
          rescuerLocation: { lat: 26.913, lng: 75.788 },
        },
      },
    ]);
    const now = Date.now();
    const response = await fetch(`${baseUrl}/api/v1/sync/batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${publicToken}`,
      },
      body: JSON.stringify({
        deviceId: 'DEVICE-NODE-1',
        lastSyncTimestamp: 0,
        outboundEnvelopes: [{
          ...sampleEnvelope,
          messageId: 'person-found-1',
          messageType: 'EMERGENCY',
          priority: 'CRITICAL',
          createdAt: now,
          expiresAt: now + 60_000,
          senderPseudonym: 'MOBILE-NODE-RESCUE1',
          payload: {
            kind: 'RESCUE_SIGNAL',
            action: 'PERSON_FOUND',
            targetRequestId: 'HELP-1',
            targetSenderPseudonym: 'MOBILE-DEVICE-NODE-1',
            rescuerNodeId: 'NODE-RESCUE1',
            sentAt: new Date(now).toISOString(),
          },
        }],
      }),
    });

    expect(response.status).toBe(200);
    const updates = tx.syncMessage.update.mock.calls.map((call: any[]) => call[0]);
    const requestUpdate = updates.find((item: any) => item.where.messageId === 'help-request-1');
    const foundUpdate = updates.find((item: any) => item.where.messageId === 'person-found-1');
    expect(requestUpdate.data.payload.location).toBeUndefined();
    expect(requestUpdate.data.payload.locationObservedAt).toBeUndefined();
    expect(requestUpdate.data.payload.status).toBe('PERSON_FOUND');
    expect(requestUpdate.data.payload.locationRedacted).toBe(true);
    expect(foundUpdate.data.payload.rescuerLocation).toBeUndefined();
    expect(tx.devicePresence.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { nodeId: 'DEVICE-NODE-1' },
      data: expect.objectContaining({ latitude: null, longitude: null, locationObservedAt: null }),
    }));
  });

  it('redacts a delayed location update that arrives after its rescue was completed', async () => {
    (prisma.syncMessage.findUnique as any).mockResolvedValue(null);
    const tx = (prisma as any).__transactionClient;
    tx.syncMessage.findMany.mockResolvedValue([{
      payload: {
        kind: 'RESCUE_SIGNAL',
        action: 'PERSON_FOUND',
        targetRequestId: 'HELP-1',
        targetSenderPseudonym: 'MOBILE-DEVICE-NODE-1',
      },
    }]);
    const now = Date.now();
    const response = await fetch(`${baseUrl}/api/v1/sync/batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${publicToken}`,
      },
      body: JSON.stringify({
        deviceId: 'DEVICE-NODE-1',
        lastSyncTimestamp: 0,
        outboundEnvelopes: [{
          ...sampleEnvelope,
          messageId: 'late-help-location',
          messageType: 'EMERGENCY',
          priority: 'CRITICAL',
          createdAt: now,
          expiresAt: now + 60_000,
          senderPseudonym: 'MOBILE-DEVICE-NODE-1',
          payload: {
            requestId: 'HELP-1',
            status: 'REQUESTING_HELP',
            updateType: 'LOCATION_UPDATE',
            timestamp: new Date(now).toISOString(),
            consentToShareLocation: true,
            location: { lat: 26.9125, lng: 75.7874, accuracyMeters: 5 },
            locationObservedAt: now,
          },
        }],
      }),
    });

    expect(response.status).toBe(200);
    const update = tx.syncMessage.update.mock.calls
      .map((call: any[]) => call[0])
      .find((item: any) => item.where.messageId === 'late-help-location');
    expect(update.data.payload.location).toBeUndefined();
    expect(update.data.payload.locationObservedAt).toBeUndefined();
    expect(update.data.payload.status).toBe('PERSON_FOUND');
  });
});
