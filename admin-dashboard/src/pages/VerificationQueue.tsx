import React, { useState } from 'react';
import { MatchCandidate, DisasterCase } from '../types';
import { MatchComparisonCard } from '../components/verification/MatchComparisonCard';
import { UserCheck, ShieldAlert, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';

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
  const [showSop, setShowSop] = useState(true);

  const filteredMatches = pendingMatches.filter((m) => {
    if (filterConfidence === 'ALL') return true;
    return m.confidenceLevel === filterConfidence;
  });

  return (
    <div className="space-y-4">
      {/* Top Banner Control */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <div className="h-10 w-10 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center">
            <UserCheck className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-slate-900 tracking-tight">
              Human-in-the-Loop Verification Queue
            </h2>
            <p className="text-xs text-slate-500">
              AI correlation suggests identity matches • Authorized responders verify evidence before dispatching P2P confirm packet
            </p>
          </div>
        </div>

        {/* Confidence Filter Pills */}
        <div className="flex items-center space-x-2">
          {['ALL', 'STRONG_CANDIDATE', 'POSSIBLE_MATCH'].map((conf) => (
            <button
              key={conf}
              onClick={() => setFilterConfidence(conf)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                filterConfidence === conf
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {conf === 'ALL' ? 'All Candidates' : conf.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Mandatory Protocol Alert - Collapsible */}
      <div className="bg-blue-50/70 border border-blue-200 rounded-xl overflow-hidden shadow-xs">
        <button
          onClick={() => setShowSop(!showSop)}
          className="w-full px-4 py-2.5 flex items-center justify-between text-left hover:bg-blue-100/50 transition-colors"
        >
          <div className="flex items-center space-x-2 text-xs text-blue-950 font-bold">
            <ShieldAlert className="h-4 w-4 text-blue-600 flex-shrink-0" />
            <span>Disaster Verification Standard Operating Procedure (SOP)</span>
          </div>
          {showSop ? (
            <ChevronUp className="h-4 w-4 text-blue-600" />
          ) : (
            <ChevronDown className="h-4 w-4 text-blue-600" />
          )}
        </button>

        {showSop && (
          <div className="px-4 pb-3 pt-1 text-xs text-blue-900 border-t border-blue-200/60 space-y-1">
            <p>1. Cross-reference name spelling, phonetic variations, and language transliterations (RapidFuzz token score).</p>
            <p>2. Correlate clothing descriptions with intake notes from field hospitals and relief camps.</p>
            <p>3. Upon clicking <strong>[ Review & Confirm Identity ]</strong>, check off the physical evidence examined.</p>
            <p>4. Once confirmed, an encrypted Ed25519 update packet is dispatched across the mesh to the family.</p>
          </div>
        )}
      </div>

      {/* Candidate Cards List */}
      {filteredMatches.length === 0 ? (
        <div className="py-12 bg-white border border-slate-200 rounded-xl text-center space-y-3">
          <div className="mx-auto h-12 w-12 rounded-full bg-emerald-50 flex items-center justify-center">
            <CheckCircle2 className="h-6 w-6 text-emerald-600" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">Verification Queue Clear</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              All pending identity match candidates have been processed and confirmed.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
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
