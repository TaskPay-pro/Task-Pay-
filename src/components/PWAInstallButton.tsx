import React, { useState } from 'react';
import { Download, Share, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  compact?: boolean;
  className?: string;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  compact = false,
  className = '',
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  const handleClick = async () => {
    if (isInstallable) {
      await install();
    } else {
      setShowGuide(true);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className={`inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-gold px-4 py-2 text-xs font-bold text-primary-foreground shadow-gold transition-transform active:scale-[0.97] whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${className}`}
      >
        <Download className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span>{compact ? 'Install' : 'Install App'}</span>
      </button>

      {showGuide && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="install-guide-title"
          onClick={() => setShowGuide(false)}
        >
          <div
            className="w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl border border-border bg-card p-6 pb-8 sm:pb-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-white/15 sm:hidden" />
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-surface text-primary">
                  <Smartphone className="h-5 w-5" aria-hidden="true" />
                </div>
                <div>
                  <h3 id="install-guide-title" className="font-display text-base font-bold">
                    Install Pak Earn App
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {isIOS ? 'iPhone & iPad (Safari)' : 'Add to Home Screen'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                aria-label="Close"
                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-muted-foreground hover:bg-surface hover:text-foreground cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {isIOS ? (
              <ol className="mt-5 space-y-3 text-sm text-foreground/90">
                <li className="flex items-start gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-surface text-xs font-bold text-primary">
                    1
                  </span>
                  <span>
                    Tap the <strong className="inline-flex items-center gap-1 text-primary"><Share className="inline h-3.5 w-3.5" /> Share</strong> button in your Safari toolbar.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-surface text-xs font-bold text-primary">
                    2
                  </span>
                  <span>
                    Scroll down and select <strong>Add to Home Screen</strong>.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-surface text-xs font-bold text-primary">
                    3
                  </span>
                  <span>Tap <strong>Add</strong> to launch Pak Earn like a native app.</span>
                </li>
              </ol>
            ) : (
              <ol className="mt-5 space-y-3 text-sm text-foreground/90">
                <li className="flex items-start gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-surface text-xs font-bold text-primary">
                    1
                  </span>
                  <span>Open your browser menu (three dots or address bar install icon).</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-surface text-xs font-bold text-primary">
                    2
                  </span>
                  <span>
                    Tap <strong>Install App</strong> or <strong>Add to Home Screen</strong>.
                  </span>
                </li>
              </ol>
            )}

            <button
              type="button"
              onClick={() => setShowGuide(false)}
              className="mt-6 flex min-h-[44px] w-full items-center justify-center rounded-xl bg-surface text-sm font-semibold text-foreground hover:bg-surface-raised cursor-pointer"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
};
