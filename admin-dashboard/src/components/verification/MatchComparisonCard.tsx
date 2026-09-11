import React, { useState } from 'react';
import { MatchCandidate, DisasterCase } from '../../types';
import { StatusBadge } from '../common/StatusBadge';
import { ScoreBreakdownBar } from './ScoreBreakdownBar';
import { VerificationActionModal } from './VerificationActionModal';
import {
  ShieldCheck,
  XCircle,
  Clock,
  MapPin,
  User,
  HeartPulse,
  Tag,
  ChevronDown,
  ChevronUp,
  Maximize2
} from 'lucide-react';

interface MatchComparisonCardProps {
  match: MatchCandidate;
  targetCase?: DisasterCase | null;
  candidateCase?: DisasterCase | null;
  onVerify: (matchId: string, reviewerName: string, notes?: string, evidenceUsed?: string[]) => void;
  onReject: (matchId: string, reviewerName: string, notes?: string) => void;
}

export const MatchComparisonCard: React.FC<MatchComparisonCardProps> = ({
  match,
  targetCase,
  candidateCase,
  onVerify,
  onReject
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showFullDetails, setShowFullDetails] = useState(true);

  if (!targetCase || !candidateCase) return null;

  const score = match.overallScore;
  const radius = 20;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  let ringColor = '#16a34a'; // emerald
  if (score < 70) ringColor = '#dc2626'; // rose
  else if (score < 85) ringColor = '#d97706'; // amber

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
      {/* Top Banner: AI Score Header */}
      <div className="px-5 py-3.5 flex items-center justify-between border-b border-slate-200 bg-slate-50/70">
        <div className="flex items-center space-x-3">
          <div className="relative flex items-center justify-center">
            <svg width="48" height="48" className="rotate-[-90deg]">
              <circle cx="24" cy="24" r={radius} fill="none" stroke="#e2e8f0" strokeWidth="4" />
              <circle
                cx="24"
                cy="24"
                r={radius}
                fill="none"
                stroke={ringColor}
                strokeWidth="4"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center font-mono font-black text-xs text-slate-900">
              {score.toFixed(0)}%
            </div>
          </div>

          <div>
            <div className="flex items-center space-x-2">
              <span className="font-extrabold text-xs uppercase tracking-wider text-slate-900">
                Match Correlation Confidence
              </span>
              <StatusBadge type="confidence" value={match.confidenceLevel} />
            </div>
            <p className="text-[11px] text-slate-500 font-mono mt-0.5">
              Candidate ID: {match.matchId} • Multi-attribute RapidFuzz correlation
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowFullDetails(!showFullDetails)}
          className="text-xs font-semibold text-slate-600 hover:text-blue-600 flex items-center space-x-1 transition-colors"
        >
          <span>{showFullDetails ? 'Hide Model Evidence' : 'Show Model Evidence'}</span>
          {showFullDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>

      {/* Main Side-by-Side Comparison Container */}
      <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
        {/* LEFT: Target Missing Person (Family Source) */}
        <div className="p-5 space-y-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-red-600" />
              <span className="text-[10px] font-extrabold text-red-700 uppercase tracking-wider bg-red-50 border border-red-200 px-2 py-0.5 rounded">
                Family Missing Report
              </span>
              <span className="font-mono text-xs text-slate-500 font-bold">{targetCase.caseId}</span>
            </div>
            <StatusBadge type="status" value={targetCase.status} />
          </div>

          <div className="flex space-x-3.5 items-start">
            <div className="w-24 h-28 rounded-lg overflow-hidden bg-slate-100 border border-slate-200 flex-shrink-0 relative">
              {targetCase.person.photoUrl ? (
                <img
                  src={targetCase.person.photoUrl}
                  alt={targetCase.person.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="h-full w-full flex items-center justify-center text-slate-400">
                  <User className="h-8 w-8" />
                </div>
              )}
              <div className="absolute bottom-0 inset-x-0 bg-black/60 py-0.5 text-center text-[9px] text-white font-bold">
                Family Photo
              </div>
            </div>

            <div className="space-y-1 min-w-0 flex-1">
              <h3 className="text-base font-extrabold text-slate-900 truncate">{targetCase.person.name}</h3>
              {targetCase.person.nickname && (
                <p className="text-[11px] text-slate-500">
                  Alias: <span className="text-slate-800 font-medium">"{targetCase.person.nickname}"</span>
                </p>
              )}
              <div className="text-xs text-slate-600 space-y-0.5 pt-0.5">
                <p>
                  Age: <strong className="text-slate-900">{targetCase.person.age} years</strong> • Gender:{' '}
                  <strong className="text-slate-900">{targetCase.person.gender}</strong>
                </p>
                <p className="truncate">
                  Kin Contact: <span className="text-slate-800">{targetCase.person.fatherMotherName}</span>
                </p>
                <p className="truncate font-mono text-[11px]">
                  Phone: <span className="text-blue-700 font-bold">{targetCase.person.phoneNumber}</span>
                </p>
              </div>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs space-y-2">
            <div className="flex items-center space-x-1.5 text-slate-800">
              <MapPin className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />
              <span className="font-bold">Last Seen Location:</span>
              <span className="text-slate-700">{targetCase.lastKnownLocation?.zone}</span>
            </div>
            <div className="text-slate-500 pl-5 text-[11px] truncate">
              {targetCase.lastKnownLocation?.address}
            </div>

            <div className="flex items-center space-x-1.5 text-slate-800 pt-1 border-t border-slate-200">
              <Tag className="h-3.5 w-3.5 text-amber-600 flex-shrink-0" />
              <span className="font-bold">Clothing:</span>
              <span className="text-slate-700">{targetCase.person.clothing}</span>
            </div>

            <div className="flex items-center space-x-1.5 text-slate-800">
              <HeartPulse className="h-3.5 w-3.5 text-blue-600 flex-shrink-0" />
              <span className="font-bold">Medical:</span>
              <span className="text-slate-700">{targetCase.person.medicalNeeds || 'None specified'}</span>
            </div>

            <div className="text-slate-600 pl-5 text-[11px]">
              Identifying Marks: <strong className="text-slate-900">{targetCase.person.identifyingMarks}</strong>
            </div>
          </div>
        </div>

        {/* RIGHT: Candidate Found / Hospital Intake */}
        <div className="p-5 space-y-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-emerald-600" />
              <span className="text-[10px] font-extrabold text-emerald-700 uppercase tracking-wider bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                Hospital Intake Record
              </span>
              <span className="font-mono text-xs text-slate-500 font-bold">{candidateCase.caseId}</span>
            </div>
            <StatusBadge type="status" value={candidateCase.status} />
          </div>

          <div className="flex space-x-3.5 items-start">
            <div className="w-24 h-28 rounded-lg overflow-hidden bg-slate-100 border border-slate-200 flex-shrink-0 relative">
              {candidateCase.person.photoUrl ? (
                <img
                  src={candidateCase.person.photoUrl}
                  alt={candidateCase.person.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="h-full w-full flex items-center justify-center text-slate-400">
                  <User className="h-8 w-8" />
                </div>
              )}
              <div className="absolute bottom-0 inset-x-0 bg-black/60 py-0.5 text-center text-[9px] text-white font-bold">
                Field Intake
              </div>
            </div>

            <div className="space-y-1 min-w-0 flex-1">
              <h3 className="text-base font-extrabold text-slate-900 truncate">{candidateCase.person.name}</h3>
              <p className="text-[11px] text-slate-500">
                Source: <span className="text-emerald-700 font-bold">{candidateCase.source}</span>
              </p>
              <div className="text-xs text-slate-600 space-y-0.5 pt-0.5">
                <p>
                  Est. Age: <strong className="text-slate-900">~{candidateCase.person.approximateAge} years</strong> •
                  Gender: <strong className="text-slate-900">{candidateCase.person.gender}</strong>
                </p>
                <p className="truncate">
                  Admitted: <span className="text-slate-700 font-mono">2026-09-11 09:10 UTC</span>
                </p>
                <p className="truncate font-mono text-[11px]">
                  Trust Score: <span className="text-emerald-700 font-bold">98% (Hospital Desk)</span>
                </p>
              </div>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs space-y-2">
            <div className="flex items-center space-x-1.5 text-slate-800">
              <MapPin className="h-3.5 w-3.5 text-emerald-600 flex-shrink-0" />
              <span className="font-bold">Admitted Location:</span>
              <span className="text-slate-700">{candidateCase.lastKnownLocation?.zone}</span>
            </div>
            <div className="text-slate-500 pl-5 text-[11px] truncate">
              {candidateCase.lastKnownLocation?.address}
            </div>

            <div className="flex items-center space-x-1.5 text-slate-800 pt-1 border-t border-slate-200">
              <Tag className="h-3.5 w-3.5 text-amber-600 flex-shrink-0" />
              <span className="font-bold">Clothing Observed:</span>
              <span className="text-slate-700">{candidateCase.person.clothing}</span>
            </div>

            <div className="flex items-center space-x-1.5 text-slate-800">
              <HeartPulse className="h-3.5 w-3.5 text-blue-600 flex-shrink-0" />
              <span className="font-bold">Medical Condition:</span>
              <span className="text-slate-700">{candidateCase.person.medicalNeeds}</span>
            </div>

            <div className="text-slate-600 pl-5 text-[11px]">
              Observed Marks: <strong className="text-slate-900">{candidateCase.person.identifyingMarks}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Explainable AI Score Breakdown */}
      {showFullDetails && (
        <div className="p-5 border-t border-slate-200 bg-slate-50/50">
          <ScoreBreakdownBar
            breakdown={match.breakdown}
            reasons={match.reasons}
            warnings={match.warnings}
          />
        </div>
      )}

      {/* Action Footer */}
      <div className="bg-slate-50 px-5 py-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs text-slate-500 flex items-center space-x-1.5">
          <Clock className="h-3.5 w-3.5 text-slate-400" />
          <span>Generated 18m ago • Requires Responder Authorization</span>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => onReject(match.matchId, 'Ruchit Gaurh (Lead)')}
            className="px-3 py-1.5 text-xs font-bold text-slate-700 hover:text-red-700 bg-white hover:bg-red-50 border border-slate-300 hover:border-red-300 rounded-lg transition-colors flex items-center space-x-1"
          >
            <XCircle className="h-3.5 w-3.5" />
            <span>Reject Match</span>
          </button>

          <button
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-1.5 text-xs font-black text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition-colors flex items-center space-x-1.5"
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>Review & Confirm Identity</span>
          </button>
        </div>
      </div>

      {/* Verification Authorization Modal */}
      <VerificationActionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onConfirm={(reviewerName, notes, evidenceUsed) =>
          onVerify(match.matchId, reviewerName, notes, evidenceUsed)
        }
        matchId={match.matchId}
        missingName={targetCase.person.name}
        candidateName={candidateCase.person.name}
        overallScore={match.overallScore}
      />
    </div>
  );
};
