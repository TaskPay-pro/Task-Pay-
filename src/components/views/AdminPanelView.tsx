import React, { useMemo, useState } from 'react';
import {
  Activity,
  ArrowLeft,
  Ban,
  Check,
  CheckCircle2,
  Clock,
  Download,
  LogOut,
  MessageSquare,
  Pause,
  Pencil,
  Phone,
  Play,
  Radio,
  Receipt,
  Search,
  ShieldCheck,
  Sliders,
  Trash2,
  UserCheck,
  UserX,
  Users,
  Video,
  Wallet,
  X,
} from 'lucide-react';
import { useI18n } from '../../data/i18n';
import {
  PAYMENT_METHODS,
  type SyncStatePayload,
  type TaskRecord,
  type UserRecord,
} from '../../types/taskpay';
import {
  ADMIN_OPERATORS,
  type AdminRoleId,
  clearChatThread,
  DEFAULT_ADMIN_NUMBER,
  deleteMessageForEveryone,
  deleteStatusUpdate,
  getAdminBlockStatus,
  getLockedUserProfile,
  maskMobileNumber,
  purgeUserFromWhatsAppStore,
  reviewSupportRegistration,
  setActiveAdminId,
  toggleDisableUserChat,
  triggerMediaDownload,
  useWhatsAppStore,
} from '../../utils/whatsappChatStore';
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

type AdminSection = 'role_workspace' | 'tasks' | 'withdrawals' | 'users';
type Admin1SubTab = 'threads' | 'monitor' | 'requests' | 'media';

function splitName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] || fullName,
    lastName: parts.slice(1).join(' ') || '—',
  };
}

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
  const wa = useWhatsAppStore();
  const activeRole: AdminRoleId = wa.activeAdminId || 'ADMIN-1';

  const [section, setSection] = useState<AdminSection>('role_workspace');
  const [admin1Tab, setAdmin1Tab] = useState<Admin1SubTab>('threads');

  const [rateInput, setRateInput] = useState(String(data.snapshot.taskRewardRate));
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [feedPaused, setFeedPaused] = useState(false);

  // Inspected Full User Dashboard & Balance Adjustment
  const [inspectedUid, setInspectedUid] = useState<string | null>(null);
  const [editingBalance, setEditingBalance] = useState(false);
  const [balanceMode, setBalanceMode] = useState<'add' | 'set'>('add');
  const [balanceAmt, setBalanceAmt] = useState('');
  const [balanceNote, setBalanceNote] = useState('VIP Custom Bonus');

  // Admin 1 Chat Window & Admin 2 Registration Review inputs
  const [openChatUid, setOpenChatUid] = useState<string | null>(null);
  const [rejectReasonByUid, setRejectReasonByUid] = useState<Record<string, string>>({});

  const allUsers = data.allUsers ?? [];
  const allTasks = data.allTasks ?? [];
  const allWithdrawals = data.allWithdrawals ?? [];
  const allMessages = data.allMessages ?? [];

  const registrationsList = useMemo(
    () =>
      Object.values(wa.registrations).sort(
        (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
      ),
    [wa.registrations]
  );

  const pendingRegCount = registrationsList.filter((r) => r.status === 'pending').length;
  const pendingTaskCount = allTasks.filter((x) => x.status === 'pending').length;
  const pendingWdCount = allWithdrawals.filter((x) => x.status === 'pending').length;

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allUsers;
    return allUsers.filter((u) => {
      const reg = wa.registrations[u.uid];
      const mob = reg?.ownAddedNumber || reg?.mobileNumber || u.contact;
      return (
        u.name.toLowerCase().includes(q) ||
        mob.toLowerCase().includes(q) ||
        u.uid.toLowerCase().includes(q)
      );
    });
  }, [allUsers, wa.registrations, search]);

  const tasksByUser = useMemo(() => {
    const groups = new Map<
      string,
      { uid: string; userName: string; contact: string; tasks: TaskRecord[] }
    >();
    for (const task of allTasks) {
      if (task.status !== 'pending') continue;
      const member = allUsers.find((u) => u.uid === task.uid);
      const reg = wa.registrations[task.uid];
      const existing = groups.get(task.uid);
      if (existing) {
        existing.tasks.push(task);
      } else {
        groups.set(task.uid, {
          uid: task.uid,
          userName: member?.name || task.userName,
          contact: reg?.ownAddedNumber || reg?.mobileNumber || member?.contact || 'N/A',
          tasks: [task],
        });
      }
    }
    return Array.from(groups.values());
  }, [allTasks, allUsers, wa.registrations]);

  const inspectedUser: UserRecord | undefined = useMemo(
    () => allUsers.find((u) => u.uid === inspectedUid),
    [allUsers, inspectedUid]
  );

  if (!isAdmin) {
    return null;
  }

  const activeOperator =
    ADMIN_OPERATORS.find((op) => op.id === activeRole) ?? ADMIN_OPERATORS[0];

  return (
    <div className="space-y-4 animate-view-enter">
      {/* Top Admin Header */}
      <section className="vip-hero-3d p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <ShieldCheck className="h-6 w-6 text-[#00FF66] shrink-0" aria-hidden="true" />
            <div className="min-w-0">
              <h1 className="font-display text-base font-extrabold text-white truncate">
                {activeOperator.label}: {activeOperator.title}
              </h1>
              <p className="text-[11px] text-[#9cb3a5] truncate">
                {activeOperator.scope}
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
        </div>

        {/* 3 Distinct Admin Role Switcher + Tasks, Withdrawals & Users/Live Tracker */}
        <div className="space-y-1.5">
          <div className="grid grid-cols-3 gap-1 rounded-2xl border border-[#00FF66]/20 bg-[#050505] p-1">
            {ADMIN_OPERATORS.map((op) => {
              const isSelected = section === 'role_workspace' && activeRole === op.id;
              const badge =
                op.id === 'ADMIN-2' && pendingRegCount > 0
                  ? ` (${pendingRegCount})`
                  : op.id === 'ADMIN-3' && wa.disabledChatUids.length > 0
                  ? ` (${wa.disabledChatUids.length})`
                  : '';
              return (
                <button
                  key={op.id}
                  type="button"
                  onClick={() => {
                    setActiveAdminId(op.id);
                    setSection('role_workspace');
                    setOpenChatUid(null);
                    setInspectedUid(null);
                  }}
                  className={`min-h-[38px] rounded-xl px-1.5 text-[10px] font-extrabold truncate cursor-pointer ${
                    isSelected ? 'vip-btn-neon' : 'text-[#9cb3a5] hover:text-white'
                  }`}
                >
                  {op.label}
                  {badge}
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-3 gap-1 rounded-2xl border border-[#00FF66]/20 bg-[#050505] p-1">
            <button
              type="button"
              onClick={() => {
                setSection('tasks');
                setOpenChatUid(null);
                setInspectedUid(null);
              }}
              className={`min-h-[38px] rounded-xl px-1.5 text-[10px] font-extrabold truncate cursor-pointer ${
                section === 'tasks' ? 'vip-btn-neon' : 'text-[#9cb3a5] hover:text-white'
              }`}
            >
              Tasks ({pendingTaskCount})
            </button>
            <button
              type="button"
              onClick={() => {
                setSection('withdrawals');
                setOpenChatUid(null);
                setInspectedUid(null);
              }}
              className={`min-h-[38px] rounded-xl px-1.5 text-[10px] font-extrabold truncate cursor-pointer ${
                section === 'withdrawals' ? 'vip-btn-neon' : 'text-[#9cb3a5] hover:text-white'
              }`}
            >
              Withdrawals ({pendingWdCount})
            </button>
            <button
              type="button"
              onClick={() => {
                setSection('users');
                setOpenChatUid(null);
              }}
              className={`min-h-[38px] rounded-xl px-1.5 text-[10px] font-extrabold truncate cursor-pointer ${
                section === 'users' ? 'vip-btn-neon' : 'text-[#9cb3a5] hover:text-white'
              }`}
            >
              Users ({allUsers.length})
            </button>
          </div>
        </div>
      </section>

      {/* ===================================================================== */}
      {/* ADMIN 1 WORKSPACE: Manages & Monitors Active Live Chats               */}
      {/* ===================================================================== */}
      {section === 'role_workspace' && activeRole === 'ADMIN-1' && (
        <div className="space-y-3">
          {openChatUid ? (
            (() => {
              const member = allUsers.find((u) => u.uid === openChatUid);
              const reg = wa.registrations[openChatUid];
              const prof = getLockedUserProfile(wa, openChatUid, member?.contact);
              const blockStatus = getAdminBlockStatus(wa, 'ADMIN-1', openChatUid);
              const targetNumber = reg?.ownAddedNumber || reg?.mobileNumber || member?.contact;

              return (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => setOpenChatUid(null)}
                      className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl vip-btn-surface px-3 text-xs font-bold text-[#00FF66] cursor-pointer"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      <span>All Active Chats</span>
                    </button>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        disabled={!blockStatus.allowed}
                        onClick={() => clearChatThread(`support:${openChatUid}`, openChatUid)}
                        className="inline-flex min-h-[40px] items-center gap-1 rounded-xl border border-[#FFB800]/45 bg-[#050505] px-2.5 text-xs font-bold text-[#FFB800] cursor-pointer disabled:opacity-45"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>Clear</span>
                      </button>
                      <button
                        type="button"
                        disabled={!blockStatus.allowed}
                        onClick={() => onStartCall(openChatUid, 'audio')}
                        className="inline-flex min-h-[40px] items-center gap-1 rounded-xl vip-btn-neon px-2.5 text-xs font-extrabold cursor-pointer disabled:opacity-45"
                      >
                        <Phone className="h-3.5 w-3.5" />
                        <span>{t('audioCall')}</span>
                      </button>
                      <button
                        type="button"
                        disabled={!blockStatus.allowed}
                        onClick={() => onStartCall(openChatUid, 'video')}
                        className="inline-flex min-h-[40px] items-center gap-1 rounded-xl vip-btn-neon px-2.5 text-xs font-extrabold cursor-pointer disabled:opacity-45"
                      >
                        <Video className="h-3.5 w-3.5" />
                        <span>{t('videoCall')}</span>
                      </button>
                    </div>
                  </div>

                  {!blockStatus.allowed && blockStatus.reason && (
                    <div className="rounded-xl border border-[#FFB800]/60 bg-[#FFB800]/12 px-3 py-2 text-xs font-semibold text-[#FFB800]">
                      {blockStatus.reason}
                    </div>
                  )}

                  <SupportChatView
                    roomUid={openChatUid}
                    senderRole="admin"
                    messages={allMessages.filter((m) => m.roomUid === openChatUid)}
                    title={prof.name || member?.name || openChatUid}
                    subtitle={targetNumber}
                    onSend={onSendMessage}
                    onMarkRead={onMarkChatRead}
                    isSignedIn={true}
                  />
                </div>
              );
            })()
          ) : (
            <>
              <div className="grid grid-cols-4 gap-1 rounded-xl border border-[#00FF66]/20 bg-[#0b0e0c] p-1">
                {(
                  [
                    { id: 'threads', label: 'Live Chats' },
                    { id: 'monitor', label: 'Monitor' },
                    { id: 'requests', label: `Requests (${wa.chatRequests.length})` },
                    { id: 'media', label: 'Status' },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setAdmin1Tab(tab.id)}
                    className={`min-h-[38px] rounded-lg px-1.5 text-[10px] font-extrabold cursor-pointer truncate ${
                      admin1Tab === tab.id ? 'vip-btn-neon' : 'text-[#9cb3a5] hover:text-white'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {admin1Tab === 'threads' && (
                <div className="space-y-3">
                  {allUsers.map((member) => {
                    const clearedAt = wa.clearedServerRooms[member.uid];
                    const visibleSupportMsgs = allMessages.filter(
                      (m) =>
                        m.roomUid === member.uid &&
                        !wa.deletedForEveryoneIds.includes(m.id) &&
                        (!clearedAt || new Date(m.createdAt).getTime() > new Date(clearedAt).getTime())
                    );
                    const localSupportMsgs = wa.directMessages.filter(
                      (m) =>
                        m.chatId === `support:${member.uid}` &&
                        !wa.deletedForEveryoneIds.includes(m.id)
                    );
                    const merged = [...visibleSupportMsgs, ...localSupportMsgs].sort(
                      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
                    );
                    const lastMsg = merged[merged.length - 1];
                    const unread = visibleSupportMsgs.filter(
                      (m) => m.senderRole === 'user' && m.tickState < 3
                    ).length;
                    const reg = wa.registrations[member.uid];
                    const prof = getLockedUserProfile(wa, member.uid, member.contact);
                    const blockStatus = getAdminBlockStatus(wa, 'ADMIN-1', member.uid);
                    const targetNumber = reg?.ownAddedNumber || reg?.mobileNumber || member.contact;

                    return (
                      <section key={member.uid} className="vip-card-3d p-4 space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2.5 min-w-0">
                            {prof.avatarDataUrl ? (
                              <img
                                src={prof.avatarDataUrl}
                                alt={member.name}
                                className="h-10 w-10 shrink-0 rounded-full object-cover border border-[#00FF66]/50"
                              />
                            ) : (
                              <div className="h-10 w-10 shrink-0 rounded-full border border-[#00FF66]/35 bg-[#050505] flex items-center justify-center font-display text-xs font-extrabold text-[#00FF66]">
                                {member.name.slice(0, 2).toUpperCase()}
                              </div>
                            )}
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="font-display text-sm font-extrabold text-white truncate">
                                  {prof.name || member.name}
                                </span>
                                <span
                                  className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[9px] font-extrabold uppercase ${
                                    member.online
                                      ? 'bg-[#00FF66]/15 text-[#00FF66]'
                                      : 'bg-white/10 text-[#9cb3a5]'
                                  }`}
                                >
                                  <span
                                    className={`h-1.5 w-1.5 rounded-full ${
                                      member.online ? 'bg-[#00FF66]' : 'bg-[#FFB800]'
                                    }`}
                                  />
                                  {member.online ? 'Online' : 'Offline'}
                                </span>
                                {blockStatus.disabledByAdmin3 && (
                                  <span className="rounded-md bg-[#FFB800]/15 px-1.5 py-0.5 text-[9px] font-extrabold text-[#FFB800]">
                                    CHAT DISABLED · ADMIN 1 ONLY
                                  </span>
                                )}
                              </div>
                              <div dir="ltr" className="text-[11px] font-mono text-[#00FF66] truncate">
                                {member.uid} · {targetNumber}
                              </div>
                            </div>
                          </div>
                          {unread > 0 && (
                            <span className="shrink-0 rounded-lg bg-[#00FF66] px-2 py-0.5 text-[10px] font-extrabold text-[#050505]">
                              {unread} NEW
                            </span>
                          )}
                        </div>

                        {!blockStatus.allowed && blockStatus.reason && (
                          <div className="rounded-xl border border-[#FFB800]/45 bg-[#FFB800]/10 px-3 py-2 text-[11px] font-semibold text-[#FFB800]">
                            {blockStatus.reason}
                          </div>
                        )}

                        <p className="truncate rounded-xl bg-[#050505] px-3 py-2 text-xs text-[#9cb3a5]">
                          {lastMsg ? lastMsg.text || `[${lastMsg.kind}]` : 'No active messages'}
                        </p>

                        <div className="grid grid-cols-3 gap-2">
                          <button
                            type="button"
                            disabled={!blockStatus.allowed}
                            onClick={() => setOpenChatUid(member.uid)}
                            className="flex min-h-[42px] items-center justify-center gap-1 rounded-xl vip-btn-surface text-[11px] font-bold text-white cursor-pointer disabled:opacity-40"
                          >
                            <MessageSquare className="h-3.5 w-3.5 text-[#00FF66]" />
                            <span>Open Chat</span>
                          </button>
                          <button
                            type="button"
                            disabled={!blockStatus.allowed}
                            onClick={() => onStartCall(member.uid, 'audio')}
                            className="flex min-h-[42px] items-center justify-center gap-1 rounded-xl vip-btn-neon text-[11px] font-extrabold cursor-pointer disabled:opacity-40"
                          >
                            <Phone className="h-3.5 w-3.5" />
                            <span>Audio</span>
                          </button>
                          <button
                            type="button"
                            disabled={!blockStatus.allowed}
                            onClick={() => onStartCall(member.uid, 'video')}
                            className="flex min-h-[42px] items-center justify-center gap-1 rounded-xl vip-btn-neon text-[11px] font-extrabold cursor-pointer disabled:opacity-40"
                          >
                            <Video className="h-3.5 w-3.5" />
                            <span>Video</span>
                          </button>
                        </div>
                      </section>
                    );
                  })}
                </div>
              )}

              {admin1Tab === 'monitor' && (
                <div className="space-y-2.5">
                  <div className="vip-card-3d p-3.5 text-xs text-[#9cb3a5]">
                    Admin 1 Live Monitor: Real-time oversight of all Support & Peer messages.
                  </div>
                  {(() => {
                    const combinedFeed = [
                      ...allMessages
                        .filter((m) => {
                          const clearedAt = wa.clearedServerRooms[m.roomUid];
                          if (wa.deletedForEveryoneIds.includes(m.id)) return false;
                          if (clearedAt && new Date(m.createdAt).getTime() <= new Date(clearedAt).getTime()) {
                            return false;
                          }
                          return true;
                        })
                        .map((m) => ({
                          id: m.id,
                          from: m.senderName,
                          to:
                            m.senderRole === 'admin'
                              ? allUsers.find((u) => u.uid === m.roomUid)?.name || m.roomUid
                              : 'TaskPay VIP Admin',
                          text: m.text || `[${m.kind}]`,
                          createdAt: m.createdAt,
                        })),
                      ...wa.directMessages
                        .filter((dm) => !wa.deletedForEveryoneIds.includes(dm.id))
                        .map((dm) => ({
                          id: dm.id,
                          from: dm.senderName,
                          to: dm.recipientLabel,
                          text: dm.text || `[${dm.kind}]`,
                          createdAt: dm.createdAt,
                        })),
                    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

                    if (combinedFeed.length === 0) {
                      return (
                        <div className="vip-card-3d p-8 text-center text-xs text-[#9cb3a5]">
                          {t('noRecords')}
                        </div>
                      );
                    }

                    return combinedFeed.map((entry) => (
                      <section key={entry.id} className="vip-card-3d p-3.5 space-y-2 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0 font-bold text-[#00FF66] truncate">
                            {entry.from} → <span className="text-[#FFB800]">{entry.to}</span>
                          </div>
                          <span className="shrink-0 font-mono text-[10px] text-[#9cb3a5] tabular">
                            {new Date(entry.createdAt).toLocaleTimeString()}
                          </span>
                        </div>
                        <p className="text-white break-words">{entry.text}</p>
                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={() => deleteMessageForEveryone(entry.id)}
                            className="inline-flex min-h-[32px] items-center gap-1 rounded-lg border border-[#FFB800]/55 bg-[#FFB800]/12 px-2.5 text-[10px] font-bold text-[#FFB800] cursor-pointer"
                          >
                            <Trash2 className="h-3 w-3" />
                            <span>Remove Message</span>
                          </button>
                        </div>
                      </section>
                    ));
                  })()}
                </div>
              )}

              {admin1Tab === 'requests' && (
                <div className="space-y-2.5">
                  <div className="vip-card-3d p-3.5 text-xs text-[#9cb3a5]">
                    Monitoring all peer-to-peer Chat Requests across registered members.
                  </div>
                  {wa.chatRequests.length === 0 ? (
                    <div className="vip-card-3d p-8 text-center text-xs text-[#9cb3a5]">
                      No chat requests initiated yet.
                    </div>
                  ) : (
                    wa.chatRequests.map((reqItem) => (
                      <section key={reqItem.id} className="vip-card-3d p-3.5 space-y-1.5 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <div className="font-bold text-white truncate">
                            {reqItem.senderName} → {reqItem.recipientName}
                          </div>
                          <span
                            className={`rounded-md px-2 py-0.5 text-[10px] font-extrabold uppercase ${
                              reqItem.status === 'accepted'
                                ? 'bg-[#00FF66]/15 text-[#00FF66]'
                                : 'bg-[#FFB800]/15 text-[#FFB800]'
                            }`}
                          >
                            {reqItem.status}
                          </span>
                        </div>
                        <div dir="ltr" className="font-mono text-[10px] text-[#9cb3a5]">
                          {reqItem.senderMobile} → {reqItem.recipientMobile}
                        </div>
                      </section>
                    ))
                  )}
                </div>
              )}

              {admin1Tab === 'media' && (
                <div className="space-y-2.5">
                  <section className="vip-card-3d p-4 space-y-2.5">
                    <div className="flex items-center gap-2 text-xs font-extrabold text-[#00FF66]">
                      <Radio className="h-4 w-4" />
                      <span>Live Status Updates ({wa.statusUpdates.length})</span>
                    </div>
                    {wa.statusUpdates.length === 0 ? (
                      <p className="text-xs text-[#9cb3a5] py-3 text-center">{t('noRecords')}</p>
                    ) : (
                      wa.statusUpdates.map((st) => (
                        <div
                          key={st.id}
                          className="rounded-xl border border-white/10 bg-[#050505] p-3 space-y-2 text-xs"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-white truncate">{st.authorName}</span>
                            <span className="text-[10px] text-[#9cb3a5] tabular">
                              {st.views} views
                            </span>
                          </div>
                          {st.kind === 'image' && st.mediaDataUrl && (
                            <img src={st.mediaDataUrl} alt="Status" className="max-h-36 rounded-xl object-cover" />
                          )}
                          {st.kind === 'video' && st.mediaDataUrl && (
                            <video controls src={st.mediaDataUrl} className="max-h-40 w-full rounded-xl" />
                          )}
                          {st.text && <p className="text-[#9cb3a5]">{st.text}</p>}
                          <div className="flex items-center justify-end gap-2">
                            {st.mediaDataUrl && (
                              <button
                                type="button"
                                onClick={() => triggerMediaDownload(st.mediaDataUrl!, st.fileName)}
                                className="inline-flex min-h-[34px] items-center gap-1 rounded-lg vip-btn-surface px-2.5 text-[10px] font-bold text-[#00FF66] cursor-pointer"
                              >
                                <Download className="h-3 w-3" />
                                <span>Download</span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => deleteStatusUpdate(st.id)}
                              className="inline-flex min-h-[34px] items-center gap-1 rounded-lg border border-[#FFB800]/55 bg-[#FFB800]/12 px-2.5 text-[10px] font-bold text-[#FFB800] cursor-pointer"
                            >
                              <Trash2 className="h-3 w-3" />
                              <span>Delete</span>
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </section>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* ADMIN 2 WORKSPACE: Approval Manager (Chat Registration Receipts)       */}
      {/* ===================================================================== */}
      {section === 'role_workspace' && activeRole === 'ADMIN-2' && (
        <div className="space-y-3">
          <div className="vip-card-3d p-3.5 text-xs text-[#9cb3a5]">
            <strong className="text-[#00FF66]">Admin 2 (Approval Manager):</strong> Review incoming
            Support Chat registration receipts. Clicking <strong>Approve</strong> unlocks user chat
            immediately; <strong>Reject / Re-reject</strong> keeps chat locked.
          </div>

          {registrationsList.length === 0 ? (
            <div className="vip-card-3d p-8 text-center text-xs text-[#9cb3a5]">
              No support chat registration receipts yet.
            </div>
          ) : (
            registrationsList.map((reg) => {
              const rejectNote = rejectReasonByUid[reg.uid] ?? '';
              return (
                <section
                  key={reg.uid}
                  className="rounded-3xl border-2 border-[#00FF66]/45 bg-[#FFFFFF] p-4 text-[#050505] shadow-[0_14px_30px_-14px_rgba(0,255,102,0.4)] space-y-3"
                >
                  <div className="flex items-start justify-between gap-2 border-b border-[#050505]/10 pb-2.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {reg.avatarDataUrl ? (
                        <img
                          src={reg.avatarDataUrl}
                          alt={`${reg.firstName} ${reg.lastName}`}
                          className="h-10 w-10 shrink-0 rounded-full object-cover border-2 border-[#050505]"
                        />
                      ) : (
                        <div className="h-10 w-10 shrink-0 rounded-full bg-[#050505] text-[#00FF66] flex items-center justify-center font-display text-xs font-extrabold">
                          {reg.firstName.slice(0, 1)}
                          {reg.lastName.slice(0, 1)}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="font-display text-sm font-extrabold truncate">
                          {reg.firstName} {reg.lastName}
                        </div>
                        <div dir="ltr" className="text-[11px] font-mono font-bold text-[#00993d] truncate">
                          {reg.mobileNumber} · {reg.receiptId || reg.uid}
                        </div>
                      </div>
                    </div>
                    <span
                      className={`shrink-0 inline-flex items-center gap-1 rounded-lg px-2.5 py-0.5 text-[10px] font-extrabold uppercase ${
                        reg.status === 'approved'
                          ? 'bg-[#00FF66]/25 text-[#006629]'
                          : 'bg-[#FFB800]/25 text-[#996600]'
                      }`}
                    >
                      {reg.status === 'pending' && <Clock className="h-3 w-3" />}
                      {reg.status === 'approved' && <CheckCircle2 className="h-3 w-3" />}
                      {reg.status}
                    </span>
                  </div>

                  <dl className="grid grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <dt className="text-[#050505]/60">First Name</dt>
                      <dd className="font-bold">{reg.firstName}</dd>
                    </div>
                    <div>
                      <dt className="text-[#050505]/60">Last Name</dt>
                      <dd className="font-bold">{reg.lastName}</dd>
                    </div>
                    <div>
                      <dt className="text-[#050505]/60">Mobile Number</dt>
                      <dd dir="ltr" className="font-mono font-bold text-[#00993d]">
                        {reg.mobileNumber}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[#050505]/60">User ID</dt>
                      <dd className="font-mono font-bold truncate">{reg.uid}</dd>
                    </div>
                    <div className="col-span-2 rounded-xl bg-[#050505]/5 p-2.5">
                      <dt className="text-[#050505]/60 mb-0.5">Description / Bio</dt>
                      <dd className="font-semibold text-[#050505] break-words">
                        {reg.bio || 'Support chat verification request'}
                      </dd>
                    </div>
                  </dl>

                  <input
                    type="text"
                    value={rejectNote}
                    onChange={(e) =>
                      setRejectReasonByUid((prev) => ({
                        ...prev,
                        [reg.uid]: e.target.value,
                      }))
                    }
                    placeholder="Optional rejection note..."
                    className="h-9 w-full rounded-xl border border-[#050505]/15 bg-[#050505]/5 px-3 text-[11px] text-[#050505] placeholder:text-[#050505]/50 focus:border-[#00993d] focus:outline-none"
                  />

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        reviewSupportRegistration(reg.uid, 'approved', DEFAULT_ADMIN_NUMBER)
                      }
                      className="flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl bg-[#00FF66] text-xs font-extrabold text-[#050505] shadow-md cursor-pointer"
                    >
                      <Check className="h-4 w-4" />
                      <span>{reg.status === 'approved' ? 'Approved' : 'Approve'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        reviewSupportRegistration(
                          reg.uid,
                          'rejected',
                          undefined,
                          rejectNote || 'Rejected by Admin 2'
                        )
                      }
                      className="flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl bg-[#050505] text-xs font-extrabold text-[#FFB800] cursor-pointer"
                    >
                      <X className="h-4 w-4" />
                      <span>{reg.status === 'pending' ? 'Reject' : 'Re-reject'}</span>
                    </button>
                  </div>
                </section>
              );
            })
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* ADMIN 3 WORKSPACE: Disable / Block Manager                            */}
      {/* ===================================================================== */}
      {section === 'role_workspace' && activeRole === 'ADMIN-3' && (
        <div className="space-y-3">
          <section className="vip-card-3d p-4 space-y-2">
            <div className="flex items-center gap-2 text-xs font-extrabold text-[#FFB800]">
              <Ban className="h-4 w-4" aria-hidden="true" />
              <span>Admin 3: User Chat Disable & Block Manager</span>
            </div>
            <p className="text-[11px] text-[#9cb3a5] leading-relaxed">
              Disabling a user&apos;s chat restricts them so they can <strong>ONLY message Admin 1 (Main Chat Admin)</strong>.
              Any other contact, group, or peer chat displays:{' '}
              <span className="text-[#FFB800] font-semibold">
                &ldquo;Chat has been disabled, please contact support admin.&rdquo;
              </span>
            </p>
          </section>

          {allUsers.map((member) => {
            const reg = wa.registrations[member.uid];
            const targetNumber = reg?.ownAddedNumber || reg?.mobileNumber || member.contact;
            const isChatDisabled = wa.disabledChatUids.includes(member.uid);

            return (
              <section key={member.uid} className="vip-card-3d p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-display text-sm font-extrabold text-white truncate">
                        {member.name}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[9px] font-extrabold uppercase ${
                          member.online
                            ? 'bg-[#00FF66]/15 text-[#00FF66]'
                            : 'bg-white/10 text-[#9cb3a5]'
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            member.online ? 'bg-[#00FF66]' : 'bg-[#FFB800]'
                          }`}
                        />
                        {member.online ? 'Online' : 'Offline'}
                      </span>
                      {isChatDisabled && (
                        <span className="rounded-md bg-[#FFB800]/15 px-1.5 py-0.5 text-[10px] font-extrabold text-[#FFB800]">
                          CHAT DISABLED (ADMIN 1 ONLY)
                        </span>
                      )}
                    </div>
                    <div dir="ltr" className="text-[11px] font-mono text-[#00FF66] truncate">
                      {member.uid} · {targetNumber}
                    </div>
                  </div>
                  <span
                    className={`shrink-0 rounded-lg px-2 py-0.5 text-[10px] font-extrabold uppercase ${
                      member.status === 'active'
                        ? 'bg-[#00FF66]/15 text-[#00FF66]'
                        : 'bg-[#FFB800]/15 text-[#FFB800]'
                    }`}
                  >
                    Account: {member.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => toggleDisableUserChat(member.uid)}
                    className={`flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl text-[11px] font-extrabold cursor-pointer ${
                      isChatDisabled
                        ? 'vip-btn-neon'
                        : 'border border-[#FFB800]/60 bg-[#FFB800]/15 text-[#FFB800]'
                    }`}
                  >
                    {isChatDisabled ? (
                      <>
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>Enable Chat</span>
                      </>
                    ) : (
                      <>
                        <Ban className="h-3.5 w-3.5" />
                        <span>Disable Chat</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      onMemberAction(member.uid, member.status === 'active' ? 'disable' : 'enable')
                    }
                    className="flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl vip-btn-surface text-[11px] font-extrabold text-white cursor-pointer"
                  >
                    {member.status === 'active' ? (
                      <>
                        <UserX className="h-3.5 w-3.5 text-[#FFB800]" />
                        <span>{t('disable')} Account</span>
                      </>
                    ) : (
                      <>
                        <UserCheck className="h-3.5 w-3.5 text-[#00FF66]" />
                        <span>{t('enable')} Account</span>
                      </>
                    )}
                  </button>
                </div>
              </section>
            );
          })}
        </div>
      )}

      {/* ===================================================================== */}
      {/* TASK & EMAIL RECEIPTS SECTION + DYNAMIC REWARD RATE                   */}
      {/* ===================================================================== */}
      {section === 'tasks' && (
        <div className="space-y-3">
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

          <h2 className="font-display text-sm font-extrabold text-white px-1">
            Task & Email Receipts ({pendingTaskCount} Pending)
          </h2>

          {tasksByUser.length === 0 ? (
            <div className="vip-card-3d p-8 text-center text-xs text-[#9cb3a5]">
              {t('noRecords')}
            </div>
          ) : (
            tasksByUser.map((group) => (
              <section
                key={group.uid}
                className="rounded-3xl border border-[#00FF66]/45 bg-[#FFFFFF] p-4 text-[#050505] shadow-[0_14px_30px_-14px_rgba(0,255,102,0.35)] space-y-3"
              >
                <div className="flex items-start justify-between gap-2 border-b border-[#050505]/10 pb-2.5">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <Receipt className="h-4 w-4 text-[#00993d] shrink-0" aria-hidden="true" />
                      <span className="font-display text-sm font-extrabold truncate">
                        {group.userName}
                      </span>
                    </div>
                    <div dir="ltr" className="text-[11px] font-mono font-bold text-[#00993d] truncate">
                      User ID: {group.uid} · Mobile: {group.contact}
                    </div>
                  </div>
                  <span className="shrink-0 rounded-lg bg-[#FFB800]/20 px-2 py-1 text-[10px] font-extrabold text-[#996600]">
                    {group.tasks.length} Pending
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => onBulkReviewTasks(group.uid, 'approved')}
                    className="flex min-h-[38px] items-center justify-center gap-1.5 rounded-xl bg-[#00FF66] text-xs font-extrabold text-[#050505] cursor-pointer"
                  >
                    <Check className="h-3.5 w-3.5" />
                    <span>{t('approveAll')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onBulkReviewTasks(group.uid, 'rejected')}
                    className="flex min-h-[38px] items-center justify-center gap-1.5 rounded-xl bg-[#050505] text-xs font-extrabold text-[#FFB800] cursor-pointer"
                  >
                    <X className="h-3.5 w-3.5" />
                    <span>{t('rejectAll')}</span>
                  </button>
                </div>

                <ul className="divide-y divide-[#050505]/10">
                  {group.tasks.map((task) => (
                    <li
                      key={task.id}
                      className="flex items-center justify-between gap-2 py-2.5 text-xs"
                    >
                      <div className="min-w-0">
                        <div dir="ltr" className="truncate font-bold text-[#050505]">
                          {task.email}
                        </div>
                        <div className="text-[10px] font-semibold text-[#050505]/60">
                          PKR {task.rewardRate} · {new Date(task.createdAt).toLocaleTimeString()}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => onReviewTask(task.id, 'approved')}
                          aria-label="Approve task"
                          className="inline-flex h-8 items-center gap-1 rounded-lg bg-[#00FF66] px-2.5 text-[10px] font-extrabold text-[#050505] cursor-pointer"
                        >
                          <Check className="h-3.5 w-3.5" />
                          <span>Approve</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onReviewTask(task.id, 'rejected')}
                          aria-label="Reject task"
                          className="inline-flex h-8 items-center gap-1 rounded-lg bg-[#050505] px-2.5 text-[10px] font-extrabold text-[#FFB800] cursor-pointer"
                        >
                          <X className="h-3.5 w-3.5" />
                          <span>Reject</span>
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

      {/* ===================================================================== */}
      {/* WITHDRAWAL RECEIPTS SECTION                                           */}
      {/* ===================================================================== */}
      {section === 'withdrawals' && (
        <div className="space-y-3">
          <h2 className="font-display text-sm font-extrabold text-white px-1">
            Withdrawal Receipts ({pendingWdCount} Processing)
          </h2>
          {allWithdrawals.length === 0 ? (
            <div className="vip-card-3d p-8 text-center text-xs text-[#9cb3a5]">
              {t('noRecords')}
            </div>
          ) : (
            allWithdrawals.map((wd) => {
              const member = allUsers.find((u) => u.uid === wd.uid);
              const reg = wa.registrations[wd.uid];
              const userMobile = reg?.ownAddedNumber || reg?.mobileNumber || member?.contact || wd.accountNumber;
              return (
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
                          {wd.id} · User ID: {wd.uid}
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
                        {wd.status === 'approved' ? (
                          <>
                            <CheckCircle2 className="h-3.5 w-3.5 text-[#00993d]" />
                            <span>Transfer successful</span>
                          </>
                        ) : wd.status === 'pending' ? (
                          <>
                            <Clock className="h-3 w-3" />
                            <span>Processing</span>
                          </>
                        ) : (
                          <>
                            <X className="h-3 w-3" />
                            <span>Rejected</span>
                          </>
                        )}
                      </span>
                    </div>
                  </div>

                  <dl className="grid grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <dt className="text-[#050505]/60">User ID</dt>
                      <dd dir="ltr" className="font-mono font-bold truncate">
                        {wd.uid}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[#050505]/60">User Mobile Number</dt>
                      <dd dir="ltr" className="font-mono font-bold text-[#00993d] truncate">
                        {userMobile}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[#050505]/60">Account Holder Name</dt>
                      <dd className="font-bold truncate">{wd.accountHolder}</dd>
                    </div>
                    <div>
                      <dt className="text-[#050505]/60">Account Holder Mobile</dt>
                      <dd dir="ltr" className="font-mono font-bold">
                        {wd.accountNumber}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[#050505]/60">CNIC Number</dt>
                      <dd dir="ltr" className="font-mono font-bold">
                        {wd.cnic || 'Not provided'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[#050505]/60">Amount</dt>
                      <dd dir="ltr" className="font-mono font-extrabold text-[#00993d]">
                        PKR {wd.amount.toLocaleString()}
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
              );
            })
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* FULL USER & FINANCIAL / REFERRAL DASHBOARD (No Emails)                */}
      {/* ===================================================================== */}
      {section === 'users' && (
        <div className="space-y-3">
          {inspectedUser ? (
            (() => {
              const reg = wa.registrations[inspectedUser.uid];
              const prof = getLockedUserProfile(wa, inspectedUser.uid, inspectedUser.contact);
              const mobileNum = reg?.ownAddedNumber || reg?.mobileNumber || inspectedUser.contact;
              const nameSplit = reg
                ? { firstName: reg.firstName, lastName: reg.lastName }
                : splitName(prof.name || inspectedUser.name);

              const userWithdrawals = allWithdrawals.filter((w) => w.uid === inspectedUser.uid);
              const totalWithdrawnApproved = userWithdrawals
                .filter((w) => w.status === 'approved')
                .reduce((acc, w) => acc + w.amount, 0);
              const totalWithdrawnPending = userWithdrawals
                .filter((w) => w.status === 'pending')
                .reduce((acc, w) => acc + w.amount, 0);

              const invitedMembers = allUsers.filter(
                (u) =>
                  u.invitedBy?.toUpperCase() === inspectedUser.inviteCode.toUpperCase()
              );

              // Group payouts by payment method (SadaPay, NayaPay, JazzCash, EasyPaisa, UPaisa, AEPAY)
              const methodTotals = new Map<string, { count: number; total: number; accounts: string[] }>();
              for (const wd of userWithdrawals) {
                const cur = methodTotals.get(wd.method) ?? { count: 0, total: 0, accounts: [] };
                cur.count += 1;
                cur.total += wd.amount;
                if (!cur.accounts.includes(wd.accountNumber)) cur.accounts.push(wd.accountNumber);
                methodTotals.set(wd.method, cur);
              }

              return (
                <section className="vip-hero-3d p-4 space-y-4">
                  <button
                    type="button"
                    onClick={() => {
                      setInspectedUid(null);
                      setEditingBalance(false);
                    }}
                    className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl vip-btn-surface px-3 text-xs font-bold text-[#00FF66] cursor-pointer"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    <span>Back to Full Users Directory</span>
                  </button>

                  {/* Full User Identity Header (First/Last Name + Mobile Only, No Email) */}
                  <div className="vip-balance-white p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        {prof.avatarDataUrl ? (
                          <img
                            src={prof.avatarDataUrl}
                            alt={inspectedUser.name}
                            className="h-12 w-12 shrink-0 rounded-full object-cover border-2 border-[#050505]"
                          />
                        ) : (
                          <div className="h-12 w-12 shrink-0 rounded-full bg-[#050505] text-[#00FF66] flex items-center justify-center font-display text-sm font-extrabold">
                            {nameSplit.firstName.slice(0, 1)}
                            {nameSplit.lastName.slice(0, 1)}
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="font-display text-base font-extrabold truncate">
                            {nameSplit.firstName} {nameSplit.lastName}
                          </div>
                          <div dir="ltr" className="text-xs font-mono font-bold text-[#00993d] truncate">
                            {mobileNum}
                          </div>
                          <div className="text-[10px] font-mono text-[#050505]/65">
                            {inspectedUser.uid} · Masked: {maskMobileNumber(mobileNum)}
                          </div>
                        </div>
                      </div>
                      <span
                        className={`shrink-0 rounded-lg px-2 py-1 text-[10px] font-extrabold uppercase ${
                          inspectedUser.status === 'active'
                            ? 'bg-[#00FF66] text-[#050505]'
                            : 'bg-[#050505] text-[#FFB800]'
                        }`}
                      >
                        {inspectedUser.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 border-t border-[#050505]/10 pt-2.5 text-[11px]">
                      <div>
                        <span className="text-[#050505]/60">First Name:</span>{' '}
                        <strong className="text-[#050505]">{nameSplit.firstName}</strong>
                      </div>
                      <div>
                        <span className="text-[#050505]/60">Last Name:</span>{' '}
                        <strong className="text-[#050505]">{nameSplit.lastName}</strong>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 border-t border-[#050505]/10 pt-3">
                      <div>
                        <div className="text-[11px] font-bold text-[#050505]/65">
                          Available Balance
                        </div>
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

                  {/* Manual Balance Editor */}
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

                  {/* Financial & Referral Tracking Grid */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs font-extrabold text-[#00FF66] px-1">
                      <Wallet className="h-4 w-4" aria-hidden="true" />
                      <span>Financial & Referral Tracking</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2.5 text-xs">
                      <div className="vip-card-3d p-3">
                        <div className="text-[#9cb3a5]">Total Earned</div>
                        <div dir="ltr" className="mt-1 font-display text-base font-extrabold text-[#00FF66] tabular">
                          PKR {inspectedUser.totalEarned.toLocaleString()}
                        </div>
                      </div>
                      <div className="vip-card-3d p-3">
                        <div className="text-[#9cb3a5]">Total Referrals</div>
                        <div className="mt-1 font-display text-base font-extrabold text-white tabular">
                          {inspectedUser.referralCount} ({invitedMembers.length} synced)
                        </div>
                      </div>
                      <div className="vip-card-3d p-3">
                        <div className="text-[#9cb3a5]">Referral Commission</div>
                        <div dir="ltr" className="mt-1 font-display text-base font-extrabold text-[#FFB800] tabular">
                          PKR {inspectedUser.referralProfit.toLocaleString()}
                        </div>
                        <div className="text-[10px] text-[#9cb3a5]">30% + PKR 30 bonus</div>
                      </div>
                      <div className="vip-card-3d p-3">
                        <div className="text-[#9cb3a5]">Total Withdrawals</div>
                        <div dir="ltr" className="mt-1 font-display text-base font-extrabold text-[#00FF66] tabular">
                          PKR {totalWithdrawnApproved.toLocaleString()}
                        </div>
                        <div className="text-[10px] text-[#FFB800]">
                          {userWithdrawals.length} req · PKR {totalWithdrawnPending.toLocaleString()} pending
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Payout Methods & Accounts (SadaPay, NayaPay, JazzCash, EasyPaisa, etc.) */}
                  <section className="vip-card-3d p-4 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-extrabold text-[#FFB800]">
                        Payout Methods & Wallet Breakdown
                      </span>
                      <span className="text-[10px] text-[#9cb3a5]">
                        {userWithdrawals.length} withdrawal(s)
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      {PAYMENT_METHODS.map((pm) => {
                        const stat = methodTotals.get(pm.name);
                        return (
                          <div
                            key={pm.id}
                            className={`rounded-xl border p-2.5 text-[11px] ${
                              stat
                                ? 'border-[#00FF66]/45 bg-[#00FF66]/10'
                                : 'border-white/10 bg-[#050505]'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <PaymentMethodLogo method={pm.name} size={22} />
                              <span className="font-extrabold text-white truncate">
                                {pm.displayName}
                              </span>
                            </div>
                            {stat ? (
                              <div className="mt-1.5 space-y-0.5">
                                <div dir="ltr" className="font-mono font-bold text-[#00FF66]">
                                  PKR {stat.total.toLocaleString()} ({stat.count}x)
                                </div>
                                <div dir="ltr" className="font-mono text-[10px] text-[#9cb3a5] truncate">
                                  {stat.accounts.join(', ')}
                                </div>
                              </div>
                            ) : (
                              <div className="mt-1 text-[10px] text-[#9cb3a5]">No payouts yet</div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </section>

                  {/* Referred Friends List */}
                  <section className="vip-card-3d p-4 space-y-2">
                    <div className="flex items-center gap-2 text-xs font-extrabold text-[#00FF66]">
                      <Users className="h-4 w-4" aria-hidden="true" />
                      <span>
                        Referred Members ({invitedMembers.length}) · Code: {inspectedUser.inviteCode}
                      </span>
                    </div>
                    {invitedMembers.length === 0 ? (
                      <p className="text-[11px] text-[#9cb3a5]">No invited referrals yet.</p>
                    ) : (
                      <ul className="divide-y divide-white/10">
                        {invitedMembers.map((refUser) => (
                          <li
                            key={refUser.uid}
                            className="py-2 flex items-center justify-between gap-2 text-xs"
                          >
                            <div className="min-w-0">
                              <div className="font-bold text-white truncate">{refUser.name}</div>
                              <div dir="ltr" className="font-mono text-[10px] text-[#9cb3a5]">
                                {refUser.contact}
                              </div>
                            </div>
                            <span className="font-mono text-[11px] font-bold text-[#00FF66] tabular">
                              PKR {refUser.totalEarned.toLocaleString()}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>

                  {/* Account Controls */}
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
                        purgeUserFromWhatsAppStore(inspectedUser.uid, mobileNum);
                        setInspectedUid(null);
                      }}
                      className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-[#FFB800]/45 bg-[#050505] text-xs font-extrabold text-[#FFB800] cursor-pointer"
                    >
                      <Trash2 className="h-4 w-4" />
                      <span>{t('deleteUser')}</span>
                    </button>
                  </div>
                </section>
              );
            })()
          ) : (
            <>
              {/* Interactive Live Earnings Tracker (Pause/Resume + Manual Scroll + Synchronized Delete) */}
              {(() => {
                const liveItems = data.allFeed ?? data.snapshot.liveFeed ?? [];
                const trackerItems =
                  !feedPaused && liveItems.length > 3 ? [...liveItems, ...liveItems] : liveItems;
                return (
                  <section className="vip-card-3d p-4 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Activity className="h-4 w-4 text-[#00FF66]" aria-hidden="true" />
                        <h2 className="font-display text-sm font-extrabold text-white">
                          Live Earnings Tracker
                        </h2>
                      </div>
                      <button
                        type="button"
                        onClick={() => setFeedPaused((p) => !p)}
                        className={`inline-flex min-h-[32px] items-center gap-1 rounded-lg px-2.5 text-[10px] font-extrabold cursor-pointer ${
                          feedPaused
                            ? 'vip-btn-neon'
                            : 'border border-[#00FF66]/40 bg-[#050505] text-[#00FF66]'
                        }`}
                      >
                        {feedPaused ? (
                          <>
                            <Play className="h-3 w-3" />
                            <span>Resume</span>
                          </>
                        ) : (
                          <>
                            <Pause className="h-3 w-3" />
                            <span>Pause</span>
                          </>
                        )}
                      </button>
                    </div>

                    {liveItems.length === 0 ? (
                      <p className="py-5 text-center text-xs text-[#9cb3a5]">{t('noRecords')}</p>
                    ) : (
                      <div
                        className={`h-44 rounded-xl border border-[#00FF66]/15 bg-[#050505] px-3 ${
                          feedPaused || liveItems.length <= 3
                            ? 'overflow-y-auto mobile-scroll'
                            : 'overflow-y-auto overflow-x-hidden mobile-scroll'
                        }`}
                      >
                        <ul
                          className={`divide-y divide-[#00FF66]/10 ${
                            !feedPaused && liveItems.length > 3 ? 'animate-feed-scroll' : ''
                          }`}
                        >
                          {trackerItems.map((item, idx) => (
                            <li
                              key={`${item.id}-${idx}`}
                              className="flex items-center justify-between gap-2 py-2 text-xs"
                            >
                              <div className="min-w-0">
                                <div className="truncate font-semibold text-white">
                                  {item.userName} ·{' '}
                                  <span className="font-normal text-[#9cb3a5]">{item.label}</span>
                                </div>
                                <div className="text-[10px] text-[#9cb3a5]">
                                  {item.uid} · {new Date(item.createdAt).toLocaleTimeString()}
                                </div>
                              </div>
                              <span
                                dir="ltr"
                                className={`shrink-0 font-display text-xs font-extrabold tabular ${
                                  item.kind === 'refund' ? 'text-[#FFB800]' : 'text-[#00FF66]'
                                }`}
                              >
                                +PKR {item.amount}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </section>
                );
              })()}

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
                {filteredUsers.map((member) => {
                  const reg = wa.registrations[member.uid];
                  const prof = getLockedUserProfile(wa, member.uid, member.contact);
                  const mob = reg?.ownAddedNumber || reg?.mobileNumber || member.contact;
                  const nameSplit = reg
                    ? { firstName: reg.firstName, lastName: reg.lastName }
                    : splitName(prof.name || member.name);
                  const userWds = allWithdrawals.filter((w) => w.uid === member.uid);
                  const totalWd = userWds.reduce((sum, w) => sum + w.amount, 0);
                  const methodsUsed = Array.from(new Set(userWds.map((w) => w.method)));

                  return (
                    <div key={member.uid} className="vip-card-3d p-4 space-y-2.5">
                      <button
                        type="button"
                        onClick={() => setInspectedUid(member.uid)}
                        className="w-full text-start space-y-2.5 cursor-pointer"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2.5 min-w-0">
                            {prof.avatarDataUrl ? (
                              <img
                                src={prof.avatarDataUrl}
                                alt={member.name}
                                className="h-10 w-10 shrink-0 rounded-full object-cover border border-[#00FF66]/55"
                              />
                            ) : (
                              <div className="h-10 w-10 shrink-0 rounded-full border border-[#00FF66]/35 bg-[#050505] flex items-center justify-center font-display text-xs font-extrabold text-[#00FF66]">
                                {nameSplit.firstName.slice(0, 1)}
                                {nameSplit.lastName.slice(0, 1)}
                              </div>
                            )}
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="font-display text-sm font-extrabold text-white truncate">
                                  {nameSplit.firstName} {nameSplit.lastName}
                                </span>
                                <span
                                  className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[9px] font-extrabold uppercase ${
                                    member.online
                                      ? 'bg-[#00FF66]/15 text-[#00FF66]'
                                      : 'bg-white/10 text-[#9cb3a5]'
                                  }`}
                                >
                                  <span
                                    className={`h-1.5 w-1.5 rounded-full ${
                                      member.online ? 'bg-[#00FF66]' : 'bg-[#FFB800]'
                                    }`}
                                  />
                                  {member.online ? 'Online' : 'Offline'}
                                </span>
                              </div>
                              <div dir="ltr" className="mt-0.5 font-mono text-[11px] text-[#00FF66] truncate">
                                {mob} · {member.uid}
                              </div>
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

                        <div className="grid grid-cols-3 gap-2 border-t border-white/10 pt-2.5 text-[11px]">
                          <div>
                            <div className="text-[#9cb3a5]">Referrals</div>
                            <div className="font-bold text-white tabular">
                              {member.referralCount} (PKR {member.referralProfit})
                            </div>
                          </div>
                          <div>
                            <div className="text-[#9cb3a5]">Withdrawn</div>
                            <div dir="ltr" className="font-bold text-[#FFB800] tabular">
                              PKR {totalWd.toLocaleString()}
                            </div>
                          </div>
                          <div className="text-end">
                            <div className="text-[#9cb3a5]">Balance</div>
                            <div dir="ltr" className="font-display text-xs font-extrabold text-[#00FF66] tabular">
                              PKR {member.balance.toLocaleString()}
                            </div>
                          </div>
                        </div>

                        {methodsUsed.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-[#9cb3a5]">
                            <span>Payouts:</span>
                            {methodsUsed.map((m) => (
                              <span
                                key={m}
                                className="rounded-md bg-[#00FF66]/12 px-1.5 py-0.5 font-bold text-[#00FF66]"
                              >
                                {m}
                              </span>
                            ))}
                          </div>
                        )}
                      </button>

                      <div className="grid grid-cols-2 gap-2 border-t border-white/10 pt-2.5">
                        <button
                          type="button"
                          onClick={() => setInspectedUid(member.uid)}
                          className="flex min-h-[36px] items-center justify-center gap-1 rounded-xl vip-btn-surface text-[11px] font-bold text-[#00FF66] cursor-pointer"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          <span>Edit Balance</span>
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            await onMemberAction(member.uid, 'delete');
                            purgeUserFromWhatsAppStore(member.uid, mob);
                          }}
                          className="flex min-h-[36px] items-center justify-center gap-1 rounded-xl border border-[#FFB800]/50 bg-[#050505] text-[11px] font-extrabold text-[#FFB800] cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>Delete User</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};
