import type { LocalStorageAdapter } from './LocalQueueService';

const DEV_NODE_ID_KEY = '@resqnet/dev-node-id/v1';

export async function getOrCreateDevNodeId(
  storage: LocalStorageAdapter,
  createId: () => string,
): Promise<string> {
  const existing = await storage.getItem(DEV_NODE_ID_KEY);
  if (existing?.trim()) return existing;
  const nodeId = `NODE-${createId().slice(0, 8).toUpperCase()}`;
  await storage.setItem(DEV_NODE_ID_KEY, nodeId);
  return nodeId;
}
