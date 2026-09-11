import React, { useState } from 'react';
import { DisasterCase } from '../../types';
import { CorrelationWorkflowModal } from '../verification/CorrelationWorkflowModal';
import { Zap, Download, RotateCcw, Radio, Upload, Sliders, CheckCircle, ShieldAlert, FileText, ArrowRight } from 'lucide-react';

interface IncidentDispatchPanelProps {
  cases: DisasterCase[];
  selectedCaseId: string;
  onSelectCase: (caseId: string) => void;
  onTriggerRunMatch: () => void;
  onExportReport: () => void;
  onReset: () => void;
}

export const IncidentDispatchPanel: React.FC<IncidentDispatchPanelProps> = ({
  cases,
  selectedCaseId,
  onSelectCase,
  onTriggerRunMatch,
  onExportReport,
  onReset
}) => {
  const [threshold, setThreshold] = useState<number>(0.75);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [feedbackMsg, setFeedbackMsg] = useState<string>('System ready. Mesh transport synchronized.');

  const currentCase = cases.find((c) => c.caseId === selectedCaseId) || cases[0];

  const handleOpenWorkflow = () => {
    setIsModalOpen(true);
  };

  const handleWorkflowComplete = () => {
    setFeedbackMsg('Match correlation completed. Candidate MATCH-4821 confidence: 91.2%.');
    onTriggerRunMatch();
  };

  return (
    <>
      <aside className="w-full lg:w-80 bg-white border border-slate-200 rounded-xl p-3.5 shadow-sm space-y-3.5 flex-shrink-0 text-xs text-slate-800">
        {/* 1. Incident Demographics */}
        <div className="space-y-2">
          <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-1 flex justify-between items-center">
            <span>Incident Casualty Demographics</span>
            <span className="text-[10px] font-mono text-blue-600 font-bold">CASE FILE</span>
          </div>

          <div className="grid grid-cols-3 gap-1.5 items-center">
            <span className="text-slate-500 text-[11px] font-medium">Case ID:</span>
            <input
              type="text"
              readOnly
              value={currentCase ? currentCase.caseId : 'CASE-10291'}
              className="col-span-2 bg-slate-50 border border-slate-300 rounded px-2 py-1 text-slate-900 font-mono font-bold text-xs"
            />
          </div>

          <div className="grid grid-cols-3 gap-1.5 items-center">
            <span className="text-slate-500 text-[11px] font-medium">Age / Gender:</span>
            <input
              type="text"
              readOnly
              value={currentCase ? `${currentCase.person.age || currentCase.person.approximateAge || 'N/A'} Y / ${currentCase.person.gender}` : '22 Y / MALE'}
              className="col-span-2 bg-slate-50 border border-slate-300 rounded px-2 py-1 text-slate-900 font-medium text-xs"
            />
          </div>

          <div className="grid grid-cols-3 gap-1.5 items-center">
            <span className="text-slate-500 text-[11px] font-medium">Zone / Post:</span>
            <input
              type="text"
              readOnly
              value={currentCase?.lastKnownLocation?.zone ? currentCase.lastKnownLocation.zone.split('—')[0] : 'Zone A — Riverfront'}
              className="col-span-2 bg-slate-50 border border-slate-300 rounded px-2 py-1 text-slate-900 font-medium text-xs truncate"
            />
          </div>
        </div>

        {/* 2. Photo / Field Evidence Input (Matching Reference Screenshot) */}
        <div className="space-y-2 border-t border-slate-100 pt-2.5">
          <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 flex justify-between items-center">
            <span>Casualty Image & Evidence</span>
            <span className="text-[10px] text-emerald-600 font-bold">● Active Intake</span>
          </div>

          <select
            value={currentCase ? currentCase.caseId : ''}
            onChange={(e) => onSelectCase(e.target.value)}
            className="w-full bg-slate-50 border border-slate-300 rounded-md p-1.5 text-xs text-slate-800 font-medium focus:outline-none focus:border-blue-500"
          >
            {cases.map((c) => (
              <option key={c.caseId} value={c.caseId}>
                {c.caseId}: {c.person.name} ({c.type})
              </option>
            ))}
          </select>

          <button className="w-full py-1.5 px-2.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 rounded-md font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors">
            <Upload size={13} />
            <span>Upload Field Photograph...</span>
          </button>

          {/* Thumbnail Preview Box */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-2 flex gap-2.5 items-center">
            <div className="w-16 h-16 rounded bg-slate-200 border border-slate-300 overflow-hidden flex-shrink-0 flex items-center justify-center">
              {currentCase?.person.photoUrl ? (
                <img
                  src={currentCase.person.photoUrl}
                  alt={currentCase.person.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-xl font-black text-slate-400">
                  {currentCase?.person.name.charAt(0) || '?'}
                </span>
              )}
            </div>
            <div className="text-[11px] space-y-0.5 text-slate-600 min-w-0">
              <p className="font-mono text-slate-900 font-bold truncate">
                {currentCase?.person.name || 'Sample_victim.jpg'}
              </p>
              <p className="text-[10px] text-slate-500">Res: 400×400 RGB</p>
              <p className="text-[10px] text-emerald-600 font-bold flex items-center gap-1">
                <CheckCircle size={10} /> Status: Ingested & Verified
              </p>
            </div>
          </div>
        </div>

        {/* 3. Triage & Match Parameters */}
        <div className="space-y-2 border-t border-slate-100 pt-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
              AI Triage Parameters
            </span>
            <span className="font-mono font-bold text-blue-600 text-[11px]">
              {threshold.toFixed(2)} (Calibrated)
            </span>
          </div>

          <input
            type="range"
            min="0.30"
            max="0.95"
            step="0.05"
            value={threshold}
            onChange={(e) => setThreshold(parseFloat(e.target.value))}
            className="w-full accent-blue-600 cursor-pointer h-1.5 bg-slate-200 rounded-lg"
          />

          <div className="flex justify-between text-[10px] font-mono text-slate-400">
            <span>0.30</span>
            <span>0.50</span>
            <span>0.70</span>
            <span>0.95</span>
          </div>

          <div className="text-[10px] text-slate-500 italic bg-slate-50 p-1.5 rounded border border-slate-200 leading-tight">
            Decision Rule: P[Candidate Match &gt;= {threshold.toFixed(2)}] OR Critical Medical Need
          </div>
        </div>

        {/* 4. Action Buttons (Matching Screenshot) */}
        <div className="space-y-2 border-t border-slate-100 pt-2.5">
          <button
            onClick={handleOpenWorkflow}
            className="w-full py-2.5 px-3 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-black text-xs rounded-lg shadow-sm flex items-center justify-center gap-2 transition-all"
          >
            <Zap size={14} />
            <span>⚡ RUN DIAGNOSTIC MATCHING</span>
          </button>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={onExportReport}
              className="py-1.5 px-2 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 rounded-md font-bold text-[11px] flex items-center justify-center gap-1 transition-colors"
            >
              <FileText size={12} />
              <span>Export Report</span>
            </button>
            <button
              onClick={onReset}
              className="py-1.5 px-2 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 rounded-md font-bold text-[11px] flex items-center justify-center gap-1 transition-colors"
            >
              <RotateCcw size={12} />
              <span>Reset Station</span>
            </button>
          </div>

          <button className="w-full py-1.5 px-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-blue-700 rounded-md font-bold text-[11px] flex items-center justify-center gap-1 transition-colors">
            <Radio size={12} className="text-blue-600" />
            <span>📡 Starlink P2P Gateway Uplink...</span>
          </button>

          {/* Live Feedback Line */}
          <div className="text-[10px] text-slate-500 pt-1 border-t border-slate-100 leading-tight">
            {feedbackMsg}
          </div>
        </div>
      </aside>

      {/* Correlation Pipeline Modal */}
      <CorrelationWorkflowModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onComplete={handleWorkflowComplete}
      />
    </>
  );
};
