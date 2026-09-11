import { randomUUID } from 'expo-crypto';

import type { MeshTransportService } from '../../../mesh/MeshTransportService';
import {
  DevMeshTransport,
  type DevMeshActivity,
} from '../../../mesh/dev/DevMeshTransport';
import { MockMeshNetwork, MockMeshTransport } from '../../../mesh/mock/MockMeshTransport';
import {
  Deduplicator,
  KeyValueSeenMessageStore,
} from '../../../mesh/protocol/Deduplicator';
import {
  KeyValueMessageQueueStorage,
  MessageQueue,
} from '../../../mesh/queue/MessageQueue';
import type { MeshEnvelope, SyncBatchResponse } from '../../../shared/types/index';
import { asyncStorageAdapter } from './AsyncStorageAdapters';
import { getOrCreateDevNodeId } from './DevNodeIdentity';
import { LocalQueueService, type ReceivedMeshRecord } from './LocalQueueService';
import { ReportSubmissionService } from './ReportSubmissionService';

export type MobileMeshMode = 'MOCK_IN_PROCESS' | 'DEV_EMULATOR_MESH' | 'NATIVE_BLE';

export interface MobileMeshActivity {
  transportMode: MobileMeshMode;
  nodeId: string;
  brokerUrl?: string;
  brokerConnected: boolean;
  connectedPeerIds: string[];
  queuedCount: number;
  receivedCount: number;
  relayedCount: number;
  peerReceiptCount: number;
  gatewayState: 'NOT_CONNECTED' | 'ACKNOWLEDGED' | 'FAILED';
  lastActivity?: string;
  lastReceived?: {
    messageId: string;
    messageType: MeshEnvelope<unknown>['messageType'];
    fromNodeId?: string;
    summary: string;
  };
}

export interface MobileServices {
  readonly mesh: MeshTransportService;
  readonly localQueue: LocalQueueService;
  readonly submissions: ReportSubmissionService;
  readonly transportMode: MobileMeshMode;
  readonly canRunDemoGateway: boolean;
  initialize(): Promise<void>;
  getMeshActivity(): Promise<MobileMeshActivity>;
  subscribeMeshActivity(callback: () => void): () => void;
  shutdown(): void;
  syncDemoGateway(): Promise<SyncBatchResponse>;
}

function configuredMode(): MobileMeshMode {
  const value = process.env.EXPO_PUBLIC_MESH_TRANSPORT;
  if (value === 'DEV_EMULATOR_MESH' || value === 'NATIVE_BLE') return value;
  return 'MOCK_IN_PROCESS';
}

function summaryFromRecord(record: ReceivedMeshRecord): string {
  const payload = record.envelope.payload as Record<string, unknown>;
  const person = payload.person;
  if (
    typeof person === 'object' &&
    person !== null &&
    typeof (person as Record<string, unknown>).name === 'string'
  ) {
    return (person as Record<string, unknown>).name as string;
  }
  if (typeof payload.personName === 'string') return payload.personName;
  if (typeof payload.personDescription === 'string') return payload.personDescription;
  return record.envelope.messageType.replaceAll('_', ' ');
}

export function createMobileServices(): MobileServices {
  const mode = configuredMode();
  const localQueue = new LocalQueueService(asyncStorageAdapter);
  const subscribers = new Set<() => void>();
  let mesh: MeshTransportService | undefined;
  let submissions: ReportSubmissionService | undefined;
  let nodeId = 'INITIALIZING';
  let mockGatewayNode: MockMeshTransport | undefined;
  let devActivity: DevMeshActivity | undefined;
  let shutdownTransport: (() => void) | undefined;
  let initialized = false;

  const notify = () => {
    for (const subscriber of subscribers) subscriber();
  };
  localQueue.subscribe(notify);

  return {
    get mesh(): MeshTransportService {
      if (!mesh) throw new Error('Mobile mesh service has not initialized yet.');
      return mesh;
    },
    get submissions(): ReportSubmissionService {
      if (!submissions) throw new Error('Mobile submission service has not initialized yet.');
      return submissions;
    },
    localQueue,
    transportMode: mode,
    canRunDemoGateway: mode === 'MOCK_IN_PROCESS',

    async initialize(): Promise<void> {
      if (initialized) return;
      nodeId = await getOrCreateDevNodeId(asyncStorageAdapter, randomUUID);
      const persistentQueue = new MessageQueue(
        new KeyValueMessageQueueStorage(asyncStorageAdapter, '@resqnet/mobile-mesh-queue/v1'),
      );
      const persistentDedup = new Deduplicator(
        new KeyValueSeenMessageStore(asyncStorageAdapter, '@resqnet/mobile-mesh-seen/v1'),
      );

      if (mode === 'NATIVE_BLE') {
        throw new Error('Native BLE mode requires an Android BleRadioPort driver. Use DEV_EMULATOR_MESH for this demo.');
      }

      if (mode === 'DEV_EMULATOR_MESH') {
        const brokerUrl = process.env.EXPO_PUBLIC_DEV_MESH_URL ?? 'ws://10.0.2.2:8787';
        const devMesh = new DevMeshTransport(nodeId, brokerUrl, {
          queue: persistentQueue,
          deduplicator: persistentDedup,
        });
        mesh = devMesh;
        shutdownTransport = () => devMesh.shutdown();
        devMesh.onActivityChanged((activity) => {
          devActivity = activity;
          notify();
        });
        devMesh.onPeerReceipt((messageId) => {
          void localQueue.markPeerReached(messageId).catch((error: unknown) => {
            console.warn('Could not persist development peer receipt.', error);
          });
        });
        devMesh.onMessageReceived((envelope) => {
          const fromNodeId = devMesh.getActivity().lastReceived?.fromNodeId;
          void localQueue.saveReceivedEnvelope(envelope, fromNodeId).catch((error: unknown) => {
            console.warn('Could not persist received development mesh envelope.', error);
          });
        });
        await devMesh.init();
      } else {
        const mockNetwork = new MockMeshNetwork();
        const mockMesh = new MockMeshTransport(nodeId, mockNetwork, {
          queue: persistentQueue,
          deduplicator: persistentDedup,
        });
        const nodeB = new MockMeshTransport('MOCK-B', mockNetwork);
        const demoGateway = {
          async sync(
            _gatewayUrl: string,
            request: { outboundEnvelopes: Array<{ messageId: string }> },
          ): Promise<SyncBatchResponse> {
            return {
              acknowledgedMessageIds: request.outboundEnvelopes.map((item) => item.messageId),
              inboundCases: [],
              inboundMatches: [],
              inboundTimelineEvents: [],
              serverTimestamp: Date.now(),
            };
          },
        };
        mockGatewayNode = new MockMeshTransport('MOCK-C', mockNetwork, {
          gatewayClient: demoGateway,
        });
        mesh = mockMesh;
        await Promise.all([mockMesh.init(), nodeB.init(), mockGatewayNode.init()]);
        mockNetwork.connect(nodeId, 'MOCK-B');
        mockNetwork.connect('MOCK-B', 'MOCK-C');
        await mockMesh.relayQueuedMessages();
      }

      submissions = new ReportSubmissionService(localQueue, mesh, {
        senderPseudonym: `MOBILE-${nodeId}`,
        createId: randomUUID,
      });
      initialized = true;
      notify();
    },

    async getMeshActivity(): Promise<MobileMeshActivity> {
      if (!mesh) {
        return {
          transportMode: mode,
          nodeId,
          brokerConnected: false,
          connectedPeerIds: [],
          queuedCount: 0,
          receivedCount: 0,
          relayedCount: 0,
          peerReceiptCount: 0,
          gatewayState: 'NOT_CONNECTED',
          lastActivity: 'Initializing local mesh services',
        };
      }
      const [queued, received] = await Promise.all([
        mesh.getQueuedMessages(),
        localQueue.getReceivedRecords(),
      ]);
      const lastReceived = received[0];
      if (devActivity) {
        return {
          ...devActivity,
          receivedCount: Math.max(devActivity.receivedCount, received.length),
          queuedCount: queued.length,
          lastReceived: devActivity.lastReceived ?? (lastReceived ? {
            messageId: lastReceived.messageId,
            messageType: lastReceived.envelope.messageType,
            fromNodeId: lastReceived.fromNodeId,
            summary: summaryFromRecord(lastReceived),
          } : undefined),
        };
      }
      const health = mesh.getNetworkHealth();
      return {
        transportMode: mode,
        nodeId,
        brokerConnected: false,
        connectedPeerIds: (await mesh.getNearbyPeers()).map((peer) => peer.nodeId),
        queuedCount: queued.length,
        receivedCount: received.length,
        relayedCount: 0,
        peerReceiptCount: 0,
        gatewayState: health.lastSuccessfulSyncTimestamp ? 'ACKNOWLEDGED' : 'NOT_CONNECTED',
        lastActivity: 'In-process A to B to C mock topology active',
      };
    },

    subscribeMeshActivity(callback: () => void): () => void {
      subscribers.add(callback);
      return () => subscribers.delete(callback);
    },

    shutdown(): void {
      shutdownTransport?.();
    },

    async syncDemoGateway(): Promise<SyncBatchResponse> {
      if (!mockGatewayNode) {
        throw new Error('The demo gateway ACK is only available in MOCK_IN_PROCESS mode.');
      }
      const response = await mockGatewayNode.syncWithGateway('mock://demo-gateway');
      await localQueue.applySyncResponse(response);
      notify();
      return response;
    },
  };
}
