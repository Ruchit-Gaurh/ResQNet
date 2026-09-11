import React, { useState, useEffect } from 'react';
import { Radio, ShieldAlert, Database, RefreshCw, UserCheck } from 'lucide-react';
import { apiService } from '../../services/api';

interface NavbarProps {
  onRefresh?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onRefresh }) => {
  const [isLive, setIsLive] = useState(apiService.isLive());
  const [activeAlert] = useState('CRITICAL: Flood Surge in Zone A — Mesh Relays Prioritized');

  useEffect(() => {
    return apiService.subscribe(() => {
      setIsLive(apiService.isLive());
    });
  }, []);

  const toggleBackendMode = () => {
    apiService.setMode(!isLive);
  };

  return (
    <header className="sticky top-0 z-40 bg-[#0F172A]/95 backdrop-blur border-b border-slate-800 px-6 py-3">
      <div className="flex items-center justify-between">
        {/* Left: Brand & Emergency Tag */}
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2.5">
            <div className="h-9 w-9 rounded-lg bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Radio className="h-5 w-5 text-white animate-pulse" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-extrabold text-lg tracking-wider text-white">RESQNET</span>
                <span className="text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded bg-blue-900/60 text-blue-300 border border-blue-700/50">
                  COMMAND CENTER
                </span>
              </div>
              <p className="text-xs text-slate-400">Offline-First Disaster Coordination</p>
            </div>
          </div>

          <div className="hidden lg:flex items-center space-x-2 bg-red-950/40 border border-red-500/30 rounded-md px-3 py-1 text-xs text-red-300">
            <ShieldAlert className="h-3.5 w-3.5 text-red-400 flex-shrink-0" />
            <span className="truncate max-w-xs">{activeAlert}</span>
          </div>
        </div>

        {/* Right: Connectivity Status & Controls */}
        <div className="flex items-center space-x-3">
          {/* Dual Mode Switcher */}
          <button
            onClick={toggleBackendMode}
            className={`flex items-center space-x-1.5 text-xs px-2.5 py-1.5 rounded-md border transition-colors ${
              isLive
                ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300 hover:bg-emerald-900/50'
                : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-700/80'
            }`}
            title="Toggle between mock seed data and live PostgreSQL backend"
          >
            <Database className="h-3.5 w-3.5" />
            <span>{isLive ? 'Live API (Port 4000)' : 'Mock Demo Mode'}</span>
          </button>

          {/* Network Health Indicator */}
          <div className="hidden sm:flex items-center space-x-2 bg-slate-900/90 border border-slate-800 rounded-md px-3 py-1.5 text-xs">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-slate-300 font-medium">Mesh Connected</span>
            <span className="text-slate-500">|</span>
            <span className="text-blue-400 font-mono">18 Nodes</span>
          </div>

          {/* Reset / Refresh */}
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="p-1.5 text-slate-400 hover:text-white rounded-md hover:bg-slate-800 transition-colors"
              title="Refresh Dashboard Data"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          )}

          {/* Operator Profile */}
          <div className="flex items-center space-x-2 pl-2 border-l border-slate-800">
            <div className="h-8 w-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-blue-400 font-bold text-xs">
              RG
            </div>
            <div className="hidden md:block text-left">
              <div className="text-xs font-semibold text-slate-200">Ruchit Gaurh</div>
              <div className="text-[10px] text-emerald-400 font-mono flex items-center space-x-1">
                <UserCheck className="h-2.5 w-2.5" />
                <span>Lead Responder / Tech Lead</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
