import React, { useEffect, useState } from 'react';
import { Eye, EyeOff, Gift, KeyRound, Shield } from 'lucide-react';
import { useI18n } from '../../data/i18n';
import { TASK_PASSCODE, TASKPAY_LOGO_SRC } from '../../types/taskpay';
import { getSavedReferralCode } from '../../utils/referral';

interface AuthPanelProps {
  onRegister: (
    name: string,
    contact: string,
    password: string,
    inviteCode?: string
  ) => Promise<void>;
  onLogin: (contact: string, password: string) => Promise<unknown>;
}

const CONTACT_RE = /^(03\d{9}|[a-zA-Z0-9._%+-]+@gmail\.com)$/i;
const INVITE_RE = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z0-9]{4,16}$/;

export const AuthPanel: React.FC<AuthPanelProps> = ({ onRegister, onLogin }) => {
  const { t } = useI18n();
  const [mode, setMode] = useState<'register' | 'login'>('register');
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
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

    const normalizedContact = contact.trim().replace(/\s|-/g, '');
    if (!CONTACT_RE.test(normalizedContact)) {
      setError('Enter a valid Pakistani mobile (03XXXXXXXXX, 11 digits) or @gmail.com address.');
      return;
    }

    if (password.trim().length < 8) {
      setError('Password must be at least 8 characters.');
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
          normalizedContact,
          password.trim(),
          inviteCode.trim() || undefined
        );
      } else {
        await onLogin(normalizedContact, password.trim());
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
            {mode === 'register' ? t('signupBonusNote') : t('welcomeTitle')}
          </p>
        </div>
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
        )}

        <div>
          <label htmlFor="tp-contact" className="block text-xs font-semibold text-[#9cb3a5]">
            {t('contactLabel')}
          </label>
          <input
            id="tp-contact"
            type="text"
            dir="ltr"
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            placeholder="03001234567 or name@gmail.com"
            className="mt-1 h-11 w-full rounded-xl border border-[#00FF66]/25 bg-[#050505] px-3.5 text-sm text-white placeholder:text-[#9cb3a5]/45 focus:border-[#00FF66] focus:outline-none"
          />
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
