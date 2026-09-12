import assert from 'node:assert/strict';
import test from 'node:test';

import type { MeshEnvelope } from '../../shared/types/index';
import {
  BleFrameAssembler,
  frameBlePayload,
  type BleAdvertisingConfig,
  type BleConnectionEvent,
  type BleFrameEvent,
  type BlePeerEvent,
  type BlePermissionState,
  type BleRadioCapabilities,
  type BleRadioPort,
} from '../native/BleRadioPort';
import { NativeBleMeshTransport } from '../native/NativeBleMeshTransport';
import {
  compareBleInventories,
  deserializeBleWirePacket,
  prepareEnvelopeForBle,
} from '../native/BleWireProtocol';

function report(overrides: Partial<MeshEnvelope<unknown>> = {}): MeshEnvelope<unknown> {
  const now = Date.now();
  return {
    messageId: `ble-${Math.random().toString(16).slice(2)}`,
    messageType: 'MISSING_PERSON',
    priority: 'HIGH',
    createdAt: now,
    expiresAt: now + 60_000,
    hopCount: 0,
    maxHops: 7,
    senderPseudonym: 'TEST-BLE-NODE',
    destinationType: 'GATEWAY',
    payload: { person: { name: 'Rahul Sharma', photoUrl: 'file:///private/rahul.jpg' } },
    ...overrides,
  };
}

async function waitFor(predicate: () => boolean | Promise<boolean>, timeoutMs = 2_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!(await predicate())) {
    if (Date.now() >= deadline) throw new Error('Timed out waiting for linked BLE radios.');
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

class LinkedRadioNetwork {
  private readonly radios = new Map<string, LinkedRadio>();

  add(radio: LinkedRadio): void {
    this.radios.set(radio.nodeId, radio);
  }

  discover(left: string, right: string): void {
    this.radios.get(left)?.emitPeer(right);
    this.radios.get(right)?.emitPeer(left);
  }

  connect(left: string, right: string): void {
    const a = this.radios.get(left);
    const b = this.radios.get(right);
    if (!a || !b) throw new Error('Unknown linked BLE radio.');
    a.attach(right);
    b.attach(left);
  }

  disconnect(left: string, right: string): void {
    this.radios.get(left)?.detach(right);
    this.radios.get(right)?.detach(left);
  }

  deliver(from: string, to: string, frame: Uint8Array): void {
    const target = this.radios.get(to);
    if (!target) throw new Error('Linked BLE peer is unavailable.');
    target.emitFrame(from, frame);
  }
}

class LinkedRadio implements BleRadioPort {
  failWrites = false;
  private readonly peerListeners = new Set<(event: BlePeerEvent) => void>();
  private readonly connectionListeners = new Set<(event: BleConnectionEvent) => void>();
  private readonly frameListeners = new Set<(event: BleFrameEvent) => void>();
  private readonly connected = new Set<string>();

  constructor(readonly nodeId: string, private readonly network: LinkedRadioNetwork) {
    network.add(this);
  }

  async getPermissionState(): Promise<BlePermissionState> { return 'GRANTED'; }
  async requestPermissions(): Promise<BlePermissionState> { return 'GRANTED'; }
  async getCapabilities(): Promise<BleRadioCapabilities> {
    return { canScan: true, canAdvertise: true, canGattClient: true, canGattServer: true };
  }
  async startAdvertising(_config: BleAdvertisingConfig): Promise<void> {}
  async startScanning(_serviceUuid: string): Promise<void> {}
  async stop(): Promise<void> {
    for (const peer of [...this.connected]) this.network.disconnect(this.nodeId, peer);
  }
  async connect(peerId: string): Promise<void> { this.network.connect(this.nodeId, peerId); }
  async disconnect(peerId: string): Promise<void> { this.network.disconnect(this.nodeId, peerId); }
  async writeFrame(peerId: string, _uuid: string, frame: Uint8Array): Promise<void> {
    if (this.failWrites) throw new Error('simulated GATT write failure');
    if (!this.connected.has(peerId)) throw new Error('peer disconnected');
    this.network.deliver(this.nodeId, peerId, frame.slice());
  }
  onPeerFound(callback: (event: BlePeerEvent) => void): () => void {
    this.peerListeners.add(callback);
    return () => this.peerListeners.delete(callback);
  }
  onConnectionChanged(callback: (event: BleConnectionEvent) => void): () => void {
    this.connectionListeners.add(callback);
    return () => this.connectionListeners.delete(callback);
  }
  onFrameReceived(callback: (event: BleFrameEvent) => void): () => void {
    this.frameListeners.add(callback);
    return () => this.frameListeners.delete(callback);
  }
  emitPeer(peerId: string, rssi = -61): void {
    for (const listener of this.peerListeners) listener({ peerId, lastSeenAt: Date.now(), rssi });
  }
  attach(peerId: string): void {
    if (!this.connected.add(peerId)) return;
    for (const listener of this.connectionListeners) {
      listener({ peerId, connected: true, negotiatedFrameBytes: 80 });
    }
  }
  detach(peerId: string): void {
    if (!this.connected.delete(peerId)) return;
    for (const listener of this.connectionListeners) {
      listener({ peerId, connected: false, negotiatedFrameBytes: 80 });
    }
  }
  emitFrame(peerId: string, frame: Uint8Array): void {
    for (const listener of this.frameListeners) listener({ peerId, frame });
  }
}

test('BLE assembler ignores duplicate chunks and purges incomplete transfers after timeout', () => {
  let now = 1_000;
  const assembler = new BleFrameAssembler(() => now, 100);
  const frames = frameBlePayload(new TextEncoder().encode('a message spanning frames'), 12);
  assert.ok(frames.length > 1);
  assert.equal(assembler.accept('A', frames[0] as Uint8Array), undefined);
  assert.equal(assembler.accept('A', frames[0] as Uint8Array), undefined);
  assert.equal(assembler.getPendingTransferCount(), 1);
  now += 101;
  assert.equal(assembler.purgeExpired(), 1);
  assert.equal(assembler.getPendingTransferCount(), 0);
});

test('BLE assembler rejects a payload whose integrity token no longer matches', () => {
  const frames = frameBlePayload(new TextEncoder().encode('integrity protected'), 12);
  const last = frames.at(-1) as Uint8Array;
  last[last.length - 1] = (last[last.length - 1] ?? 0) ^ 0xff;
  const assembler = new BleFrameAssembler();
  assert.throws(() => {
    for (const frame of frames) assembler.accept('A', frame);
  }, /integrity/);
});

test('BLE inventory compares stable IDs and invalid envelopes are rejected', () => {
  assert.deepEqual(compareBleInventories(['1', '2', '3'], ['2', '3', '4']), {
    sendToPeer: ['1'],
    requestFromPeer: ['4'],
  });
  const invalid = new TextEncoder().encode(JSON.stringify({ kind: 'ENVELOPE', envelope: { messageId: 'bad' } }));
  assert.throws(() => deserializeBleWirePacket(invalid), /message type/);
});

test('BLE capsule strips device-local media URI without mutating durable source report', () => {
  const source = report();
  const prepared = prepareEnvelopeForBle(source);
  const sourcePerson = (source.payload as { person: { photoUrl?: string } }).person;
  const preparedPerson = (prepared.payload as { person: { photoUrl?: string } }).person;
  assert.equal(sourcePerson.photoUrl, 'file:///private/rahul.jpg');
  assert.equal(preparedPerson.photoUrl, undefined);
});

test('native-independent BLE path relays A -> B -> C with receipt and persistent dedup semantics', async (context) => {
  const network = new LinkedRadioNetwork();
  const radioA = new LinkedRadio('A', network);
  const radioB = new LinkedRadio('B', network);
  const radioC = new LinkedRadio('C', network);
  const nodeA = new NativeBleMeshTransport('A', radioA, { createEphemeralTag: () => 'tag-a' });
  const nodeB = new NativeBleMeshTransport('B', radioB, { createEphemeralTag: () => 'tag-b' });
  const nodeC = new NativeBleMeshTransport('C', radioC, { createEphemeralTag: () => 'tag-c' });
  context.after(async () => Promise.all([nodeA.shutdown(), nodeB.shutdown(), nodeC.shutdown()]));
  await Promise.all([nodeA.init(), nodeB.init(), nodeC.init()]);

  let receivedAtB = 0;
  let receivedAtC = 0;
  let receiptsAtA = 0;
  nodeB.onMessageReceived(() => { receivedAtB += 1; });
  nodeC.onMessageReceived(() => { receivedAtC += 1; });
  nodeA.onPeerReceipt(() => { receiptsAtA += 1; });
  network.discover('A', 'B');
  await waitFor(() => nodeA.getActivity().connectedPeerIds.includes('B'));
  assert.equal(nodeA.getActivity().peerSignals[0]?.nodeId, 'B');
  assert.equal(Math.round(nodeA.getActivity().peerSignals[0]?.rssi ?? 0), -61);

  const source = report();
  await nodeA.sendMeshMessage(source);
  await waitFor(() => receivedAtB === 1 && receiptsAtA >= 1);
  assert.equal((await nodeB.getQueuedMessages())[0]?.hopCount, 1);

  network.disconnect('A', 'B');
  network.discover('B', 'C');
  await waitFor(() => receivedAtC === 1);
  assert.equal((await nodeC.getQueuedMessages())[0]?.hopCount, 2);

  // Reconnect B/C and exchange inventories again; C must not accept X twice.
  network.disconnect('B', 'C');
  network.discover('B', 'C');
  await new Promise((resolve) => setTimeout(resolve, 100));
  assert.equal(receivedAtB, 1);
  assert.equal(receivedAtC, 1);
});

test('failed BLE transfer leaves the source envelope in its store-and-forward queue', async (context) => {
  const network = new LinkedRadioNetwork();
  const radioA = new LinkedRadio('A', network);
  const radioB = new LinkedRadio('B', network);
  const nodeA = new NativeBleMeshTransport('A', radioA, { createEphemeralTag: () => 'tag-a' });
  const nodeB = new NativeBleMeshTransport('B', radioB, { createEphemeralTag: () => 'tag-b' });
  context.after(async () => Promise.all([nodeA.shutdown(), nodeB.shutdown()]));
  await Promise.all([nodeA.init(), nodeB.init()]);
  network.discover('A', 'B');
  await waitFor(() => nodeA.getActivity().connectedPeerIds.includes('B'));
  radioA.failWrites = true;
  const source = report();
  await assert.rejects(nodeA.sendMeshMessage(source), /GATT write failure/);
  assert.deepEqual((await nodeA.getQueuedMessages()).map((item) => item.messageId), [source.messageId]);
});
