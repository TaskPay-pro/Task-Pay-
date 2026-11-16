import React from 'react';
import { AlertTriangle, CheckCircle2, X } from 'lucide-react';
import type { BannerNotification } from '../types/taskpay';

interface TopNotificationBannerProps {
  banner: BannerNotification | null;
  onDismiss: () => void;
}

export const TopNotificationBanner: React.FC<TopNotificationBannerProps> = ({
  banner,
  onDismiss,
}) => {
  if (!banner) return null;

  const isWarning = banner.tone === 'warning';

  return (
    <div
      role="status"
      aria-live="polite"
      className="px-3 pt-2.5 shrink-0 animate-view-enter"
    >
      <div
        className={`flex items-start justify-between gap-2.5 rounded-2xl px-3.5 py-2.5 ${
          isWarning
            ? 'border border-[#FFB800] bg-[#161206] text-[#FFB800] shadow-[0_8px_24px_-10px_rgba(255,184,0,0.45)]'
            : 'vip-banner-white'
        }`}
      >
        <div className="flex items-start gap-2.5 min-w-0">
          <div
            className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl ${
              isWarning
                ? 'bg-[#FFB800]/20 text-[#FFB800]'
                : 'bg-[#00FF66] text-[#050505] shadow-[0_4px_10px_rgba(0,255,102,0.4)]'
            }`}
          >
            {isWarning ? (
              <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            ) : (
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            )}
          </div>
          <div className="min-w-0">
            <div
              className={`font-display text-xs font-extrabold leading-tight ${
                isWarning ? 'text-[#FFB800]' : 'text-[#050505]'
              }`}
            >
              {banner.title}
            </div>
            <div
              className={`mt-0.5 text-[11px] font-medium leading-snug ${
                isWarning ? 'text-[#FFB800]/90' : 'text-[#14291d]'
              }`}
            >
              {banner.message}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss notification"
          className={`flex min-h-[32px] min-w-[32px] shrink-0 items-center justify-center rounded-lg cursor-pointer ${
            isWarning
              ? 'text-[#FFB800] hover:bg-[#FFB800]/15'
              : 'text-[#050505]/70 hover:bg-[#00FF66]/20'
          }`}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};
