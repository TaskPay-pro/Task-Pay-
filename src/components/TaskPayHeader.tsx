import React from 'react';
import { useI18n } from '../data/i18n';
import { TASKPAY_LOGO_SRC } from '../types/taskpay';

export type TaskPayTab =
  | 'home'
  | 'tasks'
  | 'invite'
  | 'wallet'
  | 'support'
  | 'profile';

interface TaskPayHeaderProps {
  onNavigate: (tab: TaskPayTab) => void;
}

export const TaskPayHeader: React.FC<TaskPayHeaderProps> = ({
  onNavigate,
}) => {
  const { lang, setLang } = useI18n();

  return (
    <header className="sticky top-0 z-30 shrink-0 border-b border-[#00FF66]/20 bg-[#050505]/95 backdrop-blur-md">
      <div className="flex h-[56px] items-center justify-between px-3.5">
        <button
          type="button"
          onClick={() => onNavigate('home')}
          className="flex min-h-[44px] items-center gap-2.5 cursor-pointer shrink-0"
        >
          <div className="rounded-xl p-0.5 border border-[#00FF66]/60 shadow-[0_0_12px_rgba(0,255,102,0.35)]">
            <img
              src={TASKPAY_LOGO_SRC}
              alt="TaskPay"
              className="h-8 w-8 rounded-[10px] object-cover"
            />
          </div>
          <span className="font-display text-base font-extrabold tracking-tight text-white whitespace-nowrap">
            Task<span className="text-[#00FF66]">Pay</span>
          </span>
        </button>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* Instant Global Language Switcher */}
          <div
            dir="ltr"
            role="group"
            aria-label="Language Switcher"
            className="inline-flex items-center rounded-xl border border-[#00FF66]/25 bg-[#0b0e0c] p-0.5 text-xs font-extrabold"
          >
            <button
              type="button"
              onClick={() => setLang('en')}
              className={`min-h-[34px] rounded-lg px-2.5 transition-colors cursor-pointer whitespace-nowrap ${
                lang === 'en' ? 'bg-[#00FF66] text-[#050505]' : 'text-[#9cb3a5] hover:text-white'
              }`}
            >
              EN
            </button>
            <button
              type="button"
              onClick={() => setLang('ur')}
              className={`min-h-[34px] rounded-lg px-2.5 transition-colors cursor-pointer whitespace-nowrap ${
                lang === 'ur' ? 'bg-[#00FF66] text-[#050505]' : 'text-[#9cb3a5] hover:text-white'
              }`}
            >
              اردو
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
