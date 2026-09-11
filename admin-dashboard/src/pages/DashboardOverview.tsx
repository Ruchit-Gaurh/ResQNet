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
    <div className="space-y-6">
      {/* Top Banner Alert / Hackathon Demo CTA */}
      <div className="bg-gradient-to-r from-blue-900/60 via-indigo-900/50 to-slate-900 border border-blue-500/30 rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4 shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <h2 className="text-base font-bold text-white tracking-wide">
              DISASTER COORDINATION ACTIVE — NCR FLASH FLOOD & STRUCTURAL COLLAPSE
            </h2>
          </div>
          <p className="text-xs text-blue-200/80 max-w-2xl">
            Store-and-forward mesh is operational across Zones A, B, and C. AI is analyzing potential identity correlations. All identity confirmations require human verification.
          </p>
        </div>
        <button
          onClick={onNavigateToDemo}
          className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-xl shadow-lg shadow-blue-500/30 transition-all flex items-center space-x-2"
        >
          <span>🚀 Launch 5-Min Golden Demo</span>
          <ArrowUpRight className="h-4 w-4" />
        </button>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {/* Total Missing */}
        <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-4 space-y-2">
          <div className="flex justify-between items-center text-slate-400 text-xs">
            <span>Missing Reports</span>
            <Search className="h-4 w-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black text-white font-mono">{missingCount}</div>
          <div className="text-[11px] text-slate-500 flex items-center space-x-1">
            <span className="text-red-400 font-semibold">{criticalCount} Critical</span>
          </div>
        </div>

        {/* Total Found */}
        <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-4 space-y-2">
          <div className="flex justify-between items-center text-slate-400 text-xs">
            <span>Found / Intake</span>
            <Users className="h-4 w-4 text-blue-400" />
          </div>
          <div className="text-2xl font-black text-white font-mono">{foundCount}</div>
          <div className="text-[11px] text-slate-500">Hospitals & Camps</div>
        </div>

        {/* Human Verified */}
        <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-4 space-y-2">
          <div className="flex justify-between items-center text-slate-400 text-xs">
            <span>Human Verified</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-emerald-400 font-mono">{verifiedCount}</div>
          <div className="text-[11px] text-emerald-500/80">Confirmed identities</div>
        </div>

        {/* Pending AI Matches */}
        <div
          onClick={onNavigateToVerification}
          className="bg-[#0F172A] border border-amber-500/40 hover:border-amber-400 rounded-xl p-4 space-y-2 cursor-pointer transition-all shadow-md shadow-amber-500/10"
        >
          <div className="flex justify-between items-center text-amber-300 text-xs font-semibold">
            <span>AI Match Queue</span>
            <AlertTriangle className="h-4 w-4 text-amber-400 animate-pulse" />
          </div>
          <div className="text-2xl font-black text-amber-300 font-mono">{pendingMatches.length}</div>
          <div className="text-[11px] text-amber-400/80 flex items-center space-x-1 font-medium">
            <span>Review Candidates ▶</span>
          </div>
        </div>

        {/* Active Mesh Relays */}
        <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-4 space-y-2">
          <div className="flex justify-between items-center text-slate-400 text-xs">
            <span>Active Relays</span>
            <Radio className="h-4 w-4 text-sky-400" />
          </div>
          <div className="text-2xl font-black text-sky-400 font-mono">18</div>
          <div className="text-[11px] text-slate-500">BLE P2P Nodes</div>
        </div>

        {/* Reunited / Closed */}
        <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-4 space-y-2">
          <div className="flex justify-between items-center text-slate-400 text-xs">
            <span>Family Reunited</span>
            <HeartHandshake className="h-4 w-4 text-purple-400" />
          </div>
          <div className="text-2xl font-black text-purple-400 font-mono">1</div>
          <div className="text-[11px] text-slate-500">Cases Completed</div>
        </div>
      </div>

      {/* Main Grid: Active Disaster Cases Table & Live Audit Trail */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Cases Table */}
        <div className="lg:col-span-2 bg-[#0F172A] border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-white tracking-wide flex items-center space-x-2">
              <span>Active Disaster Case Records</span>
              <span className="text-xs font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                {cases.length} Total
              </span>
            </h3>
            <span className="text-xs text-slate-400">Canonical Case Graph</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-900/80 text-slate-400 uppercase font-mono text-[10px] tracking-wider">
                <tr>
                  <th className="px-3 py-2 rounded-l-lg">Case ID</th>
                  <th className="px-3 py-2">Person Name</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Zone / Facility</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2 rounded-r-lg">Priority</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {cases.map((c) => (
                  <tr key={c.caseId} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-3 py-3 font-mono text-blue-400 font-medium">{c.caseId}</td>
                    <td className="px-3 py-3">
                      <div className="font-bold text-white">{c.person.name}</div>
                      <div className="text-slate-500 text-[11px]">
                        Age: {c.person.age || c.person.approximateAge || 'Unknown'} • {c.person.gender}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <span className="font-medium text-[11px] text-slate-300">{c.type}</span>
                    </td>
                    <td className="px-3 py-3 text-slate-400 text-[11px]">
                      {c.lastKnownLocation?.zone || 'Unspecified'}
                    </td>
                    <td className="px-3 py-3">
                      <StatusBadge type="status" value={c.status} />
                    </td>
                    <td className="px-3 py-3">
                      <StatusBadge type="priority" value={c.priority} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Live Verification & Audit Trail Feed */}
        <div className="bg-[#0F172A] border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-white tracking-wide flex items-center space-x-2">
              <Clock className="h-4 w-4 text-emerald-400" />
              <span>Immutable Audit Trail</span>
            </h3>
            <span className="text-[10px] font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
              Accountability Log
            </span>
          </div>

          <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
            {auditLogs.map((log) => (
              <div key={log.id} className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-1.5 text-xs">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-emerald-400">IDENTITY VERIFIED</span>
                  <span className="font-mono text-[10px] text-slate-500">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <div className="text-slate-200 font-medium">
                  {log.missingPersonName} ⇄ {log.candidatePersonName}
                </div>
                <div className="text-[11px] text-slate-400">
                  Reviewer: <strong className="text-slate-300">{log.reviewerName}</strong>
                </div>
                {log.notes && (
                  <div className="text-[11px] text-slate-400 bg-slate-950/60 p-2 rounded border border-slate-800/60 mt-1 italic">
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
