import type { KeyValueStore } from '../queue/MessageQueue';

export interface SeenMessageRecord {
  messageId: string;
  seenAt: number;
}

export interface SeenMessageStore {
  load(): Promise<SeenMessageRecord[]>;
  save(records: SeenMessageRecord[]): Promise<void>;
}

export class InMemorySeenMessageStore implements SeenMessageStore {
  private records: SeenMessageRecord[] = [];

  async load(): Promise<SeenMessageRecord[]> {
    return this.records.map((record) => ({ ...record }));
  }

  async save(records: SeenMessageRecord[]): Promise<void> {
    this.records = records.map((record) => ({ ...record }));
  }
}

export class KeyValueSeenMessageStore implements SeenMessageStore {
  constructor(
    private readonly store: KeyValueStore,
    private readonly key = '@resqnet/mesh-seen/v1',
  ) {}

  async load(): Promise<SeenMessageRecord[]> {
    const serialized = await this.store.getItem(this.key);
    if (!serialized) {
      return [];
    }
    const parsed = JSON.parse(serialized) as unknown;
    if (!Array.isArray(parsed)) {
      throw new Error('Persisted seen-message ledger is not an array.');
    }
    return parsed.flatMap((entry): SeenMessageRecord[] => {
      if (
        typeof entry === 'object' &&
        entry !== null &&
        typeof (entry as Record<string, unknown>).messageId === 'string' &&
        typeof (entry as Record<string, unknown>).seenAt === 'number'
      ) {
        return [entry as SeenMessageRecord];
      }
      return [];
    });
  }

  async save(records: SeenMessageRecord[]): Promise<void> {
    await this.store.setItem(this.key, JSON.stringify(records));
  }
}

export class Deduplicator {
  private readonly seen = new Map<string, number>();
  private initialized = false;

  constructor(
    private readonly storage: SeenMessageStore = new InMemorySeenMessageStore(),
    private readonly maxEntries = 2_048,
    private readonly retentionMs = 7 * 24 * 60 * 60 * 1000,
    private readonly now: () => number = Date.now,
  ) {
    if (maxEntries < 1) {
      throw new Error('Deduplicator maxEntries must be positive.');
    }
  }

  async init(): Promise<void> {
    if (this.initialized) {
      return;
    }
    const cutoff = this.now() - this.retentionMs;
    for (const record of await this.storage.load()) {
      if (record.seenAt > cutoff) {
        this.seen.set(record.messageId, record.seenAt);
      }
    }
    this.trim();
    this.initialized = true;
    await this.persist();
  }

  hasSeen(messageId: string): boolean {
    this.ensureInitialized();
    return this.seen.has(messageId);
  }

  async checkAndMark(messageId: string): Promise<boolean> {
    this.ensureInitialized();
    if (this.seen.has(messageId)) {
      const seenAt = this.seen.get(messageId) ?? this.now();
      this.seen.delete(messageId);
      this.seen.set(messageId, seenAt);
      return false;
    }

    this.seen.set(messageId, this.now());
    this.trim();
    await this.persist();
    return true;
  }

  async purge(): Promise<number> {
    this.ensureInitialized();
    const cutoff = this.now() - this.retentionMs;
    const before = this.seen.size;
    for (const [messageId, seenAt] of this.seen) {
      if (seenAt <= cutoff) {
        this.seen.delete(messageId);
      }
    }
    const removed = before - this.seen.size;
    if (removed > 0) {
      await this.persist();
    }
    return removed;
  }

  private trim(): void {
    while (this.seen.size > this.maxEntries) {
      const oldest = this.seen.keys().next().value as string | undefined;
      if (!oldest) {
        return;
      }
      this.seen.delete(oldest);
    }
  }

  private async persist(): Promise<void> {
    const records = [...this.seen.entries()].map(([messageId, seenAt]) => ({ messageId, seenAt }));
    await this.storage.save(records);
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('Deduplicator.init() must be called before use.');
    }
  }
}
