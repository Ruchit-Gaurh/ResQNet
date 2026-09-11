import React from 'react';
import { MatchScoreBreakdown } from '../../types';
import { CheckCircle2, AlertTriangle, Info, Cpu } from 'lucide-react';

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
    { label: 'Phonetic Name Similarity', weight: '20%', score: breakdown.nameScore },
    { label: 'Age Delta Proximity', weight: '10%', score: breakdown.ageScore },
    { label: 'GPS Location Proximity', weight: '20%', score: breakdown.locationScore },
    { label: 'Timeline Plausibility', weight: '15%', score: breakdown.timelineScore },
    { label: 'Physical & Clothing Details', weight: '10%', score: breakdown.physicalScore },
    { label: 'Facial Visual Embedding', weight: '25%', score: breakdown.photoScore || 0 }
  ];

  const getBarColor = (score: number) => {
    if (score < 50) return 'bg-red-500';
    if (score < 75) return 'bg-amber-500';
    return 'bg-emerald-600';
  };

  return (
    <div className="space-y-4 text-xs">
      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
        <div className="flex items-center space-x-2 text-slate-800">
          <Cpu className="h-4 w-4 text-blue-600" />
          <span className="font-extrabold uppercase tracking-wider text-[11px]">
            Explainable AI Multi-Attribute Correlation
          </span>
        </div>
        <span className="text-[10px] font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded border border-slate-300">
          RapidFuzz XAI v1.4
        </span>
      </div>

      {/* Progress Bars */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {metrics.map((m, idx) => (
          <div key={idx} className="bg-white border border-slate-200 rounded-lg p-2.5 space-y-1.5 shadow-2xs">
            <div className="flex justify-between items-baseline">
              <span className="text-slate-700 font-semibold text-[11px]">
                {m.label} <span className="text-slate-400 font-normal">({m.weight})</span>
              </span>
              <span className="font-mono font-bold text-slate-900 text-xs">{m.score.toFixed(0)}%</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
              <div
                className={`h-1.5 rounded-full ${getBarColor(m.score)}`}
                style={{ width: `${Math.min(100, Math.max(0, m.score))}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Rationale Checklist */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
        {/* Reasons */}
        <div className="space-y-1.5 bg-emerald-50/60 border border-emerald-200 rounded-lg p-3">
          <div className="text-[11px] font-extrabold text-emerald-800 uppercase tracking-wider flex items-center gap-1.5">
            <CheckCircle2 size={13} className="text-emerald-600" />
            <span>Positive Evidence Correlations</span>
          </div>
          <div className="space-y-1 mt-1">
            {reasons.map((r, i) => (
              <div key={i} className="text-[11px] text-emerald-950 flex items-start gap-1 leading-snug">
                <span className="text-emerald-600 font-bold">•</span>
                <span>{r}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Warnings */}
        <div className="space-y-1.5 bg-amber-50/60 border border-amber-200 rounded-lg p-3">
          <div className="text-[11px] font-extrabold text-amber-800 uppercase tracking-wider flex items-center gap-1.5">
            <AlertTriangle size={13} className="text-amber-600" />
            <span>Responder Review Advisory</span>
          </div>
          <div className="space-y-1 mt-1">
            {warnings.map((w, i) => (
              <div key={i} className="text-[11px] text-amber-950 flex items-start gap-1 leading-snug">
                <span className="text-amber-600 font-bold">•</span>
                <span>{w}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
