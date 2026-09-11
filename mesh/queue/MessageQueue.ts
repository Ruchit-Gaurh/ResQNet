import type { MeshEnvelope, PriorityLevel } from '../../shared/types/index';
import { isEnvelopeExpired, validateEnvelope } from '../protocol/Envelope';

const PRIORITY_WEIGHT: Record<PriorityLevel, number> = {
  CRITICAL: 4,
  HIGH: 3,
  NORMAL: 2,
  LOW: 1,
};

export interface MessageQueueStorage {
  load(): Promise<MeshEnvelope<unknown>[]>;
  save(envelopes: MeshEnvelope<unknown>[]): Promise<void>;
}

export interface KeyValueStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

export class InMemoryMessageQueueStorage implements MessageQueueStorage {
  private envelopes: MeshEnvelope<unknown>[] = [];

  async load(): Promise<MeshEnvelope<unknown>[]> {
    return this.envelopes.map((envelope) => ({ ...envelope }));
  }

  async save(envelopes: MeshEnvelope<unknown>[]): Promise<void> {
    this.envelopes = envelopes.map((envelope) => ({ ...envelope }));
  }
}

export class KeyValueMessageQueueStorage implements MessageQueueStorage {
  constructor(
    private readonly store: KeyValueStore,
    private readonly key = '@resqnet/mesh-queue/v1',
  ) {}

  async load(): Promise<MeshEnvelope<unknown>[]> {
    const serialized = await this.store.getItem(this.key);
    if (!serialized) {
      return [];
    }

    const parsed = JSON.parse(serialized) as unknown;
    if (!Array.isArray(parsed)) {
      throw new Error('Persisted mesh queue is not an array.');
    }
    return parsed.map(validateEnvelope);
  }

  async save(envelopes: MeshEnvelope<unknown>[]): Promise<void> {
    await this.store.setItem(this.key, JSON.stringify(envelopes));
  }
}

function orderMessages(
  left: MeshEnvelope<unknown>,
  right: MeshEnvelope<unknown>,
): number {
  const priorityDelta = PRIORITY_WEIGHT[right.priority] - PRIORITY_WEIGHT[left.priority];
  return priorityDelta || left.createdAt - right.createdAt || left.messageId.localeCompare(right.messageId);
}

export class MessageQueue {
  private messages = new Map<string, MeshEnvelope<unknown>>();
  private initialized = false;
  private mutation: Promise<void> = Promise.resolve();

  constructor(
    private readonly storage: MessageQueueStorage = new InMemoryMessageQueueStorage(),
    private readonly now: () => number = Date.now,
  ) {}

  async init(): Promise<void> {
    if (this.initialized) {
      return;
    }

    const persisted = await this.storage.load();
    for (const envelope of persisted) {
      if (!isEnvelopeExpired(envelope, this.now())) {
        this.messages.set(envelope.messageId, validateEnvelope(envelope));
      }
    }
    this.initialized = true;
    await this.persist();
  }

  async enqueue(envelope: MeshEnvelope<unknown>): Promise<boolean> {
    return this.withMutation(async () => {
      this.ensureInitialized();
      await this.purgeExpiredInternal();
      const validated = validateEnvelope(envelope);
      if (isEnvelopeExpired(validated, this.now()) || this.messages.has(validated.messageId)) {
        return false;
      }
      this.messages.set(validated.messageId, { ...validated });
      await this.persist();
      return true;
    });
  }

  async next(): Promise<MeshEnvelope<unknown> | undefined> {
    await this.purgeExpired();
    return this.sorted()[0];
  }

  async dequeue(): Promise<MeshEnvelope<unknown> | undefined> {
    return this.withMutation(async () => {
      this.ensureInitialized();
      await this.purgeExpiredInternal();
      const next = this.sorted()[0];
      if (!next) {
        return undefined;
      }
      this.messages.delete(next.messageId);
      await this.persist();
      return next;
    });
  }

  async acknowledge(messageId: string): Promise<boolean> {
    return this.withMutation(async () => {
      this.ensureInitialized();
      const removed = this.messages.delete(messageId);
      if (removed) {
        await this.persist();
      }
      return removed;
    });
  }

  async getAll(): Promise<MeshEnvelope<unknown>[]> {
    await this.purgeExpired();
    return this.sorted();
  }

  async size(): Promise<number> {
    await this.purgeExpired();
    return this.messages.size;
  }

  async purgeExpired(): Promise<number> {
    return this.withMutation(async () => {
      this.ensureInitialized();
      return this.purgeExpiredInternal();
    });
  }

  private async purgeExpiredInternal(): Promise<number> {
    const before = this.messages.size;
    const now = this.now();
    for (const [messageId, envelope] of this.messages) {
      if (isEnvelopeExpired(envelope, now)) {
        this.messages.delete(messageId);
      }
    }
    const removed = before - this.messages.size;
    if (removed > 0) {
      await this.persist();
    }
    return removed;
  }

  private sorted(): MeshEnvelope<unknown>[] {
    return [...this.messages.values()].sort(orderMessages).map((envelope) => ({ ...envelope }));
  }

  private async persist(): Promise<void> {
    await this.storage.save(this.sorted());
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('MessageQueue.init() must be called before use.');
    }
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
