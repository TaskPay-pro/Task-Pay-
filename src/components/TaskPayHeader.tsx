import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Download, Globe, Menu, Smartphone, X } from 'lucide-react';
import { useI18n, type Lang } from '../data/i18n';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { TASKPAY_LOGO_SRC } from '../types/taskpay';
import { PWAInstallModal } from './PWAInstallModal';

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
  const { lang, setLang, t } = useI18n();
  const { isInstallable, isInstalled, isIOS, install, unlockInstalledState } = usePWAInstall();
  const [menuOpen, setMenuOpen] = useState(false);
  const [showInstallGuide, setShowInstallGuide] = useState(false);
  const menuContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handlePointerDown = (e: MouseEvent) => {
      if (menuContainerRef.current && !menuContainerRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [menuOpen]);

  const handleInstallClick = async () => {
    setMenuOpen(false);
    if (isInstallable) {
      const outcome = await install();
      if (outcome === 'accepted') {
        unlockInstalledState();
        return;
      }
    }
    setShowInstallGuide(true);
  };

  const langOptions: { id: Lang; label: string }[] = [
    { id: 'en', label: 'English' },
    { id: 'ur', label: 'اردو' },
    { id: 'roman', label: 'Roman Urdu' },
  ];

  return (
    <>
      <PWAInstallModal
        open={showInstallGuide}
        isIOS={isIOS}
        onClose={() => setShowInstallGuide(false)}
      />

      <header
        ref={menuContainerRef}
        className="sticky top-0 z-30 shrink-0 border-b border-[#00FF66]/20 bg-[#050505]/95 backdrop-blur-md"
      >
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

            {/* Menu Box Toggle Button */}
            <button
              type="button"
              onClick={() => setMenuOpen((prev) => !prev)}
              aria-label="Open menu box"
              aria-expanded={menuOpen}
              className="flex h-[38px] w-[38px] items-center justify-center rounded-xl border border-[#00FF66]/35 bg-[#0b0e0c] text-[#00FF66] shadow-[0_0_12px_rgba(0,255,102,0.18)] cursor-pointer"
            >
              {menuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Header Menu Box Dropdown with PWA Web App Button */}
        {menuOpen && (
          <div
            role="menu"
            className="absolute end-3.5 top-[54px] z-40 w-[280px] rounded-2xl border border-[#00FF66]/45 bg-[#0b0e0c] p-3.5 shadow-[0_20px_45px_rgba(0,0,0,0.92)] space-y-3 animate-view-enter"
          >
            {/* PWA Web App Box inside Menu */}
            <div className="rounded-xl border border-[#00FF66]/25 bg-[#050505] p-3 space-y-2.5">
              <div className="flex items-center gap-2.5">
                <img
                  src={TASKPAY_LOGO_SRC}
                  alt="TaskPay Official 3D App"
                  className="h-10 w-10 rounded-xl border border-[#00FF66]/60 object-cover shrink-0"
                />
                <div className="min-w-0">
                  <div className="font-display text-xs font-extrabold text-white truncate">
                    TaskPay Official Web App
                  </div>
                  <div className="text-[10px] text-[#9cb3a5] leading-snug">
                    Optional PWA · Zero lag &amp; instant access
                  </div>
                </div>
              </div>

              {!isInstalled ? (
                <button
                  type="button"
                  onClick={handleInstallClick}
                  className="flex min-h-[40px] w-full items-center justify-center gap-2 rounded-xl vip-btn-neon px-3 py-2 text-xs font-extrabold cursor-pointer"
                >
                  <Download className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>Download / Install App (PWA)</span>
                </button>
              ) : (
                <div className="flex min-h-[36px] w-full items-center justify-center gap-1.5 rounded-xl border border-[#00FF66]/40 bg-[#00FF66]/10 px-3 text-[11px] font-bold text-[#00FF66]">
                  <Smartphone className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>Web App Installed</span>
                </div>
              )}
            </div>

            {/* Language Selector */}
            <div>
              <div className="flex items-center gap-1.5 text-[11px] font-extrabold text-[#00FF66] mb-1.5">
                <Globe className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{t('language')}</span>
              </div>
              <div className="grid grid-cols-3 gap-1" dir="ltr">
                {langOptions.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      setLang(opt.id);
                      setMenuOpen(false);
                    }}
                    className={`flex min-h-[34px] items-center justify-center gap-1 rounded-lg px-1.5 text-[10px] font-bold cursor-pointer ${
                      lang === opt.id
                        ? 'vip-btn-neon'
                        : 'border border-white/10 bg-[#050505] text-[#d7e5dc] hover:border-[#00FF66]/40'
                    }`}
                  >
                    <span className="truncate">{opt.label}</span>
                    {lang === opt.id && <CheckCircle2 className="h-3 w-3 shrink-0" aria-hidden="true" />}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </header>
    </>
  );
};

