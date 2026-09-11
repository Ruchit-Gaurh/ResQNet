import React, { useState, useEffect } from 'react';
import { demoSimulator, DemoStep } from '../services/demoSimulator';
import {
  Rocket,
  RotateCcw,
  CheckCircle2,
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
    '[SYSTEM] Zones A, B, C seeded. Mock BLE radios listening on 2.4GHz.',
    '[SYSTEM] Ready to trigger Step 1.'
  ]);

  useEffect(() => {
    return demoSimulator.subscribe(() => {
      setSteps([...demoSimulator.steps]);
      setCurrentStepIdx(demoSimulator.getCurrentStep());
      setIsRunning(demoSimulator.isRunning());

      // Append step log
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
      case 'PHONE_A_FAMILY':
        return Smartphone;
      case 'BLE_HOP':
        return Radio;
      case 'GATEWAY_SYNC':
        return Wifi;
      case 'HOSPITAL':
        return Hospital;
      case 'AI_ENGINE':
        return Cpu;
      case 'ADMIN_VERIFY':
        return ShieldCheck;
      default:
        return Clock;
    }
  };

  return (
    <div className="space-y-6">
      {/* Hero Control Card */}
      <div className="bg-gradient-to-r from-blue-950 via-indigo-950 to-slate-900 border border-blue-500/40 rounded-2xl p-6 shadow-2xl flex flex-wrap items-center justify-between gap-6">
        <div className="space-y-2 max-w-xl">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-blue-600 text-white shadow-md">
              HACKATHON JURY MODE
            </span>
            <span className="text-xs font-mono text-emerald-400 font-semibold">
              Full End-to-End Simulation
            </span>
          </div>
          <h2 className="text-2xl font-black text-white tracking-tight">
            The 5-Minute Golden Demo Experience
          </h2>
          <p className="text-xs text-blue-200/80 leading-relaxed">
            Demonstrates the complete journey: <strong>Offline Phone A</strong> generates a report → <strong>Phone B</strong> relays via BLE mesh → <strong>Starlink Gateway</strong> syncs to cloud → <strong>AI Engine</strong> matches hospital intake (91%) → <strong>Admin (Ruchit)</strong> verifies → <strong>Family Dashboard</strong> confirms "Located".
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-3">
          <button
            onClick={handleReset}
            className="px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold flex items-center space-x-2 transition-all"
          >
            <RotateCcw className="h-4 w-4" />
            <span>Reset</span>
          </button>

          <button
            onClick={handleNextStep}
            disabled={currentStepIdx >= steps.length || isRunning}
            className="px-5 py-2.5 rounded-xl border border-blue-500/50 bg-blue-950/60 hover:bg-blue-900 text-blue-200 text-xs font-bold flex items-center space-x-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <span>Next Step</span>
            <ChevronRight className="h-4 w-4" />
          </button>

          <button
            onClick={handleAutoPlay}
            className={`px-6 py-2.5 rounded-xl font-bold text-xs shadow-xl transition-all flex items-center space-x-2 ${
              isRunning
                ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-600/30'
                : 'bg-gradient-to-r from-blue-600 to-emerald-600 hover:from-blue-500 hover:to-emerald-500 text-white shadow-blue-600/30'
            }`}
          >
            {isRunning ? (
              <>
                <Clock className="h-4 w-4 animate-spin" />
                <span>Pause Auto-Play</span>
              </>
            ) : (
              <>
                <Rocket className="h-4 w-4" />
                <span>Auto-Play Golden Demo</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 6-Step Visual Timeline */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {steps.map((step, idx) => {
          const Icon = getActorIcon(step.actor);
          const isDone = step.status === 'COMPLETED';
          const isActive = step.status === 'ACTIVE';

          return (
            <div
              key={step.stepNumber}
              className={`p-5 rounded-2xl border transition-all relative overflow-hidden ${
                isActive
                  ? 'bg-blue-950/40 border-blue-500 shadow-xl shadow-blue-500/20 scale-[1.02]'
                  : isDone
                  ? 'bg-slate-900/90 border-emerald-500/40 text-slate-300'
                  : 'bg-slate-900/40 border-slate-800 text-slate-500'
              }`}
            >
              {/* Step Number Badge */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2">
                  <div
                    className={`h-7 w-7 rounded-lg flex items-center justify-center font-mono font-bold text-xs ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30'
                        : isDone
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {isDone ? <CheckCircle2 className="h-4 w-4" /> : step.stepNumber}
                  </div>
                  <span
                    className={`text-[11px] font-bold uppercase tracking-wider ${
                      isActive
                        ? 'text-blue-400'
                        : isDone
                        ? 'text-emerald-400'
                        : 'text-slate-500'
                    }`}
                  >
                    {isDone ? 'Completed' : isActive ? 'Active Now' : 'Pending'}
                  </span>
                </div>
                <Icon className={`h-5 w-5 ${isActive ? 'text-blue-400 animate-pulse' : isDone ? 'text-emerald-400' : 'text-slate-600'}`} />
              </div>

              {/* Title & Description */}
              <h3 className={`font-bold text-sm mb-1.5 ${isActive ? 'text-white' : isDone ? 'text-slate-100' : 'text-slate-400'}`}>
                {step.title}
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed mb-3">
                {step.description}
              </p>

              {/* Step Log Preview */}
              {step.timestamp && (
                <div className="mt-2 pt-2 border-t border-slate-800/80 text-[11px] font-mono text-slate-300 flex justify-between">
                  <span>Timestamp:</span>
                  <span className="text-blue-400">{step.timestamp}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Live Event Terminal / Console */}
      <div className="bg-[#0B1120] border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
        <div className="bg-slate-900 px-4 py-2.5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Terminal className="h-4 w-4 text-emerald-400" />
            <span className="text-xs font-mono font-bold text-slate-300">
              Live Mesh & Ingestion Telemetry Stream
            </span>
          </div>
          <span className="text-[10px] font-mono text-slate-500">Auto-scrolling</span>
        </div>

        <div className="p-4 font-mono text-xs text-slate-300 space-y-1.5 max-h-48 overflow-y-auto bg-black/40">
          {logs.map((log, index) => (
            <div key={index} className="leading-relaxed">
              <span className="text-emerald-500 mr-2">❯</span>
              <span className={log.includes('VERIFIED') ? 'text-emerald-300 font-bold' : log.includes('POTENTIAL MATCH') ? 'text-amber-300 font-bold' : 'text-slate-300'}>
                {log}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Verification Direct Link CTA */}
      {currentStepIdx >= 5 && (
        <div className="bg-amber-950/40 border border-amber-500/50 rounded-2xl p-5 flex items-center justify-between animate-in fade-in">
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-white flex items-center space-x-2">
              <span className="h-2.5 w-2.5 rounded-full bg-amber-400 animate-ping"></span>
              <span>Potential Match Ready for Review!</span>
            </h4>
            <p className="text-xs text-amber-200/80">
              Candidate #MATCH-4821 (Rahul Sharma ⇄ Rahool Sharma, 91.2%) is waiting in the Human Verification Queue.
            </p>
          </div>
          <button
            onClick={onNavigateToVerification}
            className="px-5 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-500 rounded-xl shadow-lg shadow-amber-600/30 transition-all flex items-center space-x-2"
          >
            <span>Open Verification Queue</span>
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
};
