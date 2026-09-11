import React, { useState, useEffect } from 'react';
import { demoSimulator, DemoStep } from '../services/demoSimulator';
import {
  Rocket,
  RotateCcw,
  Check,
  Clock,
  Radio,
  Wifi,
  Hospital,
  Cpu,
  ShieldCheck,
  Smartphone,
  ChevronRight,
  Terminal
} from 'lucide-react';

interface GoldenDemoPageProps {
  onNavigateToVerification: () => void;
}

export const GoldenDemoPage: React.FC<GoldenDemoPageProps> = ({ onNavigateToVerification }) => {
  const [steps, setSteps] = useState<DemoStep[]>(demoSimulator.steps);
  const [currentStepIdx, setCurrentStepIdx] = useState<number>(demoSimulator.getCurrentStep());
  const [isRunning, setIsRunning] = useState<boolean>(demoSimulator.isRunning());
  const [logs, setLogs] = useState<string[]>([
    '[SYSTEM] Disaster Demo Harness Initialized.',
    '[SYSTEM] Zones A, B, C seeded. Mock BLE radios listening on 2.4GHz ISM band.',
    '[SYSTEM] Ready to trigger Step 1 (Offline Report Creation).'
  ]);

  useEffect(() => {
    return demoSimulator.subscribe(() => {
      setSteps([...demoSimulator.steps]);
      setCurrentStepIdx(demoSimulator.getCurrentStep());
      setIsRunning(demoSimulator.isRunning());

      const activeOrLast = demoSimulator.steps[Math.max(0, demoSimulator.getCurrentStep() - 1)];
      if (activeOrLast && activeOrLast.timestamp) {
        setLogs((prev) => [
          ...prev,
          `[${activeOrLast.timestamp}] [STEP ${activeOrLast.stepNumber}] ${activeOrLast.logMessage}`
        ]);
      }
    });
  }, []);

  const handleNextStep = async () => {
    await demoSimulator.advanceStep();
  };

  const handleAutoPlay = () => {
    if (isRunning) {
      demoSimulator.stopAutoPlay();
    } else {
      demoSimulator.startAutoPlay(3000);
    }
  };

  const handleReset = () => {
    demoSimulator.reset();
    setLogs([
      '[SYSTEM] Demo reset to clean baseline.',
      '[SYSTEM] Zones A, B, C re-initialized. Ready for new demonstration.'
    ]);
  };

  const getActorIcon = (actor: string) => {
    switch (actor) {
      case 'PHONE_A_FAMILY': return Smartphone;
      case 'BLE_HOP': return Radio;
      case 'GATEWAY_SYNC': return Wifi;
      case 'HOSPITAL': return Hospital;
      case 'AI_ENGINE': return Cpu;
      case 'ADMIN_VERIFY': return ShieldCheck;
      default: return Clock;
    }
  };

  return (
    <div className="space-y-4">
      {/* Hero Control Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1 max-w-2xl">
          <div className="flex items-center space-x-2">
            <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-100 text-blue-800">
              HACKATHON JURY & EVALUATOR MODE
            </span>
            <span className="text-xs font-bold text-slate-900">5-Minute Golden Path</span>
          </div>
          <h2 className="text-lg font-black text-slate-900 tracking-tight">
            End-to-End Offline-to-Cloud Coordination Demo
          </h2>
          <p className="text-xs text-slate-500 leading-relaxed">
            Demonstrates the complete lifecycle: Offline Phone A report ➔ BLE volunteer courier relay ➔ Starlink Gateway sync ➔ AI correlation with hospital intake (91.2%) ➔ Lead Responder confirms ➔ Reunited status broadcast.
          </p>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          <button
            onClick={handleReset}
            className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold flex items-center space-x-1.5 transition-colors"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Reset Demo</span>
          </button>

          <button
            onClick={handleNextStep}
            disabled={currentStepIdx >= steps.length || isRunning}
            className="px-3.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-800 text-xs font-bold flex items-center space-x-1.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <span>Next Step</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </button>

          <button
            onClick={handleAutoPlay}
            className={`px-4 py-1.5 rounded-lg text-xs font-black text-white shadow-xs transition-colors flex items-center space-x-1.5 ${
              isRunning ? 'bg-amber-600 hover:bg-amber-700' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {isRunning ? (
              <>
                <Clock className="h-3.5 w-3.5 animate-spin" />
                <span>Pause Auto-Play</span>
              </>
            ) : (
              <>
                <Rocket className="h-3.5 w-3.5" />
                <span>Auto-Play Simulation</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 6-Step Visual Timeline */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {steps.map((step) => {
          const Icon = getActorIcon(step.actor);
          const isDone = step.status === 'COMPLETED';
          const isActive = step.status === 'ACTIVE';

          return (
            <div
              key={step.stepNumber}
              className={`p-4 rounded-xl border transition-all relative ${
                isActive
                  ? 'bg-blue-50/80 border-blue-500 shadow-sm'
                  : isDone
                  ? 'bg-white border-emerald-300 shadow-2xs'
                  : 'bg-white/60 border-slate-200 opacity-60'
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <div
                    className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      isActive
                        ? 'bg-blue-600 text-white'
                        : isDone
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {isDone ? <Check className="h-3.5 w-3.5" /> : step.stepNumber}
                  </div>
                  <span
                    className={`text-[10px] font-extrabold uppercase tracking-wider ${
                      isActive ? 'text-blue-700' : isDone ? 'text-emerald-700' : 'text-slate-400'
                    }`}
                  >
                    {isDone ? 'Completed' : isActive ? 'Active Now' : 'Pending'}
                  </span>
                </div>
                <Icon className={`h-4 w-4 ${isActive ? 'text-blue-600 animate-pulse' : isDone ? 'text-emerald-600' : 'text-slate-400'}`} />
              </div>

              <h4 className="font-extrabold text-xs text-slate-900 mb-1">{step.title}</h4>
              <p className="text-[11px] text-slate-600 leading-relaxed">{step.description}</p>

              {step.timestamp && (
                <div className="mt-2.5 pt-2 border-t border-slate-200 text-[10px] font-mono text-slate-500 flex justify-between">
                  <span>Timestamp:</span>
                  <span className="text-blue-700 font-bold">{step.timestamp}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Verification Direct Call-to-Action */}
      {currentStepIdx >= 5 && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-3.5 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center space-x-2.5">
            <span className="h-3 w-3 rounded-full bg-amber-500 animate-ping" />
            <div>
              <h4 className="text-xs font-extrabold text-amber-950">AI Candidate Ready in Queue!</h4>
              <p className="text-[11px] text-amber-800">
                Match #MATCH-4821 (Rahul Sharma ⇄ Rahool S., 91.2%) awaits Authorized Responder approval.
              </p>
            </div>
          </div>
          <button
            onClick={onNavigateToVerification}
            className="px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center space-x-1 shadow-xs transition-colors"
          >
            <span>Open Verification Queue</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Live Event Terminal / Console */}
      <div className="bg-slate-950 rounded-xl overflow-hidden border border-slate-800 shadow-md">
        <div className="bg-slate-900 px-4 py-2 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="flex space-x-1.5">
              <div className="h-2.5 w-2.5 rounded-full bg-[#ff5f56]" />
              <div className="h-2.5 w-2.5 rounded-full bg-[#ffbd2e]" />
              <div className="h-2.5 w-2.5 rounded-full bg-[#27c93f]" />
            </div>
            <span className="text-[11px] font-mono text-slate-400 ml-2 font-bold flex items-center gap-1">
              <Terminal size={12} className="text-emerald-400" />
              resqnet-telemetry-stream ~ zsh
            </span>
          </div>
          <span className="text-[10px] font-mono text-slate-500">Live P2P Packets</span>
        </div>

        <div className="p-3.5 font-mono text-xs text-slate-300 space-y-1.5 h-44 overflow-y-auto bg-black/50">
          {logs.map((log, index) => (
            <div key={index} className="flex leading-relaxed">
              <span className="text-emerald-400 mr-2 font-bold">❯</span>
              <span
                className={
                  log.includes('VERIFIED')
                    ? 'text-emerald-300 font-bold'
                    : log.includes('POTENTIAL MATCH')
                    ? 'text-amber-300 font-bold'
                    : 'text-slate-300'
                }
              >
                {log}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
