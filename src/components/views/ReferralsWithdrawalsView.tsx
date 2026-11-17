import React, { useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  MessageCircle,
  Receipt,
  Users,
  Wallet,
  X,
  XCircle,
} from 'lucide-react';
import { useI18n } from '../../data/i18n';
import type {
  PaymentMethod,
  SyncStatePayload,
  WithdrawalRecord,
} from '../../types/taskpay';
import { PaymentMethodDropdown } from '../PaymentMethodDropdown';
import { PaymentMethodLogo } from '../PaymentMethodLogo';

interface ReferralsWithdrawalsViewProps {
  mode: 'invite' | 'wallet';
  data: SyncStatePayload;
  onRequestWithdrawal: (
    method: PaymentMethod,
    accountHolder: string,
    accountNumber: string,
    amount: number,
    cnic?: string
  ) => Promise<WithdrawalRecord | undefined>;
  onRequireAuth: () => void;
}

const DigitalReceiptModal: React.FC<{
  receipt: WithdrawalRecord;
  onClose: () => void;
}> = ({ receipt, onClose }) => {
  const { t } = useI18n();
  const isApproved = receipt.status === 'approved';
  const isPending = receipt.status === 'pending';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('digitalReceipt')}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[390px] rounded-3xl border-2 border-[#00FF66] bg-[#FFFFFF] p-5 text-[#050505] shadow-[0_20px_50px_rgba(0,255,102,0.45)] animate-view-enter"
      >
        <div className="flex items-center justify-between gap-2 border-b border-[#050505]/10 pb-3">
          <div className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-[#00993d]" aria-hidden="true" />
            <h3 className="font-display text-base font-extrabold">{t('digitalReceipt')}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close receipt"
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#050505]/5 text-[#050505] cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <PaymentMethodLogo method={receipt.method} size={36} />
            <div>
              <div className="font-display text-sm font-extrabold">{receipt.method}</div>
              <div className="font-mono text-[11px] text-[#050505]/65">{receipt.id}</div>
            </div>
          </div>
          <div className="text-end">
            <div dir="ltr" className="font-display text-xl font-extrabold tabular text-[#00993d]">
              PKR {receipt.amount.toLocaleString()}
            </div>
            <div
              className={`inline-flex items-center justify-end gap-1 text-[11px] font-extrabold uppercase ${
                isApproved ? 'text-[#00993d]' : 'text-[#b37d00]'
              }`}
            >
              {isApproved ? (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5 text-[#00993d]" aria-hidden="true" />
                  <span>Transfer successful</span>
                </>
              ) : isPending ? (
                <span>Processing</span>
              ) : (
                <span>{t(receipt.status)}</span>
              )}
            </div>
          </div>
        </div>

        {/* Status Tracker Steps */}
        <div className="mt-4 rounded-2xl bg-[#050505] p-3.5 text-white">
          <div className="text-[10px] font-bold uppercase tracking-wider text-[#9cb3a5]">
            Live Status Tracker
          </div>
          <div className="mt-2.5 grid grid-cols-3 gap-2 text-center text-[11px] font-bold">
            <div className="rounded-xl bg-[#00FF66]/15 border border-[#00FF66] py-2 text-[#00FF66]">
              1. Submitted
            </div>
            <div
              className={`rounded-xl border py-2 ${
                isPending
                  ? 'border-[#FFB800] bg-[#FFB800]/15 text-[#FFB800]'
                  : 'border-[#00FF66] bg-[#00FF66]/15 text-[#00FF66]'
              }`}
            >
              2. Admin Review
            </div>
            <div
              className={`rounded-xl border py-2 ${
                isApproved
                  ? 'border-[#00FF66] bg-[#00FF66] text-[#050505]'
                  : receipt.status === 'rejected'
                  ? 'border-[#FFB800] bg-[#FFB800]/20 text-[#FFB800]'
                  : 'border-white/15 text-[#9cb3a5]'
              }`}
            >
              {receipt.status === 'rejected' ? '3. Refunded' : '3. Paid'}
            </div>
          </div>
        </div>

        <dl className="mt-4 space-y-2 text-xs">
          <div className="flex justify-between gap-2 border-b border-[#050505]/10 pb-1.5">
            <dt className="text-[#050505]/60">Account Holder</dt>
            <dd className="font-bold text-end">{receipt.accountHolder}</dd>
          </div>
          <div className="flex justify-between gap-2 border-b border-[#050505]/10 pb-1.5">
            <dt className="text-[#050505]/60">Mobile / Account</dt>
            <dd dir="ltr" className="font-mono font-bold">
              {receipt.accountNumber}
            </dd>
          </div>
          {receipt.cnic && (
            <div className="flex justify-between gap-2 border-b border-[#050505]/10 pb-1.5">
              <dt className="text-[#050505]/60">CNIC</dt>
              <dd dir="ltr" className="font-mono font-bold">
                {receipt.cnic}
              </dd>
            </div>
          )}
          <div className="flex justify-between gap-2">
            <dt className="text-[#050505]/60">Timestamp</dt>
            <dd className="font-semibold text-end">
              {new Date(receipt.createdAt).toLocaleString()}
            </dd>
          </div>
        </dl>

        <button
          type="button"
          onClick={onClose}
          className="mt-5 flex min-h-[44px] w-full items-center justify-center rounded-xl bg-[#050505] text-xs font-extrabold text-[#00FF66] cursor-pointer"
        >
          Done
        </button>
      </div>
    </div>
  );
};

export const ReferralsWithdrawalsView: React.FC<ReferralsWithdrawalsViewProps> = ({
  mode,
  data,
  onRequestWithdrawal,
  onRequireAuth,
}) => {
  const { t } = useI18n();
  const [copied, setCopied] = useState<'code' | 'link' | null>(null);

  const [method, setMethod] = useState<PaymentMethod>('JazzCash');
  const [accountHolder, setAccountHolder] = useState(data.user?.name ?? '');
  const [accountNumber, setAccountNumber] = useState(data.user?.contact ?? '');
  const [cnic, setCnic] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);
  const [activeReceipt, setActiveReceipt] = useState<WithdrawalRecord | null>(null);

  const inviteCode = data.user?.inviteCode ?? 'TP1001';
  const referralLink =
    typeof window !== 'undefined'
      ? `${window.location.origin}/?ref=${inviteCode}`
      : `https://taskpay.app/?ref=${inviteCode}`;

  const handleCopy = async (val: string, field: 'code' | 'link') => {
    try {
      await navigator.clipboard.writeText(val);
    } catch {
      // Ignore clipboard error
    }
    setCopied(field);
    setTimeout(() => setCopied(null), 1600);
  };

  if (mode === 'invite') {
    const whatsappHref = `https://wa.me/?text=${encodeURIComponent(
      `Join TaskPay VIP using invite code ${inviteCode} and earn PKR 20 bonus: ${referralLink}`
    )}`;

    return (
      <div className="space-y-4 animate-view-enter">
        <section className="vip-hero-3d p-5">
          <h1 className="font-display text-lg font-extrabold text-white">
            {t('referralTitle')}
          </h1>
          <p className="mt-1.5 text-xs text-[#9cb3a5] leading-relaxed">{t('referralSub')}</p>

          <div className="mt-4 space-y-3">
            <div>
              <div className="text-[11px] font-semibold text-[#9cb3a5]">{t('yourCode')}</div>
              <div className="mt-1 flex items-center justify-between gap-2 rounded-2xl border border-[#00FF66]/25 bg-[#050505] px-3.5 py-2">
                <span dir="ltr" className="font-mono text-base font-extrabold text-[#00FF66]">
                  {inviteCode}
                </span>
                <button
                  type="button"
                  onClick={() => handleCopy(inviteCode, 'code')}
                  className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl vip-btn-surface px-3 py-1.5 text-xs font-bold cursor-pointer"
                >
                  {copied === 'code' ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-[#00FF66]" aria-hidden="true" />
                      <span className="text-[#00FF66]">{t('copied')}</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5 text-[#00FF66]" aria-hidden="true" />
                      <span>{t('copyCode')}</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <div>
              <div className="text-[11px] font-semibold text-[#9cb3a5]">{t('yourLink')}</div>
              <div className="mt-1 flex items-center justify-between gap-2 rounded-2xl border border-[#00FF66]/25 bg-[#050505] px-3.5 py-2">
                <span dir="ltr" className="truncate text-xs text-white">
                  {referralLink}
                </span>
                <button
                  type="button"
                  onClick={() => handleCopy(referralLink, 'link')}
                  className="inline-flex min-h-[38px] shrink-0 items-center gap-1.5 rounded-xl vip-btn-surface px-3 py-1.5 text-xs font-bold cursor-pointer"
                >
                  {copied === 'link' ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-[#00FF66]" aria-hidden="true" />
                      <span className="text-[#00FF66]">{t('copied')}</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5 text-[#00FF66]" aria-hidden="true" />
                      <span>{t('copyLink')}</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl vip-btn-neon px-5 py-3 text-sm font-extrabold"
            >
              <MessageCircle className="h-5 w-5" aria-hidden="true" />
              <span>{t('shareWhatsApp')}</span>
            </a>
          </div>
        </section>

        <div className="grid grid-cols-2 gap-3">
          <div className="vip-card-3d p-4">
            <Users className="h-5 w-5 text-[#00FF66]" aria-hidden="true" />
            <div className="mt-2 font-display text-2xl font-extrabold tabular text-white">
              {data.referrals.length}
            </div>
            <div className="text-xs text-[#9cb3a5]">{t('invitedFriends')}</div>
          </div>

          <div className="vip-card-3d p-4">
            <span className="font-mono text-[10px] font-bold text-[#00FF66]">
              30% + PKR 30 BONUS
            </span>
            <div
              dir="ltr"
              className="mt-2 font-display text-2xl font-extrabold tabular text-[#00FF66]"
            >
              PKR {(data.user?.referralProfit ?? 0).toLocaleString()}
            </div>
            <div className="text-xs text-[#9cb3a5]">{t('referralProfit')}</div>
          </div>
        </div>

        {/* Clear English Referral Commission & First-Milestone Bonus Rules */}
        <section className="vip-card-3d p-5 space-y-3">
          <h2 className="font-display text-base font-extrabold text-[#00FF66]">
            Referral Commission & Milestone Rules
          </h2>
          <div className="space-y-2.5 text-xs leading-relaxed text-white">
            <div className="rounded-xl border border-[#00FF66]/25 bg-[#050505] p-3">
              <div className="font-extrabold text-[#00FF66]">
                1. Lifetime 30% Commission
              </div>
              <p className="mt-1 text-[#9cb3a5]">
                You automatically earn a lifetime <strong className="text-white">30% commission</strong> on all approved task earnings made by every user who registers with your invite code.
              </p>
            </div>
            <div className="rounded-xl border border-[#00FF66]/25 bg-[#050505] p-3">
              <div className="font-extrabold text-[#00FF66]">
                2. First-Time Milestone Bonus: PKR 30
              </div>
              <p className="mt-1 text-[#9cb3a5]">
                When a referred user gets their <strong className="text-white">first 5 submitted emails approved</strong> by the admin, you automatically receive a one-time <strong className="text-[#00FF66]">PKR 30 bonus</strong>. After this one-time bonus, you continue receiving your standard 30% commission on all future approved tasks.
              </p>
            </div>
          </div>
        </section>

        <section className="vip-card-3d p-5">
          <h2 className="font-display text-base font-extrabold text-white">
            {t('invitedFriends')}
          </h2>
          {data.referrals.length === 0 ? (
            <p className="py-8 text-center text-xs text-[#9cb3a5]">{t('noRecords')}</p>
          ) : (
            <ul className="mt-3 divide-y divide-[#00FF66]/10">
              {data.referrals.map((refUser) => (
                <li
                  key={refUser.uid}
                  className="flex items-center justify-between gap-3 py-3 text-xs"
                >
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-white">{refUser.name}</div>
                    <div className="text-[11px] text-[#9cb3a5]">
                      Joined {new Date(refUser.createdAt).toLocaleDateString()} · Earned PKR{' '}
                      {refUser.totalEarned.toLocaleString()}
                    </div>
                  </div>
                  <span
                    className={`shrink-0 rounded-lg px-2 py-1 text-[10px] font-extrabold ${
                      refUser.milestoneBonusPaid
                        ? 'bg-[#00FF66]/15 text-[#00FF66]'
                        : 'bg-[#FFB800]/15 text-[#FFB800]'
                    }`}
                  >
                    {refUser.milestoneBonusPaid
                      ? 'PKR 30 Paid · 30%'
                      : '30% Active · 5-Email Bonus'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    );
  }

  // Withdrawals View
  const balance = data.user?.balance ?? 0;
  const isDisabled = data.user?.status === 'disabled';

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    if (!data.user) {
      onRequireAuth();
      return;
    }

    if (isDisabled) {
      setFeedback({ ok: false, msg: t('disabledWithdrawWarning') });
      return;
    }

    const num = Number(amountStr);
    if (!Number.isFinite(num) || num < 200 || num > 50000) {
      setFeedback({ ok: false, msg: 'Amount must be between PKR 200 and PKR 50,000.' });
      return;
    }
    if (num > balance) {
      setFeedback({ ok: false, msg: 'Insufficient balance.' });
      return;
    }

    setBusy(true);
    try {
      const created = await onRequestWithdrawal(
        method,
        accountHolder.trim(),
        accountNumber.trim(),
        num,
        cnic.trim() || undefined
      );
      setAmountStr('');
      setCnic('');
      if (created) {
        setActiveReceipt(created);
      }
      setFeedback({
        ok: true,
        msg: 'Withdrawal submitted! Digital receipt generated & routed live to Admin.',
      });
    } catch (err) {
      setFeedback({
        ok: false,
        msg: err instanceof Error ? err.message : 'Withdrawal failed.',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4 animate-view-enter">
      {activeReceipt && (
        <DigitalReceiptModal
          receipt={activeReceipt}
          onClose={() => setActiveReceipt(null)}
        />
      )}

      <section className="vip-card-3d p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-lg font-extrabold text-white">
              {t('withdrawTitle')}
            </h1>
            <p className="mt-0.5 text-xs text-[#9cb3a5]">{t('withdrawRange')}</p>
          </div>
          <div className="text-end">
            <div className="text-[10px] text-[#9cb3a5]">{t('balance')}</div>
            <div dir="ltr" className="font-display text-base font-extrabold tabular text-[#00FF66]">
              PKR {balance.toLocaleString()}
            </div>
          </div>
        </div>

        {isDisabled && (
          <div
            role="alert"
            className="mt-4 flex items-start gap-2.5 rounded-2xl border border-[#FFB800] bg-[#FFB800]/12 p-3.5 text-xs font-bold text-[#FFB800]"
          >
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
            <span>{t('disabledWithdrawWarning')}</span>
          </div>
        )}

        <form onSubmit={handleWithdraw} className="mt-4 space-y-3.5">
          <div>
            <label className="block text-xs font-semibold text-[#9cb3a5] mb-1.5">
              {t('paymentMethod')}
            </label>
            <PaymentMethodDropdown value={method} onChange={setMethod} />
          </div>

          <div>
            <label htmlFor="tp-wd-holder" className="block text-xs font-semibold text-[#9cb3a5]">
              {t('accountHolder')}
            </label>
            <input
              id="tp-wd-holder"
              type="text"
              value={accountHolder}
              onChange={(e) => setAccountHolder(e.target.value)}
              placeholder="Hamza Tariq"
              className="mt-1 h-11 w-full rounded-xl border border-[#00FF66]/25 bg-[#050505] px-3.5 text-sm text-white focus:border-[#00FF66] focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="tp-wd-num" className="block text-xs font-semibold text-[#9cb3a5]">
              {t('accountNumber')}
            </label>
            <input
              id="tp-wd-num"
              type="text"
              dir="ltr"
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              placeholder="03001234567"
              className="mt-1 h-11 w-full rounded-xl border border-[#00FF66]/25 bg-[#050505] px-3.5 text-sm tabular text-white focus:border-[#00FF66] focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="tp-wd-cnic" className="block text-xs font-semibold text-[#9cb3a5]">
              {t('cnicOptional')}
            </label>
            <input
              id="tp-wd-cnic"
              type="text"
              dir="ltr"
              value={cnic}
              onChange={(e) => setCnic(e.target.value)}
              placeholder="35202-1234567-1"
              className="mt-1 h-11 w-full rounded-xl border border-[#00FF66]/25 bg-[#050505] px-3.5 text-sm font-mono tabular text-white placeholder:text-[#9cb3a5]/45 focus:border-[#00FF66] focus:outline-none"
            />
          </div>

          <div>
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="tp-wd-amt" className="text-xs font-semibold text-[#9cb3a5]">
                {t('amountPkr')}
              </label>
              <button
                type="button"
                onClick={() => setAmountStr(String(Math.min(50000, balance)))}
                className="min-h-[32px] px-2 text-xs font-bold text-[#00FF66] hover:underline cursor-pointer"
              >
                Max (PKR {Math.min(50000, balance)})
              </button>
            </div>
            <input
              id="tp-wd-amt"
              type="number"
              min={200}
              max={50000}
              dir="ltr"
              value={amountStr}
              onChange={(e) => setAmountStr(e.target.value)}
              placeholder="200"
              className="mt-1 h-11 w-full rounded-xl border border-[#00FF66]/25 bg-[#050505] px-3.5 text-sm tabular text-white focus:border-[#00FF66] focus:outline-none"
            />
          </div>

          {feedback && (
            <div
              role="status"
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
            disabled={busy || isDisabled}
            className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl vip-btn-neon px-5 py-3 text-sm font-extrabold transition-transform active:scale-[0.98] disabled:opacity-50 cursor-pointer"
          >
            <Wallet className="h-4 w-4" aria-hidden="true" />
            <span>{busy ? '...' : isDisabled ? 'Withdrawals Blocked' : t('requestWithdraw')}</span>
          </button>
        </form>
      </section>

      <section className="vip-card-3d p-5">
        <h2 className="font-display text-base font-extrabold text-white">{t('withdrawHistory')}</h2>
        {data.withdrawals.length === 0 ? (
          <p className="py-8 text-center text-xs text-[#9cb3a5]">{t('noRecords')}</p>
        ) : (
          <ul className="mt-3 divide-y divide-[#00FF66]/10">
            {data.withdrawals.map((wd) => (
              <li key={wd.id}>
                <button
                  type="button"
                  onClick={() => setActiveReceipt(wd)}
                  className="flex w-full items-center justify-between gap-2.5 py-3 text-start cursor-pointer hover:bg-white/[0.02] rounded-xl px-1"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <PaymentMethodLogo method={wd.method} size={32} />
                    <div className="min-w-0">
                      <div className="truncate text-xs font-semibold text-white">
                        {wd.method} · {wd.accountNumber}
                      </div>
                      <div className="mt-0.5 text-[11px] text-[#9cb3a5]">
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
                      PKR {wd.amount.toLocaleString()}
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
    </div>
  );
};
