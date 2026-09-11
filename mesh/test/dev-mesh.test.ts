import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';

import WebSocket from 'ws';

import type { MeshEnvelope } from '../../shared/types/index';
import { DevMeshBroker } from '../dev-broker/DevMeshBroker';
import {
  DevMeshTransport,
  type DevMeshSocket,
} from '../dev/DevMeshTransport';
import { InMemorySeenMessageStore, Deduplicator } from '../protocol/Deduplicator';
import { InMemoryMessageQueueStorage, MessageQueue } from '../queue/MessageQueue';

function report(overrides: Partial<MeshEnvelope<unknown>> = {}): MeshEnvelope<unknown> {
  const now = Date.now();
  return {
    messageId: randomUUID(),
    messageType: 'MISSING_PERSON',
    priority: 'HIGH',
    createdAt: now,
    expiresAt: now + 60_000,
    hopCount: 0,
    maxHops: 7,
    senderPseudonym: 'TEST-NODE',
    destinationType: 'GATEWAY',
    payload: { person: { name: 'Rahul Sharma' } },
    ...overrides,
  };
}

function node(nodeId: string, url: string, options: ConstructorParameters<typeof DevMeshTransport>[2] = {}) {
  return new DevMeshTransport(nodeId, url, {
    reconnectDelayMs: 40,
    socketFactory: (target) => new WebSocket(target) as unknown as DevMeshSocket,
    ...options,
  });
}

async function waitFor(predicate: () => boolean | Promise<boolean>, timeoutMs = 3_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!(await predicate())) {
    if (Date.now() >= deadline) throw new Error('Timed out waiting for development mesh state.');
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

test('broker sends A -> B without sender echo and preserves ID, TTL, and hop semantics', async (context) => {
  const broker = new DevMeshBroker({ port: 0, logger: () => undefined });
  const port = await broker.start();
  const url = `ws://127.0.0.1:${port}`;
  const nodeA = node('NODE-A', url);
  const nodeB = node('NODE-B', url);
  context.after(async () => {
    nodeA.shutdown();
    nodeB.shutdown();
    await broker.stop();
  });
  await Promise.all([nodeA.init(), nodeB.init()]);
  await waitFor(() => nodeA.getActivity().connectedPeerIds.includes('NODE-B'));

  let receivedAtA = 0;
  const receivedAtB: MeshEnvelope<unknown>[] = [];
  nodeA.onMessageReceived(() => { receivedAtA += 1; });
  nodeB.onMessageReceived((envelope) => receivedAtB.push(envelope));
  const envelope = report();
  await nodeA.sendMeshMessage(envelope);
  await waitFor(() => receivedAtB.length === 1);

  assert.equal(receivedAtA, 0);
  assert.equal(receivedAtB[0]?.messageId, envelope.messageId);
  assert.equal(receivedAtB[0]?.expiresAt, envelope.expiresAt);
  assert.equal(receivedAtB[0]?.hopCount, 1);
  assert.equal((await nodeB.getQueuedMessages()).length, 1);
});

test('existing deduplicator accepts an intentionally duplicated broker delivery only once', async (context) => {
  const broker = new DevMeshBroker({ port: 0, deliveryCopies: 2, logger: () => undefined });
  const port = await broker.start();
  const url = `ws://127.0.0.1:${port}`;
  const nodeA = node('NODE-A', url);
  const nodeB = node('NODE-B', url);
  context.after(async () => {
    nodeA.shutdown();
    nodeB.shutdown();
    await broker.stop();
  });
  await Promise.all([nodeA.init(), nodeB.init()]);
  await waitFor(() => nodeA.getActivity().connectedPeerIds.length === 1);

  let accepted = 0;
  nodeB.onMessageReceived(() => { accepted += 1; });
  await nodeA.sendMeshMessage(report());
  await waitFor(() => accepted === 1);
  await new Promise((resolve) => setTimeout(resolve, 100));

  assert.equal(accepted, 1);
  assert.equal((await nodeB.getQueuedMessages()).length, 1);
});

test('offline durable queue retries after broker restart and receiver processes once', async (context) => {
  const reservation = new DevMeshBroker({ port: 0, logger: () => undefined });
  const port = await reservation.start();
  await reservation.stop();
  const url = `ws://127.0.0.1:${port}`;
  const queueStorage = new InMemoryMessageQueueStorage();
  const seenStorage = new InMemorySeenMessageStore();
  const offlineA = node('NODE-A', url, {
    queue: new MessageQueue(queueStorage),
    deduplicator: new Deduplicator(seenStorage),
  });
  await offlineA.init();
  const envelope = report();
  const sendResult = await offlineA.sendMeshMessage(envelope);
  assert.equal(sendResult.immediateRelay, false);
  assert.deepEqual((await offlineA.getQueuedMessages()).map((item) => item.messageId), [envelope.messageId]);

  // Recreate the app transport over the same durable stores before connectivity returns.
  offlineA.shutdown();
  const restartedA = node('NODE-A', url, {
    queue: new MessageQueue(queueStorage),
    deduplicator: new Deduplicator(seenStorage),
  });
  const nodeB = node('NODE-B', url);
  const broker = new DevMeshBroker({ port, logger: () => undefined });
  context.after(async () => {
    restartedA.shutdown();
    nodeB.shutdown();
    await broker.stop();
  });
  let acceptedAtB = 0;
  nodeB.onMessageReceived(() => { acceptedAtB += 1; });
  await Promise.all([restartedA.init(), nodeB.init()]);
  await broker.start();
  await waitFor(() => acceptedAtB === 1, 5_000);
  await new Promise((resolve) => setTimeout(resolve, 150));

  assert.equal(acceptedAtB, 1);
  assert.deepEqual((await restartedA.getQueuedMessages()).map((item) => item.messageId), [envelope.messageId]);
});

test('configured topology can connect A-B-C while preventing direct A-C delivery', async (context) => {
  const broker = new DevMeshBroker({
    port: 0,
    topology: { 'NODE-A': ['NODE-B'], 'NODE-B': ['NODE-A', 'NODE-C'], 'NODE-C': ['NODE-B'] },
    logger: () => undefined,
  });
  const port = await broker.start();
  const url = `ws://127.0.0.1:${port}`;
  const nodeA = node('NODE-A', url);
  const nodeB = node('NODE-B', url);
  const nodeC = node('NODE-C', url);
  context.after(async () => {
    nodeA.shutdown();
    nodeB.shutdown();
    nodeC.shutdown();
    await broker.stop();
  });
  await Promise.all([nodeA.init(), nodeB.init(), nodeC.init()]);
  await waitFor(() => nodeB.getActivity().connectedPeerIds.length === 2);
  assert.deepEqual(nodeA.getActivity().connectedPeerIds, ['NODE-B']);
  assert.deepEqual(nodeC.getActivity().connectedPeerIds, ['NODE-B']);

  const receivedAtC: MeshEnvelope<unknown>[] = [];
  nodeC.onMessageReceived((envelope) => receivedAtC.push(envelope));
  const envelope = report();
  await nodeA.sendMeshMessage(envelope);
  await waitFor(() => receivedAtC.length === 1);
  assert.equal(receivedAtC[0]?.hopCount, 2);
});
