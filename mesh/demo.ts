import { randomUUID } from 'node:crypto';

import type { MeshEnvelope } from '../shared/types/index';
import { MockMeshNetwork, MockMeshTransport } from './mock/MockMeshTransport';

async function main(): Promise<void> {
  const network = new MockMeshNetwork();
  const gateway = {
    async sync(_gatewayUrl: string, request: { outboundEnvelopes: MeshEnvelope[] }) {
      for (const item of request.outboundEnvelopes) {
        console.log(`[MOCK-C -> GATEWAY] syncing ${item.messageId}`);
        console.log(`[GATEWAY] ACK ${item.messageId}`);
      }
      return {
        acknowledgedMessageIds: request.outboundEnvelopes.map((item) => item.messageId),
        inboundCases: [],
        inboundMatches: [],
        inboundTimelineEvents: [],
        serverTimestamp: Date.now(),
      };
    },
  };

  const nodeA = new MockMeshTransport('PHONE-A', network);
  const nodeB = new MockMeshTransport('MOCK-B', network);
  const nodeC = new MockMeshTransport('MOCK-C', network, { gatewayClient: gateway });
  await Promise.all([nodeA.init(), nodeB.init(), nodeC.init()]);
  network.connect('PHONE-A', 'MOCK-B');
  network.connect('MOCK-B', 'MOCK-C');

  let deliveriesToC = 0;
  nodeB.onMessageReceived((message) => {
    console.log(`[PHONE-A -> MOCK-B] relayed ${message.messageId} (hop ${message.hopCount})`);
  });
  nodeC.onMessageReceived((message) => {
    deliveriesToC += 1;
    console.log(`[MOCK-B -> MOCK-C] relayed ${message.messageId} (hop ${message.hopCount})`);
    console.log(`[MOCK-C] accepted ${message.messageId}`);
  });

  const now = Date.now();
  const report: MeshEnvelope<{ name: string; approximateAge: number; zone: string }> = {
    messageId: randomUUID(),
    messageType: 'MISSING_PERSON',
    priority: 'HIGH',
    createdAt: now,
    expiresAt: now + 24 * 60 * 60 * 1000,
    hopCount: 0,
    maxHops: 7,
    senderPseudonym: 'FAMILY-A',
    destinationType: 'GATEWAY',
    payload: {
      name: 'Rahul Sharma',
      approximateAge: 22,
      zone: 'Zone A',
    },
  };

  console.log('Topology: PHONE-A <-> MOCK-B <-> MOCK-C <-> GATEWAY');
  console.log('Invariant: PHONE-A and MOCK-C have no direct connection.');
  console.log(`[PHONE-A] queued report ${report.messageId}`);
  await nodeA.sendMeshMessage(report);
  await nodeA.sendMeshMessage(report);
  console.log(`[DEDUP] MOCK-C delivery count for ${report.messageId}: ${deliveriesToC}`);
  const response = await nodeC.syncWithGateway('mock://gateway');
  console.log(`[QUEUE] removed ${response.acknowledgedMessageIds.join(', ')} after ACK`);
  console.log(`[QUEUE] PHONE-A=${(await nodeA.getQueuedMessages()).length}, MOCK-B=${(await nodeB.getQueuedMessages()).length}, MOCK-C=${(await nodeC.getQueuedMessages()).length}`);
  console.log('[PASS] Mock store-carry-forward and loop suppression complete.');
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
