import { randomUUID } from 'expo-crypto';
import { Platform } from 'react-native';

import {
  FetchGatewayClient,
  type MeshTransportService,
} from '../../../mesh/MeshTransportService';
import {
  DevMeshTransport,
  type DevMeshActivity,
} from '../../../mesh/dev/DevMeshTransport';
import { MockMeshNetwork, MockMeshTransport } from '../../../mesh/mock/MockMeshTransport';
import {
  NativeBleMeshTransport,
  type NativeBleActivity,
} from '../../../mesh/native/NativeBleMeshTransport';
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
import { AndroidBleRadioPort } from './AndroidBleRadioPort';
import { DevelopmentBackendAuth } from './DevelopmentBackendAuth';

export type MobileMeshMode = 'MOCK_IN_PROCESS' | 'DEV_EMULATOR_MESH' | 'NATIVE_BLE';

export interface MobileMeshActivity {
  transportMode: MobileMeshMode;
  nodeId: string;
  brokerUrl?: string;
  brokerConnected: boolean;
  bluetoothEnabled?: boolean;
  radioReady?: boolean;
  radioPermissionState?: string;
  discoveredPeerIds?: string[];
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
  readonly canSyncBackend: boolean;
  readonly backendBaseUrl: string;
  initialize(): Promise<void>;
  getMeshActivity(): Promise<MobileMeshActivity>;
  subscribeMeshActivity(callback: () => void): () => void;
  shutdown(): void;
  syncDemoGateway(): Promise<SyncBatchResponse>;
  syncBackend(): Promise<SyncBatchResponse>;
  retryNativeBle(): Promise<void>;
  sendBleTestEnvelope(): Promise<string>;
}

function configuredBackendBaseUrl(): string {
  const configured = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
  if (configured) return configured.replace(/\/$/, '');
  return Platform.OS === 'android' ? 'http://10.0.2.2:4000' : 'http://127.0.0.1:4000';
}

function configuredMode(): MobileMeshMode {
  const value = process.env.EXPO_PUBLIC_MESH_TRANSPORT;
  if (value === 'DEV_EMULATOR_MESH' || value === 'NATIVE_BLE') return value;
  // A standalone judge build must not depend on Metro or the Mac broker.
  if (Platform.OS === 'android' && !__DEV__) return 'NATIVE_BLE';
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
  const backendBaseUrl = configuredBackendBaseUrl();
  const canSyncBackend =
    mode === 'DEV_EMULATOR_MESH' || Boolean(process.env.EXPO_PUBLIC_API_BASE_URL?.trim());
  const localQueue = new LocalQueueService(asyncStorageAdapter);
  const subscribers = new Set<() => void>();
  let mesh: MeshTransportService | undefined;
  let submissions: ReportSubmissionService | undefined;
  let nodeId = 'INITIALIZING';
  let mockGatewayNode: MockMeshTransport | undefined;
  let devActivity: DevMeshActivity | undefined;
  let nativeActivity: NativeBleActivity | undefined;
  let nativeMesh: NativeBleMeshTransport | undefined;
  let shutdownTransport: (() => void) | undefined;
  let initialized = false;
  let backendSyncTimer: ReturnType<typeof setInterval> | undefined;
  let backendSyncInFlight: Promise<SyncBatchResponse> | undefined;
  let backendGatewayState: MobileMeshActivity['gatewayState'] = 'NOT_CONNECTED';

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
    canSyncBackend,
    backendBaseUrl,

    async initialize(): Promise<void> {
      if (initialized) return;
      nodeId = await getOrCreateDevNodeId(asyncStorageAdapter, randomUUID);
      const persistentQueue = new MessageQueue(
        new KeyValueMessageQueueStorage(asyncStorageAdapter, '@resqnet/mobile-mesh-queue/v1'),
      );
      const persistentDedup = new Deduplicator(
        new KeyValueSeenMessageStore(asyncStorageAdapter, '@resqnet/mobile-mesh-seen/v1'),
      );
      const developmentAuth = new DevelopmentBackendAuth(
        backendBaseUrl,
        `mobile-${nodeId}`,
      );
      const gatewayClient = new FetchGatewayClient({
        getAccessToken:
          mode === 'DEV_EMULATOR_MESH' || __DEV__
            ? () => developmentAuth.getAccessToken()
            : undefined,
      });

      if (mode === 'NATIVE_BLE') {
        // The radio driver and its honest capability/error state are native;
        // durable queue and disaster protocol behavior stay in the shared abstraction.
        nativeMesh = new NativeBleMeshTransport(nodeId, new AndroidBleRadioPort(), {
          queue: persistentQueue,
          deduplicator: persistentDedup,
          gatewayClient,
          createEphemeralTag: randomUUID,
        });
        mesh = nativeMesh;
        shutdownTransport = () => { void nativeMesh?.shutdown(); };
        nativeMesh.onActivityChanged((activity) => {
          nativeActivity = activity;
          notify();
        });
        nativeMesh.onPeerReceipt((messageId) => {
          void localQueue.markPeerReached(messageId).catch((error: unknown) => {
            console.warn('Could not persist Bluetooth peer receipt.', error);
          });
        });
        nativeMesh.onMessageReceived((envelope) => {
          const fromNodeId = nativeMesh?.getActivity().lastReceived?.fromNodeId;
          void localQueue.saveReceivedEnvelope(envelope, fromNodeId).catch((error: unknown) => {
            console.warn('Could not persist received Bluetooth envelope.', error);
          });
        });
        await nativeMesh.init();
      } else if (mode === 'DEV_EMULATOR_MESH') {
        const brokerUrl = process.env.EXPO_PUBLIC_DEV_MESH_URL ?? 'ws://10.0.2.2:8787';
        const devMesh = new DevMeshTransport(nodeId, brokerUrl, {
          queue: persistentQueue,
          deduplicator: persistentDedup,
          gatewayClient,
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
      if (canSyncBackend) {
        backendSyncTimer = setInterval(() => {
          void this.syncBackend().catch((error: unknown) => {
            console.info('Backend sync unavailable; local queue retained.', error);
          });
        }, 4_000);
        void this.syncBackend().catch((error: unknown) => {
          console.info('Initial backend sync unavailable; local queue retained.', error);
        });
      }
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
          gatewayState: canSyncBackend ? backendGatewayState : devActivity.gatewayState,
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
      if (nativeActivity) {
        return {
          transportMode: mode,
          nodeId,
          brokerConnected: false,
          bluetoothEnabled: nativeActivity.bluetoothEnabled,
          radioReady: nativeActivity.radioReady,
          radioPermissionState: nativeActivity.permissionState,
          discoveredPeerIds: nativeActivity.discoveredPeerIds,
          connectedPeerIds: nativeActivity.connectedPeerIds,
          queuedCount: queued.length,
          receivedCount: Math.max(nativeActivity.receivedCount, received.length),
          relayedCount: nativeActivity.relayedCount,
          peerReceiptCount: nativeActivity.peerReceiptCount,
          gatewayState: canSyncBackend
            ? backendGatewayState
            : mesh.getNetworkHealth().lastSuccessfulSyncTimestamp
              ? 'ACKNOWLEDGED'
              : 'NOT_CONNECTED',
          lastActivity: nativeActivity.lastActivity,
          lastReceived: nativeActivity.lastReceived ? {
            ...nativeActivity.lastReceived,
            summary: lastReceived ? summaryFromRecord(lastReceived) : nativeActivity.lastReceived.messageType.replaceAll('_', ' '),
          } : lastReceived ? {
            messageId: lastReceived.messageId,
            messageType: lastReceived.envelope.messageType,
            fromNodeId: lastReceived.fromNodeId,
            summary: summaryFromRecord(lastReceived),
          } : undefined,
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
        gatewayState: canSyncBackend
          ? backendGatewayState
          : health.lastSuccessfulSyncTimestamp
            ? 'ACKNOWLEDGED'
            : 'NOT_CONNECTED',
        lastActivity: 'In-process A to B to C mock topology active',
      };
    },

    subscribeMeshActivity(callback: () => void): () => void {
      subscribers.add(callback);
      return () => subscribers.delete(callback);
    },

    shutdown(): void {
      if (backendSyncTimer) clearInterval(backendSyncTimer);
      backendSyncTimer = undefined;
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

    async syncBackend(): Promise<SyncBatchResponse> {
      if (!canSyncBackend || !submissions) {
        throw new Error('Real backend sync is not enabled for this transport mode.');
      }
      if (!backendSyncInFlight) {
        backendSyncInFlight = submissions.syncWithGateway(backendBaseUrl)
          .then((response) => {
            backendGatewayState = 'ACKNOWLEDGED';
            return response;
          })
          .catch((error: unknown) => {
            backendGatewayState = 'FAILED';
            throw error;
          })
          .finally(() => {
            backendSyncInFlight = undefined;
            notify();
          });
      }
      return backendSyncInFlight;
    },

    async retryNativeBle(): Promise<void> {
      if (!nativeMesh) throw new Error('Native Bluetooth transport is not selected.');
      await nativeMesh.retryRadio();
      notify();
    },

    async sendBleTestEnvelope(): Promise<string> {
      if (!nativeMesh) throw new Error('Native Bluetooth transport is not selected.');
      const now = Date.now();
      const messageId = randomUUID();
      await nativeMesh.sendMeshMessage({
        messageId,
        messageType: 'NETWORK_STATUS',
        priority: 'LOW',
        createdAt: now,
        expiresAt: now + 10 * 60 * 1000,
        hopCount: 0,
        maxHops: 3,
        senderPseudonym: `MOBILE-${nodeId}`,
        destinationType: 'BROADCAST',
        payload: { diagnostic: true, note: 'ResQNet BLE test envelope' },
      });
      notify();
      return messageId;
    },
  };
}
