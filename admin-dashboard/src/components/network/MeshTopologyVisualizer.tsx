import React from 'react';
import { MapPin, Radio, Smartphone, Wifi, WifiOff } from 'lucide-react';
import { MeshNodeStatus } from '../../types';

interface MeshTopologyVisualizerProps {
  nodes: MeshNodeStatus[];
}

function ageLabel(milliseconds: number): string {
  const seconds = Math.floor(milliseconds / 1_000);
  if (seconds < 10) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.floor(minutes / 60)}h ago`;
}

function stateCopy(node: MeshNodeStatus) {
  if (node.connectionState === 'ONLINE_DIRECT') {
    return { label: 'Online directly', classes: 'bg-emerald-50 text-emerald-800 border-emerald-200' };
  }
  if (node.connectionState === 'OFFLINE_RELAYED') {
    return { label: 'Offline · relayed last seen', classes: 'bg-amber-50 text-amber-800 border-amber-200' };
  }
  return { label: 'Last seen · stale', classes: 'bg-slate-100 text-slate-700 border-slate-200' };
}

export const MeshTopologyVisualizer: React.FC<MeshTopologyVisualizerProps> = ({ nodes }) => {
  const online = nodes.filter((node) => node.connectionState === 'ONLINE_DIRECT').length;
  const relayed = nodes.filter((node) => node.connectionState === 'OFFLINE_RELAYED').length;
  const located = nodes.filter((node) => typeof node.lat === 'number' && typeof node.lng === 'number').length;
  const stats = [
    { label: 'Known devices', value: nodes.length, Icon: Smartphone },
    { label: 'Online directly', value: online, Icon: Wifi },
    { label: 'Offline via relay', value: relayed, Icon: Radio },
    { label: 'With location', value: located, Icon: MapPin },
  ];

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-blue-50 border border-blue-200 text-blue-700">
              <Radio size={19} />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900">Live ResQNet device presence</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Direct phones and last-seen observations carried through nearby relay phones.
              </p>
            </div>
          </div>
          <span className="text-[11px] font-semibold text-slate-600">Refreshes every 5 seconds</span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
          {stats.map(({ label, value, Icon }) => (
            <div key={label} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <Icon className="h-4 w-4 text-blue-700" />
              <div className="mt-2 text-xl font-extrabold text-slate-900">{value}</div>
              <div className="text-[11px] font-semibold text-slate-500">{label}</div>
            </div>
          ))}
        </div>
      </div>

      {nodes.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-300 rounded-xl p-10 text-center">
          <WifiOff className="h-8 w-8 text-slate-400 mx-auto" />
          <h4 className="mt-3 text-sm font-bold text-slate-900">No real device presence received yet</h4>
          <p className="mt-1 text-xs text-slate-500">
            Open the updated mobile app, allow location, and let a phone sync directly or through a relay.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {nodes.map((node) => {
            const state = stateCopy(node);
            const hasLocation = typeof node.lat === 'number' && typeof node.lng === 'number';
            return (
              <article key={node.nodeId} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h4 className="font-bold text-sm text-slate-900 truncate">{node.name}</h4>
                    <p className="font-mono text-[10px] text-slate-500 truncate">{node.nodeId}</p>
                  </div>
                  <span className={`shrink-0 rounded-full border px-2 py-1 text-[10px] font-bold ${state.classes}`}>
                    {state.label}
                  </span>
                </div>

                <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
                  <div><dt className="text-slate-500">Last observation</dt><dd className="font-semibold text-slate-900">{ageLabel(node.lastSeenMs)}</dd></div>
                  <div><dt className="text-slate-500">Transport</dt><dd className="font-semibold text-slate-900">{node.transportMode?.replace(/_/g, ' ') ?? 'Unknown'}</dd></div>
                  <div><dt className="text-slate-500">Nearby peers</dt><dd className="font-semibold text-slate-900">{node.connectedPeersCount}</dd></div>
                  <div><dt className="text-slate-500">Carried messages</dt><dd className="font-semibold text-slate-900">{node.messagesInQueue}</dd></div>
                  <div className="col-span-2"><dt className="text-slate-500">Location</dt><dd className="font-semibold text-slate-900">{hasLocation ? `${node.lat?.toFixed(4)}, ${node.lng?.toFixed(4)}` : 'Not shared / unavailable'}</dd></div>
                  {node.relayedByNodeId && (
                    <div className="col-span-2"><dt className="text-slate-500">Observation delivered by</dt><dd className="font-mono text-[11px] font-semibold text-amber-800">{node.relayedByNodeId}</dd></div>
                  )}
                </dl>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};
