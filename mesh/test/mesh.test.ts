import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';

import type { MeshEnvelope, PriorityLevel } from '../../shared/types/index';
import { MockMeshNetwork, MockMeshTransport } from '../mock/MockMeshTransport';
import { BleFrameAssembler, frameBlePayload } from '../native/BleRadioPort';
import { Deduplicator, InMemorySeenMessageStore } from '../protocol/Deduplicator';
import { SIGHTING_TTL_MS } from '../protocol/Envelope';
import { InMemoryMessageQueueStorage, MessageQueue } from '../queue/MessageQueue';

function envelope(
  priority: PriorityLevel,
  overrides: Partial<MeshEnvelope<unknown>> = {},
): MeshEnvelope<unknown> {
  const now = Date.now();
  return {
    messageId: randomUUID(),
    messageType: 'MISSING_PERSON',
    priority,
    createdAt: now,
    expiresAt: now + 60_000,
    hopCount: 0,
    maxHops: 7,
    senderPseudonym: 'TEST-NODE',
    destinationType: 'GATEWAY',
    payload: { name: 'Rahul Sharma' },
    ...overrides,
  };
}

test('priority queue selects CRITICAL, HIGH, NORMAL, then LOW', async () => {
  const queue = new MessageQueue(new InMemoryMessageQueueStorage());
  await queue.init();
  await queue.enqueue(envelope('LOW'));
  await queue.enqueue(envelope('NORMAL'));
  await queue.enqueue(envelope('CRITICAL'));
  await queue.enqueue(envelope('HIGH'));

  const ordered: PriorityLevel[] = [];
  while ((await queue.size()) > 0) {
    ordered.push((await queue.dequeue())?.priority ?? 'LOW');
  }

  assert.deepEqual(ordered, ['CRITICAL', 'HIGH', 'NORMAL', 'LOW']);
});

test('queue persistence restores unacknowledged items and ACK removes only its ID', async () => {
  const storage = new InMemoryMessageQueueStorage();
  const first = new MessageQueue(storage);
  await first.init();
  const acknowledged = envelope('CRITICAL');
  const retained = envelope('LOW');
  await first.enqueue(acknowledged);
  await first.enqueue(retained);

  assert.equal(await first.acknowledge(acknowledged.messageId), true);
  assert.equal(await first.acknowledge('not-queued'), false);

  const restored = new MessageQueue(storage);
  await restored.init();
  assert.deepEqual((await restored.getAll()).map((item) => item.messageId), [retained.messageId]);
});

test('expired sightings are purged and duplicate IDs are not enqueued', async () => {
  const now = 1_000_000;
  const queue = new MessageQueue(new InMemoryMessageQueueStorage(), () => now);
  await queue.init();
  const sighting = envelope('NORMAL', {
    messageType: 'SIGHTING',
    createdAt: now - SIGHTING_TTL_MS - 1,
    expiresAt: now - 1,
  });

  assert.equal(await queue.enqueue(sighting), false);
  const current = envelope('HIGH', { createdAt: now, expiresAt: now + 10_000 });
  assert.equal(await queue.enqueue(current), true);
  assert.equal(await queue.enqueue(current), false);
  assert.equal(await queue.size(), 1);
});

test('deduplicator suppresses a stable message ID and persists the ledger', async () => {
  const store = new InMemorySeenMessageStore();
  const first = new Deduplicator(store);
  await first.init();
  assert.equal(await first.checkAndMark('stable-id'), true);
  assert.equal(await first.checkAndMark('stable-id'), false);

  const restored = new Deduplicator(store);
  await restored.init();
  assert.equal(restored.hasSeen('stable-id'), true);
});

test('deduplicator keeps recently used IDs within its in-memory LRU bound', async () => {
  const deduplicator = new Deduplicator(new InMemorySeenMessageStore(), 2);
  await deduplicator.init();
  await deduplicator.checkAndMark('first');
  await deduplicator.checkAndMark('second');
  await deduplicator.checkAndMark('first');
  await deduplicator.checkAndMark('third');

  assert.equal(deduplicator.hasSeen('first'), true);
  assert.equal(deduplicator.hasSeen('second'), false);
  assert.equal(deduplicator.hasSeen('third'), true);
});

test('BLE framing reassembles an envelope payload from out-of-order chunks', () => {
  const source = new TextEncoder().encode(JSON.stringify({ messageId: 'stable-id', note: 'store carry forward' }));
  const frames = frameBlePayload(source, 20);
  assert.ok(frames.length > 1);
  const assembler = new BleFrameAssembler();
  let completed: Uint8Array | undefined;
  for (const frame of [...frames].reverse()) {
    completed = assembler.accept('peer-a', frame) ?? completed;
  }
  assert.equal(new TextDecoder().decode(completed), new TextDecoder().decode(source));
});

test('mock mesh relays A -> B -> C without an A/C link and suppresses loops', async () => {
  const network = new MockMeshNetwork();
  const gatewayRequests: MeshEnvelope[] = [];
  const gateway = {
    async sync(_url: string, request: { outboundEnvelopes: MeshEnvelope[] }) {
      gatewayRequests.push(...request.outboundEnvelopes);
      return {
        acknowledgedMessageIds: request.outboundEnvelopes.map((item) => item.messageId),
        inboundCases: [],
        inboundMatches: [],
        inboundTimelineEvents: [],
        serverTimestamp: Date.now(),
      };
    },
  };
  const nodeA = new MockMeshTransport('A', network);
  const nodeB = new MockMeshTransport('B', network);
  const nodeC = new MockMeshTransport('C', network, { gatewayClient: gateway });
  await Promise.all([nodeA.init(), nodeB.init(), nodeC.init()]);
  network.connect('A', 'B');
  network.connect('B', 'C');

  let receivedAtC = 0;
  let receivedAtB = 0;
  nodeB.onMessageReceived(() => {
    receivedAtB += 1;
  });
  nodeC.onMessageReceived(() => {
    receivedAtC += 1;
  });
  const report = envelope('HIGH');
  const result = await nodeA.sendMeshMessage(report);

  assert.equal(result.immediateRelay, true);
  assert.deepEqual((await nodeA.getNearbyPeers()).map((peer) => peer.nodeId), ['B']);
  assert.deepEqual((await nodeC.getNearbyPeers()).map((peer) => peer.nodeId), ['B']);
  assert.equal(receivedAtC, 1);
  assert.equal(receivedAtB, 1);
  assert.equal((await nodeC.getQueuedMessages())[0]?.hopCount, 2);

  await nodeA.sendMeshMessage(report);
  assert.equal(receivedAtC, 1);

  const response = await nodeC.syncWithGateway('mock://gateway');
  assert.deepEqual(response.acknowledgedMessageIds, [report.messageId]);
  assert.equal(gatewayRequests.length, 1);
  assert.equal((await nodeC.getQueuedMessages()).length, 0);
  assert.equal(nodeC.getNetworkHealth().connectivity, 'INTERNET_CONNECTED');
  assert.equal((await nodeA.getQueuedMessages()).length, 0);
  assert.equal(nodeA.getNetworkHealth().connectivity, 'MESH_CONNECTED');
});

test('peer-addressed rescue alert reaches only its target and is not consumed by gateway sync', async () => {
  const network = new MockMeshNetwork();
  const gatewayRequests: MeshEnvelope[] = [];
  const gateway = {
    async sync(_url: string, request: { outboundEnvelopes: MeshEnvelope[] }) {
      gatewayRequests.push(...request.outboundEnvelopes);
      return {
        acknowledgedMessageIds: request.outboundEnvelopes.map((item) => item.messageId),
        inboundCases: [],
        inboundMatches: [],
        inboundTimelineEvents: [],
        serverTimestamp: Date.now(),
      };
    },
  };
  const nodeA = new MockMeshTransport('A', network);
  const nodeB = new MockMeshTransport('B', network, { gatewayClient: gateway });
  const nodeC = new MockMeshTransport('C', network);
  await Promise.all([nodeA.init(), nodeB.init(), nodeC.init()]);
  network.connect('A', 'B');
  network.connect('B', 'C');

  let receivedAtC = 0;
  nodeC.onMessageReceived(() => { receivedAtC += 1; });
  const signal = envelope('CRITICAL', {
    messageType: 'EMERGENCY',
    destinationType: 'SPECIFIC_NODE',
    destinationId: 'C',
    payload: { kind: 'RESCUE_SIGNAL', action: 'RESCUER_NEARBY' },
  });
  await nodeA.sendMeshMessage(signal);

  assert.equal(receivedAtC, 1);
  assert.equal((await nodeC.getQueuedMessages()).length, 0);
  await nodeB.syncWithGateway('mock://gateway');
  assert.equal(gatewayRequests.length, 0);
  assert.equal((await nodeB.getQueuedMessages()).some((item) => item.messageId === signal.messageId), true);
});

test('durable queue replays through A -> B -> C after the origin restarts', async () => {
  const queueStorage = new InMemoryMessageQueueStorage();
  const seenStorage = new InMemorySeenMessageStore();
  const firstNetwork = new MockMeshNetwork();
  const firstA = new MockMeshTransport('A', firstNetwork, {
    queue: new MessageQueue(queueStorage),
    deduplicator: new Deduplicator(seenStorage),
  });
  await firstA.init();
  const report = envelope('HIGH');
  await firstA.sendMeshMessage(report);

  const restartedNetwork = new MockMeshNetwork();
  const restartedA = new MockMeshTransport('A', restartedNetwork, {
    queue: new MessageQueue(queueStorage),
    deduplicator: new Deduplicator(seenStorage),
  });
  const nodeB = new MockMeshTransport('B', restartedNetwork);
  const nodeC = new MockMeshTransport('C', restartedNetwork);
  await Promise.all([restartedA.init(), nodeB.init(), nodeC.init()]);
  restartedNetwork.connect('A', 'B');
  restartedNetwork.connect('B', 'C');

  assert.equal(await restartedA.relayQueuedMessages(), 2);
  assert.deepEqual((await nodeC.getQueuedMessages()).map((item) => item.messageId), [report.messageId]);
});

test('hop limit prevents a maxHops=1 envelope from reaching C', async () => {
  const network = new MockMeshNetwork();
  const nodeA = new MockMeshTransport('A', network);
  const nodeB = new MockMeshTransport('B', network);
  const nodeC = new MockMeshTransport('C', network);
  await Promise.all([nodeA.init(), nodeB.init(), nodeC.init()]);
  network.connect('A', 'B');
  network.connect('B', 'C');

  let receivedAtB = 0;
  let receivedAtC = 0;
  nodeB.onMessageReceived(() => {
    receivedAtB += 1;
  });
  nodeC.onMessageReceived(() => {
    receivedAtC += 1;
  });

  await nodeA.sendMeshMessage(envelope('NORMAL', { maxHops: 1 }));
  assert.equal(receivedAtB, 1);
  assert.equal(receivedAtC, 0);
});

test('gateway partial ACK keeps unacknowledged envelopes queued on every relay node', async () => {
  const network = new MockMeshNetwork();
  let acknowledgedId = '';
  const gateway = {
    async sync(_url: string, request: { outboundEnvelopes: MeshEnvelope[] }) {
      acknowledgedId = request.outboundEnvelopes[0]?.messageId ?? '';
      return {
        acknowledgedMessageIds: acknowledgedId ? [acknowledgedId] : [],
        inboundCases: [],
        inboundMatches: [],
        inboundTimelineEvents: [],
        serverTimestamp: Date.now(),
      };
    },
  };
  const nodeA = new MockMeshTransport('A', network);
  const nodeB = new MockMeshTransport('B', network);
  const nodeC = new MockMeshTransport('C', network, { gatewayClient: gateway });
  await Promise.all([nodeA.init(), nodeB.init(), nodeC.init()]);
  network.connect('A', 'B');
  network.connect('B', 'C');

  await nodeA.sendMeshMessage(envelope('HIGH'));
  await nodeA.sendMeshMessage(envelope('NORMAL'));
  await nodeC.syncWithGateway('mock://partial');

  for (const node of [nodeA, nodeB, nodeC]) {
    const queuedIds = (await node.getQueuedMessages()).map((item) => item.messageId);
    assert.equal(queuedIds.includes(acknowledgedId), false);
    assert.equal(queuedIds.length, 1);
  }
});

test('gateway failure rejects visibly and leaves all messages queued', async () => {
  const network = new MockMeshNetwork();
  const failingGateway = {
    async sync(): Promise<never> {
      throw new Error('gateway unavailable');
    },
  };
  const node = new MockMeshTransport('GATEWAY-NODE', network, { gatewayClient: failingGateway });
  await node.init();
  const report = envelope('HIGH');
  await node.sendMeshMessage(report);

  await assert.rejects(node.syncWithGateway('mock://offline'), /gateway unavailable/);
  assert.deepEqual((await node.getQueuedMessages()).map((item) => item.messageId), [report.messageId]);
  assert.equal(node.getNetworkHealth().connectivity, 'OFFLINE_QUEUED');
});
