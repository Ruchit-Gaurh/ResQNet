import React from 'react';
import { CaseStatus, PriorityLevel, VerificationState, MatchConfidenceLevel } from '../../types';

interface StatusBadgeProps {
  type: 'status' | 'priority' | 'verification' | 'confidence';
  value: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ type, value }) => {
  let colorClasses = 'bg-slate-700 text-slate-200 border-slate-600';

  if (type === 'status') {
    switch (value as CaseStatus) {
      case 'VERIFIED':
      case 'REUNITED':
        colorClasses = 'bg-emerald-950/80 text-emerald-300 border-emerald-500/50';
        break;
      case 'SEARCHING':
        colorClasses = 'bg-amber-950/80 text-amber-300 border-amber-500/50';
        break;
      case 'INFORMATION_RECEIVED':
      case 'POSSIBLE_MATCH':
        colorClasses = 'bg-blue-950/80 text-blue-300 border-blue-500/50';
        break;
      case 'UNDER_VERIFICATION':
        colorClasses = 'bg-purple-950/80 text-purple-300 border-purple-500/50';
        break;
      case 'DUPLICATE':
      case 'REJECTED':
      case 'CLOSED':
        colorClasses = 'bg-slate-800 text-slate-400 border-slate-700';
        break;
    }
  } else if (type === 'priority') {
    switch (value as PriorityLevel) {
      case 'CRITICAL':
        colorClasses = 'bg-red-950/80 text-red-300 border-red-500/60 animate-pulse-subtle';
        break;
      case 'HIGH':
        colorClasses = 'bg-amber-950/80 text-amber-300 border-amber-500/50';
        break;
      case 'NORMAL':
        colorClasses = 'bg-blue-950/80 text-blue-300 border-blue-500/50';
        break;
      case 'LOW':
        colorClasses = 'bg-slate-800 text-slate-400 border-slate-700';
        break;
    }
  } else if (type === 'verification') {
    switch (value as VerificationState) {
      case 'VERIFIED':
        colorClasses = 'bg-emerald-950/80 text-emerald-300 border-emerald-500/50';
        break;
      case 'CORROBORATED':
        colorClasses = 'bg-cyan-950/80 text-cyan-300 border-cyan-500/50';
        break;
      case 'UNDER_REVIEW':
        colorClasses = 'bg-purple-950/80 text-purple-300 border-purple-500/50';
        break;
      case 'UNVERIFIED':
        colorClasses = 'bg-amber-950/80 text-amber-300 border-amber-500/50';
        break;
      case 'REJECTED':
        colorClasses = 'bg-rose-950/80 text-rose-300 border-rose-500/50';
        break;
    }
  } else if (type === 'confidence') {
    switch (value as MatchConfidenceLevel) {
      case 'HUMAN_VERIFIED':
        colorClasses = 'bg-emerald-950/80 text-emerald-300 border-emerald-500/50';
        break;
      case 'STRONG_CANDIDATE':
        colorClasses = 'bg-blue-950/80 text-blue-300 border-blue-500/60 font-semibold';
        break;
      case 'POSSIBLE_MATCH':
        colorClasses = 'bg-amber-950/80 text-amber-300 border-amber-500/50';
        break;
      case 'WEAK_CANDIDATE':
      case 'NO_MATCH':
        colorClasses = 'bg-slate-800 text-slate-400 border-slate-700';
        break;
    }
  }

  const formatText = (txt: string) => txt.replace(/_/g, ' ');

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border tracking-wide uppercase ${colorClasses}`}
    >
      {formatText(value)}
    </span>
  );
};
