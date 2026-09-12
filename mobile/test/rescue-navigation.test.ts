import assert from 'node:assert/strict';
import test from 'node:test';

import {
  bearingBetweenDegrees,
  bluetoothApproachGuidance,
  calculateRescueGuidance,
  directionInstruction,
  distanceBetweenMeters,
  estimatePreciseLocation,
  isGpsBearingReliable,
  normalizeAngle,
  smoothCircularDegrees,
  smoothGeoLocation,
  smoothMovingLocation,
  unwrapAngleDegrees,
} from '../src/services/RescueNavigation';

test('Bluetooth approach guidance remains coarse and never invents distance', () => {
  const nearby = bluetoothApproachGuidance(-78);
  const strong = bluetoothApproachGuidance(-62);
  const veryStrong = bluetoothApproachGuidance(-48);
  assert.equal(nearby.strength, 'NEARBY');
  assert.equal(strong.strength, 'STRONG');
  assert.equal(veryStrong.strength, 'VERY_STRONG');
  assert.doesNotMatch(`${nearby.label} ${nearby.detail}`, /\d+\s*(m|meter)/i);
});

test('classifies whether GPS bearing is trustworthy at close range', () => {
  assert.equal(isGpsBearingReliable(80, 5, 8), true);
  assert.equal(isGpsBearingReliable(12, 3, 4), true);
  assert.equal(isGpsBearingReliable(12, 8, 10), false);
  assert.equal(isGpsBearingReliable(30, 25, 20), false);
});
import { RescueTargetService } from '../src/services/RescueTargetService';
import { isRescueSignalEnvelope, rescueSignalTarget } from '../src/services/RescueSignal';
import { InMemoryLocalStorage, LocalQueueService } from '../src/services/LocalQueueService';
import type { DisasterCase, MeshEnvelope } from '../../shared/types/index';

test('calculates distance and cardinal bearing', () => {
  const origin = { lat: 0, lng: 0 };
  const north = { lat: 0.001, lng: 0 };
  assert.ok(distanceBetweenMeters(origin, north) > 110);
  assert.ok(distanceBetweenMeters(origin, north) < 112);
  assert.ok(Math.abs(bearingBetweenDegrees(origin, north)) < 0.001);
});

test('normalizes angles and provides understandable turn instructions', () => {
  assert.equal(normalizeAngle(350), -10);
  assert.equal(directionInstruction(5, false), 'Continue ahead');
  assert.equal(directionInstruction(45, false), 'Bear right');
  assert.equal(directionInstruction(-90, false), 'Turn left');
  assert.equal(directionInstruction(175, false), 'Turn around');
});

test('smooths compass updates across north without making a full-circle jump', () => {
  assert.ok(smoothCircularDegrees(358, 2, 0.5) < 1 || smoothCircularDegrees(358, 2, 0.5) > 359);
  assert.equal(unwrapAngleDegrees(175, -175), 185);
  const location = smoothGeoLocation({ lat: 10, lng: 20 }, { lat: 12, lng: 24, accuracyMeters: 8 }, 0.25);
  assert.deepEqual(location, { lat: 10.5, lng: 21, accuracyMeters: 8 });
});

test('combines recent accurate requester fixes without claiming invented accuracy', () => {
  const estimate = estimatePreciseLocation([
    { location: { lat: 26.900000, lng: 75.800000, accuracyMeters: 8 }, observedAt: 9_000 },
    { location: { lat: 26.900010, lng: 75.800010, accuracyMeters: 6 }, observedAt: 9_500 },
    { location: { lat: 26.910000, lng: 75.810000, accuracyMeters: 80 }, observedAt: 9_900 },
  ], 10_000);
  assert.ok(estimate);
  assert.ok(Math.abs(estimate.lat - 26.90001) < 0.00002);
  assert.equal(estimate.accuracyMeters, 6);
});

test('rescuer smoothing follows real movement immediately but damps stationary jitter', () => {
  const origin = { lat: 26.900000, lng: 75.800000, accuracyMeters: 6 };
  const jitter = smoothMovingLocation(origin, { lat: 26.900005, lng: 75.800005, accuracyMeters: 8 });
  const moved = { lat: 26.900100, lng: 75.800000, accuracyMeters: 6 };
  assert.ok(jitter.lat < 26.900005);
  assert.deepEqual(smoothMovingLocation(origin, moved), moved);
});

test('targets rescue signals only to the originating emergency device', () => {
  const target = {
    caseId: 'EMERGENCY-HELP-123',
    createdById: 'MOBILE-NODE-ABCDEF12',
  } as DisasterCase;
  assert.deepEqual(rescueSignalTarget(target), {
    requestId: 'HELP-123',
    senderPseudonym: 'MOBILE-NODE-ABCDEF12',
    nodeId: 'NODE-ABCDEF12',
  });
  assert.equal(rescueSignalTarget({ ...target, caseId: 'CASE-123' }), undefined);

  const signal: MeshEnvelope<unknown> = {
    messageId: 'signal-1',
    messageType: 'EMERGENCY',
    priority: 'CRITICAL',
    createdAt: 1_000,
    expiresAt: 2_000,
    hopCount: 1,
    maxHops: 5,
    senderPseudonym: 'MOBILE-NODE-RESCUER',
    destinationType: 'GATEWAY',
    destinationId: 'NODE-ABCDEF12',
    payload: {
      kind: 'RESCUE_SIGNAL',
      action: 'RESCUER_NEARBY',
      targetRequestId: 'HELP-123',
      targetSenderPseudonym: 'MOBILE-NODE-ABCDEF12',
      rescuerNodeId: 'NODE-RESCUER',
      sentAt: '2026-09-12T00:00:00.000Z',
    },
  };
  assert.equal(isRescueSignalEnvelope(signal), true);
  assert.equal(isRescueSignalEnvelope({
    ...signal,
    payload: { ...(signal.payload as object), action: 'RESCUE_ACCEPTED' },
  }), true);
  assert.equal(isRescueSignalEnvelope({ ...signal, payload: { action: 'RESCUER_NEARBY' } }), false);
});

test('uses an 8 meter final-approach arrival radius', () => {
  const outside = calculateRescueGuidance(
    { lat: 28.6139, lng: 77.2090, accuracyMeters: 35 },
    { lat: 28.6140, lng: 77.2090 },
    0,
  );
  const inside = calculateRescueGuidance(
    { lat: 28.6139, lng: 77.2090, accuracyMeters: 35 },
    { lat: 28.61395, lng: 77.2090 },
    0,
  );
  assert.equal(outside.arrived, false);
  assert.equal(inside.arrived, true);
  assert.equal(inside.direction, 'Target area reached');
});

test('rescuer targets remain available from locally received mesh reports while offline', async () => {
  const storage = new InMemoryLocalStorage();
  const queue = new LocalQueueService(storage, () => 1_000);
  const target: DisasterCase = {
    caseId: 'CASE-MESH-1',
    type: 'MISSING',
    status: 'REGISTERED',
    priority: 'HIGH',
    person: { name: 'Rahul Sharma', gender: 'UNKNOWN' },
    lastKnownLocation: { lat: 26.9124, lng: 75.7873, accuracyMeters: 25 },
    source: 'FAMILY',
    sourceTrustScore: 0,
    verificationState: 'UNVERIFIED',
    createdAt: '2026-09-12T00:00:00.000Z',
    updatedAt: '2026-09-12T00:00:00.000Z',
    evidenceIds: [],
  };
  const envelope: MeshEnvelope<DisasterCase> = {
    messageId: 'mesh-1',
    messageType: 'MISSING_PERSON',
    priority: 'HIGH',
    createdAt: 1_000,
    expiresAt: 2_000,
    hopCount: 1,
    maxHops: 5,
    senderPseudonym: 'PHONE-A',
    destinationType: 'GATEWAY',
    payload: target,
  };
  await queue.saveReceivedEnvelope(envelope, 'NODE-A');
  const failingFetch = async () => { throw new Error('offline'); };
  const service = new RescueTargetService(storage, queue, failingFetch as typeof fetch);

  const result = await service.getTargets('https://offline.example');

  assert.equal(result.fromCache, true);
  assert.equal(result.targets.length, 1);
  assert.equal(result.targets[0]?.caseId, 'CASE-MESH-1');
});

test('mesh-received emergency help becomes an urgent rescuer target', async () => {
  const storage = new InMemoryLocalStorage();
  const queue = new LocalQueueService(storage, () => 1_000);
  const envelope: MeshEnvelope<unknown> = {
    messageId: 'help-message-1',
    messageType: 'EMERGENCY',
    priority: 'CRITICAL',
    createdAt: 1_000,
    expiresAt: 20_000,
    hopCount: 1,
    maxHops: 7,
    senderPseudonym: 'PHONE-A',
    destinationType: 'GATEWAY',
    payload: {
      requestId: 'HELP-1',
      requesterName: 'Aman',
      note: 'Unable to leave the building',
      location: { lat: 26.9124, lng: 75.7873, accuracyMeters: 12 },
      locationObservedAt: 1_000,
      timestamp: '2026-09-12T00:00:00.000Z',
      consentToShareLocation: true,
      status: 'REQUESTING_HELP',
    },
  };
  await queue.saveReceivedEnvelope(envelope, 'NODE-A');
  const failingFetch = async () => { throw new Error('offline'); };
  const service = new RescueTargetService(storage, queue, failingFetch as typeof fetch);

  const result = await service.getTargets('https://offline.example');

  assert.equal(result.targets.length, 1);
  assert.equal(result.targets[0]?.caseId, 'EMERGENCY-HELP-1');
  assert.equal(result.targets[0]?.priority, 'CRITICAL');
  assert.equal(result.targets[0]?.lastKnownLocation?.lat, 26.9124);
  assert.equal(result.targets[0]?.createdById, 'PHONE-A');

  await service.markFound('EMERGENCY-HELP-1');
  assert.equal(
    (await storage.getItem('@resqnet/rescue-targets/v1'))?.includes('26.9124'),
    false,
  );
  const afterRestart = new RescueTargetService(storage, queue, failingFetch as typeof fetch);
  assert.equal((await afterRestart.getTargets('https://offline.example')).targets.length, 0);
});

test('authenticated rescuer loads internet-origin help requests outside Bluetooth range', async () => {
  const storage = new InMemoryLocalStorage();
  const queue = new LocalQueueService(storage, () => 1_000);
  const requestedUrls: string[] = [];
  const fakeFetch = async (input: RequestInfo | URL) => {
    const url = String(input);
    requestedUrls.push(url);
    if (url.endsWith('/api/v1/auth/rescuer')) {
      return new Response(JSON.stringify({ success: true, token: 'volunteer-token' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({
      success: true,
      targets: [{
        requestId: 'HELP-REMOTE',
        requesterName: 'Remote requester',
        location: { lat: 26.91, lng: 75.78, accuracyMeters: 7 },
        locationObservedAt: 1_000,
        requestedAt: '2026-09-12T00:00:00.000Z',
        senderPseudonym: 'MOBILE-NODE-A1B2C3D4',
        sourceMessageId: 'remote-envelope',
        updatedAt: '2026-09-12T00:00:01.000Z',
      }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  const service = new RescueTargetService(storage, queue, fakeFetch as typeof fetch);

  assert.equal(await service.authenticateRescuer('https://backend.example', 'rescue', 'rescue'), true);
  const result = await service.getTargets('https://backend.example');

  assert.equal(result.fromCache, false);
  assert.equal(result.targets[0]?.caseId, 'EMERGENCY-HELP-REMOTE');
  assert.equal(result.targets[0]?.createdById, 'MOBILE-NODE-A1B2C3D4');
  assert.deepEqual(requestedUrls, [
    'https://backend.example/api/v1/auth/rescuer',
    'https://backend.example/api/v1/rescue/targets',
  ]);
});
