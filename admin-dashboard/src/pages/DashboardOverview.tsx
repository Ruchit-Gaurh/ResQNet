import React from 'react';
import { DisasterCase, MatchCandidate, VerificationAuditEntry } from '../types';
import { StatusBadge } from '../components/common/StatusBadge';
import {
  Users,
  Search,
  CheckCircle2,
  AlertTriangle,
  HeartHandshake,
  Radio,
  Clock,
  ArrowUpRight
} from 'lucide-react';

interface DashboardOverviewProps {
  cases: DisasterCase[];
  matches: MatchCandidate[];
  auditLogs: VerificationAuditEntry[];
  onNavigateToVerification: () => void;
  onNavigateToDemo: () => void;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({
  cases,
  matches,
  auditLogs,
  onNavigateToVerification,
  onNavigateToDemo
}) => {
  const missingCount = cases.filter((c) => c.type === 'MISSING').length;
  const foundCount = cases.filter((c) => c.type === 'FOUND' || c.type === 'UNIDENTIFIED_PATIENT').length;
  const verifiedCount = cases.filter((c) => c.status === 'VERIFIED').length;
  const pendingMatches = matches.filter((m) => m.status === 'PENDING_REVIEW');
  const criticalCount = cases.filter((c) => c.priority === 'CRITICAL').length;

  return (
    <div className="space-y-4">
      {/* KPI Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Total Missing */}
        <div className="bg-white border border-slate-200 border-t-3 border-t-red-500 rounded-xl p-3.5 shadow-xs space-y-1">
          <div className="flex justify-between items-center text-slate-500 text-xs">
            <span className="font-bold text-[11px] uppercase tracking-wider">Missing</span>
            <Search className="h-4 w-4 text-red-500" />
          </div>
          <div className="text-2xl font-black text-slate-900 font-mono">{missingCount}</div>
          <div className="text-[11px] text-red-600 font-bold">{criticalCount} Critical Priority</div>
        </div>

        {/* Total Found */}
        <div className="bg-white border border-slate-200 border-t-3 border-t-amber-500 rounded-xl p-3.5 shadow-xs space-y-1">
          <div className="flex justify-between items-center text-slate-500 text-xs">
            <span className="font-bold text-[11px] uppercase tracking-wider">Field Intake</span>
            <Users className="h-4 w-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-slate-900 font-mono">{foundCount}</div>
          <div className="text-[11px] text-slate-500">Trauma Centers & Camps</div>
        </div>

        {/* Human Verified */}
        <div className="bg-white border border-slate-200 border-t-3 border-t-emerald-500 rounded-xl p-3.5 shadow-xs space-y-1">
          <div className="flex justify-between items-center text-slate-500 text-xs">
            <span className="font-bold text-[11px] uppercase tracking-wider">Verified</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-emerald-600 font-mono">{verifiedCount}</div>
          <div className="text-[11px] text-emerald-700 font-semibold">Confirmed Identities</div>
        </div>

        {/* Pending AI Matches */}
        <div
          onClick={onNavigateToVerification}
          className="bg-white border border-blue-300 border-t-3 border-t-blue-600 rounded-xl p-3.5 shadow-xs space-y-1 cursor-pointer hover:bg-blue-50/50 transition-colors"
        >
          <div className="flex justify-between items-center text-blue-700 text-xs">
            <span className="font-bold text-[11px] uppercase tracking-wider">AI Queue</span>
            <AlertTriangle className="h-4 w-4 text-blue-600 animate-pulse" />
          </div>
          <div className="text-2xl font-black text-blue-700 font-mono">{pendingMatches.length}</div>
          <div className="text-[11px] text-blue-600 font-bold flex items-center gap-0.5">
            <span>Review Candidates ▶</span>
          </div>
        </div>

        {/* Active Mesh Relays */}
        <div className="bg-white border border-slate-200 border-t-3 border-t-sky-500 rounded-xl p-3.5 shadow-xs space-y-1">
          <div className="flex justify-between items-center text-slate-500 text-xs">
            <span className="font-bold text-[11px] uppercase tracking-wider">BLE Relays</span>
            <Radio className="h-4 w-4 text-sky-500" />
          </div>
          <div className="text-2xl font-black text-sky-600 font-mono">18</div>
          <div className="text-[11px] text-slate-500">P2P Mesh Online</div>
        </div>

        {/* Reunited / Closed */}
        <div className="bg-white border border-slate-200 border-t-3 border-t-purple-500 rounded-xl p-3.5 shadow-xs space-y-1">
          <div className="flex justify-between items-center text-slate-500 text-xs">
            <span className="font-bold text-[11px] uppercase tracking-wider">Reunited</span>
            <HeartHandshake className="h-4 w-4 text-purple-500" />
          </div>
          <div className="text-2xl font-black text-purple-600 font-mono">1</div>
          <div className="text-[11px] text-slate-500">Family Completed</div>
        </div>
      </div>

      {/* Grid: Cases Table & Live Audit Trail */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Cases Table */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider flex items-center space-x-2">
              <span>Active Case Records</span>
              <span className="text-[10px] font-mono text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                {cases.length} Total
              </span>
            </h3>
            <span className="text-[11px] text-slate-500 font-mono">Canonical Case Graph</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-600 uppercase font-mono text-[10px] tracking-wider">
                <tr>
                  <th className="px-3 py-2 rounded-l">Case ID</th>
                  <th className="px-3 py-2">Person Name</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Zone / Facility</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2 rounded-r">Priority</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {cases.map((c) => (
                  <tr key={c.caseId} className="hover:bg-slate-50 transition-colors">
                    <td className="px-3 py-2.5 font-mono text-blue-600 font-bold text-[11px]">{c.caseId}</td>
                    <td className="px-3 py-2.5">
                      <div className="font-bold text-slate-900">{c.person.name}</div>
                      <div className="text-slate-500 text-[10px]">
                        Age: {c.person.age || c.person.approximateAge || 'Unknown'} • {c.person.gender}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="font-semibold text-slate-700">{c.type}</span>
                    </td>
                    <td className="px-3 py-2.5 text-slate-600 text-[11px]">
                      {c.lastKnownLocation?.zone ? c.lastKnownLocation.zone.split('—')[0] : 'Unspecified'}
                    </td>
                    <td className="px-3 py-2.5">
                      <StatusBadge type="status" value={c.status} />
                    </td>
                    <td className="px-3 py-2.5">
                      <StatusBadge type="priority" value={c.priority} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Immutable Audit Trail */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider flex items-center space-x-1.5">
              <Clock className="h-4 w-4 text-emerald-600" />
              <span>Immutable Audit Trail</span>
            </h3>
            <span className="text-[10px] font-mono text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
              Accountability Log
            </span>
          </div>

          <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
            {auditLogs.map((log) => (
              <div key={log.id} className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 space-y-1 text-xs">
                <div className="flex justify-between items-center">
                  <span className="font-extrabold text-[10px] text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded">
                    IDENTITY CONFIRMED
                  </span>
                  <span className="font-mono text-[10px] text-slate-500">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <div className="text-slate-900 font-bold text-xs mt-1">
                  {log.missingPersonName} ⇄ {log.candidatePersonName}
                </div>
                <div className="text-[11px] text-slate-500">
                  Reviewer: <strong className="text-slate-700">{log.reviewerName}</strong>
                </div>
                {log.notes && (
                  <div className="text-[11px] text-slate-600 bg-white p-2 rounded border border-slate-200 mt-1 italic">
                    "{log.notes}"
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
