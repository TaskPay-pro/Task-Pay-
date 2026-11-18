import { useEffect, useState } from 'react';

export type WaMediaKind = 'text' | 'image' | 'video' | 'voice';
export type AdminRoleId = 'ADMIN-1' | 'ADMIN-2' | 'ADMIN-3';

export const STRICT_MOBILE_RE = /^03\d{9}$/;

export function maskMobileNumber(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 5) return '03******000';
  const prefix = digits.startsWith('03') ? '03' : digits.slice(0, 2);
  const suffix = digits.slice(-3);
  const stars = '*'.repeat(Math.max(4, digits.length - 5));
  return `${prefix}${stars}${suffix}`;
}

export interface WaSupportRegistration {
  uid: string;
  receiptId?: string;
  firstName: string;
  lastName: string;
  mobileNumber: string;
  bio: string;
  avatarDataUrl?: string;
  ownAddedNumber?: string;
  adminAssignedNumber?: string;
  status: 'pending' | 'approved' | 'rejected';
  rejectionReason?: string;
  submittedAt: string;
  reviewedAt?: string;
  chatUnlocked: boolean;
}

export interface WaBlockLock {
  targetId: string;
  targetName: string;
  targetNumber?: string;
  adminId: string;
  createdAt: string;
}

export interface WaUserProfile {
  uid: string;
  username: string;
  mobileNumber?: string;
  about: string;
  avatarDataUrl?: string;
  locked: boolean;
  updatedAt: string;
}

export interface WaLockedMobileProfile {
  mobileNumber: string;
  fullName: string;
  avatarDataUrl?: string;
  locked: true;
  createdAt: string;
}

export interface WaChatRequest {
  id: string;
  senderUid: string;
  senderName: string;
  senderMobile: string;
  senderAvatar?: string;
  recipientUid?: string;
  recipientName: string;
  recipientMobile: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: string;
  respondedAt?: string;
}

export interface WaContact {
  id: string;
  ownerUid: string;
  firstName: string;
  lastName: string;
  phoneNumber: string; // Strictly 11-digit starting with 03
  avatarDataUrl?: string;
  createdAt: string;
}

export interface WaGroup {
  id: string;
  ownerUid: string;
  name: string;
  memberIds: string[];
  memberSummary: string;
  avatarDataUrl?: string;
  createdAt: string;
}

export interface WaDirectMessage {
  id: string;
  chatId: string;
  chatTitle: string;
  ownerUid: string;
  ownerName: string;
  recipientLabel: string;
  senderRole: 'user' | 'admin';
  senderUid: string;
  senderName: string;
  senderAvatar?: string;
  kind: WaMediaKind;
  text?: string;
  mediaDataUrl?: string;
  fileName?: string;
  durationSec?: number;
  tickState: 1 | 2 | 3;
  createdAt: string;
}

export interface WaStatusUpdate {
  id: string;
  authorUid: string;
  authorName: string;
  authorAvatar?: string;
  kind: 'text' | 'image' | 'video';
  text?: string;
  mediaDataUrl?: string;
  fileName?: string;
  views: number;
  createdAt: string;
}

export interface WaCallLog {
  id: string;
  ownerUid: string;
  peerName: string;
  peerNumber: string;
  callType: 'audio' | 'video';
  direction: 'outgoing' | 'incoming';
  status: 'connected' | 'missed' | 'ended';
  durationLabel: string;
  createdAt: string;
}

export interface WhatsAppStoreState {
  activeAdminId: AdminRoleId;
  registrations: Record<string, WaSupportRegistration>;
  approvalHistory: WaSupportRegistration[];
  blockLocks: WaBlockLock[];
  disabledChatUids: string[];
  profiles: Record<string, WaUserProfile>;
  mobileProfiles: Record<string, WaLockedMobileProfile>;
  chatRequests: WaChatRequest[];
  contacts: WaContact[];
  groups: WaGroup[];
  directMessages: WaDirectMessage[];
  statusUpdates: WaStatusUpdate[];
  callLogs: WaCallLog[];
  deletedForMe: Record<string, string[]>;
  deletedForEveryoneIds: string[];
  blockedChatIds: string[];
  clearedServerRooms: Record<string, string>;
}

export const ADMIN_OPERATORS: readonly {
  id: AdminRoleId;
  label: string;
  title: string;
  scope: string;
  mobile: string;
}[] = [
  {
    id: 'ADMIN-1',
    label: 'Admin 1',
    title: 'Chat Manager',
    scope: 'Views and manages direct user chat conversations (including disabled users)',
    mobile: '03265410214',
  },
  {
    id: 'ADMIN-2',
    label: 'Admin 2',
    title: 'Approval Manager',
    scope: 'Handles incoming chat registration receipts (Approve / Reject / Re-reject)',
    mobile: '03000000002',
  },
  {
    id: 'ADMIN-3',
    label: 'Admin 3',
    title: 'Disable / Block Manager',
    scope: 'Disables or enables user chat (disabled users can only contact Admin 1)',
    mobile: '03000000003',
  },
] as const;

export const DEFAULT_ADMIN_NUMBER = '03001122334';

const STORAGE_KEY = 'taskpay_wa_store_v1';
const CHANGE_EVENT = 'taskpay-wa-store-updated';

function createInitialStore(): WhatsAppStoreState {
  const now = Date.now();
  return {
    activeAdminId: 'ADMIN-1',
    registrations: {},
    approvalHistory: [],
    blockLocks: [],
    disabledChatUids: [],
    profiles: {},
    mobileProfiles: {},
    chatRequests: [],
    contacts: [
      {
        id: 'cnt-seed-1',
        ownerUid: 'GLOBAL',
        firstName: 'TaskPay',
        lastName: 'Verification Desk',
        phoneNumber: DEFAULT_ADMIN_NUMBER,
        createdAt: new Date(now - 86400_000).toISOString(),
      },
    ],
    groups: [],
    directMessages: [],
    statusUpdates: [
      {
        id: 'st-seed-official',
        authorUid: 'ADMIN',
        authorName: 'TaskPay VIP Official',
        kind: 'text',
        text: 'Welcome to TaskPay Support! Verification queue is active 24/7.',
        views: 42,
        createdAt: new Date(now - 3600_000 * 3).toISOString(),
      },
    ],
    callLogs: [],
    deletedForMe: {},
    deletedForEveryoneIds: [],
    blockedChatIds: [],
    clearedServerRooms: {},
  };
}

function readStore(): WhatsAppStoreState {
  if (typeof window === 'undefined') return createInitialStore();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return createInitialStore();
    const parsed = JSON.parse(raw) as Partial<WhatsAppStoreState>;
    const fallback = createInitialStore();
    const blockLocks = Array.isArray(parsed.blockLocks) ? parsed.blockLocks : [];
    const disabledChatUids = Array.isArray(parsed.disabledChatUids) ? parsed.disabledChatUids : [];
    const activeAdminId: AdminRoleId =
      parsed.activeAdminId === 'ADMIN-1' ||
      parsed.activeAdminId === 'ADMIN-2' ||
      parsed.activeAdminId === 'ADMIN-3'
        ? parsed.activeAdminId
        : 'ADMIN-1';

    const rawRegs = parsed.registrations ?? fallback.registrations;
    const normalizedRegs: Record<string, WaSupportRegistration> = {};
    for (const [k, v] of Object.entries(rawRegs)) {
      if (v) {
        normalizedRegs[k] = {
          ...v,
          bio: typeof v.bio === 'string' ? v.bio : '',
        };
      }
    }

    const rawHistory = Array.isArray(parsed.approvalHistory)
      ? parsed.approvalHistory
      : Object.values(normalizedRegs);
    const histDedupe = new Map<string, WaSupportRegistration>();
    for (const item of rawHistory) {
      if (!item || !item.uid) continue;
      const receiptKey = item.receiptId?.trim() || normalizedRegs[item.uid]?.receiptId || `REC-${item.uid}`;
      const existing = histDedupe.get(receiptKey);
      histDedupe.set(receiptKey, {
        ...existing,
        ...item,
        receiptId: receiptKey,
        bio: typeof item.bio === 'string' ? item.bio : existing?.bio || '',
      });
    }
    const normalizedHistory: WaSupportRegistration[] = Array.from(histDedupe.values());

    return {
      activeAdminId,
      registrations: normalizedRegs,
      approvalHistory: normalizedHistory,
      blockLocks,
      disabledChatUids,
      profiles: parsed.profiles ?? fallback.profiles,
      mobileProfiles: parsed.mobileProfiles ?? fallback.mobileProfiles,
      chatRequests: Array.isArray(parsed.chatRequests) ? parsed.chatRequests : fallback.chatRequests,
      contacts: Array.isArray(parsed.contacts) ? parsed.contacts : fallback.contacts,
      groups: Array.isArray(parsed.groups) ? parsed.groups : fallback.groups,
      directMessages: Array.isArray(parsed.directMessages) ? parsed.directMessages : fallback.directMessages,
      statusUpdates: Array.isArray(parsed.statusUpdates) ? parsed.statusUpdates : fallback.statusUpdates,
      callLogs: Array.isArray(parsed.callLogs) ? parsed.callLogs : fallback.callLogs,
      deletedForMe: parsed.deletedForMe ?? fallback.deletedForMe,
      deletedForEveryoneIds: Array.isArray(parsed.deletedForEveryoneIds)
        ? parsed.deletedForEveryoneIds
        : fallback.deletedForEveryoneIds,
      blockedChatIds: Array.isArray(parsed.blockedChatIds)
        ? parsed.blockedChatIds
        : blockLocks.map((b) => b.targetId),
      clearedServerRooms: parsed.clearedServerRooms ?? fallback.clearedServerRooms,
    };
  } catch {
    return createInitialStore();
  }
}

function writeStore(next: WhatsAppStoreState) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    const trimmed: WhatsAppStoreState = {
      ...next,
      directMessages: next.directMessages.slice(-40).map((m, idx, arr) =>
        idx < arr.length - 10 && m.mediaDataUrl && m.mediaDataUrl.length > 250_000
          ? { ...m, mediaDataUrl: undefined, text: `${m.text || m.fileName || 'Media'} (archived)` }
          : m
      ),
      statusUpdates: next.statusUpdates.slice(0, 15),
    };
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    } catch {
      // Ignore quota failure
    }
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function updateStore(updater: (prev: WhatsAppStoreState) => WhatsAppStoreState): WhatsAppStoreState {
  const prev = readStore();
  const next = updater(prev);
  writeStore(next);
  return next;
}

export function useWhatsAppStore(): WhatsAppStoreState {
  const [store, setStore] = useState<WhatsAppStoreState>(() => readStore());

  useEffect(() => {
    const sync = () => setStore(readStore());
    const onStorage = (e: StorageEvent) => {
      if (!e.key || e.key === STORAGE_KEY) sync();
    };
    window.addEventListener(CHANGE_EVENT, sync);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(CHANGE_EVENT, sync);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  return store;
}

// ---------------------------------------------------------------------------
// Locked User Profile Persistence (Immutable once set at Registration/Setup)
// ---------------------------------------------------------------------------

export function lockRegisteredUserProfile(
  mobileNumber: string,
  fullName: string,
  avatarDataUrl?: string,
  uid?: string
) {
  const cleanMob = mobileNumber.trim().replace(/[\s-]/g, '');
  const cleanName = fullName.trim();
  if (!cleanMob || !cleanName) return;

  updateStore((prev) => {
    const existingMob = prev.mobileProfiles[cleanMob];
    // Permanently locked once registered
    const lockedMobProfile: WaLockedMobileProfile = existingMob?.locked
      ? existingMob
      : {
          mobileNumber: cleanMob,
          fullName: cleanName,
          avatarDataUrl: avatarDataUrl || existingMob?.avatarDataUrl,
          locked: true,
          createdAt: new Date().toISOString(),
        };

    const nextProfiles = { ...prev.profiles };
    if (uid) {
      const existingUidProf = nextProfiles[uid];
      if (!existingUidProf?.locked) {
        nextProfiles[uid] = {
          uid,
          username: lockedMobProfile.fullName,
          mobileNumber: cleanMob,
          about: `ID: ${maskMobileNumber(cleanMob)}`,
          avatarDataUrl: lockedMobProfile.avatarDataUrl,
          locked: true,
          updatedAt: new Date().toISOString(),
        };
      }
    }

    return {
      ...prev,
      mobileProfiles: {
        ...prev.mobileProfiles,
        [cleanMob]: lockedMobProfile,
      },
      profiles: nextProfiles,
    };
  });
}

export function getLockedUserProfile(
  store: WhatsAppStoreState,
  uid?: string,
  mobileNumber?: string
): { name?: string; avatarDataUrl?: string; locked: boolean } {
  if (uid && store.profiles[uid]) {
    return {
      name: store.profiles[uid].username,
      avatarDataUrl: store.profiles[uid].avatarDataUrl,
      locked: !!store.profiles[uid].locked,
    };
  }
  if (mobileNumber && store.mobileProfiles[mobileNumber]) {
    const mp = store.mobileProfiles[mobileNumber];
    return {
      name: mp.fullName,
      avatarDataUrl: mp.avatarDataUrl,
      locked: mp.locked,
    };
  }
  return { locked: false };
}

// ---------------------------------------------------------------------------
// Mandatory Support Registration & Admin 2 Approval Flow
// ---------------------------------------------------------------------------

export function submitSupportRegistration(
  uid: string,
  firstName: string,
  lastName: string,
  mobileNumber: string,
  bio: string,
  avatarDataUrl?: string
): WaSupportRegistration {
  const cleanFirst = firstName.trim();
  const cleanLast = lastName.trim();
  const cleanMob = mobileNumber.trim().replace(/[\s-]/g, '');
  const cleanBio = bio.trim();
  const fullName = `${cleanFirst} ${cleanLast}`.trim();

  const existing = readStore().registrations[uid];
  const existingMobileProf = readStore().mobileProfiles[cleanMob];
  const finalAvatar = existing?.avatarDataUrl || existingMobileProf?.avatarDataUrl || avatarDataUrl;

  const receiptId =
    existing && existing.status === 'pending' && existing.receiptId
      ? existing.receiptId
      : `REC-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;

  const record: WaSupportRegistration = {
    uid,
    receiptId,
    firstName: cleanFirst || existing?.firstName || '',
    lastName: cleanLast || existing?.lastName || '',
    mobileNumber: cleanMob,
    bio: cleanBio,
    avatarDataUrl: finalAvatar,
    status: 'pending',
    submittedAt: new Date().toISOString(),
    chatUnlocked: false,
  };

  updateStore((prev) => {
    const nextProfiles = { ...prev.profiles };
    if (!nextProfiles[uid]?.locked) {
      nextProfiles[uid] = {
        uid,
        username: fullName,
        mobileNumber: cleanMob,
        about: cleanBio || `ID: ${maskMobileNumber(cleanMob)}`,
        avatarDataUrl: finalAvatar,
        locked: true,
        updatedAt: new Date().toISOString(),
      };
    }

    const nextMobProfiles = { ...prev.mobileProfiles };
    if (!nextMobProfiles[cleanMob]?.locked) {
      nextMobProfiles[cleanMob] = {
        mobileNumber: cleanMob,
        fullName,
        avatarDataUrl: finalAvatar,
        locked: true,
        createdAt: new Date().toISOString(),
      };
    }

    const nextHistory = [
      record,
      ...prev.approvalHistory.filter((h) => h.receiptId !== record.receiptId),
    ];

    return {
      ...prev,
      registrations: {
        ...prev.registrations,
        [uid]: record,
      },
      approvalHistory: nextHistory,
      profiles: nextProfiles,
      mobileProfiles: nextMobProfiles,
    };
  });
  return record;
}

export function reviewSupportRegistration(
  uid: string,
  decision: 'approved' | 'rejected',
  adminNumber?: string,
  rejectionReason?: string,
  receiptId?: string
) {
  updateStore((prev) => {
    const histMatch = receiptId
      ? prev.approvalHistory.find((h) => h.receiptId === receiptId)
      : prev.approvalHistory.find((h) => h.uid === uid);
    const existing = prev.registrations[uid] || histMatch;
    if (!existing) return prev;
    const assigned =
      decision === 'approved'
        ? adminNumber?.trim() || existing.adminAssignedNumber || DEFAULT_ADMIN_NUMBER
        : existing.adminAssignedNumber;
    const nowIso = new Date().toISOString();
    const updated: WaSupportRegistration = {
      ...existing,
      ...(receiptId ? { receiptId } : {}),
      status: decision,
      adminAssignedNumber: assigned,
      rejectionReason:
        decision === 'rejected'
          ? rejectionReason?.trim() || 'Rejected by Admin 2'
          : undefined,
      reviewedAt: nowIso,
      chatUnlocked: decision === 'approved',
    };

    const nextHistory = prev.approvalHistory.some(
      (h) => (updated.receiptId && h.receiptId === updated.receiptId) || h.uid === uid
    )
      ? prev.approvalHistory.map((h) =>
          (updated.receiptId && h.receiptId === updated.receiptId) || (!receiptId && h.uid === uid)
            ? updated
            : h
        )
      : [updated, ...prev.approvalHistory];

    return {
      ...prev,
      registrations: {
        ...prev.registrations,
        [uid]: updated,
      },
      approvalHistory: nextHistory,
    };
  });
}

export function hydrateServerSupportState(params: {
  supportRegistration?: WaSupportRegistration | null;
  supportApprovalHistory?: WaSupportRegistration[];
  allSupportRegistrations?: WaSupportRegistration[];
  allSupportApprovalHistory?: WaSupportRegistration[];
  disabledChatUids?: string[];
}) {
  if (typeof window === 'undefined') return;
  const incomingRegs: WaSupportRegistration[] = [];
  if (Array.isArray(params.allSupportRegistrations)) {
    incomingRegs.push(...params.allSupportRegistrations);
  }
  if (params.supportRegistration) {
    incomingRegs.push(params.supportRegistration);
  }

  const incomingHistory: WaSupportRegistration[] = [
    ...(Array.isArray(params.allSupportApprovalHistory) ? params.allSupportApprovalHistory : []),
    ...(Array.isArray(params.supportApprovalHistory) ? params.supportApprovalHistory : []),
    ...incomingRegs,
  ];

  const hasDisabledList = Array.isArray(params.disabledChatUids);
  if (incomingRegs.length === 0 && incomingHistory.length === 0 && !hasDisabledList) return;

  const prev = readStore();
  let changed = false;

  const nextRegs = { ...prev.registrations };
  for (const srv of incomingRegs) {
    if (!srv?.uid) continue;
    const cur = nextRegs[srv.uid];
    const merged: WaSupportRegistration = {
      ...cur,
      ...srv,
      avatarDataUrl: cur?.avatarDataUrl || srv.avatarDataUrl,
      ownAddedNumber: cur?.ownAddedNumber || srv.ownAddedNumber,
      bio: typeof srv.bio === 'string' ? srv.bio : cur?.bio || '',
    };
    if (
      !cur ||
      cur.status !== merged.status ||
      cur.chatUnlocked !== merged.chatUnlocked ||
      cur.bio !== merged.bio ||
      cur.rejectionReason !== merged.rejectionReason ||
      cur.submittedAt !== merged.submittedAt ||
      cur.reviewedAt !== merged.reviewedAt ||
      cur.receiptId !== merged.receiptId
    ) {
      nextRegs[srv.uid] = merged;
      changed = true;
    }
  }

  const histMap = new Map<string, WaSupportRegistration>();
  for (const item of prev.approvalHistory) {
    const key = item.receiptId?.trim() || `REC-${item.uid}`;
    histMap.set(key, { ...item, receiptId: key });
  }
  for (const srv of incomingHistory) {
    if (!srv?.uid) continue;
    const key = srv.receiptId?.trim() || `REC-${srv.uid}`;
    const cur = histMap.get(key);
    const merged: WaSupportRegistration = {
      ...cur,
      ...srv,
      receiptId: key,
      avatarDataUrl: cur?.avatarDataUrl || srv.avatarDataUrl,
      ownAddedNumber: cur?.ownAddedNumber || srv.ownAddedNumber,
      bio: typeof srv.bio === 'string' ? srv.bio : cur?.bio || '',
    };
    if (
      !cur ||
      cur.status !== merged.status ||
      cur.chatUnlocked !== merged.chatUnlocked ||
      cur.bio !== merged.bio ||
      cur.rejectionReason !== merged.rejectionReason ||
      cur.submittedAt !== merged.submittedAt ||
      cur.reviewedAt !== merged.reviewedAt ||
      cur.receiptId !== merged.receiptId
    ) {
      histMap.set(key, merged);
      changed = true;
    }
  }

  const nextHistory = Array.from(histMap.values()).sort(
    (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
  );

  let nextDisabled = prev.disabledChatUids;
  if (hasDisabledList) {
    const incomingSet = Array.from(new Set(params.disabledChatUids!));
    if (
      incomingSet.length !== prev.disabledChatUids.length ||
      incomingSet.some((id, idx) => prev.disabledChatUids[idx] !== id)
    ) {
      nextDisabled = incomingSet;
      changed = true;
    }
  }

  if (!changed) return;
  writeStore({
    ...prev,
    registrations: nextRegs,
    approvalHistory: nextHistory,
    disabledChatUids: nextDisabled,
  });
}

export function completeRegistrationWithOwnNumber(uid: string, ownNumber: string) {
  updateStore((prev) => {
    const reg = prev.registrations[uid];
    if (!reg || reg.status !== 'approved') return prev;
    const fullName = `${reg.firstName} ${reg.lastName}`.trim();
    const adminNum = reg.adminAssignedNumber || DEFAULT_ADMIN_NUMBER;
    const cleanOwn = ownNumber.trim().replace(/[\s-]/g, '');

    const hasAdminContact = prev.contacts.some(
      (c) =>
        (c.ownerUid === uid || c.ownerUid === 'GLOBAL') && c.phoneNumber === adminNum
    );

    const nextContacts = hasAdminContact
      ? prev.contacts
      : [
          {
            id: `cnt-admin-${Date.now()}`,
            ownerUid: uid,
            firstName: 'TaskPay',
            lastName: 'Admin',
            phoneNumber: adminNum,
            createdAt: new Date().toISOString(),
          },
          ...prev.contacts,
        ];

    const existingProf = prev.profiles[uid];
    const lockedAvatar = existingProf?.avatarDataUrl || reg.avatarDataUrl || prev.mobileProfiles[reg.mobileNumber]?.avatarDataUrl;

    return {
      ...prev,
      registrations: {
        ...prev.registrations,
        [uid]: {
          ...reg,
          ownAddedNumber: cleanOwn,
          chatUnlocked: true,
        },
      },
      profiles: {
        ...prev.profiles,
        [uid]: existingProf?.locked
          ? {
              ...existingProf,
              avatarDataUrl: existingProf.avatarDataUrl || lockedAvatar,
            }
          : {
              uid,
              username: fullName,
              mobileNumber: cleanOwn,
              about: `ID: ${maskMobileNumber(cleanOwn)}`,
              avatarDataUrl: lockedAvatar,
              locked: true,
              updatedAt: new Date().toISOString(),
            },
      },
      contacts: nextContacts,
    };
  });
}

// ---------------------------------------------------------------------------
// Chat Request & Acceptance System
// ---------------------------------------------------------------------------

export function sendChatRequest(params: {
  senderUid: string;
  senderName: string;
  senderMobile: string;
  senderAvatar?: string;
  recipientUid?: string;
  recipientName: string;
  recipientMobile: string;
}): WaChatRequest {
  const cleanSenderMob = params.senderMobile.trim().replace(/[\s-]/g, '');
  const cleanRecipMob = params.recipientMobile.trim().replace(/[\s-]/g, '');

  let createdOrExisting: WaChatRequest | null = null;
  updateStore((prev) => {
    const existing = prev.chatRequests.find(
      (r) =>
        (r.senderMobile === cleanSenderMob && r.recipientMobile === cleanRecipMob) ||
        (r.senderMobile === cleanRecipMob && r.recipientMobile === cleanSenderMob) ||
        (params.recipientUid &&
          ((r.senderUid === params.senderUid && r.recipientUid === params.recipientUid) ||
            (r.senderUid === params.recipientUid && r.recipientUid === params.senderUid)))
    );

    if (existing) {
      createdOrExisting = existing;
      return prev;
    }

    const req: WaChatRequest = {
      id: `creq-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      senderUid: params.senderUid,
      senderName: params.senderName.trim(),
      senderMobile: cleanSenderMob,
      senderAvatar: params.senderAvatar,
      recipientUid: params.recipientUid,
      recipientName: params.recipientName.trim(),
      recipientMobile: cleanRecipMob,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    createdOrExisting = req;
    return {
      ...prev,
      chatRequests: [req, ...prev.chatRequests],
    };
  });

  return createdOrExisting!;
}

export function respondToChatRequest(requestId: string, decision: 'accepted' | 'rejected') {
  updateStore((prev) => {
    const target = prev.chatRequests.find((r) => r.id === requestId);
    if (!target) return prev;

    const updatedRequests = prev.chatRequests.map((r) =>
      r.id === requestId
        ? { ...r, status: decision, respondedAt: new Date().toISOString() }
        : r
    );

    let nextContacts = prev.contacts;
    if (decision === 'accepted' && target.recipientUid) {
      const nameParts = target.senderName.split(/\s+/);
      const fn = nameParts[0] || target.senderName;
      const ln = nameParts.slice(1).join(' ') || 'Member';
      const alreadyHas = prev.contacts.some(
        (c) => c.ownerUid === target.recipientUid && c.phoneNumber === target.senderMobile
      );
      if (!alreadyHas) {
        nextContacts = [
          {
            id: `cnt-req-${Date.now()}`,
            ownerUid: target.recipientUid,
            firstName: fn,
            lastName: ln,
            phoneNumber: target.senderMobile,
            avatarDataUrl: target.senderAvatar,
            createdAt: new Date().toISOString(),
          },
          ...prev.contacts,
        ];
      }
    }

    return {
      ...prev,
      chatRequests: updatedRequests,
      contacts: nextContacts,
    };
  });
}

export function getConnectionRequestStatus(
  store: WhatsAppStoreState,
  myUid: string,
  myMobile: string,
  peerUid?: string,
  peerMobile?: string
): {
  state: 'none' | 'pending_sent' | 'pending_received' | 'accepted' | 'rejected';
  request?: WaChatRequest;
} {
  const cleanMyMob = myMobile.trim().replace(/[\s-]/g, '');
  const cleanPeerMob = (peerMobile || '').trim().replace(/[\s-]/g, '');

  const match = store.chatRequests.find((r) => {
    const iAmSender = r.senderUid === myUid || (!!cleanMyMob && r.senderMobile === cleanMyMob);
    const iAmRecip =
      (!!peerUid && r.senderUid === peerUid) ||
      (!!cleanPeerMob && r.senderMobile === cleanPeerMob);
    const matchesDirect =
      iAmSender &&
      ((!!peerUid && r.recipientUid === peerUid) ||
        (!!cleanPeerMob && r.recipientMobile === cleanPeerMob));
    const matchesReverse =
      iAmRecip &&
      (r.recipientUid === myUid || (!!cleanMyMob && r.recipientMobile === cleanMyMob));
    return matchesDirect || matchesReverse;
  });

  if (!match) return { state: 'none' };
  if (match.status === 'accepted') return { state: 'accepted', request: match };
  if (match.status === 'rejected') return { state: 'rejected', request: match };

  const isSentByMe =
    match.senderUid === myUid || (!!cleanMyMob && match.senderMobile === cleanMyMob);
  return {
    state: isSentByMe ? 'pending_sent' : 'pending_received',
    request: match,
  };
}

// ---------------------------------------------------------------------------
// 3 Admin Operators & Exclusive Blocking Rules
// ---------------------------------------------------------------------------

export function setActiveAdminId(adminId: AdminRoleId) {
  updateStore((prev) => ({ ...prev, activeAdminId: adminId }));
}

export function toggleDisableUserChat(uid: string) {
  updateStore((prev) => {
    const isDisabled = prev.disabledChatUids.includes(uid);
    const nextDisabled = isDisabled
      ? prev.disabledChatUids.filter((id) => id !== uid)
      : [...prev.disabledChatUids, uid];
    return {
      ...prev,
      disabledChatUids: nextDisabled,
    };
  });
}

export function toggleBlockTarget(
  targetId: string,
  targetName?: string,
  targetNumber?: string,
  adminIdOverride?: AdminRoleId
) {
  updateStore((prev) => {
    const actorAdminId = adminIdOverride || prev.activeAdminId || 'ADMIN-3';
    const existingLock = prev.blockLocks.find((l) => l.targetId === targetId);

    if (existingLock) {
      if (existingLock.adminId !== actorAdminId) {
        return prev;
      }
      const nextLocks = prev.blockLocks.filter((l) => l.targetId !== targetId);
      return {
        ...prev,
        blockLocks: nextLocks,
        blockedChatIds: nextLocks.map((l) => l.targetId),
      };
    }

    const adminHasOtherLock = prev.blockLocks.some((l) => l.adminId === actorAdminId);
    if (adminHasOtherLock) {
      return prev;
    }

    const reg = prev.registrations[targetId];
    const newLock: WaBlockLock = {
      targetId,
      targetName: targetName || (reg ? `${reg.firstName} ${reg.lastName}` : targetId),
      targetNumber: targetNumber || reg?.ownAddedNumber || reg?.mobileNumber,
      adminId: actorAdminId,
      createdAt: new Date().toISOString(),
    };
    const nextLocks = [...prev.blockLocks, newLock];
    return {
      ...prev,
      blockLocks: nextLocks,
      blockedChatIds: nextLocks.map((l) => l.targetId),
    };
  });
}

export function getAdminBlockStatus(
  store: WhatsAppStoreState,
  adminId: string,
  targetId: string
): {
  allowed: boolean;
  reason?: string;
  lockOnTarget?: WaBlockLock;
  adminExclusiveLock?: WaBlockLock;
  disabledByAdmin3?: boolean;
} {
  const disabledByAdmin3 = store.disabledChatUids.includes(targetId);
  if (disabledByAdmin3 && adminId !== 'ADMIN-1') {
    return {
      allowed: false,
      disabledByAdmin3: true,
      reason: 'Chat disabled by Admin 3. Disabled users can only message Admin 1 (Main Chat Admin).',
    };
  }

  const lockOnTarget = store.blockLocks.find((l) => l.targetId === targetId);
  const adminExclusiveLock = store.blockLocks.find((l) => l.adminId === adminId);

  if (lockOnTarget && lockOnTarget.adminId !== adminId) {
    return {
      allowed: false,
      disabledByAdmin3,
      reason: `Blocked exclusively by ${lockOnTarget.adminId}. Other admins cannot access or message this user.`,
      lockOnTarget,
      adminExclusiveLock,
    };
  }

  if (adminExclusiveLock && adminExclusiveLock.targetId !== targetId) {
    return {
      allowed: false,
      disabledByAdmin3,
      reason: `Exclusive lock active: Since ${adminId} blocked ${adminExclusiveLock.targetName}, only they can contact them.`,
      lockOnTarget,
      adminExclusiveLock,
    };
  }

  return { allowed: true, disabledByAdmin3, lockOnTarget, adminExclusiveLock };
}

export function getUserLockRestriction(
  store: WhatsAppStoreState,
  currentUserUid: string,
  targetChatId: string,
  targetNumber?: string
): { blocked: boolean; lockedToAdminId?: string; reason?: string; disabledByAdmin3?: boolean } {
  // Admin 3 Chat-Disable Rule: Disabled users can ONLY message Admin 1 (Main Chat Admin)
  if (store.disabledChatUids.includes(currentUserUid)) {
    if (targetChatId === 'support-admin') {
      return { blocked: false, lockedToAdminId: 'ADMIN-1', disabledByAdmin3: true };
    }
    return {
      blocked: true,
      lockedToAdminId: 'ADMIN-1',
      disabledByAdmin3: true,
      reason: 'Chat has been disabled, please contact support admin.',
    };
  }

  const targetLock = store.blockLocks.find(
    (l) =>
      l.targetId === targetChatId ||
      (!!targetNumber && !!l.targetNumber && l.targetNumber === targetNumber)
  );

  if (currentUserUid === targetLock?.targetId && targetChatId === 'support-admin') {
    return { blocked: false, lockedToAdminId: targetLock.adminId };
  }

  if (targetLock && currentUserUid !== targetLock.targetId) {
    return {
      blocked: true,
      lockedToAdminId: targetLock.adminId,
      reason: `Restricted: Only ${targetLock.adminId} can contact this person. Other users cannot access or message them.`,
    };
  }

  const selfLock = store.blockLocks.find((l) => l.targetId === currentUserUid);
  if (selfLock && targetChatId !== 'support-admin' && targetChatId !== currentUserUid) {
    return {
      blocked: true,
      lockedToAdminId: selfLock.adminId,
      reason: `You are in an exclusive admin session with ${selfLock.adminId}. Other chats are disabled.`,
    };
  }

  return { blocked: false, lockedToAdminId: selfLock?.adminId };
}

export function purgeUserFromWhatsAppStore(uid: string, mobile?: string) {
  const cleanMob = mobile?.trim().replace(/[\s-]/g, '');
  updateStore((prev) => {
    const nextRegs = { ...prev.registrations };
    const regMob = (nextRegs[uid]?.mobileNumber || nextRegs[uid]?.ownAddedNumber || '')
      .trim()
      .replace(/[\s-]/g, '');
    delete nextRegs[uid];

    const matchedMobiles = new Set([cleanMob, regMob].filter(Boolean) as string[]);

    for (const [k, r] of Object.entries(nextRegs)) {
      const rm = (r.mobileNumber || '').trim().replace(/[\s-]/g, '');
      const om = (r.ownAddedNumber || '').trim().replace(/[\s-]/g, '');
      if (r.uid === uid || (rm && matchedMobiles.has(rm)) || (om && matchedMobiles.has(om))) {
        delete nextRegs[k];
      }
    }

    const nextProfiles = { ...prev.profiles };
    delete nextProfiles[uid];

    const nextMobileProfiles = { ...prev.mobileProfiles };
    for (const m of matchedMobiles) {
      delete nextMobileProfiles[m];
    }

    const nextLocks = prev.blockLocks.filter((l) => l.targetId !== uid);
    const nextCleared = { ...prev.clearedServerRooms };
    delete nextCleared[uid];

    return {
      ...prev,
      registrations: nextRegs,
      approvalHistory: prev.approvalHistory.filter((h) => {
        const hm = (h.mobileNumber || '').trim().replace(/[\s-]/g, '');
        return h.uid !== uid && (!hm || !matchedMobiles.has(hm));
      }),
      profiles: nextProfiles,
      mobileProfiles: nextMobileProfiles,
      blockLocks: nextLocks,
      blockedChatIds: nextLocks.map((l) => l.targetId),
      disabledChatUids: prev.disabledChatUids.filter((id) => id !== uid),
      chatRequests: prev.chatRequests.filter((r) => {
        if (r.senderUid === uid || r.recipientUid === uid) return false;
        const sm = r.senderMobile.trim().replace(/[\s-]/g, '');
        const rm = r.recipientMobile.trim().replace(/[\s-]/g, '');
        return !matchedMobiles.has(sm) && !matchedMobiles.has(rm);
      }),
      contacts: prev.contacts.filter((c) => {
        if (c.ownerUid === uid) return false;
        const pm = c.phoneNumber.trim().replace(/[\s-]/g, '');
        return !matchedMobiles.has(pm);
      }),
      groups: prev.groups
        .filter((g) => g.ownerUid !== uid)
        .map((g) =>
          g.memberIds.includes(uid)
            ? { ...g, memberIds: g.memberIds.filter((id) => id !== uid) }
            : g
        ),
      directMessages: prev.directMessages.filter((m) => {
        if (m.ownerUid === uid || m.senderUid === uid || m.chatId === `support:${uid}`) {
          return false;
        }
        if (m.chatId.includes(uid)) return false;
        for (const mob of matchedMobiles) {
          if (mob && m.chatId.includes(mob)) return false;
        }
        return true;
      }),
      statusUpdates: prev.statusUpdates.filter((s) => s.authorUid !== uid),
      callLogs: prev.callLogs.filter((c) => c.ownerUid !== uid),
      clearedServerRooms: nextCleared,
    };
  });
}

export function purgeWipedUsersFromWhatsAppStore(
  wipedEntries: { uid: string; mobile?: string }[],
  activeUids?: string[]
) {
  if (typeof window === 'undefined' || !wipedEntries || wipedEntries.length === 0) return;
  const activeSet = new Set(activeUids ?? []);
  const wipedUidSet = new Set(
    wipedEntries.map((e) => e.uid).filter((id) => Boolean(id) && !activeSet.has(id))
  );
  if (wipedUidSet.size === 0) return;

  const prev = readStore();
  let changed = false;

  const nextRegs = { ...prev.registrations };
  const nextProfiles = { ...prev.profiles };
  const nextCleared = { ...prev.clearedServerRooms };

  for (const wUid of wipedUidSet) {
    if (nextRegs[wUid]) {
      delete nextRegs[wUid];
      changed = true;
    }
    if (nextProfiles[wUid]) {
      delete nextProfiles[wUid];
      changed = true;
    }
    if (nextCleared[wUid]) {
      delete nextCleared[wUid];
      changed = true;
    }
  }

  const nextHistory = prev.approvalHistory.filter((h) => !wipedUidSet.has(h.uid));
  if (nextHistory.length !== prev.approvalHistory.length) changed = true;

  const nextLocks = prev.blockLocks.filter((l) => !wipedUidSet.has(l.targetId));
  if (nextLocks.length !== prev.blockLocks.length) changed = true;

  const nextDisabled = prev.disabledChatUids.filter((id) => !wipedUidSet.has(id));
  if (nextDisabled.length !== prev.disabledChatUids.length) changed = true;

  const nextChatRequests = prev.chatRequests.filter(
    (r) => !wipedUidSet.has(r.senderUid) && !(r.recipientUid && wipedUidSet.has(r.recipientUid))
  );
  if (nextChatRequests.length !== prev.chatRequests.length) changed = true;

  const nextContacts = prev.contacts.filter((c) => !wipedUidSet.has(c.ownerUid));
  if (nextContacts.length !== prev.contacts.length) changed = true;

  const nextGroups = prev.groups.filter((g) => !wipedUidSet.has(g.ownerUid));
  if (nextGroups.length !== prev.groups.length) changed = true;

  const nextDirectMessages = prev.directMessages.filter(
    (m) =>
      !wipedUidSet.has(m.ownerUid) &&
      !wipedUidSet.has(m.senderUid) &&
      !Array.from(wipedUidSet).some((wUid) => m.chatId.includes(wUid))
  );
  if (nextDirectMessages.length !== prev.directMessages.length) changed = true;

  const nextStatusUpdates = prev.statusUpdates.filter((s) => !wipedUidSet.has(s.authorUid));
  if (nextStatusUpdates.length !== prev.statusUpdates.length) changed = true;

  const nextCallLogs = prev.callLogs.filter((c) => !wipedUidSet.has(c.ownerUid));
  if (nextCallLogs.length !== prev.callLogs.length) changed = true;

  if (!changed) return;
  writeStore({
    ...prev,
    registrations: nextRegs,
    approvalHistory: nextHistory,
    profiles: nextProfiles,
    blockLocks: nextLocks,
    blockedChatIds: nextLocks.map((l) => l.targetId),
    disabledChatUids: nextDisabled,
    chatRequests: nextChatRequests,
    contacts: nextContacts,
    groups: nextGroups,
    directMessages: nextDirectMessages,
    statusUpdates: nextStatusUpdates,
    callLogs: nextCallLogs,
    clearedServerRooms: nextCleared,
  });
}

// ---------------------------------------------------------------------------
// Contacts, Groups, Messages, Status Updates & Calls
// ---------------------------------------------------------------------------

export function addWaContact(
  ownerUid: string,
  firstName: string,
  lastName: string,
  phoneNumber: string,
  avatarDataUrl?: string
): WaContact {
  const contact: WaContact = {
    id: `cnt-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    ownerUid,
    firstName: firstName.trim(),
    lastName: lastName.trim(),
    phoneNumber: phoneNumber.trim().replace(/[\s-]/g, ''),
    avatarDataUrl,
    createdAt: new Date().toISOString(),
  };
  updateStore((prev) => ({
    ...prev,
    contacts: [contact, ...prev.contacts],
  }));
  return contact;
}

export function createWaGroup(
  ownerUid: string,
  name: string,
  memberIds: string[],
  memberSummary: string,
  avatarDataUrl?: string
): WaGroup {
  const group: WaGroup = {
    id: `grp-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    ownerUid,
    name: name.trim(),
    memberIds,
    memberSummary: memberSummary.trim() || 'You, VIP Support',
    avatarDataUrl,
    createdAt: new Date().toISOString(),
  };
  updateStore((prev) => ({
    ...prev,
    groups: [group, ...prev.groups],
  }));
  return group;
}

export function addWaDirectMessage(
  msg: Omit<WaDirectMessage, 'id' | 'createdAt' | 'tickState'> & { tickState?: 1 | 2 | 3 }
): WaDirectMessage {
  const record: WaDirectMessage = {
    ...msg,
    id: `wa-msg-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    tickState: msg.tickState ?? 2,
    createdAt: new Date().toISOString(),
  };
  updateStore((prev) => ({
    ...prev,
    directMessages: [...prev.directMessages, record],
  }));
  return record;
}

export function deleteMessageForMe(messageId: string, viewerKey: string) {
  updateStore((prev) => {
    const existing = prev.deletedForMe[viewerKey] ?? [];
    if (existing.includes(messageId)) return prev;
    return {
      ...prev,
      deletedForMe: {
        ...prev.deletedForMe,
        [viewerKey]: [...existing, messageId],
      },
    };
  });
}

export function deleteMessageForEveryone(messageId: string) {
  updateStore((prev) => ({
    ...prev,
    directMessages: prev.directMessages.filter((m) => m.id !== messageId),
    deletedForEveryoneIds: prev.deletedForEveryoneIds.includes(messageId)
      ? prev.deletedForEveryoneIds
      : [...prev.deletedForEveryoneIds, messageId],
  }));
}

export function clearChatThread(chatKey: string, roomUid?: string) {
  const nowIso = new Date().toISOString();
  updateStore((prev) => ({
    ...prev,
    directMessages: prev.directMessages.filter((m) => m.chatId !== chatKey),
    clearedServerRooms: roomUid
      ? { ...prev.clearedServerRooms, [roomUid]: nowIso }
      : prev.clearedServerRooms,
  }));
}

export function addWaStatusUpdate(
  update: Omit<WaStatusUpdate, 'id' | 'views' | 'createdAt'>
): WaStatusUpdate {
  const item: WaStatusUpdate = {
    ...update,
    id: `st-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    views: 1,
    createdAt: new Date().toISOString(),
  };
  updateStore((prev) => ({
    ...prev,
    statusUpdates: [item, ...prev.statusUpdates],
  }));
  return item;
}

export function incrementStatusView(statusId: string) {
  updateStore((prev) => ({
    ...prev,
    statusUpdates: prev.statusUpdates.map((s) =>
      s.id === statusId ? { ...s, views: s.views + 1 } : s
    ),
  }));
}

export function deleteStatusUpdate(statusId: string) {
  updateStore((prev) => ({
    ...prev,
    statusUpdates: prev.statusUpdates.filter((s) => s.id !== statusId),
  }));
}

export function addWaCallLog(log: Omit<WaCallLog, 'id' | 'createdAt'>) {
  const entry: WaCallLog = {
    ...log,
    id: `clog-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    createdAt: new Date().toISOString(),
  };
  updateStore((prev) => ({
    ...prev,
    callLogs: [entry, ...prev.callLogs],
  }));
  return entry;
}

export function triggerMediaDownload(dataUrl: string, fileName?: string) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = fileName || `taskpay-media-${Date.now()}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
