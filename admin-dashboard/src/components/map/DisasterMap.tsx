import React, { useState } from 'react';
import { DisasterZone, FacilityLocation, MeshNodeStatus, DisasterCase } from '../../types';
import { Shield, Eye, EyeOff, Radio, Hospital, Tent } from 'lucide-react';

interface DisasterMapProps {
  zones: DisasterZone[];
  facilities: FacilityLocation[];
  meshNodes: MeshNodeStatus[];
  cases: DisasterCase[];
}

export const DisasterMap: React.FC<DisasterMapProps> = ({
  zones,
  facilities,
  meshNodes,
  cases
}) => {
  const [selectedZone, setSelectedZone] = useState<string>('ALL');
  const [privacyMode, setPrivacyMode] = useState<'RESPONDER' | 'PUBLIC'>('RESPONDER');
  const [selectedFacility, setSelectedFacility] = useState<FacilityLocation | null>(null);

  // Filter cases if minor in public mode
  const displayedCases = cases.map((c) => {
    if (c.person.isMinor && privacyMode === 'PUBLIC') {
      return {
        ...c,
        person: {
          ...c.person,
          photoUrl: undefined, // Hidden
          name: `${c.person.name.charAt(0)}. (Minor Protected)`
        },
        lastKnownLocation: {
          ...c.lastKnownLocation,
          address: 'Location geofenced to Zone B level for minor privacy',
          lat: 28.6180,
          lng: 77.2150
        }
      };
    }
    return c;
  });

  return (
    <div className="space-y-4">
      {/* Map Control Toolbar */}
      <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Filter Zone:</span>
          <div className="flex space-x-1.5 text-xs">
            {['ALL', 'ZONE-A', 'ZONE-B', 'ZONE-C'].map((z) => (
              <button
                key={z}
                onClick={() => setSelectedZone(z)}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                  selectedZone === z
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {z === 'ALL' ? 'Entire Disaster Area' : z.replace('-', ' ')}
              </button>
            ))}
          </div>
        </div>

        {/* Privacy Geofence Mode Toggle */}
        <div className="flex items-center space-x-2 bg-slate-900 border border-slate-700/80 rounded-lg p-1 text-xs">
          <button
            onClick={() => setPrivacyMode('RESPONDER')}
            className={`flex items-center space-x-1.5 px-3 py-1 rounded-md transition-all ${
              privacyMode === 'RESPONDER'
                ? 'bg-emerald-600 text-white font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Eye className="h-3.5 w-3.5" />
            <span>Authorized Responder Mode</span>
          </button>
          <button
            onClick={() => setPrivacyMode('PUBLIC')}
            className={`flex items-center space-x-1.5 px-3 py-1 rounded-md transition-all ${
              privacyMode === 'PUBLIC'
                ? 'bg-amber-600 text-white font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <EyeOff className="h-3.5 w-3.5" />
            <span>Public Safe View (Geofenced)</span>
          </button>
        </div>
      </div>

      {/* Privacy Notice Banner */}
      {privacyMode === 'PUBLIC' && (
        <div className="bg-amber-950/40 border border-amber-500/40 rounded-xl p-3 text-xs text-amber-300 flex items-center space-x-2">
          <Shield className="h-4 w-4 text-amber-400 flex-shrink-0" />
          <span>
            <strong>Public Privacy Protection Active:</strong> Minor photographs are redacted, personal phone numbers are hidden, and exact street coordinates are generalized into zone-level clusters.
          </span>
        </div>
      )}

      {/* Interactive Geofenced Map Visualizer */}
      <div className="relative bg-[#070D18] border border-slate-800 rounded-2xl h-[520px] overflow-hidden shadow-2xl flex flex-col justify-between p-6">
        {/* SVG Map Canvas with Geographic Zones */}
        <svg className="absolute inset-0 h-full w-full opacity-90" viewBox="0 0 1000 600">
          <defs>
            {/* Grid Pattern */}
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1E293B" strokeWidth="0.75" />
            </pattern>
            {/* Pulsing Node Rings */}
            <radialGradient id="relayGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#38BDF8" stopOpacity="0" />
            </radialGradient>
          </defs>

          <rect width="100%" height="100%" fill="url(#grid)" />

          {/* River Flood Area (Zone A) */}
          <path
            d="M 120 180 Q 280 220 420 310 T 600 480"
            fill="none"
            stroke="#1D4ED8"
            strokeWidth="38"
            strokeOpacity="0.25"
            strokeLinecap="round"
          />

          {/* Zone A Boundary Polygon */}
          <polygon
            points="100,120 420,160 380,360 80,320"
            fill="#DC2626"
            fillOpacity={selectedZone === 'ALL' || selectedZone === 'ZONE-A' ? 0.12 : 0.04}
            stroke="#DC2626"
            strokeWidth="1.5"
            strokeDasharray="4 4"
          />
          <text x="120" y="150" fill="#EF4444" fontSize="13" fontWeight="bold" fontFamily="monospace">
            ZONE A: FLASH FLOOD (68 MISSING)
          </text>

          {/* Zone B Boundary Polygon */}
          <polygon
            points="440,140 820,180 780,420 400,380"
            fill="#2563EB"
            fillOpacity={selectedZone === 'ALL' || selectedZone === 'ZONE-B' ? 0.12 : 0.04}
            stroke="#3B82F6"
            strokeWidth="1.5"
            strokeDasharray="4 4"
          />
          <text x="460" y="170" fill="#60A5FA" fontSize="13" fontWeight="bold" fontFamily="monospace">
            ZONE B: METRO & HOSPITAL (52 FOUND)
          </text>

          {/* Zone C Boundary Polygon */}
          <polygon
            points="220,400 680,440 640,560 180,520"
            fill="#F59E0B"
            fillOpacity={selectedZone === 'ALL' || selectedZone === 'ZONE-C' ? 0.12 : 0.04}
            stroke="#F59E0B"
            strokeWidth="1.5"
            strokeDasharray="4 4"
          />
          <text x="240" y="430" fill="#FBBF24" fontSize="13" fontWeight="bold" fontFamily="monospace">
            ZONE C: SECTOR 9 COLLAPSE (29 MISSING)
          </text>

          {/* Mesh Communication Links (BLE Packet Transport Path) */}
          <line x1="220" y1="240" x2="380" y2="280" stroke="#38BDF8" strokeWidth="2" strokeDasharray="6 4" strokeOpacity="0.7">
            <animate attributeName="stroke-dashoffset" from="20" to="0" dur="1.5s" repeatCount="indefinite" />
          </line>
          <line x1="380" y1="280" x2="560" y2="260" stroke="#38BDF8" strokeWidth="2" strokeDasharray="6 4" strokeOpacity="0.7">
            <animate attributeName="stroke-dashoffset" from="20" to="0" dur="1.5s" repeatCount="indefinite" />
          </line>
          <line x1="560" y1="260" x2="720" y2="230" stroke="#10B981" strokeWidth="2.5" strokeOpacity="0.8" />

          {/* Nodes */}
          {/* Phone A */}
          <circle cx="220" cy="240" r="14" fill="url(#relayGlow)" />
          <circle cx="220" cy="240" r="5" fill="#38BDF8" />
          <text x="180" y="270" fill="#BAE6FD" fontSize="10" fontFamily="sans-serif">Phone A (Family)</text>

          {/* Phone B (Relay) */}
          <circle cx="380" cy="280" r="14" fill="url(#relayGlow)" />
          <circle cx="380" cy="280" r="5" fill="#38BDF8" />
          <text x="340" y="310" fill="#BAE6FD" fontSize="10" fontFamily="sans-serif">Phone B (Courier)</text>

          {/* Hospital Center */}
          <circle cx="560" cy="260" r="8" fill="#EF4444" stroke="#ffffff" strokeWidth="2" />
          <text x="520" y="290" fill="#FCA5A5" fontSize="10" fontWeight="bold" fontFamily="sans-serif">Zone B Hospital</text>

          {/* Gateway Node */}
          <circle cx="720" cy="230" r="16" fill="#10B981" fillOpacity="0.3" />
          <circle cx="720" cy="230" r="6" fill="#10B981" stroke="#ffffff" strokeWidth="2" />
          <text x="670" y="210" fill="#6EE7B7" fontSize="10" fontWeight="bold" fontFamily="sans-serif">Starlink Gateway</text>
        </svg>

        {/* Floating Facility Info Overlay */}
        <div className="relative z-10 flex justify-between items-start pointer-events-none">
          {/* Legend */}
          <div className="bg-[#0F172A]/90 backdrop-blur border border-slate-800 rounded-xl p-3 text-xs space-y-2 pointer-events-auto shadow-lg">
            <div className="font-bold text-white text-[11px] uppercase tracking-wider">Map Legend</div>
            <div className="flex items-center space-x-2 text-slate-300">
              <span className="h-3 w-3 rounded-full bg-red-500 border border-white"></span>
              <span>Emergency Hospital Trauma Ward</span>
            </div>
            <div className="flex items-center space-x-2 text-slate-300">
              <span className="h-3 w-3 rounded-full bg-emerald-500 border border-white"></span>
              <span>Relief & Evacuation Camp</span>
            </div>
            <div className="flex items-center space-x-2 text-slate-300">
              <span className="h-2.5 w-2.5 rounded-full bg-sky-400"></span>
              <span>Active BLE Mesh Relay Node</span>
            </div>
          </div>

          {/* Facilities Quick Cards */}
          <div className="space-y-2 pointer-events-auto">
            {facilities.map((f) => (
              <div
                key={f.id}
                onClick={() => setSelectedFacility(f)}
                className="bg-[#0F172A]/90 backdrop-blur border border-slate-800 hover:border-slate-700 rounded-xl p-3 text-xs cursor-pointer shadow-lg w-64 transition-all"
              >
                <div className="flex items-center space-x-2 mb-1">
                  {f.type === 'HOSPITAL' ? (
                    <Hospital className="h-4 w-4 text-red-400 flex-shrink-0" />
                  ) : (
                    <Tent className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                  )}
                  <span className="font-bold text-white truncate">{f.name}</span>
                </div>
                <div className="flex justify-between text-slate-400 text-[11px]">
                  <span>Unidentified: <strong className="text-amber-300 font-mono">{f.unidentifiedCount}</strong></span>
                  <span>Occupancy: <strong className="text-slate-200 font-mono">{f.currentOccupancy}/{f.capacity}</strong></span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom Bar: Live Mesh Flow Indicator */}
        <div className="relative z-10 bg-[#0F172A]/90 backdrop-blur border border-slate-800 rounded-xl px-4 py-2 flex items-center justify-between text-xs">
          <div className="flex items-center space-x-2">
            <Radio className="h-4 w-4 text-sky-400 animate-pulse" />
            <span className="text-slate-300 font-medium">BLE Store-and-Forward Route:</span>
            <span className="font-mono text-sky-400">Phone A (Zone A) → Phone B (Courier) → Zone B Hospital → Starlink Gateway</span>
          </div>
          <span className="text-slate-400 font-mono">Hops: 3 • Latency: ~14m (Delay-Tolerant)</span>
        </div>
      </div>
    </div>
  );
};
