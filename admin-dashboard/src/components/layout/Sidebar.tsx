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
  const navItems: { id: NavTab; label: string; icon: React.ElementType; highlight?: boolean }[] = [
    { id: 'overview', label: 'Command Overview', icon: LayoutDashboard },
    { id: 'verification', label: 'Verification Queue', icon: UserCheck },
    { id: 'duplicates', label: 'Duplicate Cases', icon: CopyX },
    { id: 'map', label: 'Disaster Map', icon: MapPin },
    { id: 'network', label: 'Mesh Network', icon: Share2 },
    { id: 'demo', label: '5-Min Golden Demo', icon: Rocket, highlight: true }
  ];

  return (
    <aside className="w-60 bg-[#0a0f1a] border-r border-slate-800/80 flex flex-col justify-between flex-shrink-0">
      <div className="py-5 flex flex-col gap-1 overflow-y-auto px-3">
        <div className="text-[10px] font-medium tracking-wider text-slate-500 uppercase px-3 mb-2">
          Operations
        </div>
        <nav className="flex flex-col gap-0.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition-all ${
                  item.highlight && !isActive
                    ? 'bg-blue-950/30 hover:bg-blue-900/30 text-blue-300 border border-blue-600/15'
                    : isActive
                    ? 'bg-slate-800/50 text-white border-l-[3px] border-blue-500 pl-[9px]'
                    : 'text-slate-400 hover:bg-slate-800/30 hover:text-slate-200 border-l-[3px] border-transparent pl-[9px]'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon size={15} className={isActive ? 'text-blue-400' : item.highlight ? 'text-blue-400' : 'text-slate-500'} />
                  <span className="font-medium">{item.label}</span>
                </div>

                {item.id === 'verification' && pendingMatchesCount > 0 && (
                  <span className="flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-amber-500/15 text-amber-400 text-[10px] font-bold">
                    {pendingMatchesCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-slate-800/60">
        <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-mono mb-2 px-1">
          <ShieldCheck size={11} className="text-emerald-500" />
          <span>AI suggests — Humans verify</span>
        </div>
        <div className="text-[10px] text-slate-600 font-mono flex flex-col gap-0.5 px-1">
          <div className="flex items-center justify-between">
            <span>Protocol</span>
            <span className="text-slate-500">BLE-MESH-v2.1</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Encryption</span>
            <span className="text-slate-500">Ed25519</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Role</span>
            <span className="text-emerald-500">TECH_LEAD</span>
          </div>
        </div>
      </div>
    </aside>
  );
};
