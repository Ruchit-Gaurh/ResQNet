import assert from 'node:assert/strict';
import test from 'node:test';

import type { DisasterCase, MeshEnvelope } from '../../shared/types/index';
import { FetchGatewayClient } from '../../mesh/MeshTransportService';
import { MockMeshNetwork, MockMeshTransport } from '../../mesh/mock/MockMeshTransport';
import { InMemoryLocalStorage, LocalQueueService } from '../src/services/LocalQueueService';
import { getOrCreateDevNodeId } from '../src/services/DevNodeIdentity';
import { ReportSubmissionService } from '../src/services/ReportSubmissionService';
import { DeviceBackendAuth } from '../src/services/DeviceBackendAuth';

function idFactory(): () => string {
  let id = 0;
  return () => `00000000-0000-4000-8000-${String(++id).padStart(12, '0')}`;
}

test('missing, found, safe, sighting, and emergency help submissions persist before transport', async () => {
  const storage = new InMemoryLocalStorage();
  const localQueue = new LocalQueueService(storage, () => 1_700_000_000_000);
  const network = new MockMeshNetwork();
  const mesh = new MockMeshTransport('PHONE-A', network);
  await mesh.init();
  const submissions = new ReportSubmissionService(localQueue, mesh, {
    senderPseudonym: 'TEST-PSEUDONYM',
    createId: idFactory(),
    now: () => 1_700_000_000_000,
  });

  await submissions.submitMissing({ name: 'Rahul Sharma', approximateAge: 22, zone: 'Zone A' });
  await submissions.submitFound({ name: '', physicalDescription: 'Blue shirt', zone: 'Camp 7' });
  await submissions.submitSafe({ name: 'Aman', zone: 'School shelter' });
  await submissions.submitSighting({ personDescription: 'Young adult', zone: 'Sector 4' });
  const helpResult = await submissions.submitEmergencyHelp({
    requesterName: 'Aman',
    note: 'Trapped upstairs',
    location: { lat: 26.9124, lng: 75.7873, accuracyMeters: 18 },
    locationObservedAt: 1_700_000_000_000,
  });

  const restoredQueue = new LocalQueueService(storage);
  const records = await restoredQueue.getRecords();
  assert.equal(records.length, 5);
  assert.deepEqual(
    new Set(records.map((record) => record.envelope.messageType)),
    new Set(['MISSING_PERSON', 'FOUND_PERSON', 'SAFE_STATUS', 'SIGHTING', 'EMERGENCY']),
  );
  assert.ok(records.every((record) => record.deliveryState === 'SAVED_LOCALLY'));
  assert.equal((await restoredQueue.getCases()).length, 2);
  const emergency = records.find((record) => record.envelope.messageType === 'EMERGENCY');
  assert.equal(emergency?.envelope.priority, 'CRITICAL');
  assert.equal((emergency?.envelope.payload as { consentToShareLocation?: boolean }).consentToShareLocation, true);
  assert.equal((emergency?.envelope.payload as { locationSource?: string }).locationSource, 'CURRENT');
  assert.equal(helpResult.referenceId, (emergency?.envelope.payload as { requestId?: string }).requestId);
});

test('local save survives a transport error and does not claim delivery', async () => {
  const storage = new InMemoryLocalStorage();
  const localQueue = new LocalQueueService(storage);
  const failingMesh = {
    async init() {},
    async sendMeshMessage(_envelope: MeshEnvelope<unknown>) {
      throw new Error('Radio unavailable');
    },
    async getNearbyPeers() { return []; },
    async getQueuedMessages() { return []; },
    getNetworkHealth() {
      return {
        connectivity: 'ISOLATED' as const,
        nearbyPeerCount: 0,
        queuedMessageCount: 0,
        batteryMode: 'NORMAL' as const,
      };
    },
    onMessageReceived() { return () => undefined; },
    async syncWithGateway() { throw new Error('No gateway'); },
  };
  const submissions = new ReportSubmissionService(localQueue, failingMesh, {
    senderPseudonym: 'TEST',
    createId: idFactory(),
  });

  const result = await submissions.submitMissing({ clothing: 'Blue shirt' });
  assert.equal(result.deliveryState, 'SAVED_LOCALLY');
  assert.equal(result.transportError, 'Radio unavailable');
  const records = await localQueue.getRecords();
  assert.equal(records.length, 1);
  assert.equal(records[0]?.deliveryState, 'SAVED_LOCALLY');
  assert.equal(records[0]?.lastError, 'Radio unavailable');
});

test('mobile submission follows local storage -> MeshTransportService -> A -> B -> C -> gateway ACK', async () => {
  const fixedNow = Date.now();
  const storage = new InMemoryLocalStorage();
  const localQueue = new LocalQueueService(storage, () => fixedNow);
  const network = new MockMeshNetwork();
  const gateway = {
    async sync(_url: string, request: { outboundEnvelopes: MeshEnvelope[] }) {
      return {
        acknowledgedMessageIds: request.outboundEnvelopes.map((item) => item.messageId),
        inboundCases: [],
        inboundMatches: [],
        inboundTimelineEvents: [],
        serverTimestamp: fixedNow + 1_000,
      };
    },
  };
  const testNow = () => fixedNow;
  const nodeA = new MockMeshTransport('PHONE-A', network, { now: testNow });
  const nodeB = new MockMeshTransport('MOCK-B', network, { now: testNow });
  const nodeC = new MockMeshTransport('MOCK-C', network, { gatewayClient: gateway, now: testNow });
  await Promise.all([nodeA.init(), nodeB.init(), nodeC.init()]);
  network.connect('PHONE-A', 'MOCK-B');
  network.connect('MOCK-B', 'MOCK-C');
  const submissions = new ReportSubmissionService(localQueue, nodeA, {
    senderPseudonym: 'TEST-PHONE',
    createId: idFactory(),
    now: testNow,
  });

  const result = await submissions.submitMissing({ clothing: 'Blue shirt' });
  assert.equal(result.deliveryState, 'RELAYING');
  const recordsBeforeAck = await localQueue.getRecords();
  assert.equal(recordsBeforeAck[0]?.envelope.messageType, 'MISSING_PERSON');
  assert.equal(recordsBeforeAck[0]?.deliveryState, 'RELAYING');
  assert.equal((await nodeC.getQueuedMessages())[0]?.hopCount, 2);

  const response = await nodeC.syncWithGateway('mock://gateway');
  await localQueue.applySyncResponse(response);
  assert.equal((await localQueue.getRecords())[0]?.deliveryState, 'DELIVERED_TO_NETWORK');
  assert.equal((await nodeA.getQueuedMessages()).length, 0);
});

test('development node identity is stable per install and distinct across installations', async () => {
  const installA = new InMemoryLocalStorage();
  const installB = new InMemoryLocalStorage();
  let sequence = 0;
  const createId = () => `0000000${++sequence}-1111-4111-8111-111111111111`;

  const firstA = await getOrCreateDevNodeId(installA, createId);
  const restartedA = await getOrCreateDevNodeId(installA, createId);
  const firstB = await getOrCreateDevNodeId(installB, createId);

  assert.equal(firstA, restartedA);
  assert.notEqual(firstA, firstB);
});

test('received peer envelope is deduplicated and does not become an owned case', async () => {
  const storage = new InMemoryLocalStorage();
  const localQueue = new LocalQueueService(storage, () => 1_700_000_000_000);
  const remoteCaseEnvelope: MeshEnvelope<unknown> = {
    messageId: 'remote-message',
    messageType: 'MISSING_PERSON',
    priority: 'HIGH',
    createdAt: 1_700_000_000_000,
    expiresAt: 1_700_000_060_000,
    hopCount: 1,
    maxHops: 7,
    senderPseudonym: 'REMOTE',
    destinationType: 'GATEWAY',
    payload: {
      caseId: 'REMOTE-CASE',
      type: 'MISSING',
      status: 'REGISTERED',
      priority: 'HIGH',
      person: { name: 'Rahul Sharma', gender: 'UNKNOWN' },
      source: 'FAMILY',
      sourceTrustScore: 0,
      verificationState: 'UNVERIFIED',
      createdAt: new Date(1_700_000_000_000).toISOString(),
      updatedAt: new Date(1_700_000_000_000).toISOString(),
      evidenceIds: [],
    },
  };

  await localQueue.saveReceivedEnvelope(remoteCaseEnvelope, 'NODE-A');
  await localQueue.saveReceivedEnvelope(remoteCaseEnvelope, 'NODE-A');

  assert.equal((await localQueue.getReceivedRecords()).length, 1);
  assert.equal((await localQueue.getCases()).length, 0);
});

test('gateway reconciliation updates owned cases without importing another family case', async () => {
  const fixedNow = 1_700_000_000_000;
  const storage = new InMemoryLocalStorage();
  const localQueue = new LocalQueueService(storage, () => fixedNow);
  const network = new MockMeshNetwork();
  const mesh = new MockMeshTransport('PHONE-A', network);
  await mesh.init();
  const submissions = new ReportSubmissionService(localQueue, mesh, {
    senderPseudonym: 'MOBILE-PHONE-A',
    createId: idFactory(),
    now: () => fixedNow,
  });
  await submissions.submitMissing({ name: 'Owned person' });
  const owned = (await localQueue.getCases())[0] as DisasterCase;
  const serverOwned = { ...owned, status: 'FAMILY_NOTIFIED' as const, verificationState: 'VERIFIED' as const };
  const remote = { ...owned, caseId: 'CASE-REMOTE', person: { ...owned.person, name: 'Another family' } };

  await localQueue.applySyncResponse({
    acknowledgedMessageIds: [],
    inboundCases: [serverOwned, remote],
    inboundMatches: [],
    inboundTimelineEvents: [
      {
        eventId: 'owned-event',
        caseId: owned.caseId,
        timestamp: new Date(fixedNow + 1).toISOString(),
        source: 'RESPONDER',
        title: 'Human verification completed',
        description: 'Authorized backend update',
        verificationStatus: 'VERIFIED',
      },
      {
        eventId: 'remote-event',
        caseId: remote.caseId,
        timestamp: new Date(fixedNow + 1).toISOString(),
        source: 'RESPONDER',
        title: 'Private remote event',
        description: 'Must not be imported',
        verificationStatus: 'VERIFIED',
      },
    ],
    serverTimestamp: fixedNow + 1,
  });

  const reconciled = await localQueue.getCases();
  assert.equal(reconciled.length, 1);
  assert.equal(reconciled[0]?.status, 'FAMILY_NOTIFIED');
  assert.equal((await localQueue.getTimeline(owned.caseId)).length, 1);
  assert.equal((await localQueue.getTimeline(remote.caseId)).length, 0);
});

test('HTTP gateway client sends bearer auth and validates real ACK response', async () => {
  let authorization: string | null = null;
  const client = new FetchGatewayClient({
    getAccessToken: async () => 'development-token',
    fetchImpl: async (_input, init) => {
      authorization = new Headers(init?.headers).get('Authorization');
      return new Response(JSON.stringify({
        acknowledgedMessageIds: ['message-1'],
        inboundCases: [],
        inboundMatches: [],
        inboundTimelineEvents: [],
        serverTimestamp: 123,
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    },
  });

  const response = await client.sync('http://gateway.test/', {
    deviceId: 'PHONE-A',
    lastSyncTimestamp: 0,
    outboundEnvelopes: [],
  });
  assert.equal(authorization, 'Bearer development-token');
  assert.deepEqual(response.acknowledgedMessageIds, ['message-1']);
});

test('device backend auth requests and caches a least-privilege device token', async () => {
  let requestCount = 0;
  let requestedUrl = '';
  let requestedBody = '';
  const auth = new DeviceBackendAuth(
    'https://backend.test/',
    'NODE-A1B2C3D4',
    async (input, init) => {
      requestCount += 1;
      requestedUrl = String(input);
      requestedBody = String(init?.body);
      return new Response(JSON.stringify({
        success: true,
        token: 'public-device-token',
        expiresInSeconds: 86_400,
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    },
    () => 1_700_000_000_000,
  );

  const [first, second] = await Promise.all([
    auth.getAccessToken(),
    auth.getAccessToken(),
  ]);

  assert.equal(first, 'public-device-token');
  assert.equal(second, 'public-device-token');
  assert.equal(requestCount, 1);
  assert.equal(requestedUrl, 'https://backend.test/api/v1/auth/device');
  assert.deepEqual(JSON.parse(requestedBody), { deviceId: 'NODE-A1B2C3D4' });
});
