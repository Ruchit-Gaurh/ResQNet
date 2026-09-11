import React, { useState, useEffect } from 'react';
import { Radio, RefreshCw, Bell, User, Server, Wifi, AlertTriangle, ShieldCheck, Download, Share2, Bookmark, MoreVertical, Maximize2 } from 'lucide-react';
import { apiService } from '../../services/api';

interface NavbarProps {
  onRefresh?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onRefresh }) => {
  const [isLive, setIsLive] = useState(apiService.isLive());
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const checkHealth = async () => {
    const health = await apiService.checkBackendHealth();
    setBackendOnline(health.online);
  };

  useEffect(() => {
    checkHealth();
    const timer = setInterval(checkHealth, 10000);
    const unsub = apiService.subscribe(() => {
      setIsLive(apiService.isLive());
      checkHealth();
    });
    return () => {
      clearInterval(timer);
      unsub();
    };
  }, []);

  const toggleBackendMode = () => {
    apiService.setMode(!isLive);
    checkHealth();
    if (onRefresh) onRefresh();
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await checkHealth();
    if (onRefresh) onRefresh();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  return (
    <header className="bg-[#1e293b] text-slate-200 border-b border-slate-700/80 px-4 py-2 flex items-center justify-between shadow-md select-none">
      {/* Left: macOS Window Controls & User Identity */}
      <div className="flex items-center gap-3">
        {/* macOS Window dots */}
        <div className="flex items-center gap-1.5 mr-2">
          <span className="w-3 h-3 rounded-full bg-[#ff5f56] border border-[#e0443e] cursor-pointer" />
          <span className="w-3 h-3 rounded-full bg-[#ffbd2e] border border-[#dea123] cursor-pointer" />
          <span className="w-3 h-3 rounded-full bg-[#27c93f] border border-[#1aab29] cursor-pointer" />
        </div>

        {/* User Avatar + Tag */}
        <div className="flex items-center gap-2 border-l border-slate-700 pl-3">
          <div className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold text-[10px] flex items-center justify-center shadow-xs">
            RG
          </div>
          <div className="text-xs">
            <span className="font-semibold text-white">Ruchit Gaurh</span>
            <span className="text-[10px] text-slate-400 ml-1.5 font-mono">Lead Tech • SIH 2026</span>
          </div>
        </div>
      </div>

      {/* Center: Window Title Banner matching user reference */}
      <div className="hidden md:flex items-center gap-2 text-xs font-bold tracking-wide text-slate-100">
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        <span>ResQNet — Disaster Missing-Person Coordination & Tactical Command Center | SIH 2026</span>
      </div>

      {/* Right: Actions & Connectivity Status */}
      <div className="flex items-center gap-2.5 text-xs">
        {/* Dual Mode Switcher */}
        <button
          onClick={toggleBackendMode}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-bold border transition-colors ${
            !isLive
              ? 'bg-slate-800 border-slate-600 text-slate-300 hover:bg-slate-700'
              : backendOnline
              ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300 shadow-xs'
              : 'bg-amber-950/60 border-amber-500/50 text-amber-300'
          }`}
          title="Toggle Mock vs Live Backend"
        >
          <Server size={12} />
          <span>
            {!isLive
              ? 'Mock Engine'
              : backendOnline
              ? 'Live API :4000 (Connected)'
              : 'Live API :4000 (Connecting...)'}
          </span>
        </button>

        {/* Mesh Status */}
        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800/80 border border-slate-700 text-slate-300 text-[11px]">
          <Wifi size={12} className="text-emerald-400" />
          <span>BLE P2P: <strong>18 Relays</strong></span>
        </div>

        {/* Refresh */}
        <button
          onClick={handleRefresh}
          className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors"
          title="Refresh Telemetry"
        >
          <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
        </button>

        <button className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors" title="Export Situation Report">
          <Download size={14} />
        </button>

        <button className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors" title="Share Dispatch">
          <Share2 size={14} />
        </button>

        <button className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors">
          <MoreVertical size={14} />
        </button>
      </div>
    </header>
  );
};
