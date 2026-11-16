import React, { useEffect, useState } from 'react';
import { Phone, PhoneOff, Video } from 'lucide-react';
import { useI18n } from '../data/i18n';
import type { ActiveCallSession } from '../types/taskpay';

interface PersistentCallBannerProps {
  call: ActiveCallSession | null;
  onAccept: (callId: string) => void;
  onEnd: (callId: string) => void;
}

export const PersistentCallBanner: React.FC<PersistentCallBannerProps> = ({
  call,
  onAccept,
  onEnd,
}) => {
  const { t } = useI18n();
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (!call || call.status !== 'accepted') {
      setSeconds(0);
      return;
    }
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [call?.id, call?.status]);

  if (!call || call.status === 'ended') return null;

  const mins = String(Math.floor(seconds / 60)).padStart(2, '0');
  const secs = String(seconds % 60).padStart(2, '0');

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="sticky top-14 md:top-16 z-40 mx-auto max-w-6xl px-4 pt-2"
    >
      <div className="vip-hero-3d flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-[#00FF66]/50">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#00FF66]/15 text-[#00FF66] border border-[#00FF66]/40">
            {call.callType === 'video' ? (
              <Video className="h-5 w-5" aria-hidden="true" />
            ) : (
              <Phone className="h-5 w-5" aria-hidden="true" />
            )}
          </div>
          <div className="min-w-0">
            <div className="font-display text-sm font-bold text-[#f4fff7] truncate">
              {call.status === 'ringing' ? t('incomingCall') : t('activeCall')}
            </div>
            <div className="text-xs text-[#00FF66] tabular">
              {call.startedBy} ·{' '}
              {call.callType === 'video' ? 'HD Video' : 'Voice'}
              {call.status === 'accepted' ? ` · ${mins}:${secs}` : ''}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {call.status === 'ringing' && (
            <button
              type="button"
              onClick={() => onAccept(call.id)}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl vip-btn-neon px-4 py-2 text-xs font-extrabold cursor-pointer whitespace-nowrap"
            >
              <Phone className="h-4 w-4" aria-hidden="true" />
              <span>{t('acceptCall')}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => onEnd(call.id)}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-[#FFB800]/50 bg-[#FFB800]/15 px-4 py-2 text-xs font-bold text-[#FFB800] hover:bg-[#FFB800]/25 cursor-pointer whitespace-nowrap"
          >
            <PhoneOff className="h-4 w-4" aria-hidden="true" />
            <span>{t('declineCall')}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
