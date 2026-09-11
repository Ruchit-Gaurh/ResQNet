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

  return (
    <div className="bg-[#0F172A] border border-slate-800 rounded-2xl shadow-xl overflow-hidden mb-6 transition-all hover:border-slate-700">
      {/* Top Banner: AI Score Header */}
      <div className="bg-gradient-to-r from-blue-950/60 via-slate-900 to-indigo-950/60 border-b border-slate-800 px-6 py-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="flex items-baseline space-x-2">
            <span className="text-3xl font-black text-white font-mono tracking-tight">
              {match.overallScore.toFixed(1)}%
            </span>
            <span className="text-xs uppercase tracking-widest font-bold text-blue-400">
              MATCH CONFIDENCE
            </span>
          </div>
          <StatusBadge type="confidence" value={match.confidenceLevel} />
        </div>

        <div className="flex items-center space-x-2">
          <span className="text-xs text-slate-400 font-mono">Candidate ID: {match.matchId}</span>
          <button
            onClick={() => setShowFullDetails(!showFullDetails)}
            className="text-xs text-slate-400 hover:text-slate-200 p-1 rounded hover:bg-slate-800"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Main Side-by-Side Comparison Container */}
      <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-800">
        {/* LEFT: Target Missing Person (Family Source) */}
        <div className="p-6 space-y-4 bg-slate-900/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold text-red-400 uppercase tracking-wider bg-red-950/60 border border-red-500/40 px-2 py-0.5 rounded">
                MISSING PERSON REPORT
              </span>
              <span className="font-mono text-xs text-slate-500">{targetCase.caseId}</span>
            </div>
            <StatusBadge type="status" value={targetCase.status} />
          </div>

          <div className="flex space-x-4">
            <div className="relative h-32 w-28 rounded-xl overflow-hidden bg-slate-800 border border-slate-700 flex-shrink-0">
              {targetCase.person.photoUrl ? (
                <img
                  src={targetCase.person.photoUrl}
                  alt={targetCase.person.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="h-full w-full flex items-center justify-center text-slate-500">
                  <User className="h-10 w-10" />
                </div>
              )}
              <div className="absolute bottom-0 inset-x-0 bg-black/60 backdrop-blur-xs py-0.5 text-center text-[10px] text-slate-300 font-medium">
                Family Photo
              </div>
            </div>

            <div className="space-y-1.5 flex-1 min-w-0">
              <h3 className="text-lg font-bold text-white truncate">{targetCase.person.name}</h3>
              {targetCase.person.nickname && (
                <p className="text-xs text-slate-400">Nickname: <span className="text-slate-200">"{targetCase.person.nickname}"</span></p>
              )}
              <div className="text-xs text-slate-300 space-y-1">
                <p>Age: <strong className="text-white font-mono">{targetCase.person.age} years</strong> • Gender: <strong className="text-white font-mono">{targetCase.person.gender}</strong></p>
                <p className="truncate">Parent/Kin: <span className="text-slate-200">{targetCase.person.fatherMotherName}</span></p>
                <p className="truncate">Contact: <span className="text-slate-300 font-mono">{targetCase.person.phoneNumber}</span></p>
              </div>
            </div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-3 text-xs space-y-2">
            <div className="flex items-center space-x-2 text-slate-300">
              <MapPin className="h-3.5 w-3.5 text-red-400 flex-shrink-0" />
              <span className="font-semibold">Last Seen Location:</span>
              <span className="text-slate-200">{targetCase.lastKnownLocation?.zone}</span>
            </div>
            <div className="text-slate-400 pl-5 text-[11px] truncate">
              {targetCase.lastKnownLocation?.address}
            </div>

            <div className="flex items-center space-x-2 text-slate-300 pt-1 border-t border-slate-800/60">
              <Tag className="h-3.5 w-3.5 text-amber-400 flex-shrink-0" />
              <span className="font-semibold">Clothing:</span>
              <span className="text-slate-200">{targetCase.person.clothing}</span>
            </div>

            <div className="flex items-center space-x-2 text-slate-300">
              <HeartPulse className="h-3.5 w-3.5 text-blue-400 flex-shrink-0" />
              <span className="font-semibold">Medical Needs:</span>
              <span className="text-slate-200">{targetCase.person.medicalNeeds || 'None specified'}</span>
            </div>

            <div className="text-slate-400 pl-5 text-[11px]">
              Distinguishing Marks: <span className="text-slate-300 font-medium">{targetCase.person.identifyingMarks}</span>
            </div>
          </div>
        </div>

        {/* RIGHT: Candidate Found / Hospital Intake */}
        <div className="p-6 space-y-4 bg-slate-900/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider bg-emerald-950/60 border border-emerald-500/40 px-2 py-0.5 rounded">
                HOSPITAL INTAKE RECORD
              </span>
              <span className="font-mono text-xs text-slate-500">{candidateCase.caseId}</span>
            </div>
            <StatusBadge type="status" value={candidateCase.status} />
          </div>

          <div className="flex space-x-4">
            <div className="relative h-32 w-28 rounded-xl overflow-hidden bg-slate-800 border border-slate-700 flex-shrink-0">
              {candidateCase.person.photoUrl ? (
                <img
                  src={candidateCase.person.photoUrl}
                  alt={candidateCase.person.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="h-full w-full flex items-center justify-center text-slate-500">
                  <User className="h-10 w-10" />
                </div>
              )}
              <div className="absolute bottom-0 inset-x-0 bg-black/60 backdrop-blur-xs py-0.5 text-center text-[10px] text-slate-300 font-medium">
                Intake Photo
              </div>
            </div>

            <div className="space-y-1.5 flex-1 min-w-0">
              <h3 className="text-lg font-bold text-white truncate">{candidateCase.person.name}</h3>
              <p className="text-xs text-slate-400">Intake Source: <span className="text-emerald-400 font-semibold">{candidateCase.source}</span></p>
              <div className="text-xs text-slate-300 space-y-1">
                <p>Est. Age: <strong className="text-white font-mono">~{candidateCase.person.approximateAge} years</strong> • Gender: <strong className="text-white font-mono">{candidateCase.person.gender}</strong></p>
                <p className="truncate">Admitted: <span className="text-slate-300 font-mono">2026-09-11 09:10 UTC</span></p>
                <p className="truncate">Source Trust: <span className="text-emerald-400 font-mono font-bold">98% (Hospital)</span></p>
              </div>
            </div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-3 text-xs space-y-2">
            <div className="flex items-center space-x-2 text-slate-300">
              <MapPin className="h-3.5 w-3.5 text-emerald-400 flex-shrink-0" />
              <span className="font-semibold">Found/Admitted At:</span>
              <span className="text-slate-200">{candidateCase.lastKnownLocation?.zone}</span>
            </div>
            <div className="text-slate-400 pl-5 text-[11px] truncate">
              {candidateCase.lastKnownLocation?.address}
            </div>

            <div className="flex items-center space-x-2 text-slate-300 pt-1 border-t border-slate-800/60">
              <Tag className="h-3.5 w-3.5 text-amber-400 flex-shrink-0" />
              <span className="font-semibold">Clothing Observed:</span>
              <span className="text-slate-200">{candidateCase.person.clothing}</span>
            </div>

            <div className="flex items-center space-x-2 text-slate-300">
              <HeartPulse className="h-3.5 w-3.5 text-blue-400 flex-shrink-0" />
              <span className="font-semibold">Medical Condition:</span>
              <span className="text-slate-200">{candidateCase.person.medicalNeeds}</span>
            </div>

            <div className="text-slate-400 pl-5 text-[11px]">
              Observed Marks: <span className="text-slate-300 font-medium">{candidateCase.person.identifyingMarks}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Explainable AI Score Breakdown */}
      {showFullDetails && (
        <div className="p-6 border-t border-slate-800 bg-[#0B1120]">
          <ScoreBreakdownBar
            breakdown={match.breakdown}
            reasons={match.reasons}
            warnings={match.warnings}
          />
        </div>
      )}

      {/* Action Footer for Human Reviewer */}
      <div className="bg-slate-900/90 border-t border-slate-800 px-6 py-4 flex flex-wrap items-center justify-between gap-4">
        <div className="text-xs text-slate-400 flex items-center space-x-2">
          <Clock className="h-3.5 w-3.5 text-slate-500" />
          <span>Candidate generated 18 minutes ago • Awaiting Human Authorization</span>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => onReject(match.matchId, 'Ruchit Gaurh (Lead)')}
            className="px-4 py-2 text-xs font-semibold text-rose-400 hover:text-rose-300 bg-rose-950/40 hover:bg-rose-900/50 border border-rose-800/50 rounded-lg transition-all flex items-center space-x-1.5"
          >
            <XCircle className="h-4 w-4" />
            <span>Reject Match</span>
          </button>

          <button
            onClick={() => setIsModalOpen(true)}
            className="px-6 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg shadow-lg shadow-emerald-600/30 transition-all flex items-center space-x-2"
          >
            <ShieldCheck className="h-4 w-4" />
            <span>Review & Verify Identity</span>
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
