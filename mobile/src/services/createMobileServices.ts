import { randomUUID } from 'expo-crypto';
import { Platform } from 'react-native';

import {
  FetchGatewayClient,
  type MeshSendResult,
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
import type { DisasterCase, GeoLocation, MeshEnvelope, SyncBatchResponse } from '../../../shared/types/index';
import { asyncStorageAdapter } from './AsyncStorageAdapters';
import { getOrCreateDevNodeId } from './DevNodeIdentity';
import { LocalQueueService, type ReceivedMeshRecord } from './LocalQueueService';
import { ReportSubmissionService } from './ReportSubmissionService';
import { AndroidBleRadioPort } from './AndroidBleRadioPort';
import { DeviceBackendAuth } from './DeviceBackendAuth';
import { DevicePresenceService } from './DevicePresenceService';
import { playNearbyRescuerAlert, stopNearbyRescuerAlert } from './EmergencyAlertService';
import {
  isRescueSignalEnvelope,
  rescueSignalTarget,
  type HelpRescueStatus,
  type RescueSignalAction,
  type RescueSignalPayload,
} from './RescueSignal';

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
  peerSignals?: Array<{
    nodeId: string;
    radioPeerId: string;
    rssi: number;
    lastSeenAt: number;
  }>;
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
  isDemoOffline(): boolean;
  setDemoOffline(enabled: boolean): Promise<void>;
  initialize(): Promise<void>;
  getMeshActivity(): Promise<MobileMeshActivity>;
  subscribeMeshActivity(callback: () => void): () => void;
  shutdown(): void;
  syncDemoGateway(): Promise<SyncBatchResponse>;
  syncBackend(): Promise<SyncBatchResponse>;
  retryNativeBle(): Promise<void>;
  sendBleTestEnvelope(): Promise<string>;
  sendRescueSignal(
    target: DisasterCase,
    action: RescueSignalAction,
    rescuerLocation?: GeoLocation,
  ): Promise<{ supported: boolean; sendResult?: MeshSendResult }>;
  getRescueBluetoothProximity(target: DisasterCase): {
    rssi: number;
    lastSeenAt: number;
  } | undefined;
  getHelpStatus(requestId: string): Promise<HelpRescueStatus | undefined>;
}

const DEMO_OFFLINE_KEY = '@resqnet/demo-offline/v1';
const HOSTED_BACKEND_BASE_URL = 'https://resqnet-backend-2gof.onrender.com';

function configuredBackendBaseUrl(): string {
  const configured = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
  if (configured) return configured.replace(/\/$/, '');
  if (Platform.OS === 'android' && !__DEV__) return HOSTED_BACKEND_BASE_URL;
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
  if (record.envelope.messageType === 'EMERGENCY') {
    if (payload.kind === 'RESCUE_SIGNAL') {
      if (payload.action === 'PERSON_FOUND') return 'Rescue completion signal';
      if (payload.action === 'RESCUER_NEARBY') return 'Nearby rescuer alert';
      return 'Rescuer location update';
    }
    return typeof payload.requesterName === 'string'
      ? `${payload.requesterName} needs help`
      : 'Emergency help request';
  }
  return record.envelope.messageType.replaceAll('_', ' ');
}

export function createMobileServices(): MobileServices {
  const mode = configuredMode();
  const backendBaseUrl = configuredBackendBaseUrl();
  const canSyncBackend =
    mode === 'DEV_EMULATOR_MESH' || !__DEV__ || Boolean(process.env.EXPO_PUBLIC_API_BASE_URL?.trim());
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
  let presenceTimer: ReturnType<typeof setInterval> | undefined;
  let rescueStatusTimer: ReturnType<typeof setInterval> | undefined;
  let backendSyncInFlight: Promise<SyncBatchResponse> | undefined;
  let presenceService: DevicePresenceService | undefined;
  let deviceAuth: DeviceBackendAuth | undefined;
  let lastPresenceEnvelopeAt = 0;
  let backendGatewayState: MobileMeshActivity['gatewayState'] = 'NOT_CONNECTED';
  let demoOffline = false;
  let activeAlertRequestId: string | undefined;

  const notify = () => {
    for (const subscriber of subscribers) subscriber();
  };
  localQueue.subscribe(notify);

  const stopBackendSync = () => {
    if (backendSyncTimer) clearInterval(backendSyncTimer);
    backendSyncTimer = undefined;
  };

  const publishPresenceToMesh = async (): Promise<void> => {
    if (!mesh || !presenceService) return;
    await presenceService.refreshLocation();
    const activity = await service.getMeshActivity();
    const telemetry = presenceService.snapshot(activity);
    const now = Date.now();
    const messageId = randomUUID();
    await mesh.sendMeshMessage({
      messageId,
      messageType: 'NETWORK_STATUS',
      priority: 'LOW',
      createdAt: now,
      expiresAt: now + 30 * 60_000,
      hopCount: 0,
      maxHops: 5,
      senderPseudonym: `MOBILE-${nodeId}`,
      destinationType: 'GATEWAY',
      payload: telemetry,
    });
    lastPresenceEnvelopeAt = now;
  };

  const startPresenceSharing = () => {
    if (presenceTimer) return;
    presenceTimer = setInterval(() => {
      void publishPresenceToMesh().catch((error: unknown) => {
        console.info('Device presence remains local until the mesh is available.', error);
      });
    }, 2 * 60_000);
    void publishPresenceToMesh().catch((error: unknown) => {
      console.info('Initial device presence publication deferred.', error);
    });
  };

  const refreshOwnedRescueStatuses = async (): Promise<void> => {
    const records = await localQueue.getRecords();
    for (const record of records) {
      const payload = record.envelope.payload as Record<string, unknown>;
      if (record.envelope.messageType === 'EMERGENCY' && payload.status === 'REQUESTING_HELP' && typeof payload.requestId === 'string') {
        await service.getHelpStatus(payload.requestId);
      }
    }
  };

  const startRescueStatusPolling = () => {
    if (rescueStatusTimer) return;
    rescueStatusTimer = setInterval(() => {
      void refreshOwnedRescueStatuses().catch((error: unknown) => {
        console.info('Rescue status polling deferred.', error);
      });
    }, 5_000);
  };

  const purgeRescueLocations = async (requestId: string): Promise<void> => {
    await localQueue.redactRescueLocation(requestId);
    if (!mesh) return;
    const queued = await mesh.getQueuedMessages();
    for (const envelope of queued) {
      if (envelope.messageType !== 'EMERGENCY' || typeof envelope.payload !== 'object' || envelope.payload === null) continue;
      const payload = envelope.payload as Record<string, unknown>;
      const isResolvedRequest = payload.requestId === requestId;
      const isOldSignal = payload.kind === 'RESCUE_SIGNAL'
        && payload.targetRequestId === requestId
        && payload.action !== 'PERSON_FOUND';
      if (isResolvedRequest || isOldSignal) {
        await mesh.removeQueuedMessage(envelope.messageId);
      }
    }
    notify();
  };

  const receiveEnvelope = async (
    envelope: MeshEnvelope<unknown>,
    fromNodeId?: string,
  ): Promise<void> => {
    await localQueue.saveReceivedEnvelope(envelope, fromNodeId);
    if (!isRescueSignalEnvelope(envelope)) return;
    if (envelope.payload.action === 'PERSON_FOUND') {
      // Every store-carry-forward node removes stale target/rescuer coordinates,
      // not only the two phones involved in the final encounter.
      await purgeRescueLocations(envelope.payload.targetRequestId);
    }
    if (
      envelope.destinationId !== nodeId
      || envelope.payload.targetSenderPseudonym !== `MOBILE-${nodeId}`
    ) return;

    const ownsRequest = (await localQueue.getRecords()).some((record) => {
      if (record.envelope.messageType !== 'EMERGENCY') return false;
      const payload = record.envelope.payload as Record<string, unknown>;
      return payload.status === 'REQUESTING_HELP'
        && payload.requestId === envelope.payload.targetRequestId;
    });
    if (!ownsRequest) return;

    if (envelope.payload.action === 'RESCUER_NEARBY') {
      if (activeAlertRequestId !== envelope.payload.targetRequestId) {
        activeAlertRequestId = envelope.payload.targetRequestId;
        await playNearbyRescuerAlert();
      }
    } else if (
      envelope.payload.action === 'PERSON_FOUND'
      && activeAlertRequestId === envelope.payload.targetRequestId
    ) {
      activeAlertRequestId = undefined;
      await stopNearbyRescuerAlert();
    }
  };

  let service!: MobileServices;

  const startBackendSync = () => {
    if (!initialized || !canSyncBackend || demoOffline || backendSyncTimer) return;
    backendSyncTimer = setInterval(() => {
      void service.syncBackend().catch((error: unknown) => {
        console.info('Backend sync unavailable; local queue retained.', error);
      });
    }, 4_000);
    void service.syncBackend().catch((error: unknown) => {
      console.info('Initial backend sync unavailable; local queue retained.', error);
    });
  };

  service = {
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

    isDemoOffline(): boolean {
      return demoOffline;
    },

    async setDemoOffline(enabled: boolean): Promise<void> {
      demoOffline = enabled;
      await asyncStorageAdapter.setItem(DEMO_OFFLINE_KEY, enabled ? 'true' : 'false');
      if (enabled) {
        stopBackendSync();
        backendGatewayState = 'NOT_CONNECTED';
      } else {
        startBackendSync();
      }
      notify();
    },

    async initialize(): Promise<void> {
      if (initialized) return;
      demoOffline = (await asyncStorageAdapter.getItem(DEMO_OFFLINE_KEY)) === 'true';
      nodeId = await getOrCreateDevNodeId(asyncStorageAdapter, randomUUID);
      presenceService = new DevicePresenceService(nodeId, mode);
      const persistentQueue = new MessageQueue(
        new KeyValueMessageQueueStorage(asyncStorageAdapter, '@resqnet/mobile-mesh-queue/v1'),
      );
      const persistentDedup = new Deduplicator(
        new KeyValueSeenMessageStore(asyncStorageAdapter, '@resqnet/mobile-mesh-seen/v1'),
      );
      deviceAuth = new DeviceBackendAuth(backendBaseUrl, nodeId);
      const gatewayClient = new FetchGatewayClient({
        getAccessToken: canSyncBackend ? () => deviceAuth!.getAccessToken() : undefined,
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
          void receiveEnvelope(envelope, fromNodeId).catch((error: unknown) => {
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
          void receiveEnvelope(envelope, fromNodeId).catch((error: unknown) => {
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
        mockMesh.onMessageReceived((envelope) => {
          void receiveEnvelope(envelope).catch((error: unknown) => {
            console.warn('Could not persist received mock mesh envelope.', error);
          });
        });
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
      startPresenceSharing();
      startBackendSync();
      startRescueStatusPolling();
      // Restore an unresolved nearby-rescuer alert after an app restart. The
      // latest local signal is available offline; online status is also
      // reconciled through the authenticated requester endpoint.
      void (async () => {
        const records = await localQueue.getRecords();
        for (const record of records) {
          const payload = record.envelope.payload as Record<string, unknown>;
          if (record.envelope.messageType !== 'EMERGENCY' || payload.status !== 'REQUESTING_HELP' || typeof payload.requestId !== 'string') continue;
          await service.getHelpStatus(payload.requestId);
        }
      })().catch((error: unknown) => console.info('Rescue alert restoration deferred.', error));
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
          peerSignals: nativeActivity.peerSignals,
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
      stopBackendSync();
      if (presenceTimer) clearInterval(presenceTimer);
      presenceTimer = undefined;
      if (rescueStatusTimer) clearInterval(rescueStatusTimer);
      rescueStatusTimer = undefined;
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
      if (demoOffline) {
        throw new Error('Demo offline mode is on. Reports remain saved and nearby sharing stays active.');
      }
      if (!backendSyncInFlight) {
        await presenceService?.refreshLocation();
        // Keep an offline-carriable capsule reasonably fresh without growing
        // the queue on every four-second backend poll.
        if (Date.now() - lastPresenceEnvelopeAt > 2 * 60_000) {
          await publishPresenceToMesh();
        }
        const activity = await service.getMeshActivity();
        const telemetry = presenceService?.snapshot(activity);
        backendSyncInFlight = submissions.syncWithGateway(backendBaseUrl, telemetry)
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

    async sendRescueSignal(target, action, rescuerLocation) {
      if (!mesh) throw new Error('Mesh transport is not initialized.');
      const destination = rescueSignalTarget(target);
      if (!destination) return { supported: false };
      const createdAt = Date.now();
      const payload: RescueSignalPayload = {
        kind: 'RESCUE_SIGNAL',
        action,
        targetRequestId: destination.requestId,
        targetSenderPseudonym: destination.senderPseudonym,
        rescuerNodeId: nodeId,
        // Completion deliberately carries no fresh location. Existing target
        // and rescuer coordinates are purged after this durable signal queues.
        rescuerLocation: action === 'PERSON_FOUND' ? undefined : rescuerLocation,
        rescuerLocationObservedAt: action === 'PERSON_FOUND' || !rescuerLocation ? undefined : createdAt,
        sentAt: new Date(createdAt).toISOString(),
      };
      const sendResult = await mesh.sendMeshMessage({
        messageId: randomUUID(),
        messageType: 'EMERGENCY',
        priority: 'CRITICAL',
        createdAt,
        expiresAt: createdAt + 30 * 60_000,
        hopCount: 0,
        maxHops: 5,
        senderPseudonym: `MOBILE-${nodeId}`,
        // The destination remains explicit for requester-side filtering, while
        // GATEWAY ensures an internet-connected rescuer can coordinate with a
        // requester outside Bluetooth range.
        destinationType: 'GATEWAY',
        destinationId: destination.nodeId,
        payload,
      });
      if (action === 'PERSON_FOUND') {
        await purgeRescueLocations(destination.requestId);
      }
      return { supported: true, sendResult };
    },

    getRescueBluetoothProximity(target) {
      if (!nativeMesh) return undefined;
      const destination = rescueSignalTarget(target);
      if (!destination) return undefined;
      const signal = nativeMesh.getActivity().peerSignals.find((item) => item.nodeId === destination.nodeId);
      return signal ? { rssi: signal.rssi, lastSeenAt: signal.lastSeenAt } : undefined;
    },

    async getHelpStatus(requestId) {
      let localStatus: HelpRescueStatus | undefined;
      const received = await localQueue.getReceivedRecords();
      for (const record of received) {
        if (!isRescueSignalEnvelope(record.envelope)) continue;
        const payload = record.envelope.payload;
        if (payload.targetRequestId !== requestId || payload.targetSenderPseudonym !== `MOBILE-${nodeId}`) continue;
        localStatus = {
          requestId,
          status: payload.action === 'PERSON_FOUND'
            ? 'PERSON_FOUND'
            : payload.action === 'RESCUER_NEARBY'
              ? 'RESCUER_NEARBY'
              : 'RESCUER_ASSIGNED',
          rescuerNodeId: payload.rescuerNodeId,
          rescuerLocation: payload.rescuerLocation,
          rescuerLocationObservedAt: payload.rescuerLocationObservedAt,
          updatedAt: payload.sentAt,
        };
        break;
      }

      if (!canSyncBackend || demoOffline || !deviceAuth) {
        if (localStatus?.status === 'RESCUER_NEARBY' && activeAlertRequestId !== requestId) {
          activeAlertRequestId = requestId;
          await playNearbyRescuerAlert();
        } else if (localStatus?.status === 'PERSON_FOUND' && activeAlertRequestId === requestId) {
          activeAlertRequestId = undefined;
          await stopNearbyRescuerAlert();
        }
        if (localStatus?.status === 'PERSON_FOUND') await purgeRescueLocations(requestId);
        return localStatus;
      }
      try {
        const token = await deviceAuth.getAccessToken();
        const response = await fetch(
          `${backendBaseUrl}/api/v1/rescue/help/${encodeURIComponent(requestId)}/status`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (response.ok) {
          const result = await response.json() as { success?: boolean; status?: HelpRescueStatus };
          if (result.success && result.status && (!localStatus || result.status.updatedAt >= localStatus.updatedAt)) {
            localStatus = result.status;
          }
        }
      } catch (error) {
        console.info('Remote rescue status unavailable; local mesh status retained.', error);
      }
      if (localStatus?.status === 'RESCUER_NEARBY' && activeAlertRequestId !== requestId) {
        activeAlertRequestId = requestId;
        await playNearbyRescuerAlert();
      } else if (localStatus?.status === 'PERSON_FOUND' && activeAlertRequestId === requestId) {
        activeAlertRequestId = undefined;
        await stopNearbyRescuerAlert();
      }
      if (localStatus?.status === 'PERSON_FOUND') await purgeRescueLocations(requestId);
      return localStatus;
    },
  };

  return service;
}
