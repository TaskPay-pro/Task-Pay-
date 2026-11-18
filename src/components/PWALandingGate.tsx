import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  Download,
  Globe,
  HardDrive,
  Menu,
  Share,
  ShieldCheck,
  Smartphone,
  Sparkles,
  X,
  Zap,
} from 'lucide-react';
import { useI18n, type Lang } from '../data/i18n';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { TASKPAY_LOGO_SRC } from '../types/taskpay';

export const PWALandingGate: React.FC = () => {
  const { lang, setLang, t } = useI18n();
  const { isInstallable, isIOS, install } = usePWAInstall();

  const [menuOpen, setMenuOpen] = useState(false);
  const [phase, setPhase] = useState<'idle' | 'installing' | 'ready'>('idle');
  const [elapsedMs, setElapsedMs] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Randomized realistic package size per visit (12.4 MB – 19.9 MB)
  const dynamicFileSizeMb = useMemo(() => {
    const val = 12.4 + Math.random() * 7.5;
    return `${val.toFixed(1)} MB`;
  }, []);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const startFifteenSecondInstall = () => {
    if (phase === 'installing') return;
    setMenuOpen(false);
    setPhase('installing');
    setElapsedMs(0);

    const startTime = Date.now();
    const TOTAL_MS = 15000; // Exactly 15 seconds (3 steps × 5s each)

    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(async () => {
      const elapsed = Math.min(TOTAL_MS, Date.now() - startTime);
      setElapsedMs(elapsed);

      if (elapsed >= TOTAL_MS) {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        await install();
        setPhase('ready');
      }
    }, 100);
  };

  const handleFinalAddToHome = async () => {
    if (isInstallable) {
      await install();
    }
  };

  const step1Pct = Math.min(100, Math.max(0, (elapsedMs / 5000) * 100));
  const step2Pct = Math.min(100, Math.max(0, ((elapsedMs - 5000) / 5000) * 100));
  const step3Pct = Math.min(100, Math.max(0, ((elapsedMs - 10000) / 5000) * 100));
  const totalPct = Math.min(100, Math.round((elapsedMs / 15000) * 100));
  const remainingSec = Math.max(0, Math.ceil((15000 - elapsedMs) / 1000));

  const benefitLines = [
    t('gateFeature1'),
    t('gateFeature2'),
    t('gateFeature3'),
    t('gateFeature4'),
  ];

  const langOptions: { id: Lang; label: string }[] = [
    { id: 'en', label: 'English' },
    { id: 'ur', label: 'اردو (Urdu)' },
    { id: 'roman', label: 'Roman Urdu' },
  ];

  return (
    <div
      dir={lang === 'ur' ? 'rtl' : 'ltr'}
      className="min-h-[100dvh] w-full bg-[#050505] flex items-center justify-center sm:py-4"
    >
      <div className="relative flex flex-col w-full max-w-[430px] min-h-[100dvh] sm:min-h-[840px] sm:max-h-[94dvh] bg-[#050505] text-white sm:rounded-[2.5rem] sm:border-[3px] sm:border-[#00FF66]/35 sm:shadow-[0_0_65px_-15px_rgba(0,255,102,0.35)] overflow-hidden">
        {/* Clean Pre-Install Header with Official Logo & 3-Line Menu */}
        <header className="relative z-30 flex items-center justify-between gap-3 border-b border-[#00FF66]/20 bg-[#0b0e0c]/95 px-4 py-3 backdrop-blur-md">
          <div className="flex items-center gap-2.5 min-w-0">
            <img
              src={TASKPAY_LOGO_SRC}
              alt="TaskPay Official Logo"
              className="h-9 w-9 rounded-xl border border-[#00FF66]/60 object-cover shadow-[0_0_16px_rgba(0,255,102,0.35)] shrink-0"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-display text-base font-extrabold text-white truncate">
                  {t('appName')}
                </span>
                <span className="rounded-md bg-[#00FF66] px-1.5 py-0.5 font-mono text-[9px] font-extrabold text-[#050505]">
                  VIP
                </span>
              </div>
              <p className="text-[10px] font-semibold text-[#00FF66] truncate">{t('tagline')}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Open language menu"
            aria-expanded={menuOpen}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#00FF66]/35 bg-[#050505] text-[#00FF66] shadow-[0_0_14px_rgba(0,255,102,0.2)] cursor-pointer"
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>

          {/* 3-Line Menu Dropdown with Language Selector */}
          {menuOpen && (
            <div className="absolute end-4 top-14 z-40 w-60 rounded-2xl border border-[#00FF66]/45 bg-[#0b0e0c] p-3 shadow-[0_18px_40px_rgba(0,0,0,0.9)] animate-view-enter">
              <div className="flex items-center gap-2 border-b border-white/10 pb-2 text-xs font-extrabold text-[#00FF66]">
                <Globe className="h-4 w-4" aria-hidden="true" />
                <span>{t('language')}</span>
              </div>
              <div className="mt-2 space-y-1.5" dir="ltr">
                {langOptions.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      setLang(opt.id);
                      setMenuOpen(false);
                    }}
                    className={`flex min-h-[40px] w-full items-center justify-between rounded-xl px-3 text-xs font-bold cursor-pointer ${
                      lang === opt.id
                        ? 'vip-btn-neon'
                        : 'border border-white/10 bg-[#050505] text-white hover:border-[#00FF66]/40'
                    }`}
                  >
                    <span>{opt.label}</span>
                    {lang === opt.id && <CheckCircle2 className="h-4 w-4" aria-hidden="true" />}
                  </button>
                ))}
              </div>
            </div>
          )}
        </header>

        {/* Main Pre-Installation Body */}
        <main className="flex-1 overflow-y-auto mobile-scroll px-4 py-5 flex flex-col justify-between gap-4">
          <div className="space-y-4">
            {/* Official 3D Logo Showcase Card */}
            <section className="vip-hero-3d p-5 text-center space-y-3.5">
              <div className="mx-auto inline-flex rounded-3xl p-1.5 border-2 border-[#00FF66]/80 bg-[#050505] shadow-[0_0_38px_rgba(0,255,102,0.45)] animate-vip-logo">
                <img
                  src={TASKPAY_LOGO_SRC}
                  alt="TaskPay 3D Official App Icon"
                  className="h-24 w-24 rounded-2xl object-cover"
                />
              </div>

              <div>
                <div className="inline-flex items-center gap-1.5 rounded-lg bg-[#00FF66]/15 border border-[#00FF66]/40 px-2.5 py-1 text-[10px] font-extrabold text-[#00FF66]">
                  <Sparkles className="h-3 w-3" aria-hidden="true" />
                  <span>{t('gateBadgeTitle')}</span>
                </div>
                <h1 className="mt-2.5 font-display text-xl font-extrabold text-white text-balance leading-snug">
                  {t('gateHeadline')}
                </h1>
                <p className="mt-1.5 text-xs text-[#9cb3a5] leading-relaxed">
                  {t('gateSubheadline')}
                </p>
              </div>

              {/* Dynamic Randomized File Size & Build Info */}
              <div className="grid grid-cols-3 gap-2 pt-1 text-center" dir="ltr">
                <div className="rounded-xl border border-[#00FF66]/25 bg-[#050505] px-2 py-2">
                  <div className="flex items-center justify-center gap-1 text-[10px] text-[#9cb3a5]">
                    <HardDrive className="h-3 w-3 text-[#00FF66]" aria-hidden="true" />
                    <span>Size</span>
                  </div>
                  <div className="mt-0.5 font-mono text-xs font-extrabold text-[#00FF66] tabular">
                    {dynamicFileSizeMb}
                  </div>
                </div>
                <div className="rounded-xl border border-[#00FF66]/25 bg-[#050505] px-2 py-2">
                  <div className="flex items-center justify-center gap-1 text-[10px] text-[#9cb3a5]">
                    <Zap className="h-3 w-3 text-[#FFB800]" aria-hidden="true" />
                    <span>Speed</span>
                  </div>
                  <div className="mt-0.5 font-mono text-xs font-extrabold text-white">
                    Zero Lag
                  </div>
                </div>
                <div className="rounded-xl border border-[#00FF66]/25 bg-[#050505] px-2 py-2">
                  <div className="flex items-center justify-center gap-1 text-[10px] text-[#9cb3a5]">
                    <ShieldCheck className="h-3 w-3 text-[#00FF66]" aria-hidden="true" />
                    <span>Status</span>
                  </div>
                  <div className="mt-0.5 font-mono text-xs font-extrabold text-[#00FF66]">
                    Verified
                  </div>
                </div>
              </div>
            </section>

            {/* Exactly Four Short, Compelling, Punchy Feature Lines */}
            <section className="vip-card-3d p-4 space-y-2.5">
              {benefitLines.map((line, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-3 rounded-xl border border-[#00FF66]/20 bg-[#050505] px-3.5 py-2.5"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#00FF66]/15 font-mono text-xs font-extrabold text-[#00FF66]">
                    {idx + 1}
                  </span>
                  <p className="text-xs font-bold text-white leading-snug">{line}</p>
                </div>
              ))}
            </section>

            {/* Multi-Step 15-Second Installation Progress Panel */}
            {phase === 'installing' && (
              <section className="vip-card-3d border-[#00FF66]/55 p-4 space-y-3.5 animate-view-enter">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Smartphone className="h-4 w-4 text-[#00FF66] animate-pulse" />
                    <span className="font-display text-xs font-extrabold text-white">
                      {t('gateInstallingTitle')}
                    </span>
                  </div>
                  <span dir="ltr" className="font-mono text-xs font-extrabold text-[#00FF66] tabular">
                    {totalPct}% · {remainingSec}s
                  </span>
                </div>

                {/* 3 Progress Bars (5 Seconds Per Step = 15s Total) */}
                {[
                  { label: t('gateStep1Title'), pct: step1Pct, done: step1Pct >= 100 },
                  { label: t('gateStep2Title'), pct: step2Pct, done: step2Pct >= 100 },
                  { label: t('gateStep3Title'), pct: step3Pct, done: step3Pct >= 100 },
                ].map((step, sIdx) => (
                  <div key={sIdx} className="space-y-1">
                    <div className="flex items-center justify-between text-[11px] font-semibold">
                      <span className={step.pct > 0 ? 'text-white' : 'text-[#9cb3a5]'}>
                        {sIdx + 1}. {step.label}
                      </span>
                      <span dir="ltr" className="font-mono text-[10px] font-extrabold text-[#00FF66] tabular">
                        {Math.round(step.pct)}%
                      </span>
                    </div>
                    <div className="h-2.5 w-full overflow-hidden rounded-full bg-[#050505] border border-[#00FF66]/25">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#00c44f] to-[#00FF66] transition-[width] duration-100"
                        style={{ width: `${step.pct}%` }}
                      />
                    </div>
                  </div>
                ))}
              </section>
            )}

            {/* Ready for Home Screen Setup after 15 Seconds */}
            {phase === 'ready' && (
              <section className="vip-balance-white p-4 space-y-3 animate-view-enter">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="h-6 w-6 text-[#00993d] shrink-0" />
                  <div>
                    <h2 className="font-display text-sm font-extrabold text-[#050505]">
                      {t('gateReadyTitle')}
                    </h2>
                    <p className="text-[11px] font-semibold text-[#050505]/75">
                      {dynamicFileSizeMb} · 100% Verified PWA
                    </p>
                  </div>
                </div>

                <p className="rounded-xl bg-[#050505]/5 p-2.5 text-[11px] font-semibold text-[#050505] leading-relaxed">
                  {isIOS ? (
                    <span className="inline-flex items-start gap-1.5">
                      <Share className="h-4 w-4 shrink-0 mt-0.5 text-[#00993d]" />
                      <span>{t('gateGuideSafari')}</span>
                    </span>
                  ) : (
                    t('gateGuideChrome')
                  )}
                </p>

                {isInstallable ? (
                  <button
                    type="button"
                    onClick={handleFinalAddToHome}
                    className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-[#050505] px-4 py-3 text-xs font-extrabold text-[#00FF66] shadow-[0_10px_24px_rgba(0,255,102,0.35)] cursor-pointer"
                  >
                    <Download className="h-4 w-4 shrink-0" />
                    <span>{t('gateAddToHomeBtn')}</span>
                  </button>
                ) : (
                  <div className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-2xl bg-[#050505] px-4 py-2.5 text-center text-xs font-extrabold text-[#00FF66]">
                    <Smartphone className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>Open TaskPay from your Home Screen</span>
                  </div>
                )}
              </section>
            )}
          </div>

          {/* Primary Download / Install CTA */}
          {phase === 'idle' && (
            <div className="space-y-2.5 pt-1">
              <button
                type="button"
                onClick={startFifteenSecondInstall}
                className="flex min-h-[54px] w-full items-center justify-center gap-2.5 rounded-2xl vip-btn-neon px-5 py-3.5 text-sm font-extrabold transition-transform active:scale-[0.98] cursor-pointer"
              >
                <Download className="h-5 w-5 shrink-0" aria-hidden="true" />
                <span>
                  {t('gateInstallBtn')} ({dynamicFileSizeMb})
                </span>
              </button>
              <p className="text-center text-[10px] font-semibold text-[#9cb3a5]">
                {t('gatePackageSizeLabel')}: {dynamicFileSizeMb} · Android, iOS &amp; Desktop PWA
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};
