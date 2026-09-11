import React, { useState, useEffect } from 'react';
import { Zap, CheckCircle2, Radio, Server, ShieldCheck, ArrowRight, Cpu, UserCheck } from 'lucide-react';

interface CorrelationWorkflowModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

export const CorrelationWorkflowModal: React.FC<CorrelationWorkflowModalProps> = ({
  isOpen,
  onClose,
  onComplete
}) => {
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [progressPercent, setProgressPercent] = useState<number>(20);

  useEffect(() => {
    if (!isOpen) {
      setCurrentStep(1);
      setProgressPercent(20);
      return;
    }

    const t1 = setTimeout(() => {
      setCurrentStep(2);
      setProgressPercent(45);
    }, 700);

    const t2 = setTimeout(() => {
      setCurrentStep(3);
      setProgressPercent(75);
    }, 1500);

    const t3 = setTimeout(() => {
      setCurrentStep(4);
      setProgressPercent(100);
    }, 2300);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white border border-slate-300 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 text-xs text-slate-800">
        {/* Header */}
        <div className="flex items-center space-x-3 pb-3 border-b border-slate-200">
          <div className="p-2 rounded-xl bg-blue-600 text-white shadow-xs">
            <Cpu size={20} className={currentStep < 4 ? 'animate-spin' : ''} />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-slate-900">AI Diagnostic Correlation Engine</h3>
            <p className="text-[11px] text-slate-500 font-mono">RapidFuzz Multi-Attribute Matcher v1.4</p>
          </div>
        </div>

        {/* Progress Meter */}
        <div className="space-y-1">
          <div className="flex justify-between text-[11px] font-mono text-slate-600">
            <span>Processing Pipeline</span>
            <strong>{progressPercent}%</strong>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200">
            <div
              className="h-full bg-blue-600 transition-all duration-500 rounded-full"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Live Step Progress Sequence */}
        <div className="space-y-2.5 py-1">
          <div className={`p-2.5 rounded-lg border flex items-center gap-2.5 transition-all ${
            currentStep >= 1 ? 'bg-blue-50 border-blue-200 text-blue-900' : 'bg-slate-50 border-slate-200 opacity-50'
          }`}>
            <Radio size={16} className={currentStep === 1 ? 'text-blue-600 animate-pulse' : 'text-emerald-600'} />
            <div className="min-w-0 flex-1">
              <strong className="block text-xs">1. Ingesting Store-and-Forward BLE Packets</strong>
              <span className="text-[10px] text-slate-500">Unpacking Ed25519 encrypted envelope from Phone A</span>
            </div>
            {currentStep > 1 && <CheckCircle2 size={16} className="text-emerald-600 flex-shrink-0" />}
          </div>

          <div className={`p-2.5 rounded-lg border flex items-center gap-2.5 transition-all ${
            currentStep >= 2 ? 'bg-blue-50 border-blue-200 text-blue-900' : 'bg-slate-50 border-slate-200 opacity-50'
          }`}>
            <Server size={16} className={currentStep === 2 ? 'text-blue-600 animate-pulse' : 'text-emerald-600'} />
            <div className="min-w-0 flex-1">
              <strong className="block text-xs">2. Querying Field Hospital Intake Database</strong>
              <span className="text-[10px] text-slate-500">Cross-referencing Zone B Trauma Center Bed 14 ledger</span>
            </div>
            {currentStep > 2 && <CheckCircle2 size={16} className="text-emerald-600 flex-shrink-0" />}
          </div>

          <div className={`p-2.5 rounded-lg border flex items-center gap-2.5 transition-all ${
            currentStep >= 3 ? 'bg-blue-50 border-blue-200 text-blue-900' : 'bg-slate-50 border-slate-200 opacity-50'
          }`}>
            <Zap size={16} className={currentStep === 3 ? 'text-blue-600 animate-pulse' : 'text-emerald-600'} />
            <div className="min-w-0 flex-1">
              <strong className="block text-xs">3. RapidFuzz Phonetic & Token Matching</strong>
              <span className="text-[10px] text-slate-500">"Rahul Sharma" vs "Rahool S." (94% Phonetic score)</span>
            </div>
            {currentStep > 3 && <CheckCircle2 size={16} className="text-emerald-600 flex-shrink-0" />}
          </div>

          {currentStep >= 4 && (
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-300 text-emerald-950 space-y-1 animate-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-xs text-emerald-800 flex items-center gap-1">
                  <CheckCircle2 size={14} className="text-emerald-600" /> Match Candidate Identified!
                </span>
                <span className="font-mono font-black text-emerald-700 text-sm">91.2%</span>
              </div>
              <p className="text-[11px] text-emerald-900">
                Target Missing Person <strong>Rahul Sharma</strong> matches Hospital Patient <strong>Rahool S.</strong> (Ward 2 Bed 14).
              </p>
            </div>
          )}
        </div>

        {/* Action Button */}
        <div className="pt-2">
          {currentStep < 4 ? (
            <button
              disabled
              className="w-full py-2 bg-slate-200 text-slate-500 font-bold rounded-lg text-xs cursor-wait"
            >
              Analyzing Correlations...
            </button>
          ) : (
            <button
              onClick={() => {
                onComplete();
                onClose();
              }}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-lg text-xs flex items-center justify-center gap-2 shadow-xs transition-colors"
            >
              <UserCheck size={16} />
              <span>Proceed to Human Verification Queue</span>
              <ArrowRight size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
