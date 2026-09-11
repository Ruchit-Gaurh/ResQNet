import type {
  CaseTimelineEvent,
  DisasterCase,
  MeshEnvelope,
  SyncBatchResponse,
} from '../../../shared/types/index';

export type DeliveryState =
  | 'SAVED_LOCALLY'
  | 'RELAYING'
  | 'REACHED_PEER'
  | 'DELIVERED_TO_NETWORK';

export interface LocalQueueRecord {
  messageId: string;
  envelope: MeshEnvelope<unknown>;
  deliveryState: DeliveryState;
  savedAt: number;
  updatedAt: number;
  lastError?: string;
}

export interface ReceivedMeshRecord {
  messageId: string;
  envelope: MeshEnvelope<unknown>;
  receivedAt: number;
  fromNodeId?: string;
}

export interface LocalStorageAdapter {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

export class InMemoryLocalStorage implements LocalStorageAdapter {
  private readonly values = new Map<string, string>();

  async getItem(key: string): Promise<string | null> {
    return this.values.get(key) ?? null;
  }

  async setItem(key: string, value: string): Promise<void> {
    this.values.set(key, value);
  }
}

const RECORDS_KEY = '@resqnet/mobile-records/v1';
const CASES_KEY = '@resqnet/mobile-cases/v1';
const TIMELINE_KEY = '@resqnet/mobile-timeline/v1';
const RECEIVED_KEY = '@resqnet/mobile-received/v1';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isDisasterCase(value: unknown): value is DisasterCase {
  return (
    isRecord(value) &&
    typeof value.caseId === 'string' &&
    typeof value.type === 'string' &&
    typeof value.status === 'string' &&
    isRecord(value.person)
  );
}

export class LocalQueueService {
  private mutation: Promise<void> = Promise.resolve();
  private readonly listeners = new Set<() => void>();

  constructor(
    private readonly storage: LocalStorageAdapter,
    private readonly now: () => number = Date.now,
  ) {}

  async saveEnvelope(envelope: MeshEnvelope<unknown>): Promise<LocalQueueRecord> {
    return this.withMutation(async () => {
      const records = await this.readArray<LocalQueueRecord>(RECORDS_KEY);
      const existing = records.find((record) => record.messageId === envelope.messageId);
      if (existing) {
        return existing;
      }

      const timestamp = this.now();
      const record: LocalQueueRecord = {
        messageId: envelope.messageId,
        envelope,
        deliveryState: 'SAVED_LOCALLY',
        savedAt: timestamp,
        updatedAt: timestamp,
      };
      records.push(record);
      await this.writeArray(RECORDS_KEY, records);

      if (isDisasterCase(envelope.payload)) {
        await this.upsertCasesInternal([envelope.payload]);
      }
      return record;
    });
  }

  async markRelaying(messageId: string): Promise<void> {
    await this.updateRecord(messageId, (record) =>
      record.deliveryState === 'REACHED_PEER' || record.deliveryState === 'DELIVERED_TO_NETWORK'
        ? record
        : {
            ...record,
            deliveryState: 'RELAYING',
            lastError: undefined,
            updatedAt: this.now(),
          },
    );
  }

  async markPeerReached(messageId: string): Promise<void> {
    await this.updateRecord(messageId, (record) =>
      record.deliveryState === 'DELIVERED_TO_NETWORK'
        ? record
        : {
            ...record,
            deliveryState: 'REACHED_PEER',
            lastError: undefined,
            updatedAt: this.now(),
          },
    );
  }

  async markTransportError(messageId: string, errorMessage: string): Promise<void> {
    await this.updateRecord(messageId, (record) => ({
      ...record,
      lastError: errorMessage,
      updatedAt: this.now(),
    }));
  }

  async markDelivered(messageIds: string[]): Promise<void> {
    const acknowledged = new Set(messageIds);
    await this.withMutation(async () => {
      const records = await this.readArray<LocalQueueRecord>(RECORDS_KEY);
      let changed = false;
      const next = records.map((record) => {
        if (!acknowledged.has(record.messageId)) {
          return record;
        }
        changed = true;
        return {
          ...record,
          deliveryState: 'DELIVERED_TO_NETWORK' as const,
          lastError: undefined,
          updatedAt: this.now(),
        };
      });
      if (changed) {
        await this.writeArray(RECORDS_KEY, next);
      }
    });
  }

  async applySyncResponse(response: SyncBatchResponse): Promise<void> {
    await this.markDelivered(response.acknowledgedMessageIds);
    await this.withMutation(async () => {
      // A mesh peer may gateway another person's envelope. My Cases must only
      // reconcile server state for cases already created on this installation.
      const localCases = await this.readArray<DisasterCase>(CASES_KEY);
      const ownedCaseIds = new Set(localCases.map((item) => item.caseId));
      await this.upsertCasesInternal(
        response.inboundCases.filter((item) => ownedCaseIds.has(item.caseId)),
      );
      const timeline = await this.readArray<CaseTimelineEvent>(TIMELINE_KEY);
      const byId = new Map(timeline.map((event) => [event.eventId, event]));
      for (const event of response.inboundTimelineEvents) {
        if (ownedCaseIds.has(event.caseId)) {
          byId.set(event.eventId, event);
        }
      }
      await this.writeArray(TIMELINE_KEY, [...byId.values()]);
    });
  }

  async getRecords(): Promise<LocalQueueRecord[]> {
    const records = await this.readArray<LocalQueueRecord>(RECORDS_KEY);
    return records.sort((left, right) => right.savedAt - left.savedAt);
  }

  async getCases(): Promise<DisasterCase[]> {
    const cases = await this.readArray<DisasterCase>(CASES_KEY);
    return cases.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  async getTimeline(caseId: string): Promise<CaseTimelineEvent[]> {
    const timeline = (await this.readArray<CaseTimelineEvent>(TIMELINE_KEY))
      .filter((event) => event.caseId === caseId)
      .sort((left, right) => left.timestamp.localeCompare(right.timestamp));
    if (timeline.length > 0) {
      return timeline;
    }

    const currentCase = (await this.getCases()).find((item) => item.caseId === caseId);
    if (!currentCase) {
      return [];
    }
    return [
      {
        eventId: `LOCAL-${currentCase.caseId}`,
        caseId,
        timestamp: currentCase.createdAt,
        source: currentCase.source,
        title: 'Report created',
        description: 'Saved locally. Verification has not started yet.',
        verificationStatus: currentCase.verificationState,
      },
    ];
  }

  async saveReceivedEnvelope(
    envelope: MeshEnvelope<unknown>,
    fromNodeId?: string,
  ): Promise<ReceivedMeshRecord> {
    return this.withMutation(async () => {
      const records = await this.readArray<ReceivedMeshRecord>(RECEIVED_KEY);
      const existing = records.find((record) => record.messageId === envelope.messageId);
      if (existing) return existing;
      const record: ReceivedMeshRecord = {
        messageId: envelope.messageId,
        envelope,
        receivedAt: this.now(),
        fromNodeId,
      };
      records.push(record);
      await this.writeArray(RECEIVED_KEY, records);
      return record;
    });
  }

  async getReceivedRecords(): Promise<ReceivedMeshRecord[]> {
    const records = await this.readArray<ReceivedMeshRecord>(RECEIVED_KEY);
    return records.sort((left, right) => right.receivedAt - left.receivedAt);
  }

  subscribe(callback: () => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private async updateRecord(
    messageId: string,
    update: (record: LocalQueueRecord) => LocalQueueRecord,
  ): Promise<void> {
    await this.withMutation(async () => {
      const records = await this.readArray<LocalQueueRecord>(RECORDS_KEY);
      const index = records.findIndex((record) => record.messageId === messageId);
      if (index < 0) {
        throw new Error(`Local report ${messageId} was not found.`);
      }
      const current = records[index];
      if (!current) {
        throw new Error(`Local report ${messageId} could not be loaded.`);
      }
      records[index] = update(current);
      await this.writeArray(RECORDS_KEY, records);
    });
  }

  private async upsertCasesInternal(inboundCases: DisasterCase[]): Promise<void> {
    if (inboundCases.length === 0) {
      return;
    }
    const cases = await this.readArray<DisasterCase>(CASES_KEY);
    const byId = new Map(cases.map((item) => [item.caseId, item]));
    for (const item of inboundCases) {
      byId.set(item.caseId, item);
    }
    await this.writeArray(CASES_KEY, [...byId.values()]);
  }

  private async readArray<T>(key: string): Promise<T[]> {
    const serialized = await this.storage.getItem(key);
    if (!serialized) {
      return [];
    }
    const parsed = JSON.parse(serialized) as unknown;
    if (!Array.isArray(parsed)) {
      throw new Error(`Local data at ${key} is corrupted.`);
    }
    return parsed as T[];
  }

  private async writeArray<T>(key: string, values: T[]): Promise<void> {
    await this.storage.setItem(key, JSON.stringify(values));
    for (const listener of this.listeners) listener();
  }

  private async withMutation<T>(operation: () => Promise<T>): Promise<T> {
    const previous = this.mutation;
    let release: () => void = () => undefined;
    this.mutation = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      return await operation();
    } finally {
      release();
    }
  }
}
