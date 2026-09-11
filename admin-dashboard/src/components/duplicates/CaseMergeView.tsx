import React, { useState } from 'react';
import { DisasterCase } from '../../types';
import { StatusBadge } from '../common/StatusBadge';
import { GitMerge, Check, ShieldAlert, CheckCircle2 } from 'lucide-react';

interface CaseMergeViewProps {
  cases: DisasterCase[];
  onMerge: (canonicalCaseId: string, duplicateCaseIds: string[], reason: string) => void;
}

export const CaseMergeView: React.FC<CaseMergeViewProps> = ({ cases, onMerge }) => {
  const [canonicalId, setCanonicalId] = useState<string>('CASE-10291');
  const [selectedDuplicates, setSelectedDuplicates] = useState<string[]>(['CASE-10305']);
  const [mergeReason, setMergeReason] = useState(
    'Hospital intake form and identifying facial scar match family missing-person report for Rahul Sharma. Consolidated intake into canonical case graph.'
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
      `Successfully linked ${selectedDuplicates.length} record(s) into canonical case ${canonicalId}. Original evidence preserved.`
    );
    setTimeout(() => setSuccessMessage(null), 5000);
  };

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-lg bg-purple-50 border border-purple-200 text-purple-600">
              <GitMerge size={18} />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900">Canonical Duplicate Consolidation</h3>
              <p className="text-xs text-slate-500">
                Consolidate multiple field sightings and hospital admission records while preserving data provenance
              </p>
            </div>
          </div>
        </div>

        {successMessage && (
          <div className="bg-emerald-50 border border-emerald-300 rounded-lg p-3 text-xs text-emerald-800 flex items-center space-x-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
            <span className="font-semibold">{successMessage}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* 1. Target Canonical Case */}
          <div className="space-y-2.5">
            <div className="text-xs font-extrabold uppercase tracking-wider text-slate-700 flex items-center space-x-1.5">
              <span className="h-4 w-4 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">
                1
              </span>
              <span>Select Primary Canonical Record</span>
            </div>
            <div className="space-y-1.5 max-h-[380px] overflow-y-auto pr-1">
              {cases.map((c) => (
                <div
                  key={c.caseId}
                  onClick={() => {
                    setCanonicalId(c.caseId);
                    setSelectedDuplicates(selectedDuplicates.filter((id) => id !== c.caseId));
                  }}
                  className={`p-3 rounded-lg border text-xs cursor-pointer transition-all ${
                    canonicalId === c.caseId
                      ? 'bg-blue-50 border-blue-500 shadow-xs'
                      : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-mono font-bold text-blue-700 text-xs">{c.caseId}</span>
                    <StatusBadge type="status" value={c.status} />
                  </div>
                  <div className="font-bold text-slate-900">{c.person.name}</div>
                  <div className="text-slate-500 text-[11px] mt-0.5">
                    Source: <strong>{c.source}</strong> • Age: {c.person.age || c.person.approximateAge || 'N/A'}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 2. Select Duplicates */}
          <div className="space-y-2.5">
            <div className="text-xs font-extrabold uppercase tracking-wider text-slate-700 flex items-center space-x-1.5">
              <span className="h-4 w-4 rounded-full bg-purple-600 text-white flex items-center justify-center text-[10px]">
                2
              </span>
              <span>Link Duplicate Records</span>
            </div>
            <div className="space-y-1.5 max-h-[380px] overflow-y-auto pr-1">
              {cases
                .filter((c) => c.caseId !== canonicalId)
                .map((c) => {
                  const isSelected = selectedDuplicates.includes(c.caseId);
                  return (
                    <div
                      key={c.caseId}
                      onClick={() => toggleDuplicate(c.caseId)}
                      className={`p-3 rounded-lg border text-xs cursor-pointer transition-all flex items-start space-x-2.5 ${
                        isSelected
                          ? 'bg-purple-50 border-purple-500 shadow-xs'
                          : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}}
                        className="mt-0.5 rounded border-slate-300 text-purple-600 focus:ring-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center mb-0.5">
                          <span className="font-mono font-bold text-purple-700 text-xs">{c.caseId}</span>
                          <span className="text-[10px] text-slate-500 font-medium">{c.source}</span>
                        </div>
                        <div className="font-bold text-slate-900 truncate">{c.person.name}</div>
                        <div className="text-slate-500 text-[11px] truncate">
                          {c.person.clothing || c.lastKnownLocation?.zone}
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* 3. Review & Execute */}
          <div className="space-y-3 bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col justify-between">
            <div className="space-y-2.5">
              <div className="text-xs font-extrabold uppercase tracking-wider text-slate-700 flex items-center space-x-1.5">
                <span className="h-4 w-4 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px]">
                  3
                </span>
                <span>Provenance & Justification</span>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Consolidation Justification
                </label>
                <textarea
                  rows={4}
                  value={mergeReason}
                  onChange={(e) => setMergeReason(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                  placeholder="Explain reason for consolidation..."
                />
              </div>

              <div className="bg-white border border-slate-200 rounded-lg p-3 text-[11px] text-slate-600 space-y-1 shadow-2xs">
                <div className="flex items-center space-x-1 text-slate-900 font-bold">
                  <ShieldAlert className="h-3.5 w-3.5 text-blue-600" />
                  <span>Immutable Provenance</span>
                </div>
                <p>• Linked duplicate records are never destroyed.</p>
                <p>• Source IDs become child nodes in canonical graph.</p>
                <p>• Merges can be rolled back if contested by kin.</p>
              </div>
            </div>

            <button
              onClick={handleMergeSubmit}
              disabled={selectedDuplicates.length === 0}
              className="w-full py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg shadow-xs transition-colors disabled:opacity-50 flex items-center justify-center space-x-1.5"
            >
              <GitMerge size={14} />
              <span>Consolidate {selectedDuplicates.length} Record(s)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
