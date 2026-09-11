import React, { useState } from 'react';
import { DisasterCase } from '../../types';
import { StatusBadge } from '../common/StatusBadge';
import { GitMerge, Check, ShieldAlert } from 'lucide-react';

interface CaseMergeViewProps {
  cases: DisasterCase[];
  onMerge: (canonicalCaseId: string, duplicateCaseIds: string[], reason: string) => void;
}

export const CaseMergeView: React.FC<CaseMergeViewProps> = ({ cases, onMerge }) => {
  const [canonicalId, setCanonicalId] = useState<string>('CASE-10291');
  const [selectedDuplicates, setSelectedDuplicates] = useState<string[]>(['CASE-10305']);
  const [mergeReason, setMergeReason] = useState(
    'Intake form and physical scars match family report for Rahul Sharma. Consolidated hospital record into primary case.'
  );
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const toggleDuplicate = (id: string) => {
    if (id === canonicalId) return;
    if (selectedDuplicates.includes(id)) {
      setSelectedDuplicates(selectedDuplicates.filter((d) => d !== id));
    } else {
      setSelectedDuplicates([...selectedDuplicates, id]);
    }
  };

  const handleMergeSubmit = () => {
    if (!canonicalId || selectedDuplicates.length === 0) return;
    onMerge(canonicalId, selectedDuplicates, mergeReason);
    setSuccessMessage(
      `Successfully consolidated ${selectedDuplicates.length} record(s) into canonical case ${canonicalId}. Original evidence preserved.`
    );
    setTimeout(() => setSuccessMessage(null), 5000);
  };

  return (
    <div className="space-y-6">
      <div className="bg-[#0F172A] border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-xl bg-purple-600/20 border border-purple-500/40 flex items-center justify-center">
              <GitMerge className="h-5 w-5 text-purple-400" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Duplicate Record Consolidation</h3>
              <p className="text-xs text-slate-400">
                Group multiple hospital intakes, camp registrations, and volunteer sightings into one canonical case.
              </p>
            </div>
          </div>
        </div>

        {successMessage && (
          <div className="bg-emerald-950/60 border border-emerald-500/50 rounded-xl p-3 text-xs text-emerald-300 flex items-center space-x-2">
            <Check className="h-4 w-4 text-emerald-400" />
            <span>{successMessage}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-2">
          {/* 1. Select Canonical Record */}
          <div className="space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center space-x-1.5">
              <span className="h-5 w-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">
                1
              </span>
              <span>Target Canonical Case</span>
            </div>
            <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
              {cases.map((c) => (
                <div
                  key={c.caseId}
                  onClick={() => {
                    setCanonicalId(c.caseId);
                    setSelectedDuplicates(selectedDuplicates.filter((id) => id !== c.caseId));
                  }}
                  className={`p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                    canonicalId === c.caseId
                      ? 'bg-blue-950/40 border-blue-500 text-white shadow-md shadow-blue-500/10'
                      : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-mono font-bold text-blue-400">{c.caseId}</span>
                    <StatusBadge type="status" value={c.status} />
                  </div>
                  <div className="font-bold text-sm text-slate-100">{c.person.name}</div>
                  <div className="text-slate-400 text-[11px] mt-1">
                    Source: {c.source} • Age: {c.person.age || c.person.approximateAge || 'N/A'}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 2. Select Duplicates to Consolidate */}
          <div className="space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center space-x-1.5">
              <span className="h-5 w-5 rounded-full bg-purple-600 text-white flex items-center justify-center text-[10px]">
                2
              </span>
              <span>Select Duplicate Reports to Link</span>
            </div>
            <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
              {cases
                .filter((c) => c.caseId !== canonicalId)
                .map((c) => {
                  const isSelected = selectedDuplicates.includes(c.caseId);
                  return (
                    <div
                      key={c.caseId}
                      onClick={() => toggleDuplicate(c.caseId)}
                      className={`p-3 rounded-xl border text-xs cursor-pointer transition-all flex items-start space-x-2.5 ${
                        isSelected
                          ? 'bg-purple-950/40 border-purple-500 text-white shadow-md shadow-purple-500/10'
                          : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}}
                        className="mt-0.5 rounded bg-slate-800 border-slate-700 text-purple-600 focus:ring-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-mono font-semibold text-purple-300">{c.caseId}</span>
                          <span className="text-[10px] text-slate-400">{c.source}</span>
                        </div>
                        <div className="font-semibold text-slate-200 truncate">{c.person.name}</div>
                        <div className="text-slate-400 text-[11px] truncate">
                          {c.person.clothing || c.lastKnownLocation?.zone}
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* 3. Review & Execute Merge */}
          <div className="space-y-4 bg-slate-900/40 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center space-x-1.5">
                <span className="h-5 w-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px]">
                  3
                </span>
                <span>Provenance & Audit Reason</span>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Consolidation Justification</label>
                <textarea
                  rows={4}
                  value={mergeReason}
                  onChange={(e) => setMergeReason(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-purple-500"
                  placeholder="Explain why these records refer to the same individual..."
                />
              </div>

              <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-3 text-[11px] text-slate-400 space-y-1.5">
                <div className="flex items-center space-x-1 text-slate-300 font-semibold">
                  <ShieldAlert className="h-3.5 w-3.5 text-blue-400" />
                  <span>Provenance Safeguards</span>
                </div>
                <p>• Duplicate records are <strong>never deleted</strong>.</p>
                <p>• Original source IDs link as child evidence nodes.</p>
                <p>• Can be split later if found to be merged in error.</p>
              </div>
            </div>

            <button
              onClick={handleMergeSubmit}
              disabled={selectedDuplicates.length === 0}
              className="w-full py-2.5 px-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-purple-600/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
              <GitMerge className="h-4 w-4" />
              <span>Consolidate {selectedDuplicates.length} Record(s)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
