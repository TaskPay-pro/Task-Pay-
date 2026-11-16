import React, { useMemo, useState } from 'react';
import { Award, Cloud, Globe, History, LogOut, Save } from 'lucide-react';
import type { User as FirebaseUser } from 'firebase/auth';
import { useI18n } from '../../data/i18n';
import {
  TASKPAY_LOGO_SRC,
  type SyncStatePayload,
  type VIPRank,
} from '../../types/taskpay';

interface ProfileMenuViewProps {
  data: SyncStatePayload;
  firebaseUser: FirebaseUser | null;
  onUpdateProfile: (
    name: string,
    currentPassword?: string,
    newPassword?: string
  ) => Promise<unknown>;
  onSyncGoogleCloud: () => Promise<unknown>;
  onLogout: () => void;
  onRequireAuth: () => void;
}

const VIP_TIERS: { badgeNo: string; rank: VIPRank; threshold: string }[] = [
  { badgeNo: '#1', rank: 'Diamond VIP', threshold: 'PKR 5,000+' },
  { badgeNo: '#2', rank: 'Emerald VIP', threshold: 'PKR 2,000+' },
  { badgeNo: '#3', rank: 'Gold VIP', threshold: 'PKR 600+' },
  { badgeNo: '#4', rank: 'Silver VIP', threshold: 'PKR 150+' },
  { badgeNo: '#5', rank: 'Bronze VIP', threshold: 'PKR 0+' },
];

export const ProfileMenuView: React.FC<ProfileMenuViewProps> = ({
  data,
  firebaseUser,
  onUpdateProfile,
  onSyncGoogleCloud,
  onLogout,
  onRequireAuth,
}) => {
  const { lang, setLang, t } = useI18n();
  const [name, setName] = useState(data.user?.name ?? '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [historyFilter, setHistoryFilter] = useState<'all' | 'bonuses' | 'referrals' | 'tasks' | 'withdrawals'>('all');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  const combinedHistory = useMemo(() => {
    const items: {
      id: string;
      category: 'bonuses' | 'referrals' | 'tasks' | 'withdrawals';
      title: string;
      status: string;
      amount: number;
      isAmber: boolean;
      createdAt: string;
    }[] = [];

    for (const h of data.userHistory) {
      if (h.kind === 'signup_bonus' || h.kind === 'bonus') {
        items.push({
          id: h.id,
          category: 'bonuses',
          title: h.label,
          status: 'Credited',
          amount: h.amount,
          isAmber: false,
          createdAt: h.createdAt,
        });
      } else if (h.kind === 'referral') {
        items.push({
          id: h.id,
          category: 'referrals',
          title: h.label,
          status: 'Credited',
          amount: h.amount,
          isAmber: false,
          createdAt: h.createdAt,
        });
      }
    }

    for (const task of data.tasks) {
      items.push({
        id: task.id,
        category: 'tasks',
        title: `Email · ${task.email}`,
        status: t(task.status),
        amount: task.rewardRate,
        isAmber: task.status !== 'approved',
        createdAt: task.createdAt,
      });
    }

    for (const wd of data.withdrawals) {
      items.push({
        id: wd.id,
        category: 'withdrawals',
        title: `${wd.method} · ${wd.accountNumber}`,
        status: t(wd.status),
        amount: wd.amount,
        isAmber: wd.status !== 'approved',
        createdAt: wd.createdAt,
      });
    }

    items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    if (historyFilter === 'all') return items;
    return items.filter((item) => item.category === historyFilter);
  }, [data.userHistory, data.tasks, data.withdrawals, historyFilter, t]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    if (!data.user) {
      onRequireAuth();
      return;
    }
    if (name.trim().length < 2 || name.trim().length > 40) {
      setFeedback({ ok: false, msg: 'Name must be 2 to 40 characters.' });
      return;
    }
    if (newPassword) {
      if (!currentPassword) {
        setFeedback({ ok: false, msg: 'Enter your old password to confirm password change.' });
        return;
      }
      if (newPassword.length < 8) {
        setFeedback({ ok: false, msg: 'New password must be at least 8 characters.' });
        return;
      }
    }

    setBusy(true);
    try {
      await onUpdateProfile(
        name.trim(),
        currentPassword || undefined,
        newPassword || undefined
      );
      setCurrentPassword('');
      setNewPassword('');
      setFeedback({ ok: true, msg: 'Changes saved and synced.' });
    } catch (err) {
      setFeedback({ ok: false, msg: err instanceof Error ? err.message : 'Update failed.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4 animate-view-enter">
      {/* Top VIP Identity Card */}
      <section className="vip-hero-3d p-5">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="rounded-2xl p-0.5 border border-[#00FF66]/60 shrink-0">
            <img
              src={TASKPAY_LOGO_SRC}
              alt="TaskPay VIP"
              className="h-14 w-14 rounded-[14px] object-cover"
            />
          </div>
          <div className="min-w-0">
            <h1 className="font-display text-lg font-extrabold text-white truncate">
              {data.user ? data.user.name : 'Guest Member'}
            </h1>
            <p className="text-xs text-[#9cb3a5] truncate">
              {data.user
                ? `${data.user.uid} · ${data.user.contact}`
                : 'Sign in to unlock VIP badges & history'}
            </p>
          </div>
        </div>

        <div className="mt-4">
          {data.user ? (
            <button
              type="button"
              onClick={onLogout}
              className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-[#FFB800]/50 bg-[#FFB800]/10 px-3 text-xs font-bold text-[#FFB800] cursor-pointer"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              <span>{t('signOut')}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onRequireAuth}
              className="flex min-h-[44px] w-full items-center justify-center rounded-xl vip-btn-neon px-3 text-xs font-extrabold cursor-pointer"
            >
              {t('login')}
            </button>
          )}
        </div>
      </section>

      {/* Language & Cloud Sync Card */}
      <section className="vip-card-3d p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-[#00FF66]" aria-hidden="true" />
            <span className="font-display text-xs font-bold text-white">{t('language')}</span>
          </div>
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-[#050505] p-1 border border-[#00FF66]/20" dir="ltr">
            <button
              type="button"
              onClick={() => setLang('en')}
              className={`min-h-[36px] rounded-lg px-3 text-xs font-bold cursor-pointer ${
                lang === 'en' ? 'vip-btn-neon' : 'text-[#9cb3a5]'
              }`}
            >
              English
            </button>
            <button
              type="button"
              onClick={() => setLang('ur')}
              className={`min-h-[36px] rounded-lg px-3 text-xs font-bold cursor-pointer ${
                lang === 'ur' ? 'vip-btn-neon' : 'text-[#9cb3a5]'
              }`}
            >
              اردو
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onSyncGoogleCloud()}
          className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl vip-btn-surface px-4 py-2 text-xs font-bold text-[#00FF66] cursor-pointer"
        >
          <Cloud className="h-4 w-4" aria-hidden="true" />
          <span className="truncate">
            {firebaseUser ? `${t('googleSynced')} (${firebaseUser.email})` : t('googleSync')}
          </span>
        </button>
      </section>

      {/* 3D VIP Ranking Badges (#1, #2, #3...) */}
      <section className="vip-card-3d p-5">
        <div className="flex items-center gap-2">
          <Award className="h-5 w-5 text-[#00FF66]" aria-hidden="true" />
          <h2 className="font-display text-base font-extrabold text-white">3D VIP Ranking Badges</h2>
        </div>

        <div className="mt-3.5 grid grid-cols-2 gap-2.5">
          {VIP_TIERS.map((tier) => {
            const isCurrent = data.user?.rank === tier.rank;
            return (
              <div
                key={tier.rank}
                className={`rounded-2xl p-3.5 text-center transition-transform ${
                  isCurrent
                    ? 'vip-badge-3d border-[#00FF66] col-span-2'
                    : 'border border-white/10 bg-[#050505]/85'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <span
                    className={`inline-flex h-7 min-w-[28px] items-center justify-center rounded-lg px-1.5 font-mono text-xs font-extrabold ${
                      isCurrent ? 'bg-[#00FF66] text-[#050505]' : 'bg-[#101512] text-[#00FF66]'
                    }`}
                  >
                    {tier.badgeNo}
                  </span>
                  <Award
                    className={`h-5 w-5 ${isCurrent ? 'text-[#00FF66]' : 'text-white/70'}`}
                    aria-hidden="true"
                  />
                </div>
                <div className="mt-2 font-display text-xs font-extrabold text-white">
                  {tier.rank}
                </div>
                <div className="mt-0.5 text-[11px] font-mono text-[#00FF66] tabular">
                  {tier.threshold}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Profile Settings (Changes apply ONLY on Save Changes click) */}
      <section className="vip-card-3d p-5">
        <h2 className="font-display text-base font-extrabold text-white">{t('profileTitle')}</h2>
        <form onSubmit={handleSave} className="mt-3.5 space-y-3.5">
          <div>
            <label htmlFor="prof-name" className="block text-xs font-semibold text-[#9cb3a5]">
              {t('editName')}
            </label>
            <input
              id="prof-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 h-11 w-full rounded-xl border border-[#00FF66]/25 bg-[#050505] px-3.5 text-sm text-white focus:border-[#00FF66] focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="prof-cur-pwd" className="block text-xs font-semibold text-[#9cb3a5]">
              {t('currentPassword')}
            </label>
            <input
              id="prof-cur-pwd"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Enter old password"
              className="mt-1 h-11 w-full rounded-xl border border-[#00FF66]/25 bg-[#050505] px-3.5 text-sm text-white focus:border-[#00FF66] focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="prof-new-pwd" className="block text-xs font-semibold text-[#9cb3a5]">
              {t('newPassword')}
            </label>
            <input
              id="prof-new-pwd"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Minimum 8 characters"
              className="mt-1 h-11 w-full rounded-xl border border-[#00FF66]/25 bg-[#050505] px-3.5 text-sm text-white focus:border-[#00FF66] focus:outline-none"
            />
          </div>

          {feedback && (
            <div
              className={`rounded-xl border px-3 py-2.5 text-xs font-semibold ${
                feedback.ok
                  ? 'border-[#00FF66]/45 bg-[#00FF66]/10 text-[#00FF66]'
                  : 'border-[#FFB800]/60 bg-[#FFB800]/10 text-[#FFB800]'
              }`}
            >
              {feedback.msg}
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl vip-btn-neon px-5 py-3 text-sm font-extrabold cursor-pointer"
          >
            <Save className="h-4 w-4" aria-hidden="true" />
            <span>{busy ? '...' : t('saveProfile')}</span>
          </button>
        </form>
      </section>

      {/* Full History Logs (Bonuses, Referrals, Tasks, Withdrawals) */}
      <section className="vip-card-3d p-5">
        <div className="flex items-center gap-2">
          <History className="h-5 w-5 text-[#00FF66]" aria-hidden="true" />
          <h2 className="font-display text-base font-extrabold text-white">{t('fullHistory')}</h2>
        </div>

        <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1">
          {(['all', 'bonuses', 'referrals', 'tasks', 'withdrawals'] as const).map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setHistoryFilter(cat)}
              className={`min-h-[34px] shrink-0 rounded-xl px-3 text-[11px] font-bold capitalize cursor-pointer ${
                historyFilter === cat ? 'vip-btn-neon' : 'vip-btn-surface text-[#9cb3a5]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {combinedHistory.length === 0 ? (
          <p className="py-8 text-center text-xs text-[#9cb3a5]">{t('noRecords')}</p>
        ) : (
          <ul className="mt-3 divide-y divide-[#00FF66]/10 max-h-80 overflow-y-auto mobile-scroll">
            {combinedHistory.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-2.5 py-2.5 text-xs">
                <div className="min-w-0">
                  <div dir="ltr" className="truncate font-semibold text-white">
                    {item.title}
                  </div>
                  <div className="text-[10px] text-[#9cb3a5]">
                    {item.status} · {new Date(item.createdAt).toLocaleString()}
                  </div>
                </div>
                <span
                  dir="ltr"
                  className={`shrink-0 font-display font-extrabold tabular ${
                    item.isAmber ? 'text-[#FFB800]' : 'text-[#00FF66]'
                  }`}
                >
                  PKR {item.amount.toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};
