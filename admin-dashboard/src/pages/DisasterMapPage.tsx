import React, { useState } from 'react';
import { DisasterZone, FacilityLocation, MeshNodeStatus, DisasterCase, PhoneMeshCluster } from '../types';
import { DisasterMap } from '../components/map/DisasterMap';
import { StatusBadge } from '../components/common/StatusBadge';
import { ShieldAlert, AlertTriangle, Activity, Users, MapPin, Eye, ArrowUpRight, Search, CheckCircle2, Navigation } from 'lucide-react';

interface DisasterMapPageProps {
  zones: DisasterZone[];
  facilities: FacilityLocation[];
  meshNodes: MeshNodeStatus[];
  cases: DisasterCase[];
  phoneClusters?: PhoneMeshCluster[];
}

export const DisasterMapPage: React.FC<DisasterMapPageProps> = ({
  zones,
  facilities,
  meshNodes,
  cases,
  phoneClusters = []
}) => {
  const [selectedCaseId, setSelectedCaseId] = useState<string>('CASE-10291');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const filteredCases = cases.filter(
    (c) =>
      c.person.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.caseId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.lastKnownLocation?.zone && c.lastKnownLocation.zone.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-4">
      {/* Real-time Interactive Leaflet Map Component */}
      <DisasterMap
        zones={zones}
        facilities={facilities}
        meshNodes={meshNodes}
        cases={cases}
        phoneClusters={phoneClusters}
        selectedCaseId={selectedCaseId}
        onSelectCase={(id) => setSelectedCaseId(id)}
      />

      {/* Grid: 3-Zone Differential Matrix & Full Casualty Directory (Matching User Reference Layout) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left Column: Sector Differential Matrix */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-3">
          <div className="border-b border-slate-200 pb-2.5 flex items-center justify-between">
            <div>
              <h3 className="font-extrabold text-xs text-slate-900 uppercase tracking-wider">
                Sector Differential Matrix
              </h3>
              <p className="text-[11px] text-slate-500">Hazard assessment across 3 geographic zones</p>
            </div>
            <span className="text-[10px] font-mono bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-bold border border-blue-200">
              Active Triage
            </span>
          </div>

          <div className="space-y-2.5">
            {zones.map((zone) => {
              const isCrit = zone.riskLevel === 'CRITICAL';
              const isHigh = zone.riskLevel === 'HIGH';

              return (
                <div
                  key={zone.id}
                  className={`p-3 rounded-lg border transition-all ${
                    isCrit
                      ? 'bg-red-50/70 border-red-200'
                      : isHigh
                      ? 'bg-blue-50/70 border-blue-200'
                      : 'bg-amber-50/70 border-amber-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-xs text-slate-900">{zone.id}</span>
                    <span
                      className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded ${
                        isCrit
                          ? 'bg-red-600 text-white'
                          : isHigh
                          ? 'bg-blue-600 text-white'
                          : 'bg-amber-600 text-white'
                      }`}
                    >
                      {zone.riskLevel}
                    </span>
                  </div>

                  <h5 className="font-bold text-xs text-slate-800 mt-1 leading-snug">{zone.name}</h5>

                  <div className="grid grid-cols-3 gap-1 mt-2.5 pt-2 border-t border-slate-200/80 text-[11px]">
                    <div>
                      <span className="text-slate-500 text-[10px] block">Missing</span>
                      <strong className="text-red-700 font-mono text-xs">{zone.missingCount}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 text-[10px] block">Intake</span>
                      <strong className="text-emerald-700 font-mono text-xs">{zone.foundCount}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 text-[10px] block">BLE Nodes</span>
                      <strong className="text-blue-700 font-mono text-xs">{zone.activeMeshNodes}</strong>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right 2 Columns: Casualty & Field Sighting Directory Table */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-3">
          <div className="border-b border-slate-200 pb-2.5 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-extrabold text-xs text-slate-900 uppercase tracking-wider">
                Casualty & Missing-Person Directory
              </h3>
              <p className="text-[11px] text-slate-500">Synchronized via peer-to-peer Bluetooth mesh and gateway backhaul</p>
            </div>

            {/* Search Input */}
            <div className="relative w-48">
              <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search name, ID, zone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-8 pr-2 py-1 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-3 py-2 rounded-l">Case ID</th>
                  <th className="px-3 py-2">Individual</th>
                  <th className="px-3 py-2">Sector / Facility</th>
                  <th className="px-3 py-2">Priority</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2 rounded-r text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCases.map((c) => (
                  <tr
                    key={c.caseId}
                    onClick={() => setSelectedCaseId(c.caseId)}
                    className={`hover:bg-slate-50 cursor-pointer transition-colors ${
                      selectedCaseId === c.caseId ? 'bg-blue-50/60 font-medium' : ''
                    }`}
                  >
                    <td className="px-3 py-2 font-mono text-blue-600 font-bold text-[11px]">{c.caseId}</td>
                    <td className="px-3 py-2">
                      <div className="font-bold text-slate-900">{c.person.name}</div>
                      <div className="text-[10px] text-slate-500">
                        Age: {c.person.age || c.person.approximateAge || 'N/A'} • {c.person.gender}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-slate-600 text-[11px]">
                      {c.lastKnownLocation?.zone ? c.lastKnownLocation.zone.split('—')[0] : 'Unassigned'}
                    </td>
                    <td className="px-3 py-2">
                      <StatusBadge type="priority" value={c.priority} />
                    </td>
                    <td className="px-3 py-2">
                      <StatusBadge type="status" value={c.status} />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedCaseId(c.caseId);
                        }}
                        className="p-1 text-slate-400 hover:text-blue-600 rounded hover:bg-slate-200 transition-colors"
                        title="Locate on Map"
                      >
                        <Navigation className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
