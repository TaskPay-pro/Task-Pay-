import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Copy,
  KeyRound,
  MailPlus,
} from 'lucide-react';
import { useI18n } from '../../data/i18n';
import { TASK_PASSCODE, type SyncStatePayload } from '../../types/taskpay';

interface ManualTasksViewProps {
  data: SyncStatePayload;
  onSubmitTasks: (
    passcode: string,
    emails: string[]
  ) => Promise<{ addedCount: number; skippedDup: number; skippedInvalid: number }>;
  onRequireAuth: () => void;
}

export const ManualTasksView: React.FC<ManualTasksViewProps> = ({
  data,
  onSubmitTasks,
  onRequireAuth,
}) => {
  const { t } = useI18n();
  const [bulkEmailsText, setBulkEmailsText] = useState('');
  const [passcode, setPasscode] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  const parsedLines = useMemo(
    () =>
      bulkEmailsText
        .split(/[\r\n,;\s]+/)
        .map((line) => line.replace(/^[<("'`]+|[>)"'`]+$/g, '').trim().toLowerCase())
        .filter(Boolean),
    [bulkEmailsText]
  );

  const handleCopyPasscode = async () => {
    try {
      await navigator.clipboard.writeText(TASK_PASSCODE);
    } catch {
      // Ignore clipboard failures
    }
    setPasscode(TASK_PASSCODE);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 1600);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    if (!data.user) {
      onRequireAuth();
      return;
    }

    if (parsedLines.length === 0) {
      setFeedback({
        ok: false,
        msg: 'Enter or paste at least one email address (one per line).',
      });
      return;
    }

    if (passcode.trim() !== TASK_PASSCODE) {
      setFeedback({
        ok: false,
        msg: `Incorrect passcode. Strict passcode is "${TASK_PASSCODE}".`,
      });
      return;
    }

    setBusy(true);
    try {
      const res = await onSubmitTasks(passcode.trim(), parsedLines);
      setBulkEmailsText('');
      const extras: string[] = [];
      if (res.skippedDup > 0) extras.push(`${res.skippedDup} duplicate skipped`);
      if (res.skippedInvalid > 0) extras.push(`${res.skippedInvalid} invalid skipped`);
      setFeedback({
        ok: true,
        msg: `${res.addedCount} email task(s) submitted for Admin approval (+PKR ${data.snapshot.taskRewardRate} each on approval)${extras.length ? ` (${extras.join(', ')})` : ''}.`,
      });
    } catch (err) {
      setFeedback({
        ok: false,
        msg: err instanceof Error ? err.message : 'Submission failed.',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4 animate-view-enter">
      {/* Bulk Multi-Line Email Submission Card */}
      <section className="vip-card-3d p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-lg font-extrabold text-white">
              {t('tasksTitle')}
            </h1>
            <p className="mt-0.5 text-xs text-[#9cb3a5]">
              {t('currentRate')}:{' '}
              <strong className="font-display text-sm text-[#00FF66] tabular">
                PKR {data.snapshot.taskRewardRate}
              </strong>{' '}
              {t('perApproved')}
            </p>
          </div>
          <MailPlus className="h-6 w-6 text-[#00FF66] shrink-0" aria-hidden="true" />
        </div>

        {/* Passcode Helper */}
        <div className="mt-4 flex items-center justify-between gap-2 rounded-2xl border border-[#00FF66]/35 bg-[#00FF66]/10 p-3">
          <div className="flex items-center gap-2 text-xs text-white">
            <KeyRound className="h-4 w-4 text-[#00FF66] shrink-0" aria-hidden="true" />
            <span>
              Passcode: <strong className="font-mono text-sm text-[#00FF66]">{TASK_PASSCODE}</strong>
            </span>
          </div>
          <button
            type="button"
            onClick={handleCopyPasscode}
            className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl vip-btn-surface px-3 py-1.5 text-xs font-bold cursor-pointer"
          >
            {copiedCode ? (
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

        <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
          <div>
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="tp-bulk-emails" className="block text-xs font-semibold text-[#9cb3a5]">
                {t('emailSingleLabel')}
              </label>
              <span className="font-mono text-[11px] font-bold text-[#00FF66] tabular">
                {parsedLines.length} lines
              </span>
            </div>
            <textarea
              id="tp-bulk-emails"
              rows={8}
              dir="ltr"
              value={bulkEmailsText}
              onChange={(e) => setBulkEmailsText(e.target.value)}
              placeholder={'email1@gmail.com\nemail2@gmail.com\nemail3@gmail.com\nPaste or type 100-200+ emails (one per line, press Enter)...'}
              className="mt-1.5 min-h-[180px] w-full resize-y rounded-xl border border-[#00FF66]/25 bg-[#050505] p-3.5 font-mono text-xs leading-relaxed text-white placeholder:text-[#9cb3a5]/45 focus:border-[#00FF66] focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="tp-passcode" className="block text-xs font-semibold text-[#9cb3a5]">
              {t('passcodeLabel')}
            </label>
            <input
              id="tp-passcode"
              type="text"
              dir="ltr"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              placeholder={TASK_PASSCODE}
              className="mt-1 h-11 w-full rounded-xl border border-[#00FF66]/25 bg-[#050505] px-3.5 font-mono text-sm text-white placeholder:text-[#9cb3a5]/45 focus:border-[#00FF66] focus:outline-none"
            />
          </div>

          {/* Mandatory English Verification & Suspension Warning Notice */}
          <div
            role="note"
            className="flex items-start gap-2.5 rounded-2xl border border-[#FFB800]/60 bg-[#FFB800]/10 p-3.5 text-xs leading-relaxed text-[#FFB800]"
          >
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
            <p className="font-semibold">
              Warning: Submitting fake or invalid emails will result in permanent account suspension. Verification takes approximately 12 hours per email submission. For any queries or assistance, please message the Admin directly in the Support Inbox.
            </p>
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
            disabled={busy}
            className="flex min-h-[48px] w-full items-center justify-center rounded-2xl vip-btn-neon px-5 py-3 text-sm font-extrabold transition-transform active:scale-[0.98] disabled:opacity-60 cursor-pointer"
          >
            {busy ? '...' : data.user ? t('submitTasks') : t('login')}
          </button>
        </form>
      </section>
    </div>
  );
};
