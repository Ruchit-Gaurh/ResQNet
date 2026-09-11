import React from 'react';
import { MapPin, UserCheck, Share2, CopyX, Rocket, Activity, CheckCircle2 } from 'lucide-react';
import { NavTab } from './Sidebar';

interface CommandTabBarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  pendingMatchesCount: number;
}

export const CommandTabBar: React.FC<CommandTabBarProps> = ({
  currentTab,
  onSelectTab,
  pendingMatchesCount
}) => {
  const tabs: { id: NavTab; label: string; icon: React.ElementType; badge?: string | number | null }[] = [
    {
      id: 'map',
      label: 'Disaster Map (Live Overlays)',
      icon: MapPin
    },
    {
      id: 'verification',
      label: 'Human Verification Queue',
      icon: UserCheck,
      badge: pendingMatchesCount > 0 ? `${pendingMatchesCount} Candidates` : null
    },
    {
      id: 'network',
      label: 'BLE P2P Mesh Topology (4 Hops)',
      icon: Share2
    },
    {
      id: 'duplicates',
      label: 'Canonical Case Consolidation',
      icon: CopyX
    },
    {
      id: 'demo',
      label: '5-Min Golden Demo (Jury Mode)',
      icon: Rocket,
      badge: 'Interactive'
    }
  ];

  return (
    <div className="bg-[#1e293b] rounded-lg p-1 mb-3 flex items-center gap-1 overflow-x-auto shadow-sm select-none border border-slate-700">
      {tabs.map((t) => {
        const Icon = t.icon;
        const isActive = currentTab === t.id;

        return (
          <button
            key={t.id}
            onClick={() => onSelectTab(t.id)}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-bold transition-all whitespace-nowrap ${
              isActive
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Icon size={14} className={isActive ? 'text-white' : 'text-slate-400'} />
            <span>{t.label}</span>
            {t.badge && (
              <span
                className={`text-[10px] font-extrabold px-1.5 py-0.2 rounded-full ${
                  isActive
                    ? 'bg-white text-blue-700'
                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                }`}
              >
                {t.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};
