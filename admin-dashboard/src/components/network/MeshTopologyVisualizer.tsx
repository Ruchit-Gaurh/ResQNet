import React from 'react';
import { MeshNodeStatus } from '../../types';
import { Radio, ShieldCheck, Layers, Cpu } from 'lucide-react';

interface MeshTopologyVisualizerProps {
  nodes: MeshNodeStatus[];
}

export const MeshTopologyVisualizer: React.FC<MeshTopologyVisualizerProps> = ({ nodes }) => {
  return (
    <div className="space-y-6">
      {/* Topology Flow Banner */}
      <div className="bg-[#0F172A] border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-xl bg-sky-600/20 border border-sky-500/40 flex items-center justify-center">
              <Radio className="h-5 w-5 text-sky-400" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Disaster BLE Mesh Topology</h3>
              <p className="text-xs text-slate-400">
                Store-and-Forward multi-hop packet propagation across degraded communication zones.
              </p>
            </div>
          </div>
          <div className="text-xs font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-500/40 px-3 py-1 rounded-full flex items-center space-x-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Mesh Healthy • 18 Total Nodes</span>
          </div>
        </div>

        {/* Visual Hop Chain */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-2">
          {/* Node 1: Phone A */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 space-y-3 relative">
            <div className="flex justify-between items-center text-xs">
              <span className="font-bold text-sky-400">Phone A (Origin)</span>
              <span className="text-[10px] bg-red-950/60 text-red-300 border border-red-800 px-1.5 py-0.5 rounded">
                Zone A (Offline)
              </span>
            </div>
            <div className="text-xs text-slate-300">
              <p className="font-semibold text-white">Family Reporter</p>
              <p className="text-slate-400 text-[11px]">Creates report locally</p>
            </div>
            <div className="flex justify-between items-center text-[11px] text-slate-400 border-t border-slate-800 pt-2 font-mono">
              <span>Battery: 78%</span>
              <span className="text-amber-400">Queue: 2</span>
            </div>
          </div>

          {/* Node 2: Phone B */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 space-y-3 relative">
            <div className="flex justify-between items-center text-xs">
              <span className="font-bold text-sky-400">Phone B (Courier)</span>
              <span className="text-[10px] bg-blue-950/60 text-blue-300 border border-blue-800 px-1.5 py-0.5 rounded">
                Zone A-B Corridor
              </span>
            </div>
            <div className="text-xs text-slate-300">
              <p className="font-semibold text-white">Volunteer Node</p>
              <p className="text-slate-400 text-[11px]">Store-and-forward relay</p>
            </div>
            <div className="flex justify-between items-center text-[11px] text-slate-400 border-t border-slate-800 pt-2 font-mono">
              <span>Battery: 62%</span>
              <span className="text-amber-400">Queue: 5</span>
            </div>
          </div>

          {/* Node 3: Relief Camp Station */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 space-y-3 relative">
            <div className="flex justify-between items-center text-xs">
              <span className="font-bold text-emerald-400">Camp Station</span>
              <span className="text-[10px] bg-emerald-950/60 text-emerald-300 border border-emerald-800 px-1.5 py-0.5 rounded">
                High School Camp
              </span>
            </div>
            <div className="text-xs text-slate-300">
              <p className="font-semibold text-white">Stationary Aggregator</p>
              <p className="text-slate-400 text-[11px]">High-power BLE Beacon</p>
            </div>
            <div className="flex justify-between items-center text-[11px] text-slate-400 border-t border-slate-800 pt-2 font-mono">
              <span>Battery: 95%</span>
              <span className="text-sky-400">Queue: 11</span>
            </div>
          </div>

          {/* Node 4: Gateway */}
          <div className="bg-slate-900/80 border border-emerald-500/30 rounded-xl p-4 space-y-3 relative">
            <div className="flex justify-between items-center text-xs">
              <span className="font-bold text-emerald-300">Starlink Gateway</span>
              <span className="text-[10px] bg-emerald-950/80 text-emerald-300 border border-emerald-600 px-1.5 py-0.5 rounded">
                ONLINE
              </span>
            </div>
            <div className="text-xs text-slate-300">
              <p className="font-semibold text-white">Cloud API Ingest</p>
              <p className="text-slate-400 text-[11px]">POST /api/v1/sync/batch</p>
            </div>
            <div className="flex justify-between items-center text-[11px] text-slate-400 border-t border-slate-800 pt-2 font-mono">
              <span>Backhaul: Starlink</span>
              <span className="text-emerald-400">Synced: 0s ago</span>
            </div>
          </div>
        </div>
      </div>

      {/* Priority Queue Engine & Node Health Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Priority Relay Rules */}
        <div className="bg-[#0F172A] border border-slate-800 rounded-2xl p-5 space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center space-x-2">
            <Layers className="h-4 w-4 text-purple-400" />
            <span>Prioritized Relay Engine</span>
          </h4>
          <div className="space-y-2 text-xs">
            <div className="p-2.5 rounded-lg bg-red-950/30 border border-red-500/30 flex justify-between items-center">
              <span className="font-bold text-red-300">1. CRITICAL</span>
              <span className="text-slate-400">Trapped, child in danger, medical</span>
            </div>
            <div className="p-2.5 rounded-lg bg-amber-950/30 border border-amber-500/30 flex justify-between items-center">
              <span className="font-bold text-amber-300">2. HIGH</span>
              <span className="text-slate-400">Missing child, unidentified patient</span>
            </div>
            <div className="p-2.5 rounded-lg bg-blue-950/30 border border-blue-500/30 flex justify-between items-center">
              <span className="font-bold text-blue-300">3. NORMAL</span>
              <span className="text-slate-400">Standard missing case, sightings</span>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex justify-between items-center">
              <span className="font-bold text-slate-400">4. LOW</span>
              <span className="text-slate-500">General status beacons</span>
            </div>
          </div>
        </div>

        {/* Cryptographic Message Envelope Spec */}
        <div className="bg-[#0F172A] border border-slate-800 rounded-2xl p-5 space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center space-x-2">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            <span>Cryptographic Envelope Spec</span>
          </h4>
          <div className="bg-slate-950 rounded-xl p-3 font-mono text-[11px] text-slate-300 space-y-1 overflow-x-auto border border-slate-800">
            <div><span className="text-purple-400">messageId:</span> "UUID-v4"</div>
            <div><span className="text-purple-400">messageType:</span> "MISSING_PERSON"</div>
            <div><span className="text-purple-400">priority:</span> "HIGH"</div>
            <div><span className="text-purple-400">hopCount:</span> 2 / 7 (Max)</div>
            <div><span className="text-purple-400">senderPseudonym:</span> "PSEUDO-88F"</div>
            <div><span className="text-purple-400">expiresAt:</span> 1726136500000 (TTL)</div>
            <div><span className="text-purple-400">signature:</span> "Ed25519-Sig..."</div>
          </div>
        </div>

        {/* Battery & Power Optimization */}
        <div className="bg-[#0F172A] border border-slate-800 rounded-2xl p-5 space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center space-x-2">
            <Cpu className="h-4 w-4 text-sky-400" />
            <span>Power & Battery Profiles</span>
          </h4>
          <div className="space-y-2 text-xs text-slate-300">
            <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 flex justify-between items-center">
              <span>Normal Mode</span>
              <span className="font-mono text-emerald-400">Scan: 4s / Adv: 2s</span>
            </div>
            <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 flex justify-between items-center">
              <span>Battery Saver (&lt;30%)</span>
              <span className="font-mono text-amber-400">Scan: 15s / Adv: 10s</span>
            </div>
            <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 flex justify-between items-center">
              <span>Emergency Relay</span>
              <span className="font-mono text-red-400">CRITICAL ONLY</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
