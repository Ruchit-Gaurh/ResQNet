import React from 'react';
import {
  LayoutDashboard,
  UserCheck,
  CopyX,
  MapPin,
  Share2,
  Rocket,
  ShieldCheck
} from 'lucide-react';

export type NavTab = 'overview' | 'verification' | 'duplicates' | 'map' | 'network' | 'demo';

interface SidebarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  pendingMatchesCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  pendingMatchesCount
}) => {
  const navItems = [
    {
      id: 'overview' as NavTab,
      label: 'Command Overview',
      icon: LayoutDashboard,
      badge: null
    },
    {
      id: 'verification' as NavTab,
      label: 'Verification Queue',
      icon: UserCheck,
      badge: pendingMatchesCount > 0 ? pendingMatchesCount : null,
      badgeColor: 'bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse'
    },
    {
      id: 'duplicates' as NavTab,
      label: 'Duplicate Consolidation',
      icon: CopyX,
      badge: null
    },
    {
      id: 'map' as NavTab,
      label: 'Disaster Map (Privacy)',
      icon: MapPin,
      badge: null
    },
    {
      id: 'network' as NavTab,
      label: 'Mesh Network & Hops',
      icon: Share2,
      badge: null
    },
    {
      id: 'demo' as NavTab,
      label: '5-Min Golden Demo',
      icon: Rocket,
      highlight: true
    }
  ];

  return (
    <aside className="w-64 bg-[#0F172A] border-r border-slate-800 flex flex-col justify-between p-4 flex-shrink-0">
      <div className="space-y-6">
        <div>
          <div className="text-[11px] font-semibold tracking-wider text-slate-500 uppercase px-3 mb-2">
            Disaster Operations
          </div>
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onSelectTab(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    item.highlight
                      ? isActive
                        ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/30'
                        : 'bg-blue-950/40 hover:bg-blue-900/50 text-blue-300 border border-blue-600/30'
                      : isActive
                      ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30 font-semibold'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <Icon className={`h-4 w-4 ${isActive ? 'text-blue-400' : 'text-slate-400'}`} />
                    <span>{item.label}</span>
                  </div>
                  {item.badge !== null && (
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-mono font-bold ${
                        item.badgeColor || 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Operating Guardrails Notice */}
        <div className="bg-slate-900/90 border border-slate-800/80 rounded-lg p-3 text-xs space-y-2">
          <div className="flex items-center space-x-1.5 text-slate-300 font-semibold">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
            <span>Operational Guardrails</span>
          </div>
          <ul className="text-slate-400 space-y-1 text-[11px] leading-relaxed">
            <li>• AI suggests; only human authorizes</li>
            <li>• Minor photos & exact GPS geofenced</li>
            <li>• Original evidence provenance preserved</li>
          </ul>
        </div>
      </div>

      {/* Footer System Info */}
      <div className="pt-4 border-t border-slate-800/80 text-[11px] text-slate-500 space-y-1">
        <div className="flex justify-between">
          <span>Protocol:</span>
          <span className="font-mono text-slate-400">BLE-MESH-v2.1</span>
        </div>
        <div className="flex justify-between">
          <span>Encryption:</span>
          <span className="font-mono text-slate-400">Ed25519 Sealing</span>
        </div>
        <div className="flex justify-between">
          <span>Role:</span>
          <span className="font-mono text-emerald-400">TECH_LEAD</span>
        </div>
      </div>
    </aside>
  );
};
