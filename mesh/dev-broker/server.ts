import { DevMeshBroker, type DevMeshTopology } from './DevMeshBroker';

function parseTopology(serialized: string | undefined): DevMeshTopology | undefined {
  if (!serialized) return undefined;
  const parsed = JSON.parse(serialized) as unknown;
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('DEV_MESH_TOPOLOGY must be a JSON object of node ID arrays.');
  }
  return parsed as DevMeshTopology;
}

const port = Number(process.env.DEV_MESH_PORT ?? 8787);
if (!Number.isInteger(port) || port < 1 || port > 65_535) {
  throw new Error('DEV_MESH_PORT must be a valid TCP port.');
}

const broker = new DevMeshBroker({ port, topology: parseTopology(process.env.DEV_MESH_TOPOLOGY) });

async function main(): Promise<void> {
  await broker.start();
  console.log('[BROKER] transport-only development radio medium');
  console.log('[BROKER] default topology connects all active nodes; no case or gateway authority');
}

async function shutdown(): Promise<void> {
  await broker.stop();
  process.exit(0);
}

process.on('SIGINT', () => void shutdown());
process.on('SIGTERM', () => void shutdown());

void main();
