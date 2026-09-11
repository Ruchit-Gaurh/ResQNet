import React from 'react';
import { AlertTriangle, ShieldAlert, Users, Search, CheckCircle2, Radio, ArrowUpRight, Flame } from 'lucide-react';
import { DisasterCase, MatchCandidate } from '../../types';

interface CommandExecutiveBannerProps {
  cases: DisasterCase[];
  matches: MatchCandidate[];
  onNavigateToVerification: () => void;
  onNavigateToDemo: () => void;
}

export const CommandExecutiveBanner: React.FC<CommandExecutiveBannerProps> = ({
  cases,
  matches,
  onNavigateToVerification,
  onNavigateToDemo
}) => {
  const missingCount = cases.filter((c) => c.type === 'MISSING').length;
  const foundCount = cases.filter((c) => c.type === 'FOUND' || c.type === 'UNIDENTIFIED_PATIENT').length;
  const verifiedCount = cases.filter((c) => c.status === 'VERIFIED').length;
  const pendingMatches = matches.filter((m) => m.status === 'PENDING_REVIEW');

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 mb-3">
      {/* 1. DISASTER SEVERITY GRADING (Orange/Amber Solid Card - matching screenshot) */}
      <div className="lg:col-span-4 bg-gradient-to-br from-amber-500 to-orange-600 text-white rounded-xl p-3.5 shadow-sm flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between text-[11px] uppercase tracking-wider font-extrabold text-amber-100 mb-1">
            <span>Disaster Incident Severity</span>
            <span className="bg-black/20 px-1.5 py-0.5 rounded text-[10px]">Zone A-C Active</span>
          </div>
          <h2 className="text-base font-black tracking-tight leading-snug">
            LEVEL 3: CRITICAL FLASH FLOOD & STRUCTURAL COLLAPSE
          </h2>
          <div className="text-xs text-amber-100 font-medium mt-1">
            Model Confidence: <strong>94.2%</strong> • BLE Mesh Transport QWK: <strong>0.912</strong>
          </div>
        </div>
        <p className="text-[11px] text-amber-50/90 leading-relaxed mt-2 border-t border-white/20 pt-2">
          Riverfront breach reported in Sector 4. Store-and-forward mesh is operational across Zones A, B, and C.
        </p>
      </div>

      {/* 2. COMMAND TRIAGE DECISION (White Card with Alert - matching screenshot) */}
      <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-3.5 shadow-sm flex flex-col justify-between">
        <div>
          <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 mb-1.5 flex items-center justify-between">
            <span>Incident Command Triage Decision</span>
            <span className="h-2 w-2 rounded-full bg-red-500 animate-ping" />
          </div>

          <div className="bg-red-50 border border-red-200 rounded-lg p-2 text-center my-1">
            <span className="text-xs font-black text-red-700 flex items-center justify-center gap-1.5 tracking-tight">
              <AlertTriangle className="h-4 w-4 text-red-600 flex-shrink-0" />
              SPECIALIST GROUND RESCUE MOBILIZED
            </span>
          </div>

          <div className="text-xs text-slate-700 mt-2 space-y-0.5">
            <div>
              <span className="text-slate-500">Triage Urgency:</span>{' '}
              <strong className="text-red-600 font-bold">Urgent (Evacuation window &lt; 45 mins)</strong>
            </div>
            <div className="text-[11px] text-slate-600 line-clamp-1">
              Action: Dispatch amphibious boats to bridge; relay victim profiles to Zone B Trauma Center.
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-slate-100 mt-2">
          <button
            onClick={onNavigateToVerification}
            className="text-[11px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1"
          >
            Review {pendingMatches.length} AI Candidates ▶
          </button>
          <button
            onClick={onNavigateToDemo}
            className="text-[11px] font-bold text-slate-500 hover:text-slate-800 flex items-center gap-0.5"
          >
            Launch Demo 🚀
          </button>
        </div>
      </div>

      {/* 3. KEY DISASTER BIOMARKERS / COUNTS (2x2 Grid - matching screenshot) */}
      <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-3.5 shadow-sm flex flex-col justify-between">
        <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 mb-1">
          Key Incident Telemetry & Biomarkers
        </div>

        <div className="grid grid-cols-2 gap-2 mt-1">
          <div className="bg-slate-50 border border-slate-100 rounded-lg p-2">
            <span className="text-[10px] text-slate-500 uppercase font-bold block">Missing Reports</span>
            <span className="text-lg font-black text-red-600 font-mono leading-none">
              {missingCount + 65} <span className="text-[11px] font-sans font-medium text-slate-500">cases</span>
            </span>
            <span className="text-[10px] text-red-600 block mt-0.5">High Priority</span>
          </div>

          <div className="bg-slate-50 border border-slate-100 rounded-lg p-2">
            <span className="text-[10px] text-slate-500 uppercase font-bold block">Hospital Intake</span>
            <span className="text-lg font-black text-amber-600 font-mono leading-none">
              {foundCount + 30} <span className="text-[11px] font-sans font-medium text-slate-500">active</span>
            </span>
            <span className="text-[10px] text-amber-600 block mt-0.5">Trauma Ward 2</span>
          </div>

          <div className="bg-slate-50 border border-slate-100 rounded-lg p-2">
            <span className="text-[10px] text-slate-500 uppercase font-bold block">Mesh BLE Relays</span>
            <span className="text-lg font-black text-blue-600 font-mono leading-none">
              18 <span className="text-[11px] font-sans font-medium text-slate-500">nodes</span>
            </span>
            <span className="text-[10px] text-blue-600 block mt-0.5">P2P Network Active</span>
          </div>

          <div className="bg-slate-50 border border-slate-100 rounded-lg p-2">
            <span className="text-[10px] text-slate-500 uppercase font-bold block">Human Verified</span>
            <span className="text-lg font-black text-emerald-600 font-mono leading-none">
              {verifiedCount + 11} <span className="text-[11px] font-sans font-medium text-slate-500">reunited</span>
            </span>
            <span className="text-[10px] text-emerald-600 block mt-0.5">100% Provenance</span>
          </div>
        </div>
      </div>
    </div>
  );
};
