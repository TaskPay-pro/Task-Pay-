import React from 'react';
import { Download, Share, Smartphone, X } from 'lucide-react';
import { TASKPAY_LOGO_SRC } from '../types/taskpay';

interface PWAInstallModalProps {
  open: boolean;
  isIOS: boolean;
  onClose: () => void;
}

export const PWAInstallModal: React.FC<PWAInstallModalProps> = ({
  open,
  isIOS,
  onClose,
}) => {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-3"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[390px] rounded-3xl border-2 border-[#00FF66]/60 bg-[#0b0e0c] p-5 text-white shadow-[0_20px_50px_rgba(0,255,102,0.35)] space-y-4"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <img
              src={TASKPAY_LOGO_SRC}
              alt="TaskPay Web App"
              className="h-11 w-11 rounded-xl border border-[#00FF66]/60 object-cover"
            />
            <div>
              <h3 className="font-display text-sm font-extrabold text-white">
                Install TaskPay Official Web App
              </h3>
              <p className="text-[11px] text-[#00FF66]">
                {isIOS ? 'iPhone & iPad (Safari)' : 'Add to Home Screen (PWA)'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 text-[#9cb3a5] cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {isIOS ? (
          <ol className="space-y-2.5 text-xs text-[#d7e5dc]">
            <li className="flex items-start gap-2.5 rounded-xl bg-[#050505] p-2.5 border border-white/10">
              <Smartphone className="h-4 w-4 shrink-0 text-[#00FF66] mt-0.5" />
              <span>
                Tap the{' '}
                <strong className="inline-flex items-center gap-1 text-[#00FF66]">
                  <Share className="h-3 w-3" /> Share
                </strong>{' '}
                button in Safari.
              </span>
            </li>
            <li className="flex items-start gap-2.5 rounded-xl bg-[#050505] p-2.5 border border-white/10">
              <Download className="h-4 w-4 shrink-0 text-[#00FF66] mt-0.5" />
              <span>
                Select <strong>Add to Home Screen</strong>, then tap <strong>Add</strong>.
              </span>
            </li>
          </ol>
        ) : (
          <ol className="space-y-2.5 text-xs text-[#d7e5dc]">
            <li className="flex items-start gap-2.5 rounded-xl bg-[#050505] p-2.5 border border-white/10">
              <Smartphone className="h-4 w-4 shrink-0 text-[#00FF66] mt-0.5" />
              <span>
                Open your browser menu (three dots ⋮ or address bar install icon).
              </span>
            </li>
            <li className="flex items-start gap-2.5 rounded-xl bg-[#050505] p-2.5 border border-white/10">
              <Download className="h-4 w-4 shrink-0 text-[#00FF66] mt-0.5" />
              <span>
                Tap <strong>Install App</strong> or <strong>Add to Home Screen</strong>.
              </span>
            </li>
          </ol>
        )}

        <button
          type="button"
          onClick={onClose}
          className="flex min-h-[44px] w-full items-center justify-center rounded-xl vip-btn-neon text-xs font-extrabold cursor-pointer"
        >
          Got it
        </button>
      </div>
    </div>
  );
};
