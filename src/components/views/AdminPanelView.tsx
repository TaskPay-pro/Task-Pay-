import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  Check,
  LogOut,
  MessageSquare,
  Pencil,
  Phone,
  Receipt,
  Search,
  ShieldCheck,
  Sliders,
  Trash2,
  UserCheck,
  UserX,
  Video,
  X,
} from 'lucide-react';
import { useI18n } from '../../data/i18n';
import type { SyncStatePayload, TaskRecord, UserRecord } from '../../types/taskpay';
import { PaymentMethodLogo } from '../PaymentMethodLogo';
import { SupportChatView } from './SupportChatView';

interface AdminPanelViewProps {
  isAdmin: boolean;
  data: SyncStatePayload;
  onAdminLogout: () => void;
  onSetRate: (rate: number) => Promise<void>;
  onReviewTask: (taskId: string, decision: 'approved' | 'rejected') => Promise<void>;
  onBulkReviewTasks: (uid: string, decision: 'approved' | 'rejected') => Promise<unknown>;
  onReviewWithdrawal: (withdrawalId: string, decision: 'approved' | 'rejected') => Promise<void>;
  onAdjustBalance: (
    uid: string,
    mode: 'add' | 'set',
    amount: number,
    note?: string
  ) => Promise<void>;
  onMemberAction: (uid: string, action: 'enable' | 'disable' | 'delete') => Promise<void>;
  onStartCall: (targetUid: string, callType: 'audio' | 'video') => Promise<void>;
  onSendMessage: (
    roomUid: string,
    senderRole: 'user' | 'admin',
    kind: 'text' | 'image' | 'voice',
    text?: string,
    mediaDataUrl?: string,
    durationSec?: number
  ) => Promise<unknown>;
  onMarkChatRead: (roomUid: string, readerRole: 'user' | 'admin') => Promise<void>;
}

type AdminSection = 'tasks' | 'receipts' | 'users' | 'support';

export const AdminPanelView: React.FC<AdminPanelViewProps> = ({
  isAdmin,
  data,
  onAdminLogout,
  onSetRate,
  onReviewTask,
  onBulkReviewTasks,
  onReviewWithdrawal,
  onAdjustBalance,
  onMemberAction,
  onStartCall,
  onSendMessage,
  onMarkChatRead,
}) => {
  const { t } = useI18n();

  const [section, setSection] = useState<AdminSection>('tasks');
  const [rateInput, setRateInput] = useState(String(data.snapshot.taskRewardRate));
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  // User Detail & Balance Adjustment state
  const [inspectedUid, setInspectedUid] = useState<string | null>(null);
  const [editingBalance, setEditingBalance] = useState(false);
  const [balanceMode, setBalanceMode] = useState<'add' | 'set'>('add');
  const [balanceAmt, setBalanceAmt] = useState('');
  const [balanceNote, setBalanceNote] = useState('VIP Custom Bonus');

  // Support Chat Thread state
  const [openChatUid, setOpenChatUid] = useState<string | null>(null);

  const allUsers = data.allUsers ?? [];
  const allTasks = data.allTasks ?? [];
  const allWithdrawals = data.allWithdrawals ?? [];
  const allMessages = data.allMessages ?? [];

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allUsers;
    return allUsers.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.contact.toLowerCase().includes(q) ||
        u.uid.toLowerCase().includes(q)
    );
  }, [allUsers, search]);

  // Group pending tasks by user into distinct boxes/cards
  const tasksByUser = useMemo(() => {
    const groups = new Map<
      string,
      { uid: string; userName: string; contact: string; tasks: TaskRecord[] }
    >();
    for (const task of allTasks) {
      if (task.status !== 'pending') continue;
      const member = allUsers.find((u) => u.uid === task.uid);
      const existing = groups.get(task.uid);
      if (existing) {
        existing.tasks.push(task);
      } else {
        groups.set(task.uid, {
          uid: task.uid,
          userName: member?.name || task.userName,
          contact: member?.contact || 'N/A',
          tasks: [task],
        });
      }
    }
    return Array.from(groups.values());
  }, [allTasks, allUsers]);

  const inspectedUser: UserRecord | undefined = useMemo(
    () => allUsers.find((u) => u.uid === inspectedUid),
    [allUsers, inspectedUid]
  );

  if (!isAdmin) {
    return null;
  }

  const pendingTaskCount = allTasks.filter((x) => x.status === 'pending').length;
  const pendingWdCount = allWithdrawals.filter((x) => x.status === 'pending').length;

  return (
    <div className="space-y-4 animate-view-enter">
      {/* Top Admin Header */}
      <section className="vip-hero-3d p-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <ShieldCheck className="h-6 w-6 text-[#00FF66] shrink-0" aria-hidden="true" />
          <div className="min-w-0">
            <h1 className="font-display text-base font-extrabold text-white truncate">
              {t('adminPanel')}
            </h1>
            <p className="text-[11px] text-[#9cb3a5] truncate">
              {allUsers.length} users · {pendingTaskCount} tasks · {pendingWdCount} receipts
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onAdminLogout}
          className="inline-flex min-h-[38px] shrink-0 items-center gap-1.5 rounded-xl border border-[#FFB800]/50 bg-[#FFB800]/10 px-3 text-xs font-bold text-[#FFB800] cursor-pointer"
        >
          <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
          <span>{t('signOut')}</span>
        </button>
      </section>

      {/* Dynamic Reward Rate Control Panel */}
      <section className="vip-card-3d p-4">
        <div className="flex items-center gap-2 text-xs font-bold text-[#00FF66]">
          <Sliders className="h-4 w-4" aria-hidden="true" />
          <span>{t('dynamicRateControl')}</span>
        </div>
        <div className="mt-2.5 flex items-center gap-2">
          <input
            type="number"
            min={1}
            max={5000}
            dir="ltr"
            value={rateInput}
            onChange={(e) => setRateInput(e.target.value)}
            className="h-11 w-28 rounded-xl border border-[#00FF66]/25 bg-[#050505] px-3 font-display text-base font-extrabold tabular text-[#00FF66] focus:border-[#00FF66] focus:outline-none"
          />
          <button
            type="button"
            onClick={async () => {
              await onSetRate(Number(rateInput));
              setStatusMsg(`Reward rate updated to PKR ${rateInput}.`);
              setTimeout(() => setStatusMsg(null), 2500);
            }}
            className="min-h-[44px] flex-1 rounded-xl vip-btn-neon px-3 text-xs font-extrabold cursor-pointer"
          >
            {t('updateRate')}
          </button>
        </div>
        {statusMsg && <p className="mt-2 text-xs font-semibold text-[#00FF66]">{statusMsg}</p>}
      </section>

      {/* Admin Sub-Navigation Tabs */}
      <div className="grid grid-cols-4 gap-1 rounded-2xl border border-[#00FF66]/20 bg-[#0b0e0c] p-1">
        {(
          [
            { id: 'tasks', label: `Tasks (${pendingTaskCount})` },
            { id: 'receipts', label: `Payouts (${pendingWdCount})` },
            { id: 'users', label: `Users (${allUsers.length})` },
            { id: 'support', label: 'Calls/Chat' },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => {
              setSection(tab.id);
              setInspectedUid(null);
              setOpenChatUid(null);
            }}
            className={`min-h-[40px] rounded-xl px-1.5 text-[11px] font-extrabold truncate cursor-pointer ${
              section === tab.id ? 'vip-btn-neon' : 'text-[#9cb3a5] hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* SECTION 1: Task Approvals Manager (Grouped Distinct User Cards + Bulk Controls) */}
      {section === 'tasks' && (
        <div className="space-y-3">
          <h2 className="font-display text-sm font-extrabold text-white px-1">
            {t('pendingTaskQueue')}
          </h2>
          {tasksByUser.length === 0 ? (
            <div className="vip-card-3d p-8 text-center text-xs text-[#9cb3a5]">
              {t('noRecords')}
            </div>
          ) : (
            tasksByUser.map((group) => (
              <section key={group.uid} className="vip-card-3d p-4 space-y-3">
                <div className="flex items-start justify-between gap-2 border-b border-white/10 pb-3">
                  <div className="min-w-0">
                    <div className="font-display text-sm font-extrabold text-white truncate">
                      {group.userName}
                    </div>
                    <div className="text-[11px] font-mono text-[#00FF66] truncate">
                      {group.uid} · {group.contact}
                    </div>
                  </div>
                  <span className="shrink-0 rounded-lg bg-[#FFB800]/15 border border-[#FFB800]/40 px-2 py-1 text-[10px] font-extrabold text-[#FFB800]">
                    {group.tasks.length} Pending
                  </span>
                </div>

                {/* Bulk Approve / Reject Controls */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => onBulkReviewTasks(group.uid, 'approved')}
                    className="flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl vip-btn-neon text-xs font-extrabold cursor-pointer"
                  >
                    <Check className="h-3.5 w-3.5" />
                    <span>{t('approveAll')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onBulkReviewTasks(group.uid, 'rejected')}
                    className="flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl border border-[#FFB800]/60 bg-[#FFB800]/10 text-xs font-extrabold text-[#FFB800] cursor-pointer"
                  >
                    <X className="h-3.5 w-3.5" />
                    <span>{t('rejectAll')}</span>
                  </button>
                </div>

                {/* Individual Email List */}
                <ul className="divide-y divide-[#00FF66]/10">
                  {group.tasks.map((task) => (
                    <li
                      key={task.id}
                      className="flex items-center justify-between gap-2 py-2.5 text-xs"
                    >
                      <div className="min-w-0">
                        <div dir="ltr" className="truncate font-semibold text-white">
                          {task.email}
                        </div>
                        <div className="text-[10px] text-[#9cb3a5]">
                          PKR {task.rewardRate} · {new Date(task.createdAt).toLocaleTimeString()}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => onReviewTask(task.id, 'approved')}
                          aria-label="Approve task"
                          className="flex h-9 w-9 items-center justify-center rounded-xl vip-btn-neon cursor-pointer"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onReviewTask(task.id, 'rejected')}
                          aria-label="Reject task"
                          className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#FFB800]/60 bg-[#FFB800]/10 text-[#FFB800] cursor-pointer"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ))
          )}
        </div>
      )}

      {/* SECTION 2: Withdrawal Management & Detailed Digital Receipts */}
      {section === 'receipts' && (
        <div className="space-y-3">
          <h2 className="font-display text-sm font-extrabold text-white px-1">
            {t('pendingWithdrawalQueue')}
          </h2>
          {allWithdrawals.length === 0 ? (
            <div className="vip-card-3d p-8 text-center text-xs text-[#9cb3a5]">
              {t('noRecords')}
            </div>
          ) : (
            allWithdrawals.map((wd) => (
              <section
                key={wd.id}
                className="rounded-3xl border border-[#00FF66]/40 bg-[#FFFFFF] p-4 text-[#050505] shadow-[0_14px_30px_-14px_rgba(0,255,102,0.4)] space-y-3"
              >
                <div className="flex items-center justify-between gap-2 border-b border-[#050505]/10 pb-2.5">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <PaymentMethodLogo method={wd.method} size={34} />
                    <div className="min-w-0">
                      <div className="font-display text-sm font-extrabold truncate">
                        {wd.method} Receipt
                      </div>
                      <div className="font-mono text-[10px] text-[#050505]/65 truncate">
                        {wd.id} · {wd.uid}
                      </div>
                    </div>
                  </div>
                  <div className="text-end shrink-0">
                    <div dir="ltr" className="font-display text-base font-extrabold text-[#00993d] tabular">
                      PKR {wd.amount.toLocaleString()}
                    </div>
                    <span
                      className={`inline-flex items-center gap-1 text-[10px] font-extrabold uppercase ${
                        wd.status === 'approved' ? 'text-[#00993d]' : 'text-[#b37d00]'
                      }`}
                    >
                      <Receipt className="h-3 w-3" />
                      {t(wd.status)}
                    </span>
                  </div>
                </div>

                <dl className="grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <dt className="text-[#050505]/60">Member</dt>
                    <dd className="font-bold truncate">{wd.userName}</dd>
                  </div>
                  <div>
                    <dt className="text-[#050505]/60">Account Holder</dt>
                    <dd className="font-bold truncate">{wd.accountHolder}</dd>
                  </div>
                  <div>
                    <dt className="text-[#050505]/60">Account Number</dt>
                    <dd dir="ltr" className="font-mono font-bold">
                      {wd.accountNumber}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[#050505]/60">CNIC</dt>
                    <dd dir="ltr" className="font-mono font-bold">
                      {wd.cnic || 'Not provided'}
                    </dd>
                  </div>
                </dl>

                {wd.status === 'pending' && (
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => onReviewWithdrawal(wd.id, 'approved')}
                      className="flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl bg-[#00FF66] text-xs font-extrabold text-[#050505] shadow-md cursor-pointer"
                    >
                      <Check className="h-4 w-4" />
                      <span>{t('approve')}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onReviewWithdrawal(wd.id, 'rejected')}
                      className="flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl bg-[#050505] text-xs font-extrabold text-[#FFB800] cursor-pointer"
                    >
                      <X className="h-4 w-4" />
                      <span>{t('reject')}</span>
                    </button>
                  </div>
                )}
              </section>
            ))
          )}
        </div>
      )}

      {/* SECTION 3: User Management (Large Cards + Click to Open Full User Dashboard + Pencil Balance Editor) */}
      {section === 'users' && (
        <div className="space-y-3">
          {inspectedUser ? (
            <section className="vip-hero-3d p-5 space-y-4">
              <button
                type="button"
                onClick={() => {
                  setInspectedUid(null);
                  setEditingBalance(false);
                }}
                className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl vip-btn-surface px-3 text-xs font-bold text-[#00FF66] cursor-pointer"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Back to Users</span>
              </button>

              {/* Inspected User Full Dashboard Header */}
              <div className="vip-balance-white p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-display text-base font-extrabold truncate">
                      {inspectedUser.name}
                    </div>
                    <div className="text-[11px] font-mono text-[#050505]/70 truncate">
                      {inspectedUser.uid} · {inspectedUser.contact}
                    </div>
                  </div>
                  <span
                    className={`rounded-lg px-2 py-1 text-[10px] font-extrabold uppercase ${
                      inspectedUser.status === 'active'
                        ? 'bg-[#00FF66] text-[#050505]'
                        : 'bg-[#050505] text-[#FFB800]'
                    }`}
                  >
                    {inspectedUser.status}
                  </span>
                </div>

                <div className="mt-3 flex items-center justify-between gap-2 border-t border-[#050505]/10 pt-3">
                  <div>
                    <div className="text-[11px] font-bold text-[#050505]/65">Current Balance</div>
                    <div dir="ltr" className="font-display text-2xl font-extrabold tabular">
                      PKR {inspectedUser.balance.toLocaleString()}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingBalance((v) => !v);
                      setBalanceAmt('');
                    }}
                    aria-label="Edit user balance"
                    className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#050505] text-[#00FF66] shadow-md cursor-pointer"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Manual Balance Adjustment / Custom Bonus Form */}
              {editingBalance && (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const num = Number(balanceAmt);
                    if (!Number.isFinite(num)) return;
                    await onAdjustBalance(inspectedUser.uid, balanceMode, num, balanceNote);
                    setEditingBalance(false);
                    setBalanceAmt('');
                  }}
                  className="vip-card-3d p-4 space-y-3"
                >
                  <div className="text-xs font-extrabold text-[#00FF66]">
                    Manual Balance Adjustment / Custom Bonus
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setBalanceMode('add')}
                      className={`min-h-[38px] rounded-xl text-xs font-bold cursor-pointer ${
                        balanceMode === 'add' ? 'vip-btn-neon' : 'vip-btn-surface'
                      }`}
                    >
                      Add Bonus (+/-)
                    </button>
                    <button
                      type="button"
                      onClick={() => setBalanceMode('set')}
                      className={`min-h-[38px] rounded-xl text-xs font-bold cursor-pointer ${
                        balanceMode === 'set' ? 'vip-btn-neon' : 'vip-btn-surface'
                      }`}
                    >
                      Set Exact PKR
                    </button>
                  </div>
                  <input
                    type="number"
                    dir="ltr"
                    value={balanceAmt}
                    onChange={(e) => setBalanceAmt(e.target.value)}
                    placeholder={balanceMode === 'add' ? 'e.g. 100 or -50' : 'e.g. 500'}
                    className="h-11 w-full rounded-xl border border-[#00FF66]/25 bg-[#050505] px-3 text-sm text-white focus:border-[#00FF66] focus:outline-none"
                  />
                  <input
                    type="text"
                    value={balanceNote}
                    onChange={(e) => setBalanceNote(e.target.value)}
                    placeholder="Reason / Bonus Note"
                    className="h-11 w-full rounded-xl border border-[#00FF66]/25 bg-[#050505] px-3 text-xs text-white focus:border-[#00FF66] focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="flex min-h-[44px] w-full items-center justify-center rounded-xl vip-btn-neon text-xs font-extrabold cursor-pointer"
                  >
                    Apply Balance Change
                  </button>
                </form>
              )}

              {/* User Stats Summary */}
              <div className="grid grid-cols-2 gap-2.5 text-xs">
                <div className="vip-card-3d p-3">
                  <div className="text-[#9cb3a5]">Total Earned</div>
                  <div className="mt-1 font-display text-base font-extrabold text-[#00FF66] tabular">
                    PKR {inspectedUser.totalEarned.toLocaleString()}
                  </div>
                </div>
                <div className="vip-card-3d p-3">
                  <div className="text-[#9cb3a5]">VIP Rank</div>
                  <div className="mt-1 font-display text-base font-extrabold text-white">
                    {inspectedUser.rank}
                  </div>
                </div>
                <div className="vip-card-3d p-3">
                  <div className="text-[#9cb3a5]">Tasks Submitted</div>
                  <div className="mt-1 font-display text-base font-extrabold text-white tabular">
                    {allTasks.filter((tItem) => tItem.uid === inspectedUser.uid).length}
                  </div>
                </div>
                <div className="vip-card-3d p-3">
                  <div className="text-[#9cb3a5]">Referrals</div>
                  <div className="mt-1 font-display text-base font-extrabold text-[#00FF66] tabular">
                    {inspectedUser.referralCount}
                  </div>
                </div>
              </div>

              {/* Disable / Enable & Delete Controls */}
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() =>
                    onMemberAction(
                      inspectedUser.uid,
                      inspectedUser.status === 'active' ? 'disable' : 'enable'
                    )
                  }
                  className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-[#FFB800]/60 bg-[#FFB800]/15 text-xs font-extrabold text-[#FFB800] cursor-pointer"
                >
                  {inspectedUser.status === 'active' ? (
                    <>
                      <UserX className="h-4 w-4" />
                      <span>{t('disable')}</span>
                    </>
                  ) : (
                    <>
                      <UserCheck className="h-4 w-4" />
                      <span>{t('enable')}</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await onMemberAction(inspectedUser.uid, 'delete');
                    setInspectedUid(null);
                  }}
                  className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-[#FFB800]/45 bg-[#050505] text-xs font-extrabold text-[#FFB800] cursor-pointer"
                >
                  <Trash2 className="h-4 w-4" />
                  <span>{t('deleteUser')}</span>
                </button>
              </div>
            </section>
          ) : (
            <>
              <div className="relative">
                <Search
                  className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9cb3a5]"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t('searchMembers')}
                  className="h-11 w-full rounded-xl border border-[#00FF66]/25 bg-[#050505] ps-10 pe-4 text-xs text-white focus:border-[#00FF66] focus:outline-none"
                />
              </div>

              <div className="space-y-3">
                {filteredUsers.map((member) => (
                  <button
                    key={member.uid}
                    type="button"
                    onClick={() => setInspectedUid(member.uid)}
                    className="vip-card-3d w-full p-4 text-start space-y-2.5 cursor-pointer hover:border-[#00FF66]/55 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-display text-sm font-extrabold text-white truncate">
                          {member.name}
                        </div>
                        <div className="mt-0.5 font-mono text-[11px] text-[#9cb3a5] truncate">
                          {member.uid} · {member.contact}
                        </div>
                      </div>
                      <span
                        className={`shrink-0 rounded-lg px-2 py-0.5 text-[10px] font-extrabold uppercase ${
                          member.status === 'active'
                            ? 'bg-[#00FF66]/15 text-[#00FF66]'
                            : 'bg-[#FFB800]/15 text-[#FFB800]'
                        }`}
                      >
                        {member.status}
                      </span>
                    </div>

                    <div className="flex items-center justify-between border-t border-white/10 pt-2.5 text-xs">
                      <span className="font-semibold text-[#9cb3a5]">{member.rank}</span>
                      <span dir="ltr" className="font-display text-sm font-extrabold text-[#00FF66] tabular">
                        PKR {member.balance.toLocaleString()}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* SECTION 4: Support & Live Call Hub (Large Separate Boxes per User with Audio/Video Call & Chat) */}
      {section === 'support' && (
        <div className="space-y-3">
          {openChatUid ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setOpenChatUid(null)}
                  className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl vip-btn-surface px-3 text-xs font-bold text-[#00FF66] cursor-pointer"
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span>All Threads</span>
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onStartCall(openChatUid, 'audio')}
                    className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl vip-btn-neon px-3 text-xs font-extrabold cursor-pointer"
                  >
                    <Phone className="h-3.5 w-3.5" />
                    <span>{t('audioCall')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onStartCall(openChatUid, 'video')}
                    className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl vip-btn-neon px-3 text-xs font-extrabold cursor-pointer"
                  >
                    <Video className="h-3.5 w-3.5" />
                    <span>{t('videoCall')}</span>
                  </button>
                </div>
              </div>

              <SupportChatView
                roomUid={openChatUid}
                senderRole="admin"
                messages={allMessages.filter((m) => m.roomUid === openChatUid)}
                title={allUsers.find((u) => u.uid === openChatUid)?.name ?? openChatUid}
                subtitle={allUsers.find((u) => u.uid === openChatUid)?.contact}
                onSend={onSendMessage}
                onMarkRead={onMarkChatRead}
                isSignedIn={true}
              />
            </div>
          ) : (
            allUsers.map((member) => {
              const threadMsgs = allMessages.filter((m) => m.roomUid === member.uid);
              const lastMsg = threadMsgs[threadMsgs.length - 1];
              const unread = threadMsgs.filter((m) => m.senderRole === 'user' && m.tickState < 3).length;

              return (
                <section key={member.uid} className="vip-card-3d p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-display text-sm font-extrabold text-white truncate">
                        {member.name}
                      </div>
                      <div className="text-[11px] font-mono text-[#00FF66] truncate">
                        {member.uid} · {member.contact}
                      </div>
                    </div>
                    {unread > 0 && (
                      <span className="shrink-0 rounded-lg bg-[#00FF66] px-2 py-0.5 text-[10px] font-extrabold text-[#050505]">
                        {unread} NEW
                      </span>
                    )}
                  </div>

                  <p className="truncate rounded-xl bg-[#050505] px-3 py-2 text-xs text-[#9cb3a5]">
                    {lastMsg ? lastMsg.text || `[${lastMsg.kind}]` : 'No messages yet'}
                  </p>

                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setOpenChatUid(member.uid)}
                      className="flex min-h-[42px] items-center justify-center gap-1 rounded-xl vip-btn-surface text-[11px] font-bold text-white cursor-pointer"
                    >
                      <MessageSquare className="h-3.5 w-3.5 text-[#00FF66]" />
                      <span>Chat</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onStartCall(member.uid, 'audio')}
                      className="flex min-h-[42px] items-center justify-center gap-1 rounded-xl vip-btn-neon text-[11px] font-extrabold cursor-pointer"
                    >
                      <Phone className="h-3.5 w-3.5" />
                      <span>Audio</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onStartCall(member.uid, 'video')}
                      className="flex min-h-[42px] items-center justify-center gap-1 rounded-xl vip-btn-neon text-[11px] font-extrabold cursor-pointer"
                    >
                      <Video className="h-3.5 w-3.5" />
                      <span>Video</span>
                    </button>
                  </div>
                </section>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
