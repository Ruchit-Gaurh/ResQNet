import React from 'react';
import { CaseStatus, PriorityLevel, VerificationState, MatchConfidenceLevel } from '../../types';

interface StatusBadgeProps {
  type: 'status' | 'priority' | 'verification' | 'confidence';
  value: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ type, value }) => {
  let bgClass = 'bg-slate-100 border-slate-300 text-slate-700';
  let dotClass = 'bg-slate-500';

  if (type === 'status') {
    switch (value as CaseStatus) {
      case 'VERIFIED':
      case 'REUNITED':
        bgClass = 'bg-emerald-50 border-emerald-200 text-emerald-800';
        dotClass = 'bg-emerald-600';
        break;
      case 'SEARCHING':
        bgClass = 'bg-amber-50 border-amber-200 text-amber-800';
        dotClass = 'bg-amber-600';
        break;
      case 'INFORMATION_RECEIVED':
      case 'POSSIBLE_MATCH':
        bgClass = 'bg-blue-50 border-blue-200 text-blue-800';
        dotClass = 'bg-blue-600';
        break;
      case 'UNDER_VERIFICATION':
        bgClass = 'bg-purple-50 border-purple-200 text-purple-800';
        dotClass = 'bg-purple-600';
        break;
      case 'DUPLICATE':
      case 'REJECTED':
      case 'CLOSED':
        bgClass = 'bg-slate-100 border-slate-200 text-slate-600';
        dotClass = 'bg-slate-400';
        break;
    }
  } else if (type === 'priority') {
    switch (value as PriorityLevel) {
      case 'CRITICAL':
        bgClass = 'bg-red-100 border-red-300 text-red-800 font-bold';
        dotClass = 'bg-red-600 animate-pulse';
        break;
      case 'HIGH':
        bgClass = 'bg-amber-100 border-amber-300 text-amber-800 font-semibold';
        dotClass = 'bg-amber-600';
        break;
      case 'NORMAL':
        bgClass = 'bg-blue-50 border-blue-200 text-blue-800';
        dotClass = 'bg-blue-600';
        break;
      case 'LOW':
        bgClass = 'bg-slate-100 border-slate-200 text-slate-600';
        dotClass = 'bg-slate-400';
        break;
    }
  } else if (type === 'verification') {
    switch (value as VerificationState) {
      case 'VERIFIED':
        bgClass = 'bg-emerald-50 border-emerald-300 text-emerald-800 font-bold';
        dotClass = 'bg-emerald-600';
        break;
      case 'CORROBORATED':
        bgClass = 'bg-sky-50 border-sky-200 text-sky-800 font-semibold';
        dotClass = 'bg-sky-600';
        break;
      case 'UNDER_REVIEW':
        bgClass = 'bg-purple-50 border-purple-200 text-purple-800';
        dotClass = 'bg-purple-600';
        break;
      case 'UNVERIFIED':
        bgClass = 'bg-amber-50 border-amber-200 text-amber-800';
        dotClass = 'bg-amber-600';
        break;
      case 'REJECTED':
        bgClass = 'bg-red-50 border-red-200 text-red-800';
        dotClass = 'bg-red-600';
        break;
    }
  } else if (type === 'confidence') {
    switch (value as MatchConfidenceLevel) {
      case 'HUMAN_VERIFIED':
        bgClass = 'bg-emerald-100 border-emerald-300 text-emerald-800 font-bold';
        dotClass = 'bg-emerald-600';
        break;
      case 'STRONG_CANDIDATE':
        bgClass = 'bg-blue-100 border-blue-300 text-blue-800 font-bold';
        dotClass = 'bg-blue-600';
        break;
      case 'POSSIBLE_MATCH':
        bgClass = 'bg-amber-50 border-amber-200 text-amber-800 font-semibold';
        dotClass = 'bg-amber-600';
        break;
      case 'WEAK_CANDIDATE':
      case 'NO_MATCH':
        bgClass = 'bg-slate-100 border-slate-200 text-slate-600';
        dotClass = 'bg-slate-400';
        break;
    }
  }

  const formatText = (txt: string) => {
    return txt
      .split('_')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] border shadow-xs tracking-tight ${bgClass}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${dotClass}`} />
      <span>{formatText(value)}</span>
    </span>
  );
};
