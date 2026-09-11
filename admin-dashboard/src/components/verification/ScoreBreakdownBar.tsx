import React from 'react';
import { MatchScoreBreakdown } from '../../types';
import { CheckCircle2, AlertTriangle, HelpCircle } from 'lucide-react';

interface ScoreBreakdownBarProps {
  breakdown: MatchScoreBreakdown;
  reasons: string[];
  warnings: string[];
}

export const ScoreBreakdownBar: React.FC<ScoreBreakdownBarProps> = ({
  breakdown,
  reasons,
  warnings
}) => {
  const metrics = [
    { label: 'Name Similarity (20%)', score: breakdown.nameScore, color: 'bg-blue-500' },
    { label: 'Age Delta (10%)', score: breakdown.ageScore, color: 'bg-indigo-500' },
    { label: 'Location Proximity (20%)', score: breakdown.locationScore, color: 'bg-emerald-500' },
    { label: 'Timeline Plausibility (15%)', score: breakdown.timelineScore, color: 'bg-teal-500' },
    { label: 'Physical Details (10%)', score: breakdown.physicalScore, color: 'bg-cyan-500' },
    { label: 'Facial Photo Embedding (25%)', score: breakdown.photoScore || 0, color: 'bg-purple-500' }
  ];

  return (
    <div className="bg-[#0B1120] border border-slate-800 rounded-xl p-5 space-y-5">
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
        <h4 className="text-sm font-semibold text-slate-200 flex items-center space-x-2">
          <span>AI Explainable Scoring Breakdown</span>
          <span className="text-[11px] font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
            FastAPI / RapidFuzz Model v1.4
          </span>
        </h4>
        <div className="text-xs text-slate-400 flex items-center space-x-1">
          <HelpCircle className="h-3.5 w-3.5" />
          <span>Weighted Multi-Attribute Algorithm</span>
        </div>
      </div>

      {/* Progress Bars */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {metrics.map((m, idx) => (
          <div key={idx} className="bg-slate-900/80 border border-slate-800 rounded-lg p-3 space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-slate-400 font-medium">{m.label}</span>
              <span className="font-mono font-bold text-slate-200">{m.score.toFixed(0)}%</span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
              <div
                className={`h-2 rounded-full transition-all duration-500 ${m.color}`}
                style={{ width: `${Math.min(100, Math.max(0, m.score))}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Explainable Rationale Checklist */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-2">
        <div className="space-y-2">
          <div className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">
            Why this is a strong match:
          </div>
          <div className="space-y-1.5">
            {reasons.map((r, i) => (
              <div key={i} className="flex items-start space-x-2 text-xs text-slate-300 bg-emerald-950/20 border border-emerald-900/30 p-2 rounded-md">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 flex-shrink-0 mt-0.5" />
                <span>{r}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-xs font-semibold text-amber-400 uppercase tracking-wider">
            Reviewer Attention Required:
          </div>
          <div className="space-y-1.5">
            {warnings.map((w, i) => (
              <div key={i} className="flex items-start space-x-2 text-xs text-slate-300 bg-amber-950/20 border border-amber-900/30 p-2 rounded-md">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
                <span>{w}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
