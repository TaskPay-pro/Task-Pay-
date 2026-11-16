import React from 'react';
import {
  Home,
  MailCheck,
  MessageSquare,
  Share2,
  User,
  Wallet,
} from 'lucide-react';
import { useI18n } from '../data/i18n';
import type { TaskPayTab } from './TaskPayHeader';

interface MobileBottomDockProps {
  activeTab: TaskPayTab;
  onNavigate: (tab: TaskPayTab) => void;
}

export const MobileBottomDock: React.FC<MobileBottomDockProps> = ({
  activeTab,
  onNavigate,
}) => {
  const { t } = useI18n();

  const items: {
    id: TaskPayTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }[] = [
    { id: 'home', label: t('navHome'), icon: Home },
    { id: 'tasks', label: t('navTasks'), icon: MailCheck },
    { id: 'invite', label: t('navInvite'), icon: Share2 },
    { id: 'wallet', label: t('navWallet'), icon: Wallet },
    { id: 'support', label: t('navSupport'), icon: MessageSquare },
    { id: 'profile', label: t('navProfile'), icon: User },
  ];

  return (
    <nav
      aria-label="Mobile Navigation"
      className="sticky bottom-0 z-40 shrink-0 border-t border-[#00FF66]/20 bg-[#050505]/95 backdrop-blur-lg pb-safe"
    >
      <div className="grid h-[58px] grid-cols-6 items-center px-1">
        {items.map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id)}
              className={`relative flex min-h-[44px] flex-col items-center justify-center rounded-xl transition-transform active:scale-95 cursor-pointer ${
                active ? 'text-[#00FF66]' : 'text-[#9cb3a5]'
              }`}
            >
              {active && (
                <span
                  aria-hidden="true"
                  className="absolute top-0.5 h-0.5 w-5 rounded-full bg-[#00FF66] shadow-[0_0_8px_#00FF66]"
                />
              )}
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="mt-1 text-[10px] font-semibold whitespace-nowrap truncate max-w-[54px]">
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
