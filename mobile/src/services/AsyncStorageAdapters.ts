import AsyncStorage from '@react-native-async-storage/async-storage';

import type { KeyValueStore } from '../../../mesh/queue/MessageQueue';
import type { LocalStorageAdapter } from './LocalQueueService';

export const asyncStorageAdapter: KeyValueStore & LocalStorageAdapter = {
  getItem(key: string): Promise<string | null> {
    return AsyncStorage.getItem(key);
  },
  setItem(key: string, value: string): Promise<void> {
    return AsyncStorage.setItem(key, value);
  },
};
