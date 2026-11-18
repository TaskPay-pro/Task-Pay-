import React, { useEffect, useState } from 'react';
import { Camera, Eye, EyeOff, Gift, KeyRound, Lock, Phone, Shield } from 'lucide-react';
import { useI18n } from '../../data/i18n';
import { TASK_PASSCODE, TASKPAY_LOGO_SRC } from '../../types/taskpay';
import { getSavedReferralCode } from '../../utils/referral';
import { lockRegisteredUserProfile, STRICT_MOBILE_RE } from '../../utils/whatsappChatStore';

interface AuthPanelProps {
  onRegister: (
    name: string,
    contact: string,
    password: string,
    inviteCode?: string
  ) => Promise<void>;
  onLogin: (contact: string, password: string) => Promise<unknown>;
}

const INVITE_RE = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z0-9]{4,16}$/;

function readImageDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(new Error('Could not read profile photo.'));
    reader.readAsDataURL(file);
  });
}

export const AuthPanel: React.FC<AuthPanelProps> = ({ onRegister, onLogin }) => {
  const { t } = useI18n();
  const [mode, setMode] = useState<'register' | 'login'>('register');
  const [name, setName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [avatarDataUrl, setAvatarDataUrl] = useState<string | undefined>(undefined);
  const [inviteCode, setInviteCode] = useState(() => getSavedReferralCode() || '');
  const [autoDetectedRef, setAutoDetectedRef] = useState<string | null>(() =>
    getSavedReferralCode()
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const saved = getSavedReferralCode();
    if (saved) {
      setInviteCode((prev) => prev || saved);
      setAutoDetectedRef((prev) => prev || saved);
    }
  }, [mode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const normalizedMobile = mobileNumber.trim().replace(/[\s-]/g, '');
    if (!STRICT_MOBILE_RE.test(normalizedMobile)) {
      setError('Enter a valid 11-digit Pakistani mobile number starting with 03 (e.g. 03001234567).');
      return;
    }

    if (mode === 'register' && password.trim().length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (mode === 'login' && password.trim().length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    if (mode === 'register') {
      if (name.trim().length < 2 || name.trim().length > 40) {
        setError('Full name must be 2 to 40 characters.');
        return;
      }
      if (inviteCode.trim() && !INVITE_RE.test(inviteCode.trim())) {
        setError('Invite code must combine letters and numbers (e.g. TP1001).');
        return;
      }
    }

    setBusy(true);
    try {
      if (mode === 'register') {
        await onRegister(
          name.trim(),
          normalizedMobile,
          password.trim(),
          inviteCode.trim() || undefined
        );
        // Permanently lock the registered name and gallery profile photo
        lockRegisteredUserProfile(normalizedMobile, name.trim(), avatarDataUrl);
      } else {
        await onLogin(normalizedMobile, password.trim());
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="vip-card-3d p-5">
      <div className="flex items-center gap-3">
        <div className="rounded-2xl p-0.5 border border-[#00FF66]/60 shadow-[0_0_16px_rgba(0,255,102,0.3)]">
          <img
            src={TASKPAY_LOGO_SRC}
            alt="TaskPay VIP"
            className="h-12 w-12 rounded-[14px] object-cover"
          />
        </div>
        <div>
          <h2 className="font-display text-lg font-extrabold text-white">
            {mode === 'register' ? t('register') : t('login')}
          </h2>
          <p className="text-[11px] text-[#9cb3a5]">
            {mode === 'register'
              ? 'Mobile-Only VIP Registration (03XXXXXXXXX)'
              : 'Sign in strictly with your 03XXXXXXXXX mobile number'}
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-1.5 rounded-2xl border border-[#00FF66]/20 bg-[#050505] p-1">
        <button
          type="button"
          onClick={() => {
            setMode('register');
            setError(null);
          }}
          className={`min-h-[40px] rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
            mode === 'register' ? 'vip-btn-neon' : 'text-[#9cb3a5] hover:text-white'
          }`}
        >
          {t('register')}
        </button>
        <button
          type="button"
          onClick={() => {
            setMode('login');
            setError(null);
          }}
          className={`min-h-[40px] rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
            mode === 'login' ? 'vip-btn-neon' : 'text-[#9cb3a5] hover:text-white'
          }`}
        >
          {t('login')}
        </button>
      </div>

      {mode === 'register' && (
        <div className="mt-4 space-y-2">
          <div className="flex items-center gap-2.5 rounded-xl border border-[#00FF66]/35 bg-[#00FF66]/10 px-3 py-2 text-xs font-semibold text-[#00FF66]">
            <Gift className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{t('signupBonusNote')}</span>
          </div>
          <div className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-[#101512] px-3 py-2 text-xs text-[#9cb3a5]">
            <KeyRound className="h-4 w-4 shrink-0 text-[#00FF66]" aria-hidden="true" />
            <span>
              Task Passcode: <strong className="font-mono text-[#00FF66]">{TASK_PASSCODE}</strong>
            </span>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
        {mode === 'register' && (
          <>
            {/* Gallery Profile Photo Upload (Permanently Locked after Registration) */}
            <div className="rounded-2xl border border-[#00FF66]/20 bg-[#050505] p-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                {avatarDataUrl ? (
                  <img
                    src={avatarDataUrl}
                    alt="Profile preview"
                    className="h-12 w-12 shrink-0 rounded-full object-cover border border-[#00FF66]"
                  />
                ) : (
                  <div className="h-12 w-12 shrink-0 rounded-full border border-[#00FF66]/35 bg-[#101512] flex items-center justify-center text-[#00FF66]">
                    <Camera className="h-5 w-5" aria-hidden="true" />
                  </div>
                )}
                <div className="min-w-0">
                  <div className="text-xs font-bold text-white truncate">Profile Photo (Gallery)</div>
                  <div className="flex items-center gap-1 text-[10px] text-[#FFB800]">
                    <Lock className="h-3 w-3 shrink-0" aria-hidden="true" />
                    <span>Name & photo lock permanently</span>
                  </div>
                </div>
              </div>
              <label className="inline-flex min-h-[38px] shrink-0 items-center gap-1.5 rounded-xl vip-btn-surface px-3 text-[11px] font-bold text-[#00FF66] cursor-pointer">
                <Camera className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{avatarDataUrl ? 'Selected' : 'Upload'}</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (ev) => {
                    const f = ev.target.files?.[0];
                    if (f) {
                      try {
                        setAvatarDataUrl(await readImageDataUrl(f));
                      } catch {
                        // ignore
                      }
                    }
                  }}
                />
              </label>
            </div>

            <div>
              <label htmlFor="tp-name" className="block text-xs font-semibold text-[#9cb3a5]">
                {t('fullName')}
              </label>
              <input
                id="tp-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your full name"
                className="mt-1 h-11 w-full rounded-xl border border-[#00FF66]/25 bg-[#050505] px-3.5 text-sm text-white placeholder:text-[#9cb3a5]/45 focus:border-[#00FF66] focus:outline-none"
              />
            </div>
          </>
        )}

        <div>
          <label htmlFor="tp-mobile" className="block text-xs font-semibold text-[#9cb3a5]">
            Mobile Number (11 digits starting with 03)
          </label>
          <div className="relative mt-1">
            <Phone
              className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#00FF66]"
              aria-hidden="true"
            />
            <input
              id="tp-mobile"
              type="tel"
              dir="ltr"
              inputMode="numeric"
              maxLength={11}
              value={mobileNumber}
              onChange={(e) => setMobileNumber(e.target.value.replace(/[^\d]/g, '').slice(0, 11))}
              placeholder="03001234567"
              className="h-11 w-full rounded-xl border border-[#00FF66]/25 bg-[#050505] ps-10 pe-3.5 font-mono text-sm text-white placeholder:text-[#9cb3a5]/45 focus:border-[#00FF66] focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label htmlFor="tp-pwd" className="block text-xs font-semibold text-[#9cb3a5]">
            {t('passwordLabel')}
          </label>
          <div className="relative mt-1">
            <input
              id="tp-pwd"
              type={showPwd ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimum 8 characters"
              className="h-11 w-full rounded-xl border border-[#00FF66]/25 bg-[#050505] ps-3.5 pe-11 text-sm text-white placeholder:text-[#9cb3a5]/45 focus:border-[#00FF66] focus:outline-none"
            />
            <button
              type="button"
              onClick={() => setShowPwd((v) => !v)}
              aria-label={showPwd ? 'Hide password' : 'Show password'}
              className="absolute end-1 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-lg text-[#9cb3a5] hover:text-[#00FF66] cursor-pointer"
            >
              {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {mode === 'register' && (
          <div>
            <label htmlFor="tp-inv" className="block text-xs font-semibold text-[#9cb3a5]">
              {t('inviteCodeOpt')}
            </label>
            <input
              id="tp-inv"
              type="text"
              dir="ltr"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              placeholder="TP1001"
              className="mt-1 h-11 w-full rounded-xl border border-[#00FF66]/25 bg-[#050505] px-3.5 text-sm uppercase text-white placeholder:text-[#9cb3a5]/45 focus:border-[#00FF66] focus:outline-none"
            />
            {autoDetectedRef && inviteCode.trim().toUpperCase() === autoDetectedRef && (
              <p className="mt-1.5 text-[11px] font-semibold text-[#00FF66]">
                Referral code {autoDetectedRef} automatically detected and applied.
              </p>
            )}
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="flex items-center gap-2 rounded-xl border border-[#FFB800]/60 bg-[#FFB800]/10 px-3 py-2.5 text-xs font-semibold text-[#FFB800]"
          >
            <Shield className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={busy}
          className="flex min-h-[48px] w-full items-center justify-center rounded-2xl vip-btn-neon px-5 py-3 text-sm font-extrabold transition-transform active:scale-[0.98] disabled:opacity-60 cursor-pointer"
        >
          {busy ? '...' : mode === 'register' ? t('register') : t('login')}
        </button>
      </form>

      {/* Clear Login / Register Toggle Below */}
      <div className="mt-4 border-t border-white/10 pt-4 text-center">
        <p className="text-xs text-[#9cb3a5]">
          {mode === 'register' ? 'Already have a TaskPay VIP account?' : 'New to TaskPay 3D VIP?'}
        </p>
        <button
          type="button"
          onClick={() => {
            setMode(mode === 'register' ? 'login' : 'register');
            setError(null);
          }}
          className="mt-2 flex min-h-[44px] w-full items-center justify-center rounded-xl vip-btn-surface px-4 text-xs font-extrabold text-[#00FF66] cursor-pointer"
        >
          {mode === 'register' ? `${t('login')} →` : `${t('register')} →`}
        </button>
      </div>
    </section>
  );
};
