import type {
  MeshEnvelope,
  DevicePresenceTelemetry,
  NetworkHealthStatus,
  SyncBatchRequest,
  SyncBatchResponse,
} from '../shared/types/index';

export interface MeshPeer {
  nodeId: string;
  lastSeenAt: number;
}

export interface MeshSendResult {
  queuedLocally: boolean;
  immediateRelay: boolean;
}

export interface MeshTransportService {
  init(): Promise<void>;
  sendMeshMessage(envelope: MeshEnvelope<unknown>): Promise<MeshSendResult>;
  getNearbyPeers(): Promise<MeshPeer[]>;
  getQueuedMessages(): Promise<MeshEnvelope<unknown>[]>;
  removeQueuedMessage(messageId: string): Promise<void>;
  getNetworkHealth(): NetworkHealthStatus;
  onMessageReceived(callback: (envelope: MeshEnvelope<unknown>) => void): () => void;
  syncWithGateway(
    gatewayUrl: string,
    deviceTelemetry?: DevicePresenceTelemetry,
  ): Promise<SyncBatchResponse>;
}

export interface GatewayClient {
  sync(gatewayUrl: string, request: SyncBatchRequest): Promise<SyncBatchResponse>;
}

export interface FetchGatewayClientOptions {
  getAccessToken?: () => Promise<string | undefined>;
  fetchImpl?: typeof fetch;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function validateSyncBatchResponse(value: unknown): SyncBatchResponse {
  if (!isRecord(value)) {
    throw new Error('Gateway returned a non-object sync response.');
  }
  if (!Array.isArray(value.acknowledgedMessageIds)) {
    throw new Error('Gateway response is missing acknowledgedMessageIds.');
  }
  if (!value.acknowledgedMessageIds.every((id) => typeof id === 'string')) {
    throw new Error('Gateway acknowledgedMessageIds must contain strings.');
  }
  if (!Array.isArray(value.inboundCases)) {
    throw new Error('Gateway response is missing inboundCases.');
  }
  if (!Array.isArray(value.inboundMatches)) {
    throw new Error('Gateway response is missing inboundMatches.');
  }
  if (!Array.isArray(value.inboundTimelineEvents)) {
    throw new Error('Gateway response is missing inboundTimelineEvents.');
  }
  if (typeof value.serverTimestamp !== 'number') {
    throw new Error('Gateway response is missing serverTimestamp.');
  }
  return value as unknown as SyncBatchResponse;
}

export class FetchGatewayClient implements GatewayClient {
  constructor(private readonly options: FetchGatewayClientOptions = {}) {}

  async sync(gatewayUrl: string, request: SyncBatchRequest): Promise<SyncBatchResponse> {
    const normalizedUrl = gatewayUrl.replace(/\/$/, '');
    const accessToken = await this.options.getAccessToken?.();
    const response = await (this.options.fetchImpl ?? fetch)(`${normalizedUrl}/api/v1/sync/batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`Gateway sync failed with HTTP ${response.status}.`);
    }

    return validateSyncBatchResponse(await response.json());
  }
}
