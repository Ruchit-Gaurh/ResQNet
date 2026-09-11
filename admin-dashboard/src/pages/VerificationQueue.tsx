import React, { useState } from 'react';
import { MatchCandidate, DisasterCase } from '../types';
import { MatchComparisonCard } from '../components/verification/MatchComparisonCard';
import { UserCheck, ShieldAlert, CheckCircle2 } from 'lucide-react';

interface VerificationQueueProps {
  matches: MatchCandidate[];
  cases: DisasterCase[];
  onVerify: (matchId: string, reviewerName: string, notes?: string, evidenceUsed?: string[]) => void;
  onReject: (matchId: string, reviewerName: string, notes?: string) => void;
}

export const VerificationQueue: React.FC<VerificationQueueProps> = ({
  matches,
  cases,
  onVerify,
  onReject
}) => {
  const pendingMatches = matches.filter((m) => m.status === 'PENDING_REVIEW');
  const [filterConfidence, setFilterConfidence] = useState<string>('ALL');

  const filteredMatches = pendingMatches.filter((m) => {
    if (filterConfidence === 'ALL') return true;
    return m.confidenceLevel === filterConfidence;
  });

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-[#0F172A] border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-xl bg-amber-600/20 border border-amber-500/40 flex items-center justify-center">
              <UserCheck className="h-6 w-6 text-amber-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-wide">
                Human Verification Queue
              </h2>
              <p className="text-xs text-slate-400">
                AI algorithm suggests candidate correlations. Authorized responders must review evidence before confirming.
              </p>
            </div>
          </div>
        </div>

        {/* Confidence Filter Pills */}
        <div className="flex items-center space-x-2 text-xs">
          <span className="text-slate-400 font-semibold">Filter:</span>
          {['ALL', 'STRONG_CANDIDATE', 'POSSIBLE_MATCH'].map((conf) => (
            <button
              key={conf}
              onClick={() => setFilterConfidence(conf)}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                filterConfidence === conf
                  ? 'bg-blue-600 text-white font-bold shadow-md shadow-blue-500/20'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {conf === 'ALL' ? 'All Candidates' : conf.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Mandatory Protocol Alert */}
      <div className="bg-blue-950/40 border border-blue-500/30 rounded-xl p-4 text-xs text-blue-300 flex items-start space-x-3">
        <ShieldAlert className="h-5 w-5 text-blue-400 flex-shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-bold text-white">Disaster Verification Standard Operating Procedure (SOP):</p>
          <p className="text-blue-200/90 leading-relaxed">
            1. Cross-reference name spelling, phonetic variations, and language transliterations.
            2. Correlate clothing descriptions with intake notes from field hospitals and relief camps.
            3. Upon clicking <strong>[ Review & Verify Identity ]</strong>, select the evidence items physically checked.
            4. Once confirmed, an encrypted update packet is dispatched across the mesh to the family's device.
          </p>
        </div>
      </div>

      {/* Candidate Cards List */}
      {filteredMatches.length === 0 ? (
        <div className="bg-[#0F172A] border border-slate-800 rounded-2xl p-12 text-center space-y-3">
          <CheckCircle2 className="h-12 w-12 text-emerald-400 mx-auto" />
          <h3 className="text-base font-bold text-white">Verification Queue Clear</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            All pending AI identity match candidates have been reviewed and processed by responders.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {filteredMatches.map((match) => {
            const targetCase = cases.find((c) => c.caseId === match.targetMissingCaseId);
            const candidateCase = cases.find((c) => c.caseId === match.candidateFoundCaseId);
            return (
              <MatchComparisonCard
                key={match.matchId}
                match={match}
                targetCase={targetCase}
                candidateCase={candidateCase}
                onVerify={onVerify}
                onReject={onReject}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};
