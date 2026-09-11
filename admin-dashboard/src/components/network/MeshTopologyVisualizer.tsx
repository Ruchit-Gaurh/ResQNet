import React from 'react';
import { MeshNodeStatus } from '../../types';
import { Radio, ShieldCheck, Layers, Cpu, ArrowRight, Zap, CheckCircle2, Wifi } from 'lucide-react';

interface MeshTopologyVisualizerProps {
  nodes: MeshNodeStatus[];
}

export const MeshTopologyVisualizer: React.FC<MeshTopologyVisualizerProps> = ({ nodes }) => {
  return (
    <div className="space-y-4">
      {/* Topology Flow Banner */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-6">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-lg bg-sky-50 border border-sky-200 text-sky-600">
              <Radio size={18} />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900">
                P2P Bluetooth Low Energy (BLE) Multi-Hop Store-and-Forward Mesh
              </h3>
              <p className="text-xs text-slate-500">
                Delay-tolerant cryptographic packet propagation across zero-infrastructure catastrophe zones
              </p>
            </div>
          </div>
          <div className="text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-300 px-3 py-1 rounded-full flex items-center space-x-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Mesh Operational • 18 Total Nodes</span>
          </div>
        </div>

        {/* Visual Hop Chain - Horizontal Flow */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Node 1: Phone A */}
          <div className="flex-1 w-full bg-slate-50 border-t-4 border-t-red-500 border border-slate-200 rounded-lg p-3.5 space-y-2 relative shadow-xs">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-500 font-bold uppercase text-[10px]">1. Origin Hop</span>
              <span className="text-[10px] bg-red-100 text-red-800 font-bold px-1.5 py-0.5 rounded">
                Zone A (Offline)
              </span>
            </div>
            <div>
              <p className="font-extrabold text-slate-900 text-xs">Phone A (Family)</p>
              <p className="text-slate-500 text-[11px]">Creates report locally</p>
            </div>
            <div className="flex justify-between items-center text-[11px] text-slate-600 pt-1.5 border-t border-slate-200 font-mono">
              <span>Battery: <strong>78%</strong></span>
              <span className="text-amber-700">Queue: <strong>2 msgs</strong></span>
            </div>
          </div>

          {/* Arrow */}
          <div className="hidden md:flex flex-col items-center justify-center space-y-0.5 text-slate-400">
            <span className="text-[10px] font-mono font-bold text-blue-600">BLE P2P</span>
            <ArrowRight className="h-4 w-4 text-blue-600" />
          </div>

          {/* Node 2: Phone B */}
          <div className="flex-1 w-full bg-slate-50 border-t-4 border-t-blue-500 border border-slate-200 rounded-lg p-3.5 space-y-2 relative shadow-xs">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-500 font-bold uppercase text-[10px]">2. Volunteer Courier</span>
              <span className="text-[10px] bg-blue-100 text-blue-800 font-bold px-1.5 py-0.5 rounded">
                Zone A-B Corridor
              </span>
            </div>
            <div>
              <p className="font-extrabold text-slate-900 text-xs">Phone B (Mule)</p>
              <p className="text-slate-500 text-[11px]">Store-and-forward relay</p>
            </div>
            <div className="flex justify-between items-center text-[11px] text-slate-600 pt-1.5 border-t border-slate-200 font-mono">
              <span>Battery: <strong>62%</strong></span>
              <span className="text-amber-700">Queue: <strong>5 msgs</strong></span>
            </div>
          </div>

          {/* Arrow */}
          <div className="hidden md:flex flex-col items-center justify-center space-y-0.5 text-slate-400">
            <span className="text-[10px] font-mono font-bold text-blue-600">Long Range</span>
            <ArrowRight className="h-4 w-4 text-blue-600" />
          </div>

          {/* Node 3: Camp Station */}
          <div className="flex-1 w-full bg-slate-50 border-t-4 border-t-emerald-500 border border-slate-200 rounded-lg p-3.5 space-y-2 relative shadow-xs">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-500 font-bold uppercase text-[10px]">3. Station Aggregator</span>
              <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded">
                Camp #1 Station
              </span>
            </div>
            <div>
              <p className="font-extrabold text-slate-900 text-xs">Relief Camp Station</p>
              <p className="text-slate-500 text-[11px]">High-power BLE Beacon</p>
            </div>
            <div className="flex justify-between items-center text-[11px] text-slate-600 pt-1.5 border-t border-slate-200 font-mono">
              <span>Battery: <strong>95%</strong></span>
              <span className="text-blue-700">Queue: <strong>11 msgs</strong></span>
            </div>
          </div>

          {/* Arrow */}
          <div className="hidden md:flex flex-col items-center justify-center space-y-0.5 text-slate-400">
            <span className="text-[10px] font-mono font-bold text-emerald-600">Starlink</span>
            <ArrowRight className="h-4 w-4 text-emerald-600" />
          </div>

          {/* Node 4: Gateway */}
          <div className="flex-1 w-full bg-emerald-50/50 border-t-4 border-t-emerald-600 border border-emerald-300 rounded-lg p-3.5 space-y-2 relative shadow-xs">
            <div className="flex justify-between items-center text-xs">
              <span className="text-emerald-800 font-bold uppercase text-[10px]">4. Internet Gateway</span>
              <span className="text-[10px] bg-emerald-600 text-white font-extrabold px-1.5 py-0.5 rounded">
                ONLINE
              </span>
            </div>
            <div>
              <p className="font-extrabold text-slate-900 text-xs">Starlink Terminal Alpha</p>
              <p className="text-slate-500 text-[11px]">Cloud API Batch Ingestion</p>
            </div>
            <div className="flex justify-between items-center text-[11px] text-slate-600 pt-1.5 border-t border-emerald-200 font-mono">
              <span>Backhaul: <strong>Sat-Link</strong></span>
              <span className="text-emerald-700 font-bold">Latency: <strong>48ms</strong></span>
            </div>
          </div>
        </div>
      </div>

      {/* Detail Specifications (3 Columns) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Priority Engine */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2.5 shadow-xs">
          <div className="flex items-center space-x-2 text-xs font-extrabold uppercase tracking-wider text-slate-900 border-b border-slate-200 pb-2">
            <Layers className="h-4 w-4 text-purple-600" />
            <span>Priority Routing Engine</span>
          </div>
          <div className="space-y-1.5 text-xs">
            <div className="p-2 rounded bg-red-50 border border-red-200 flex justify-between items-center">
              <span className="font-bold text-red-800">1. CRITICAL (TTL: 2h)</span>
              <span className="text-[11px] text-slate-600">Trapped, child medical</span>
            </div>
            <div className="p-2 rounded bg-amber-50 border border-amber-200 flex justify-between items-center">
              <span className="font-bold text-amber-800">2. HIGH (TTL: 6h)</span>
              <span className="text-[11px] text-slate-600">Unidentified patient</span>
            </div>
            <div className="p-2 rounded bg-blue-50 border border-blue-200 flex justify-between items-center">
              <span className="font-bold text-blue-800">3. NORMAL (TTL: 24h)</span>
              <span className="text-[11px] text-slate-600">General sightings</span>
            </div>
          </div>
        </div>

        {/* Cryptographic Envelope Spec */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2.5 shadow-xs">
          <div className="flex items-center space-x-2 text-xs font-extrabold uppercase tracking-wider text-slate-900 border-b border-slate-200 pb-2">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            <span>Cryptographic Wire Envelope</span>
          </div>
          <div className="bg-slate-900 text-slate-200 rounded-lg p-2.5 font-mono text-[10px] space-y-0.5 overflow-x-auto shadow-inner">
            <div><span className="text-purple-400">packetId:</span> "UUID-v4"</div>
            <div><span className="text-purple-400">type:</span> "MISSING_REPORT"</div>
            <div><span className="text-purple-400">priority:</span> "HIGH"</div>
            <div><span className="text-purple-400">hopsTraversed:</span> 2 / 7</div>
            <div><span className="text-purple-400">signature:</span> "Ed25519-Sig..."</div>
            <div><span className="text-purple-400">sealHash:</span> "SHA256-Hash..."</div>
          </div>
        </div>

        {/* Battery Profiles */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2.5 shadow-xs">
          <div className="flex items-center space-x-2 text-xs font-extrabold uppercase tracking-wider text-slate-900 border-b border-slate-200 pb-2">
            <Cpu className="h-4 w-4 text-blue-600" />
            <span>Battery & Duty-Cycle Profiles</span>
          </div>
          <div className="space-y-1.5 text-xs text-slate-700">
            <div className="p-2 rounded bg-slate-50 border border-slate-200 flex justify-between items-center">
              <span className="font-medium">Active Responder Mode</span>
              <span className="font-mono text-emerald-700 font-bold">Scan: 4s / Adv: 2s</span>
            </div>
            <div className="p-2 rounded bg-slate-50 border border-slate-200 flex justify-between items-center">
              <span className="font-medium">Battery Saver (&lt; 30%)</span>
              <span className="font-mono text-amber-700 font-bold">Scan: 15s / Adv: 10s</span>
            </div>
            <div className="p-2 rounded bg-slate-50 border border-slate-200 flex justify-between items-center">
              <span className="font-medium">Critical Only Emergency</span>
              <span className="font-mono text-red-700 font-bold">Sleep unless pinged</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
