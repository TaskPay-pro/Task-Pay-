import React, { useMemo, useState } from 'react';
import {
  Award,
  CheckCircle2,
  Clock,
  Crown,
  Download,
  Globe,
  History,
  ListChecks,
  LogOut,
  Receipt,
  Save,
  Smartphone,
  Trophy,
  XCircle,
} from 'lucide-react';
import type { User as FirebaseUser } from 'firebase/auth';
import { useI18n, type Lang } from '../../data/i18n';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import {
  formatBalanceK,
  TASKPAY_LOGO_SRC,
  type SyncStatePayload,
  type WithdrawalRecord,
} from '../../types/taskpay';
import { maskMobileNumber } from '../../utils/whatsappChatStore';
import { PaymentMethodLogo } from '../PaymentMethodLogo';
import { PWAInstallModal } from '../PWAInstallModal';
import { DigitalReceiptModal } from './ReferralsWithdrawalsView';

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

function getBadgeStyle(rankNumber: number) {
  if (rankNumber === 1) {
    return {
      cardClass:
        'border-[#FFB800] bg-gradient-to-r from-[#241c05] via-[#13180c] to-[#080d09] shadow-[0_8px_24px_-10px_rgba(255,184,0,0.6)]',
      pillClass: 'bg-gradient-to-br from-[#FFE066] to-[#FFB800] text-[#050505] shadow-[0_0_14px_rgba(255,184,0,0.65)]',
      tierTitle: 'Apex #1 Crown',
      isTop3: true,
    };
  }
  if (rankNumber === 2) {
    return {
      cardClass:
        'border-[#00FF66]/80 bg-gradient-to-r from-[#082213] via-[#0b1710] to-[#070a08] shadow-[0_8px_22px_-10px_rgba(0,255,102,0.5)]',
      pillClass: 'bg-gradient-to-br from-[#7dffb2] to-[#00FF66] text-[#050505] shadow-[0_0_12px_rgba(0,255,102,0.55)]',
      tierTitle: 'Emerald #2 Elite',
      isTop3: true,
    };
  }
  if (rankNumber === 3) {
    return {
      cardClass:
        'border-[#00FF66]/45 bg-gradient-to-r from-[#0e1c14] to-[#070a08] shadow-[0_6px_18px_-10px_rgba(0,255,102,0.35)]',
      pillClass: 'bg-[#00FF66]/20 border border-[#00FF66] text-[#00FF66]',
      tierTitle: 'Sovereign #3 VIP',
      isTop3: true,
    };
  }
  return {
    cardClass: 'border-white/10 bg-[#050505]/90',
    pillClass: 'bg-[#101512] border border-[#00FF66]/25 text-[#9cb3a5]',
    tierTitle: `VIP Tier #${rankNumber}`,
    isTop3: false,
  };
}

export const ProfileMenuView: React.FC<ProfileMenuViewProps> = ({
  data,
  firebaseUser,
  onUpdateProfile,
  onSyncGoogleCloud,
  onLogout,
  onRequireAuth,
}) => {
  const { lang, setLang, t } = useI18n();
  const { isInstallable, isInstalled, isIOS, install, unlockInstalledState } = usePWAInstall();

  const [name, setName] = useState(data.user?.name ?? '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [taskFilter, setTaskFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [wdFilter, setWdFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [historyFilter, setHistoryFilter] = useState<
    'all' | 'bonuses' | 'referrals' | 'tasks' | 'withdrawals'
  >('all');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);
  const [showInstallGuide, setShowInstallGuide] = useState(false);
  const [activeReceipt, setActiveReceipt] = useState<WithdrawalRecord | null>(null);

  // Preserve Firebase sync props intact without rendering visible sync text
  void firebaseUser;
  void onSyncGoogleCloud;

  const handleInstallWebApp = async () => {
    if (isInstallable) {
      const outcome = await install();
      if (outcome === 'accepted') {
        unlockInstalledState();
        return;
      }
    }
    setShowInstallGuide(true);
  };

  const filteredTasks = useMemo(() => {
    if (taskFilter === 'all') return data.tasks;
    return data.tasks.filter((item) => item.status === taskFilter);
  }, [data.tasks, taskFilter]);

  const filteredWithdrawals = useMemo(() => {
    if (wdFilter === 'all') return data.withdrawals;
    return data.withdrawals.filter((item) => item.status === wdFilter);
  }, [data.withdrawals, wdFilter]);

  const leaderboardList = useMemo(() => {
    if (data.leaderboard && data.leaderboard.length > 0) {
      return data.leaderboard;
    }
    if (data.user) {
      return [
        {
          uid: data.user.uid,
          name: data.user.name,
          maskedMobile: maskMobileNumber(data.user.contact),
          balance: data.user.balance,
          totalEarned: data.user.totalEarned,
          rankNumber: 1,
          vipTier: data.user.rank,
        },
      ];
    }
    return [];
  }, [data.leaderboard, data.user]);

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

  const langOptions: { id: Lang; label: string }[] = [
    { id: 'en', label: 'English' },
    { id: 'ur', label: 'اردو' },
    { id: 'roman', label: 'Roman Urdu' },
  ];

  return (
    <div className="space-y-4 animate-view-enter">
      {activeReceipt && (
        <DigitalReceiptModal
          receipt={activeReceipt}
          onClose={() => setActiveReceipt(null)}
        />
      )}

      <PWAInstallModal
        open={showInstallGuide}
        isIOS={isIOS}
        onClose={() => setShowInstallGuide(false)}
      />

      {/* Card 1: Top VIP Identity Card (Half-Masked Mobile Number) */}
      <section className="vip-hero-3d p-5">
        <div className="flex items-center justify-between gap-3">
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
              <p dir="ltr" className="text-xs font-mono text-[#00FF66] truncate">
                {data.user
                  ? `${data.user.uid} · ${maskMobileNumber(data.user.contact)}`
                  : 'Sign in to unlock VIP badges & history'}
              </p>
            </div>
          </div>

          {data.user && (
            <div className="shrink-0 text-end">
              <div className="text-[10px] text-[#9cb3a5]">{t('balance')}</div>
              <div dir="ltr" className="font-display text-sm font-extrabold text-[#00FF66] tabular">
                PKR {formatBalanceK(data.user.balance)}
              </div>
            </div>
          )}
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

      {/* Card 2: Language Switcher Card (English, Pure Urdu, Roman Urdu) */}
      <section className="vip-card-3d p-4 space-y-2.5">
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4 text-[#00FF66]" aria-hidden="true" />
          <h2 className="font-display text-xs font-extrabold text-white">{t('language')}</h2>
        </div>
        <div
          className="grid grid-cols-3 gap-1.5 rounded-xl bg-[#050505] p-1 border border-[#00FF66]/20"
          dir="ltr"
        >
          {langOptions.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setLang(opt.id)}
              className={`min-h-[38px] rounded-lg px-2 text-[11px] font-extrabold cursor-pointer truncate ${
                lang === opt.id ? 'vip-btn-neon' : 'text-[#9cb3a5] hover:text-white'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </section>

      {/* Card 3: Official TaskPay 3D Logo + PWA Install Card */}
      <section className="vip-card-3d p-5 space-y-4">
        <div className="flex flex-col items-center text-center gap-3">
          <div className="rounded-2xl p-1 border-2 border-[#00FF66]/75 bg-[#050505] shadow-[0_0_24px_rgba(0,255,102,0.35)]">
            <img
              src={TASKPAY_LOGO_SRC}
              alt="TaskPay Official 3D Logo"
              className="h-16 w-16 rounded-xl object-cover"
            />
          </div>

          <div className="space-y-1.5 text-xs leading-relaxed text-[#d7e5dc]" dir="ltr">
            <p className="font-semibold text-white">
              Experience lightning-fast performance, much better than the website.
            </p>
            <p>
              Enjoy a smoother and faster task experience on our official Web App.
            </p>
            <p className="font-semibold text-[#00FF66]">
              Click install below for instant access, zero lag, and direct home screen setup!
            </p>
          </div>
        </div>

        {!isInstalled ? (
          <button
            type="button"
            onClick={handleInstallWebApp}
            className="flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl vip-btn-neon px-4 py-2.5 text-xs font-extrabold cursor-pointer"
          >
            <Download className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>Download / Install App (PWA)</span>
          </button>
        ) : (
          <div className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-[#00FF66]/45 bg-[#00FF66]/10 px-4 py-2.5 text-xs font-extrabold text-[#00FF66]">
            <Smartphone className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>Official Web App Installed</span>
          </div>
        )}
      </section>

      {/* Card 4: Task Status Tracker (Moved from Manual Tasks Page) */}
      <section className="vip-card-3d p-5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ListChecks className="h-5 w-5 text-[#00FF66]" aria-hidden="true" />
            <h2 className="font-display text-base font-extrabold text-white">
              {t('taskTrackerTitle')} ({data.tasks.length})
            </h2>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-4 gap-1 rounded-xl bg-[#050505] p-1 border border-[#00FF66]/15">
          {(['all', 'pending', 'approved', 'rejected'] as const).map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setTaskFilter(status)}
              className={`min-h-[36px] rounded-lg px-1.5 text-[11px] font-bold transition-colors cursor-pointer truncate ${
                taskFilter === status ? 'vip-btn-neon' : 'text-[#9cb3a5] hover:text-white'
              }`}
            >
              {t(status)}
            </button>
          ))}
        </div>

        {filteredTasks.length === 0 ? (
          <p className="py-8 text-center text-xs text-[#9cb3a5]">{t('noRecords')}</p>
        ) : (
          <ul className="mt-3 divide-y divide-[#00FF66]/10 max-h-64 overflow-y-auto mobile-scroll">
            {filteredTasks.map((task) => (
              <li
                key={task.id}
                className="flex items-center justify-between gap-2.5 py-2.5 text-xs"
              >
                <div className="min-w-0">
                  <div dir="ltr" className="truncate font-semibold text-white">
                    {task.email}
                  </div>
                  <div className="mt-0.5 text-[10px] text-[#9cb3a5]">
                    {t(task.status)} · PKR {task.rewardRate} ·{' '}
                    {new Date(task.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {task.status === 'approved' && (
                    <>
                      <span dir="ltr" className="font-display text-xs font-extrabold tabular text-[#00FF66]">
                        +PKR {task.rewardRate}
                      </span>
                      <CheckCircle2 className="h-4 w-4 text-[#00FF66]" aria-hidden="true" />
                    </>
                  )}
                  {task.status === 'pending' && (
                    <span className="inline-flex items-center gap-1 font-bold text-[#FFB800]">
                      <Clock className="h-4 w-4" aria-hidden="true" />
                      <span>{t('pending')}</span>
                    </span>
                  )}
                  {task.status === 'rejected' && (
                    <span className="inline-flex items-center gap-1 font-bold text-[#FFB800]">
                      <XCircle className="h-4 w-4" aria-hidden="true" />
                      <span>{t('rejected')}</span>
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Card 5: Withdrawal Receipts & Tracker (Moved from Withdrawals Page) */}
      <section className="vip-card-3d p-5">
        <div className="flex items-center gap-2">
          <Receipt className="h-5 w-5 text-[#00FF66]" aria-hidden="true" />
          <h2 className="font-display text-base font-extrabold text-white">
            {t('withdrawHistory')} ({data.withdrawals.length})
          </h2>
        </div>

        <div className="mt-3 grid grid-cols-4 gap-1 rounded-xl bg-[#050505] p-1 border border-[#00FF66]/15">
          {(['all', 'pending', 'approved', 'rejected'] as const).map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setWdFilter(status)}
              className={`min-h-[36px] rounded-lg px-1.5 text-[11px] font-bold transition-colors cursor-pointer truncate ${
                wdFilter === status ? 'vip-btn-neon' : 'text-[#9cb3a5] hover:text-white'
              }`}
            >
              {t(status)}
            </button>
          ))}
        </div>

        {filteredWithdrawals.length === 0 ? (
          <p className="py-8 text-center text-xs text-[#9cb3a5]">{t('noRecords')}</p>
        ) : (
          <ul className="mt-3 divide-y divide-[#00FF66]/10 max-h-64 overflow-y-auto mobile-scroll">
            {filteredWithdrawals.map((wd) => (
              <li key={wd.id}>
                <button
                  type="button"
                  onClick={() => setActiveReceipt(wd)}
                  className="flex w-full items-center justify-between gap-2.5 py-2.5 text-start cursor-pointer hover:bg-white/[0.02] rounded-xl px-1"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <PaymentMethodLogo method={wd.method} size={30} />
                    <div className="min-w-0">
                      <div className="truncate text-xs font-semibold text-white">
                        {wd.method} · {wd.accountNumber}
                      </div>
                      <div className="mt-0.5 text-[10px] text-[#9cb3a5]">
                        {wd.accountHolder} ·{' '}
                        {wd.status === 'pending'
                          ? 'Processing'
                          : wd.status === 'approved'
                          ? 'Transfer successful'
                          : t(wd.status)}{' '}
                        · Tap for Receipt
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <span dir="ltr" className="font-display text-xs font-extrabold tabular text-white">
                      PKR {formatBalanceK(wd.amount)}
                    </span>
                    {wd.status === 'approved' && (
                      <CheckCircle2 className="h-4 w-4 text-[#00FF66]" aria-hidden="true" />
                    )}
                    {wd.status === 'pending' && (
                      <Clock className="h-4 w-4 text-[#FFB800]" aria-hidden="true" />
                    )}
                    {wd.status === 'rejected' && (
                      <XCircle className="h-4 w-4 text-[#FFB800]" aria-hidden="true" />
                    )}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Card 6: Live 3D VIP Ranking (Real-Time Database Leaderboard with Masked Mobile & Dynamic Badges) */}
      <section className="vip-card-3d p-5 space-y-3.5">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-[#FFB800]" aria-hidden="true" />
              <h2 className="font-display text-base font-extrabold text-white">
                {t('vipRankingTitle')}
              </h2>
            </div>
            <p className="mt-0.5 text-[11px] text-[#9cb3a5]">{t('liveLeaderboardSub')}</p>
          </div>
          <span className="rounded-lg bg-[#00FF66]/15 px-2 py-1 font-mono text-[10px] font-extrabold text-[#00FF66]">
            LIVE
          </span>
        </div>

        {leaderboardList.length === 0 ? (
          <p className="py-6 text-center text-xs text-[#9cb3a5]">{t('noLeaderboardUsers')}</p>
        ) : (
          <div className="space-y-2.5 max-h-96 overflow-y-auto mobile-scroll">
            {leaderboardList.map((entry) => {
              const badge = getBadgeStyle(entry.rankNumber);
              const isMe = data.user?.uid === entry.uid;
              return (
                <div
                  key={entry.uid}
                  className={`rounded-2xl border p-3 transition-transform ${badge.cardClass} ${
                    isMe ? 'ring-1 ring-[#00FF66]' : ''
                  }`}
                >
                  <div className="flex items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl font-mono text-xs font-extrabold ${badge.pillClass}`}
                      >
                        {badge.isTop3 ? (
                          <div className="flex flex-col items-center leading-none">
                            <Crown className="h-3 w-3 mb-0.5" aria-hidden="true" />
                            <span>#{entry.rankNumber}</span>
                          </div>
                        ) : (
                          <span>#{entry.rankNumber}</span>
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-display text-xs font-extrabold text-white truncate">
                            {entry.name}
                          </span>
                          {isMe && (
                            <span className="rounded bg-[#00FF66] px-1.5 py-0.5 font-mono text-[9px] font-extrabold text-[#050505]">
                              YOU
                            </span>
                          )}
                        </div>
                        <div dir="ltr" className="mt-0.5 font-mono text-[10px] text-[#9cb3a5] truncate">
                          {entry.uid} · {entry.maskedMobile}
                        </div>
                      </div>
                    </div>

                    <div className="text-end shrink-0">
                      <div
                        dir="ltr"
                        className={`font-display text-sm font-extrabold tabular ${
                          entry.rankNumber === 1 ? 'text-[#FFB800]' : 'text-[#00FF66]'
                        }`}
                      >
                        PKR {formatBalanceK(entry.balance)}
                      </div>
                      <div className="inline-flex items-center gap-1 text-[10px] font-bold text-[#9cb3a5]">
                        <Award className="h-3 w-3 text-[#00FF66]" aria-hidden="true" />
                        <span>{badge.tierTitle}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Card 7: Profile Settings (Changes apply ONLY on Save Changes click) */}
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

      {/* Card 8: Full History Logs (Bonuses, Referrals, Tasks, Withdrawals) */}
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
