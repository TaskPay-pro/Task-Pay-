import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Ban,
  Camera,
  Check,
  CheckCheck,
  Clock,
  Eye,
  Film,
  Image as ImageIcon,
  Inbox,
  Lock,
  MessageSquare,
  Pencil,
  Phone,
  PhoneCall,
  Plus,
  Radio,
  Receipt,
  Search,
  Send,
  ShieldAlert,
  Trash2,
  UserPlus,
  Users,
  Video,
  X,
} from 'lucide-react';
import { useI18n } from '../../data/i18n';
import type {
  ActiveCallSession,
  ChatMessage,
  PublicDirectoryMember,
  UserRecord,
} from '../../types/taskpay';
import {
  addWaCallLog,
  addWaContact,
  addWaDirectMessage,
  addWaStatusUpdate,
  createWaGroup,
  DEFAULT_ADMIN_NUMBER,
  deleteMessageForEveryone,
  deleteMessageForMe,
  deleteStatusUpdate,
  getAdminBlockStatus,
  getConnectionRequestStatus,
  getLockedUserProfile,
  getUserLockRestriction,
  incrementStatusView,
  maskMobileNumber,
  respondToChatRequest,
  sendChatRequest,
  STRICT_MOBILE_RE,
  submitSupportRegistration,
  useWhatsAppStore,
  type WaContact,
  type WaGroup,
  type WaStatusUpdate,
} from '../../utils/whatsappChatStore';

interface SupportChatViewProps {
  roomUid: string;
  senderRole: 'user' | 'admin';
  messages: ChatMessage[];
  title: string;
  subtitle?: string;
  currentUser?: UserRecord | null;
  publicDirectory?: PublicDirectoryMember[];
  activeCall?: ActiveCallSession | null;
  onSend: (
    roomUid: string,
    senderRole: 'user' | 'admin',
    kind: 'text' | 'image' | 'voice',
    text?: string,
    mediaDataUrl?: string,
    durationSec?: number
  ) => Promise<unknown>;
  onMarkRead: (roomUid: string, readerRole: 'user' | 'admin') => Promise<void>;
  onRequireAuth?: () => void;
  isSignedIn: boolean;
}

type UnifiedBubble = {
  id: string;
  senderRole: 'user' | 'admin';
  senderName: string;
  senderAvatar?: string;
  kind: 'text' | 'image' | 'video' | 'voice';
  text?: string;
  mediaDataUrl?: string;
  fileName?: string;
  durationSec?: number;
  tickState: 1 | 2 | 3;
  createdAt: string;
  isServer?: boolean;
};

type SelectedChat =
  | { kind: 'support'; id: 'support-admin'; name: string; subtitle: string; avatar?: string }
  | { kind: 'contact'; id: string; contact: WaContact }
  | { kind: 'group'; id: string; group: WaGroup };

type HubPage = 'chats' | 'requests' | 'ids' | 'updates' | 'calls';

function TickBadge({ tick }: { tick: 1 | 2 | 3 }) {
  if (tick === 1) {
    return <Check className="h-3.5 w-3.5 text-[#8fa698]" aria-label="Sent" />;
  }
  if (tick === 2) {
    return <CheckCheck className="h-3.5 w-3.5 text-[#9cb3a5]" aria-label="Delivered" />;
  }
  return <CheckCheck className="h-3.5 w-3.5 text-[#00FF66]" aria-label="Read" />;
}

function AvatarCircle({
  name,
  src,
  size = 'md',
  isGroup = false,
}: {
  name: string;
  src?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  isGroup?: boolean;
}) {
  const dim =
    size === 'xs'
      ? 'h-6 w-6 text-[9px]'
      : size === 'sm'
      ? 'h-9 w-9 text-xs'
      : size === 'lg'
      ? 'h-14 w-14 text-lg'
      : 'h-11 w-11 text-sm';

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={`${dim} shrink-0 rounded-full object-cover border border-[#00FF66]/55 bg-[#050505]`}
      />
    );
  }

  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join('') || 'TP';

  return (
    <div
      className={`${dim} shrink-0 rounded-full border border-[#00FF66]/45 bg-gradient-to-br from-[#16231b] to-[#090d0a] flex items-center justify-center font-display font-extrabold text-[#00FF66]`}
    >
      {isGroup ? <Users className="h-4 w-4" aria-hidden="true" /> : initials}
    </div>
  );
}

function readFileAsMediaUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (file.size > 3_000_000) {
      resolve(URL.createObjectURL(file));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      resolve(typeof reader.result === 'string' ? reader.result : '');
    };
    reader.onerror = () => reject(new Error('Failed to read selected file.'));
    reader.readAsDataURL(file);
  });
}

export const SupportChatView: React.FC<SupportChatViewProps> = ({
  roomUid,
  senderRole,
  messages,
  title,
  subtitle,
  currentUser,
  publicDirectory = [],
  activeCall,
  onSend,
  onMarkRead,
  onRequireAuth,
  isSignedIn,
}) => {
  const { t } = useI18n();
  const wa = useWhatsAppStore();

  const viewerKey = senderRole === 'admin' ? wa.activeAdminId || 'ADMIN-1' : roomUid || 'GUEST';
  const reg = roomUid ? wa.registrations[roomUid] : undefined;
  const myMobile = reg?.ownAddedNumber || reg?.mobileNumber || currentUser?.contact || '';
  const lockedProfile = getLockedUserProfile(wa, roomUid, myMobile);

  // Mandatory Support Registration Gate Form State
  const [regFirst, setRegFirst] = useState('');
  const [regLast, setRegLast] = useState('');
  const [regMobile, setRegMobile] = useState('');
  const [regBio, setRegBio] = useState('');
  const [regAvatar, setRegAvatar] = useState<string | undefined>(undefined);
  const [regError, setRegError] = useState<string | null>(null);
  const [resubmitting, setResubmitting] = useState(false);

  // Pre-fill locked photo/name/mobile from Auth registration if available
  useEffect(() => {
    if (currentUser?.contact && !regMobile && STRICT_MOBILE_RE.test(currentUser.contact)) {
      setRegMobile(currentUser.contact);
    }
    if (currentUser?.name && !regFirst && !regLast) {
      const parts = currentUser.name.trim().split(/\s+/);
      if (parts[0]) setRegFirst(parts[0]);
      if (parts.length > 1) setRegLast(parts.slice(1).join(' '));
    }
    if (lockedProfile.avatarDataUrl && !regAvatar) {
      setRegAvatar(lockedProfile.avatarDataUrl);
    }
  }, [currentUser, lockedProfile.avatarDataUrl, regFirst, regLast, regMobile, regAvatar]);

  const registeredName = reg ? `${reg.firstName} ${reg.lastName}`.trim() : '';
  const displayName = lockedProfile.name || registeredName || currentUser?.name || title;
  const displayAvatar = lockedProfile.avatarDataUrl || reg?.avatarDataUrl;
  const maskedOwnId = myMobile ? maskMobileNumber(myMobile) : 'ID Locked';

  // Separate Dedicated Hub Pages: Chats | Requests | IDs (Masked) | Updates | Calls
  const [waTab, setWaTab] = useState<HubPage>('chats');
  const [search, setSearch] = useState('');
  const [selectedChat, setSelectedChat] = useState<SelectedChat | null>(null);

  // Floating "+" Menu (Strictly ONLY "New Group" and "New Contact")
  const [fabOpen, setFabOpen] = useState(false);

  // New Contact & New Group Modals (Profile Editing is permanently locked and removed)
  const [showNewContactModal, setShowNewContactModal] = useState(false);
  const [cntFirst, setCntFirst] = useState('');
  const [cntLast, setCntLast] = useState('');
  const [cntNumber, setCntNumber] = useState('');
  const [cntAvatar, setCntAvatar] = useState<string | undefined>(undefined);
  const [cntError, setCntError] = useState<string | null>(null);

  const [showNewGroupModal, setShowNewGroupModal] = useState(false);
  const [grpName, setGrpName] = useState('');
  const [grpAvatar, setGrpAvatar] = useState<string | undefined>(undefined);
  const [grpSelectedIds, setGrpSelectedIds] = useState<string[]>([]);
  const [grpError, setGrpError] = useState<string | null>(null);

  // Direct Chat Request by Mobile Number form (on Requests page)
  const [reqTargetName, setReqTargetName] = useState('');
  const [reqTargetMobile, setReqTargetMobile] = useState('');
  const [reqFormMsg, setReqFormMsg] = useState<string | null>(null);

  const [deleteTargetMsg, setDeleteTargetMsg] = useState<UnifiedBubble | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Status Updates UI
  const [showTextStatusModal, setShowTextStatusModal] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [viewingStatus, setViewingStatus] = useState<WaStatusUpdate | null>(null);

  // Quick outgoing call preview
  const [localCallOverlay, setLocalCallOverlay] = useState<{
    peerName: string;
    peerNumber: string;
    callType: 'audio' | 'video';
    seconds: number;
  } | null>(null);

  // Clean Text-Focused Composer State
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const statusMediaInputRef = useRef<HTMLInputElement | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!localCallOverlay) return;
    const tId = setInterval(() => {
      setLocalCallOverlay((prev) => (prev ? { ...prev, seconds: prev.seconds + 1 } : null));
    }, 1000);
    return () => clearInterval(tId);
  }, [localCallOverlay]);

  const userContacts = useMemo(
    () => wa.contacts.filter((c) => c.ownerUid === 'GLOBAL' || c.ownerUid === roomUid),
    [wa.contacts, roomUid]
  );

  const userGroups = useMemo(
    () => wa.groups.filter((g) => g.ownerUid === roomUid),
    [wa.groups, roomUid]
  );

  // Chat Requests Inbox & Outgoing
  const incomingRequests = useMemo(
    () =>
      wa.chatRequests.filter(
        (r) =>
          (r.recipientUid && r.recipientUid === roomUid) ||
          (!!myMobile && r.recipientMobile === myMobile)
      ),
    [wa.chatRequests, roomUid, myMobile]
  );
  const outgoingRequests = useMemo(
    () =>
      wa.chatRequests.filter(
        (r) => r.senderUid === roomUid || (!!myMobile && r.senderMobile === myMobile)
      ),
    [wa.chatRequests, roomUid, myMobile]
  );
  const pendingIncomingCount = incomingRequests.filter((r) => r.status === 'pending').length;

  // Masked ID Directory combining registered users + support registrations
  const maskedDirectoryList = useMemo(() => {
    const q = search.trim().toLowerCase();
    const map = new Map<
      string,
      {
        uid: string;
        name: string;
        maskedMobile: string;
        rawMobile?: string;
        avatarDataUrl?: string;
        status: string;
        rank: string;
      }
    >();

    for (const member of publicDirectory) {
      if (member.uid === roomUid) continue;
      const prof = wa.profiles[member.uid];
      const supportReg = wa.registrations[member.uid];
      map.set(member.uid, {
        uid: member.uid,
        name: prof?.username || member.name,
        maskedMobile: supportReg
          ? maskMobileNumber(supportReg.ownAddedNumber || supportReg.mobileNumber)
          : member.maskedMobile,
        rawMobile: supportReg?.ownAddedNumber || supportReg?.mobileNumber,
        avatarDataUrl: prof?.avatarDataUrl || supportReg?.avatarDataUrl,
        status: member.status,
        rank: member.rank,
      });
    }

    for (const r of Object.values(wa.registrations)) {
      if (r.uid === roomUid || map.has(r.uid)) continue;
      const mob = r.ownAddedNumber || r.mobileNumber;
      map.set(r.uid, {
        uid: r.uid,
        name: `${r.firstName} ${r.lastName}`.trim(),
        maskedMobile: maskMobileNumber(mob),
        rawMobile: mob,
        avatarDataUrl: r.avatarDataUrl || wa.profiles[r.uid]?.avatarDataUrl,
        status: r.status,
        rank: 'VIP Support',
      });
    }

    const items = Array.from(map.values());
    if (!q) return items;
    return items.filter(
      (i) =>
        i.name.toLowerCase().includes(q) ||
        i.maskedMobile.toLowerCase().includes(q) ||
        i.uid.toLowerCase().includes(q)
    );
  }, [publicDirectory, wa.profiles, wa.registrations, roomUid, search]);

  const activeChatKey =
    senderRole === 'admin'
      ? roomUid
      : selectedChat?.kind === 'support'
      ? roomUid
      : selectedChat?.id ?? '';

  // Connection Request Status for selected contact chat
  const selectedContactRequestStatus = useMemo(() => {
    if (senderRole === 'admin' || !selectedChat || selectedChat.kind !== 'contact') {
      return { state: 'accepted' as const };
    }
    // Official Verification Desk contact is always open once Support Gate is approved
    if (
      selectedChat.contact.phoneNumber === (reg?.adminAssignedNumber || DEFAULT_ADMIN_NUMBER)
    ) {
      return { state: 'accepted' as const };
    }
    return getConnectionRequestStatus(
      wa,
      roomUid,
      myMobile,
      undefined,
      selectedChat.contact.phoneNumber
    );
  }, [senderRole, selectedChat, wa, roomUid, myMobile, reg?.adminAssignedNumber]);

  const isDisabledByAdmin3 = senderRole === 'user' && wa.disabledChatUids.includes(roomUid);

  // Enforce Admin 3 Chat-Disable Rule (Disabled users can ONLY message Admin 1) & Request Rejection Blocking
  const blockRestriction = useMemo(() => {
    if (senderRole === 'admin') {
      const check = getAdminBlockStatus(wa, wa.activeAdminId || 'ADMIN-1', roomUid);
      return {
        blocked: !check.allowed,
        reason: check.reason,
        exclusiveAdminId: check.lockOnTarget?.adminId,
      };
    }

    if (isDisabledByAdmin3) {
      if (selectedChat?.kind === 'support') {
        return {
          blocked: false,
          exclusiveAdminId: 'ADMIN-1',
        };
      }
      return {
        blocked: true,
        exclusiveAdminId: 'ADMIN-1',
        reason: 'Chat has been disabled, please contact support admin.',
      };
    }

    if (selectedChat?.kind === 'contact') {
      if (selectedContactRequestStatus.state === 'rejected') {
        return {
          blocked: true,
          reason: 'Chat Request was rejected. Messaging with this contact is blocked.',
        };
      }
      if (
        selectedContactRequestStatus.state === 'pending_sent' ||
        selectedContactRequestStatus.state === 'pending_received' ||
        selectedContactRequestStatus.state === 'none'
      ) {
        return {
          blocked: true,
          reason:
            selectedContactRequestStatus.state === 'pending_received'
              ? 'Incoming Chat Request pending. Accept the request in Requests to start chatting.'
              : selectedContactRequestStatus.state === 'pending_sent'
              ? 'Chat Request sent. Chat unlocks once the recipient accepts your request.'
              : 'Send a Chat Request first to connect with this contact.',
        };
      }
    }

    const targetNumber =
      selectedChat?.kind === 'contact' ? selectedChat.contact.phoneNumber : undefined;
    const targetId = selectedChat?.id || roomUid;
    const userCheck = getUserLockRestriction(wa, roomUid, targetId, targetNumber);
    return {
      blocked: userCheck.blocked,
      reason: userCheck.reason,
      exclusiveAdminId: userCheck.lockedToAdminId,
    };
  }, [senderRole, wa, roomUid, isDisabledByAdmin3, selectedChat, selectedContactRequestStatus]);

  const isCurrentChatBlocked = blockRestriction.blocked;

  const isHiddenForViewer = (msgId: string, createdAt: string, msgRoomUid?: string) => {
    if (wa.deletedForEveryoneIds.includes(msgId)) return true;
    if ((wa.deletedForMe[viewerKey] ?? []).includes(msgId)) return true;
    if (msgRoomUid && wa.clearedServerRooms[msgRoomUid]) {
      if (new Date(createdAt).getTime() <= new Date(wa.clearedServerRooms[msgRoomUid]).getTime()) {
        return true;
      }
    }
    return false;
  };

  const activeMessages: UnifiedBubble[] = useMemo(() => {
    const serverRoomMode = senderRole === 'admin' || selectedChat?.kind === 'support';
    const list: UnifiedBubble[] = [];
    const peerReg = wa.registrations[roomUid];
    const peerProf = wa.profiles[roomUid];
    const userAvatarForRoom = peerProf?.avatarDataUrl || peerReg?.avatarDataUrl || displayAvatar;

    if (serverRoomMode && roomUid) {
      for (const m of messages) {
        if (isHiddenForViewer(m.id, m.createdAt, roomUid)) continue;
        list.push({
          id: m.id,
          senderRole: m.senderRole,
          senderName: m.senderName,
          senderAvatar: m.senderRole === 'user' ? userAvatarForRoom : undefined,
          kind: m.kind,
          text: m.text,
          mediaDataUrl: m.mediaDataUrl,
          durationSec: m.durationSec,
          tickState: m.tickState,
          createdAt: m.createdAt,
          isServer: true,
        });
      }
    }

    const targetChatId = serverRoomMode ? `support:${roomUid}` : activeChatKey;
    for (const dm of wa.directMessages) {
      if (dm.chatId !== targetChatId) continue;
      if (isHiddenForViewer(dm.id, dm.createdAt)) continue;
      list.push({
        id: dm.id,
        senderRole: dm.senderRole,
        senderName: dm.senderName,
        senderAvatar: dm.senderAvatar || (dm.senderRole === 'user' ? displayAvatar : undefined),
        kind: dm.kind,
        text: dm.text,
        mediaDataUrl: dm.mediaDataUrl,
        fileName: dm.fileName,
        durationSec: dm.durationSec,
        tickState: dm.tickState,
        createdAt: dm.createdAt,
      });
    }

    list.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    return list;
  }, [
    senderRole,
    selectedChat,
    roomUid,
    messages,
    wa.directMessages,
    wa.deletedForEveryoneIds,
    wa.deletedForMe,
    wa.clearedServerRooms,
    wa.registrations,
    wa.profiles,
    displayAvatar,
    activeChatKey,
    viewerKey,
  ]);

  useEffect(() => {
    const inSupportThread = senderRole === 'admin' || selectedChat?.kind === 'support';
    const unlocked = senderRole === 'admin' || (!!reg && reg.status === 'approved' && reg.chatUnlocked);
    if (isSignedIn && unlocked && roomUid && inSupportThread) {
      onMarkRead(roomUid, senderRole);
    }
  }, [isSignedIn, reg, roomUid, senderRole, selectedChat, activeMessages.length, onMarkRead]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeMessages.length, selectedChat]);

  const startLongPress = (msg: UnifiedBubble) => {
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = setTimeout(() => {
      setDeleteTargetMsg(msg);
    }, 450);
  };

  const cancelLongPress = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const sendMessagePayload = async (contentText: string) => {
    if (!isSignedIn) {
      onRequireAuth?.();
      return;
    }
    if (isCurrentChatBlocked) {
      setError(blockRestriction.reason || 'Chatting is currently blocked.');
      return;
    }

    const inSupportThread = senderRole === 'admin' || selectedChat?.kind === 'support';
    const senderLabel =
      senderRole === 'admin'
        ? `TaskPay ${wa.activeAdminId || 'ADMIN-1'}`
        : displayName;

    setBusy(true);
    setError(null);
    try {
      if (inSupportThread && roomUid) {
        await onSend(roomUid, senderRole, 'text', contentText);
      } else {
        const chatId = selectedChat?.id || roomUid;
        const chatTitle =
          selectedChat?.kind === 'contact'
            ? `${selectedChat.contact.firstName} ${selectedChat.contact.lastName}`
            : selectedChat?.kind === 'group'
            ? selectedChat.group.name
            : 'TaskPay VIP Support';

        addWaDirectMessage({
          chatId,
          chatTitle,
          ownerUid: roomUid || 'ADMIN',
          ownerName: displayName,
          recipientLabel: chatTitle,
          senderRole,
          senderUid: senderRole === 'admin' ? wa.activeAdminId || 'ADMIN-1' : roomUid,
          senderName: senderLabel,
          senderAvatar: senderRole === 'user' ? displayAvatar : undefined,
          kind: 'text',
          text: contentText,
          tickState: 3,
        });
      }
      setText('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Message failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleSendText = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = text.trim();
    if (!clean) return;
    await sendMessagePayload(clean);
  };

  // Registration Form Handler (First Name -> Last Name -> Mobile 03XXXXXXXXX -> Description/Bio -> Submit)
  const handleSupportRegister = (e: React.FormEvent) => {
    e.preventDefault();
    setRegError(null);
    const fn = regFirst.trim();
    const ln = regLast.trim();
    const mob = regMobile.trim().replace(/[\s-]/g, '');
    const bio = regBio.trim();
    if (fn.length < 1) {
      setRegError('Please enter your First Name.');
      return;
    }
    if (ln.length < 1) {
      setRegError('Please enter your Last Name.');
      return;
    }
    if (!STRICT_MOBILE_RE.test(mob)) {
      setRegError('Mobile Number must be 11 digits starting with 03 (e.g. 03001234567).');
      return;
    }
    if (bio.length < 2) {
      setRegError('Please enter a brief Description / Bio.');
      return;
    }
    submitSupportRegistration(roomUid, fn, ln, mob, bio, regAvatar);
    setResubmitting(false);
  };

  // New Contact via "+" button (Strict 11-digit starting with "03" + sends Chat Request)
  const handleSaveNewContact = (e: React.FormEvent) => {
    e.preventDefault();
    setCntError(null);
    const fn = cntFirst.trim();
    const ln = cntLast.trim();
    const num = cntNumber.trim().replace(/[\s-]/g, '');
    if (fn.length < 1 || ln.length < 1) {
      setCntError('Enter both First Name and Last Name.');
      return;
    }
    if (!STRICT_MOBILE_RE.test(num)) {
      setCntError('Mobile ID must be strictly 11 digits starting with 03 (e.g. 03001234567).');
      return;
    }
    addWaContact(roomUid || 'GLOBAL', fn, ln, num, cntAvatar);
    // Automatically initiate Chat Request for this new contact
    if (num !== (reg?.adminAssignedNumber || DEFAULT_ADMIN_NUMBER)) {
      sendChatRequest({
        senderUid: roomUid,
        senderName: displayName,
        senderMobile: myMobile,
        senderAvatar: displayAvatar,
        recipientName: `${fn} ${ln}`.trim(),
        recipientMobile: num,
      });
    }
    setCntFirst('');
    setCntLast('');
    setCntNumber('');
    setCntAvatar(undefined);
    setShowNewContactModal(false);
    setWaTab('requests');
    setSearch('');
  };

  const handleCreateGroup = (e: React.FormEvent) => {
    e.preventDefault();
    setGrpError(null);
    if (grpName.trim().length < 2) {
      setGrpError('Enter a group name (minimum 2 characters).');
      return;
    }
    const chosenNames = userContacts
      .filter((c) => grpSelectedIds.includes(c.id))
      .map((c) => `${c.firstName} ${c.lastName}`);
    const summary = chosenNames.length > 0 ? `You, ${chosenNames.join(', ')}` : 'You, TaskPay Support';
    createWaGroup(roomUid || 'GLOBAL', grpName.trim(), grpSelectedIds, summary, grpAvatar);
    setGrpName('');
    setGrpAvatar(undefined);
    setGrpSelectedIds([]);
    setShowNewGroupModal(false);
    setWaTab('chats');
    setSearch('');
  };

  const handleSendDirectRequestForm = (e: React.FormEvent) => {
    e.preventDefault();
    setReqFormMsg(null);
    if (isDisabledByAdmin3) {
      setReqFormMsg('Chat has been disabled, please contact support admin.');
      return;
    }
    const cleanNum = reqTargetMobile.trim().replace(/[\s-]/g, '');
    if (!STRICT_MOBILE_RE.test(cleanNum)) {
      setReqFormMsg('Error: Mobile ID must be strictly 11 digits starting with 03.');
      return;
    }
    if (cleanNum === myMobile) {
      setReqFormMsg('You cannot send a chat request to your own number.');
      return;
    }
    const targetReg = Object.values(wa.registrations).find(
      (r) => (r.ownAddedNumber || r.mobileNumber) === cleanNum
    );
    const recipName =
      reqTargetName.trim() ||
      (targetReg ? `${targetReg.firstName} ${targetReg.lastName}`.trim() : maskMobileNumber(cleanNum));

    const res = sendChatRequest({
      senderUid: roomUid,
      senderName: displayName,
      senderMobile: myMobile,
      senderAvatar: displayAvatar,
      recipientUid: targetReg?.uid,
      recipientName: recipName,
      recipientMobile: cleanNum,
    });
    setReqTargetName('');
    setReqTargetMobile('');
    setReqFormMsg(
      res.status === 'rejected'
        ? 'Connection was previously rejected — chatting is blocked.'
        : res.status === 'accepted'
        ? 'Already accepted! Open this conversation from Chats.'
        : `Chat Request sent to ${maskMobileNumber(cleanNum)}.`
    );
  };

  const handleUploadStatusMedia = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const url = await readFileAsMediaUrl(file);
    if (!url) return;
    const isVideo = file.type.toLowerCase().startsWith('video/');
    addWaStatusUpdate({
      authorUid: roomUid || 'GUEST',
      authorName: displayName,
      authorAvatar: displayAvatar,
      kind: isVideo ? 'video' : 'image',
      text: file.name,
      mediaDataUrl: url,
      fileName: file.name,
    });
  };

  const handlePublishTextStatus = (e: React.FormEvent) => {
    e.preventDefault();
    if (!statusText.trim()) return;
    addWaStatusUpdate({
      authorUid: roomUid || 'GUEST',
      authorName: displayName,
      authorAvatar: displayAvatar,
      kind: 'text',
      text: statusText.trim(),
    });
    setStatusText('');
    setShowTextStatusModal(false);
  };

  const startLocalCall = (peerName: string, peerNumber: string, callType: 'audio' | 'video') => {
    if (isCurrentChatBlocked) {
      setError(blockRestriction.reason || 'Calls are disabled while restricted.');
      return;
    }
    addWaCallLog({
      ownerUid: roomUid || 'GUEST',
      peerName,
      peerNumber,
      callType,
      direction: 'outgoing',
      status: 'connected',
      durationLabel: 'Live',
    });
    setLocalCallOverlay({ peerName, peerNumber, callType, seconds: 0 });
  };

  const openChatWithPeer = (peerName: string, peerNumber: string, peerAvatar?: string) => {
    const existingContact = userContacts.find((c) => c.phoneNumber === peerNumber);
    if (existingContact) {
      setSelectedChat({ kind: 'contact', id: existingContact.id, contact: existingContact });
      return;
    }
    const parts = peerName.trim().split(/\s+/);
    const created = addWaContact(
      roomUid || 'GLOBAL',
      parts[0] || peerName,
      parts.slice(1).join(' ') || 'Member',
      peerNumber,
      peerAvatar
    );
    setSelectedChat({ kind: 'contact', id: created.id, contact: created });
  };

  // Unified Chats List
  const chatItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    const supportVisibleMsgs = messages.filter((m) => !isHiddenForViewer(m.id, m.createdAt, roomUid));
    const supportLocalMsgs = wa.directMessages.filter(
      (m) => m.chatId === `support:${roomUid}` && !isHiddenForViewer(m.id, m.createdAt)
    );
    const allSupportMsgs = [...supportVisibleMsgs, ...supportLocalMsgs].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
    const lastSupport = allSupportMsgs[allSupportMsgs.length - 1];
    const adminNum = reg?.adminAssignedNumber || DEFAULT_ADMIN_NUMBER;
    const selfExclusiveLock = wa.blockLocks.find((l) => l.targetId === roomUid);

    const list: {
      key: string;
      chat: SelectedChat;
      name: string;
      sub: string;
      preview: string;
      time?: string;
      avatar?: string;
      isGroup?: boolean;
      blocked: boolean;
      requestBadge?: string;
    }[] = [
      {
        key: 'support-admin',
        chat: {
          kind: 'support',
          id: 'support-admin',
          name: 'TaskPay VIP Support (Admin 1)',
          subtitle: isDisabledByAdmin3
            ? 'Main Chat Admin (Admin 1) · Contact Support'
            : selfExclusiveLock
            ? `Exclusive Session · ${selfExclusiveLock.adminId}`
            : `Admin: ${maskMobileNumber(adminNum)}`,
        },
        name: 'TaskPay VIP Support (Admin 1)',
        sub: isDisabledByAdmin3
          ? 'Admin 1 Support'
          : selfExclusiveLock
          ? `Locked w/ ${selfExclusiveLock.adminId}`
          : maskMobileNumber(adminNum),
        preview: isDisabledByAdmin3
          ? 'Your peer chats are disabled · Tap to contact Admin 1'
          : lastSupport
          ? lastSupport.text || `[${lastSupport.kind}]`
          : 'Tap to message Admin 1 support',
        time: lastSupport?.createdAt,
        blocked: false,
      },
    ];

    for (const grp of userGroups) {
      const grpMsgs = wa.directMessages.filter(
        (m) => m.chatId === grp.id && !isHiddenForViewer(m.id, m.createdAt)
      );
      const last = grpMsgs[grpMsgs.length - 1];
      const lockCheck = getUserLockRestriction(wa, roomUid, grp.id);
      list.push({
        key: grp.id,
        chat: { kind: 'group', id: grp.id, group: grp },
        name: grp.name,
        sub: grp.memberSummary,
        preview: isDisabledByAdmin3
          ? 'Chat has been disabled, please contact support admin.'
          : last
          ? `${last.senderName}: ${last.text || `[${last.kind}]`}`
          : 'Group created · Tap to chat',
        time: last?.createdAt || grp.createdAt,
        avatar: grp.avatarDataUrl,
        isGroup: true,
        blocked: lockCheck.blocked,
        requestBadge: isDisabledByAdmin3 ? 'Disabled' : undefined,
      });
    }

    for (const cnt of userContacts) {
      const fullName = `${cnt.firstName} ${cnt.lastName}`.trim();
      const cntMsgs = wa.directMessages.filter(
        (m) => m.chatId === cnt.id && !isHiddenForViewer(m.id, m.createdAt)
      );
      const last = cntMsgs[cntMsgs.length - 1];
      const lockCheck = getUserLockRestriction(wa, roomUid, cnt.id, cnt.phoneNumber);
      const isDesk = cnt.phoneNumber === adminNum;
      const reqCheck = isDesk
        ? { state: 'accepted' as const }
        : getConnectionRequestStatus(wa, roomUid, myMobile, undefined, cnt.phoneNumber);
      const isRejectedOrPending = !isDesk && reqCheck.state !== 'accepted';

      list.push({
        key: cnt.id,
        chat: { kind: 'contact', id: cnt.id, contact: cnt },
        name: fullName,
        sub: maskMobileNumber(cnt.phoneNumber),
        preview: isDisabledByAdmin3
          ? 'Chat has been disabled, please contact support admin.'
          : reqCheck.state === 'rejected'
          ? 'Request rejected · Chat blocked'
          : reqCheck.state === 'pending_sent'
          ? 'Request pending acceptance'
          : reqCheck.state === 'pending_received'
          ? 'Incoming request · Accept to chat'
          : reqCheck.state === 'none' && !isDesk
          ? 'Send request to unlock chat'
          : last
          ? last.text || `[${last.kind}]`
          : `ID: ${maskMobileNumber(cnt.phoneNumber)} · Tap to chat`,
        time: last?.createdAt || cnt.createdAt,
        avatar: cnt.avatarDataUrl,
        blocked: lockCheck.blocked || isRejectedOrPending,
        requestBadge: isDisabledByAdmin3
          ? 'Disabled'
          : reqCheck.state === 'rejected'
          ? 'Blocked'
          : reqCheck.state === 'pending_sent' || reqCheck.state === 'pending_received'
          ? 'Pending'
          : undefined,
      });
    }

    if (!q) return list;
    return list.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        item.sub.toLowerCase().includes(q) ||
        item.preview.toLowerCase().includes(q)
    );
  }, [
    search,
    messages,
    wa,
    roomUid,
    myMobile,
    isDisabledByAdmin3,
    reg?.adminAssignedNumber,
    userGroups,
    userContacts,
  ]);

  // Fixed-position container wrapper classes (Zero outer scroll or shift)
  const fixedShellClass =
    senderRole === 'admin'
      ? 'vip-card-3d relative flex flex-col h-[540px] w-full overflow-hidden overscroll-none animate-view-enter'
      : 'vip-card-3d relative flex flex-col flex-1 h-full min-h-0 w-full overflow-hidden overscroll-none animate-view-enter';

  // ---------------------------------------------------------------------------
  // RENDER GATE 1: Auth Sign-In Check
  // ---------------------------------------------------------------------------
  if (!isSignedIn) {
    return (
      <section className={`${fixedShellClass} items-center justify-center p-6 text-center`}>
        <div className="h-14 w-14 rounded-2xl border border-[#00FF66]/45 bg-[#00FF66]/10 flex items-center justify-center text-[#00FF66]">
          <MessageSquare className="h-7 w-7" aria-hidden="true" />
        </div>
        <h1 className="mt-4 font-display text-lg font-extrabold text-white">{title}</h1>
        <p className="mt-1.5 text-xs text-[#9cb3a5] max-w-[260px]">
          Sign in with your 03XXXXXXXXX mobile number to access TaskPay Support Chat.
        </p>
        {onRequireAuth && (
          <button
            type="button"
            onClick={onRequireAuth}
            className="mt-5 min-h-[44px] rounded-xl vip-btn-neon px-6 py-2.5 text-xs font-extrabold cursor-pointer"
          >
            {t('login')}
          </button>
        )}
      </section>
    );
  }

  // ---------------------------------------------------------------------------
  // RENDER GATE 2: Mandatory Support Registration Form & Receipt Flow
  // ---------------------------------------------------------------------------
  if (senderRole === 'user' && (!reg || resubmitting || !reg.chatUnlocked)) {
    return (
      <section className={fixedShellClass}>
        <div className="border-b border-[#00FF66]/20 bg-[#0b0e0c]/95 px-4 py-3.5 shrink-0 flex items-center justify-between gap-2">
          <div>
            <h1 className="font-display text-base font-extrabold text-white">
              Support Chat Registration
            </h1>
            <p className="text-[11px] text-[#9cb3a5]">
              Submit your details to generate an Admin verification receipt
            </p>
          </div>
          <Lock className="h-5 w-5 text-[#FFB800] shrink-0" aria-hidden="true" />
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain mobile-scroll p-4 flex flex-col justify-center">
          {/* State A: Registration Form (First Name, Last Name, Mobile 03XXXXXXXXX, Description / Bio) */}
          {(!reg || resubmitting) && (
            <form onSubmit={handleSupportRegister} className="vip-hero-3d p-4 space-y-3">
              <div className="text-xs font-bold text-[#00FF66]">
                Support Registration Form
              </div>

              {/* Gallery Profile Picture Upload (Permanently Locked after setup) */}
              <div className="rounded-2xl border border-[#00FF66]/20 bg-[#050505] p-3 flex items-center justify-between gap-2.5">
                <div className="flex items-center gap-2.5 min-w-0">
                  <AvatarCircle
                    name={`${regFirst} ${regLast}`.trim() || 'TP'}
                    src={regAvatar}
                    size="md"
                  />
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-white truncate">Profile Photo</div>
                    <div className="flex items-center gap-1 text-[10px] text-[#FFB800]">
                      <Lock className="h-3 w-3 shrink-0" />
                      <span>Permanently locked once set</span>
                    </div>
                  </div>
                </div>
                {!lockedProfile.locked || !lockedProfile.avatarDataUrl ? (
                  <label className="inline-flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-xl vip-btn-surface px-2.5 text-[11px] font-bold text-[#00FF66] cursor-pointer">
                    <Camera className="h-3.5 w-3.5" />
                    <span>Gallery</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (ev) => {
                        const f = ev.target.files?.[0];
                        if (f) setRegAvatar(await readFileAsMediaUrl(f));
                      }}
                    />
                  </label>
                ) : (
                  <span className="rounded-lg bg-[#00FF66]/15 px-2 py-1 text-[10px] font-bold text-[#00FF66]">
                    Locked
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor="sup-reg-first" className="block text-[11px] font-semibold text-[#9cb3a5]">
                    First Name
                  </label>
                  <input
                    id="sup-reg-first"
                    type="text"
                    value={regFirst}
                    onChange={(e) => setRegFirst(e.target.value)}
                    placeholder="First Name"
                    className="mt-1 h-10 w-full rounded-xl border border-[#00FF66]/25 bg-[#050505] px-3 text-xs text-white placeholder:text-[#9cb3a5]/50 focus:border-[#00FF66] focus:outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="sup-reg-last" className="block text-[11px] font-semibold text-[#9cb3a5]">
                    Last Name
                  </label>
                  <input
                    id="sup-reg-last"
                    type="text"
                    value={regLast}
                    onChange={(e) => setRegLast(e.target.value)}
                    placeholder="Last Name"
                    className="mt-1 h-10 w-full rounded-xl border border-[#00FF66]/25 bg-[#050505] px-3 text-xs text-white placeholder:text-[#9cb3a5]/50 focus:border-[#00FF66] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="sup-reg-mob" className="block text-[11px] font-semibold text-[#9cb3a5]">
                  Mobile Number (11 digits starting with 03)
                </label>
                <input
                  id="sup-reg-mob"
                  type="tel"
                  dir="ltr"
                  inputMode="numeric"
                  maxLength={11}
                  value={regMobile}
                  onChange={(e) => setRegMobile(e.target.value.replace(/[^\d]/g, '').slice(0, 11))}
                  placeholder="03001234567"
                  className="mt-1 h-10 w-full rounded-xl border border-[#00FF66]/25 bg-[#050505] px-3.5 font-mono text-xs text-white placeholder:text-[#9cb3a5]/50 focus:border-[#00FF66] focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="sup-reg-bio" className="block text-[11px] font-semibold text-[#9cb3a5]">
                  Description / Bio
                </label>
                <textarea
                  id="sup-reg-bio"
                  rows={3}
                  value={regBio}
                  onChange={(e) => setRegBio(e.target.value)}
                  placeholder="Describe why you need support chat access or add a short bio..."
                  className="mt-1 w-full rounded-xl border border-[#00FF66]/25 bg-[#050505] p-3 text-xs text-white placeholder:text-[#9cb3a5]/50 focus:border-[#00FF66] focus:outline-none resize-none"
                />
              </div>

              {regError && (
                <div
                  role="alert"
                  className="rounded-xl border border-[#FFB800]/60 bg-[#FFB800]/10 px-3 py-2 text-[11px] font-semibold text-[#FFB800] flex items-center gap-1.5"
                >
                  <ShieldAlert className="h-4 w-4 shrink-0" />
                  <span>{regError}</span>
                </div>
              )}

              <button
                type="submit"
                className="flex min-h-[44px] w-full items-center justify-center rounded-xl vip-btn-neon text-xs font-extrabold cursor-pointer"
              >
                Submit
              </button>
            </form>
          )}

          {/* State B: Pending Approval -> Gorgeous Receipt Card */}
          {reg && !resubmitting && reg.status === 'pending' && (
            <div className="rounded-3xl border-2 border-[#00FF66] bg-[#FFFFFF] p-5 text-[#050505] shadow-[0_18px_40px_rgba(0,255,102,0.3)] space-y-4">
              <div className="flex items-center justify-between gap-2 border-b border-[#050505]/10 pb-3">
                <div className="flex items-center gap-2">
                  <Receipt className="h-5 w-5 text-[#00993d]" aria-hidden="true" />
                  <div>
                    <h2 className="font-display text-sm font-extrabold">
                      Chat Registration Receipt
                    </h2>
                    <div className="font-mono text-[10px] text-[#050505]/60">
                      {reg.receiptId || `REC-${reg.uid}`}
                    </div>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1 rounded-lg bg-[#FFB800]/20 px-2.5 py-1 text-[10px] font-extrabold uppercase text-[#996600]">
                  <Clock className="h-3 w-3" aria-hidden="true" />
                  <span>Pending</span>
                </span>
              </div>

              <div className="flex items-center gap-3 rounded-2xl bg-[#050505] p-3 text-white">
                <AvatarCircle
                  name={`${reg.firstName} ${reg.lastName}`}
                  src={reg.avatarDataUrl || displayAvatar}
                  size="md"
                />
                <div className="min-w-0">
                  <div className="font-display text-sm font-extrabold truncate">
                    {reg.firstName} {reg.lastName}
                  </div>
                  <div dir="ltr" className="text-[11px] font-mono text-[#00FF66]">
                    {reg.mobileNumber}
                  </div>
                </div>
              </div>

              <dl className="space-y-2 text-xs">
                <div className="flex justify-between gap-2 border-b border-[#050505]/10 pb-1.5">
                  <dt className="text-[#050505]/60">First Name</dt>
                  <dd className="font-bold">{reg.firstName}</dd>
                </div>
                <div className="flex justify-between gap-2 border-b border-[#050505]/10 pb-1.5">
                  <dt className="text-[#050505]/60">Last Name</dt>
                  <dd className="font-bold">{reg.lastName}</dd>
                </div>
                <div className="flex justify-between gap-2 border-b border-[#050505]/10 pb-1.5">
                  <dt className="text-[#050505]/60">Mobile Number</dt>
                  <dd dir="ltr" className="font-mono font-bold text-[#00993d]">
                    {reg.mobileNumber}
                  </dd>
                </div>
                <div className="border-b border-[#050505]/10 pb-1.5">
                  <dt className="text-[#050505]/60 mb-0.5">Description / Bio</dt>
                  <dd className="font-semibold text-[#050505] break-words">
                    {reg.bio || 'Support chat verification request'}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-[#050505]/60">Submitted</dt>
                  <dd className="font-semibold text-end">
                    {new Date(reg.submittedAt).toLocaleString()}
                  </dd>
                </div>
              </dl>

              <div className="rounded-2xl border border-[#FFB800]/50 bg-[#050505] p-3.5 text-center">
                <p className="text-xs font-bold text-[#FFB800] leading-relaxed">
                  Your request has been sent to the admin for approval. Chat will be enabled once
                  approved.
                </p>
              </div>
            </div>
          )}

          {/* State C: Rejected -> Receipt Card with Rejection & Re-submit */}
          {reg && !resubmitting && reg.status === 'rejected' && (
            <div className="rounded-3xl border-2 border-[#FFB800] bg-[#FFFFFF] p-5 text-[#050505] shadow-[0_18px_40px_rgba(255,184,0,0.25)] space-y-4">
              <div className="flex items-center justify-between gap-2 border-b border-[#050505]/10 pb-3">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="h-5 w-5 text-[#b37d00]" aria-hidden="true" />
                  <h2 className="font-display text-sm font-extrabold">Registration Rejected</h2>
                </div>
                <span className="rounded-lg bg-[#FFB800]/20 px-2.5 py-1 text-[10px] font-extrabold uppercase text-[#996600]">
                  Rejected
                </span>
              </div>

              <dl className="space-y-1.5 text-xs">
                <div className="flex justify-between gap-2">
                  <dt className="text-[#050505]/60">Member</dt>
                  <dd className="font-bold">
                    {reg.firstName} {reg.lastName}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-[#050505]/60">Mobile Number</dt>
                  <dd dir="ltr" className="font-mono font-bold">
                    {reg.mobileNumber}
                  </dd>
                </div>
                {reg.bio && (
                  <div>
                    <dt className="text-[#050505]/60">Description / Bio</dt>
                    <dd className="font-semibold break-words">{reg.bio}</dd>
                  </div>
                )}
              </dl>

              <div className="rounded-2xl bg-[#050505] p-3 text-center text-xs font-semibold text-[#FFB800]">
                {reg.rejectionReason || 'Chat access was rejected by Admin 2. Chatting remains blocked.'}
              </div>

              <button
                type="button"
                onClick={() => {
                  setRegFirst(reg.firstName);
                  setRegLast(reg.lastName);
                  setRegMobile(reg.mobileNumber);
                  setRegBio(reg.bio || '');
                  setRegAvatar(reg.avatarDataUrl);
                  setResubmitting(true);
                }}
                className="flex min-h-[44px] w-full items-center justify-center rounded-xl bg-[#050505] text-xs font-extrabold text-[#00FF66] cursor-pointer"
              >
                Re-submit Registration
              </button>
            </div>
          )}
        </div>
      </section>
    );
  }

  // ---------------------------------------------------------------------------
  // RENDER MODE B: Separate Dedicated Chat Window Page (Clean Composer, Locked Profile)
  // ---------------------------------------------------------------------------
  const isDirectWindow = senderRole === 'admin' || selectedChat !== null;
  const chatWindowName =
    senderRole === 'admin'
      ? title
      : selectedChat?.kind === 'contact'
      ? `${selectedChat.contact.firstName} ${selectedChat.contact.lastName}`
      : selectedChat?.kind === 'group'
      ? selectedChat.group.name
      : 'TaskPay VIP Support';

  const chatWindowSubtitle =
    senderRole === 'admin'
      ? subtitle || roomUid
      : selectedChat?.kind === 'contact'
      ? maskMobileNumber(selectedChat.contact.phoneNumber)
      : selectedChat?.kind === 'group'
      ? selectedChat.group.memberSummary
      : blockRestriction.exclusiveAdminId
      ? `Exclusive w/ ${blockRestriction.exclusiveAdminId}`
      : `Admin: ${maskMobileNumber(reg?.adminAssignedNumber || DEFAULT_ADMIN_NUMBER)}`;

  const chatWindowAvatar =
    senderRole === 'admin'
      ? wa.profiles[roomUid]?.avatarDataUrl || wa.registrations[roomUid]?.avatarDataUrl
      : selectedChat?.kind === 'contact'
      ? selectedChat.contact.avatarDataUrl
      : selectedChat?.kind === 'group'
      ? selectedChat.group.avatarDataUrl
      : undefined;

  if (isDirectWindow) {
    return (
      <section className={fixedShellClass}>
        {/* Pinned Dedicated Chat Window Header */}
        <div className="shrink-0 border-b border-[#00FF66]/20 bg-[#0b0e0c]/95 backdrop-blur-md px-3 py-2.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {senderRole === 'user' && (
              <button
                type="button"
                onClick={() => {
                  setSelectedChat(null);
                  setError(null);
                }}
                aria-label="Back to chats"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[#00FF66] hover:bg-white/5 cursor-pointer"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
            )}
            <AvatarCircle
              name={chatWindowName}
              src={chatWindowAvatar}
              size="sm"
              isGroup={selectedChat?.kind === 'group'}
            />
            <div className="min-w-0">
              <h2 className="font-display text-sm font-extrabold text-white truncate">
                {chatWindowName}
              </h2>
              <p dir="ltr" className="text-[10px] font-mono text-[#9cb3a5] truncate">
                {chatWindowSubtitle}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {senderRole === 'user' && (
              <>
                <div className="hidden sm:flex items-center gap-1.5 rounded-xl border border-white/10 bg-[#050505] px-2 py-1">
                  <AvatarCircle name={displayName} src={displayAvatar} size="xs" />
                  <span className="max-w-[72px] truncate text-[10px] font-bold text-white">
                    {displayName}
                  </span>
                </div>
                <button
                  type="button"
                  disabled={isCurrentChatBlocked}
                  onClick={() => startLocalCall(chatWindowName, chatWindowSubtitle, 'audio')}
                  aria-label="Start audio call"
                  className="flex h-10 w-10 items-center justify-center rounded-xl text-[#00FF66] hover:bg-white/5 disabled:opacity-40 cursor-pointer"
                >
                  <Phone className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  disabled={isCurrentChatBlocked}
                  onClick={() => startLocalCall(chatWindowName, chatWindowSubtitle, 'video')}
                  aria-label="Start video call"
                  className="flex h-10 w-10 items-center justify-center rounded-xl text-[#00FF66] hover:bg-white/5 disabled:opacity-40 cursor-pointer"
                >
                  <Video className="h-4 w-4" />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Locked Identity Strip showing User's Name + Profile Picture in chat window */}
        {senderRole === 'user' && (
          <div className="shrink-0 border-b border-white/10 bg-[#070a08] px-3.5 py-1.5 flex items-center justify-between gap-2 text-[10px]">
            <div className="flex items-center gap-2 min-w-0">
              <AvatarCircle name={displayName} src={displayAvatar} size="xs" />
              <span className="font-bold text-white truncate">{displayName}</span>
              <span dir="ltr" className="font-mono text-[#00FF66]">
                {maskedOwnId}
              </span>
            </div>
            <span className="inline-flex items-center gap-1 text-[#FFB800] font-bold shrink-0">
              <Lock className="h-3 w-3" />
              <span>Locked Profile</span>
            </span>
          </div>
        )}

        {/* Chat Request / Admin 3 Block Restriction Banner */}
        {isCurrentChatBlocked && (
          <div
            role="alert"
            className="shrink-0 border-b border-[#FFB800]/50 bg-[#FFB800]/12 px-3.5 py-2.5 flex items-center justify-between gap-2 text-[11px] font-bold text-[#FFB800]"
          >
            <div className="flex items-center gap-2 min-w-0">
              <Ban className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{blockRestriction.reason}</span>
            </div>
            {senderRole === 'user' &&
              selectedChat?.kind === 'contact' &&
              selectedContactRequestStatus.state === 'none' && (
                <button
                  type="button"
                  onClick={() =>
                    sendChatRequest({
                      senderUid: roomUid,
                      senderName: displayName,
                      senderMobile: myMobile,
                      senderAvatar: displayAvatar,
                      recipientName: `${selectedChat.contact.firstName} ${selectedChat.contact.lastName}`,
                      recipientMobile: selectedChat.contact.phoneNumber,
                    })
                  }
                  className="shrink-0 rounded-lg vip-btn-neon px-2.5 py-1 text-[10px] font-extrabold cursor-pointer"
                >
                  Send Request
                </button>
              )}
          </div>
        )}

        {/* Inner Scrollable Messages Feed */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain mobile-scroll p-3.5 space-y-2.5 bg-[#050505]/90">
          {activeMessages.length === 0 ? (
            <div className="py-14 text-center space-y-1.5">
              <p className="text-xs font-semibold text-[#9cb3a5]">No messages in this chat yet.</p>
              <p className="text-[11px] text-[#9cb3a5]/70">
                Type a message below. Long-press any message to delete.
              </p>
            </div>
          ) : (
            activeMessages.map((msg) => {
              const mine = msg.senderRole === senderRole;
              return (
                <div
                  key={msg.id}
                  onPointerDown={() => startLongPress(msg)}
                  onPointerUp={cancelLongPress}
                  onPointerMove={cancelLongPress}
                  onPointerCancel={cancelLongPress}
                  className={`group flex ${mine ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`relative max-w-[85%] rounded-2xl px-3.5 py-2 text-xs select-none ${
                      mine
                        ? 'bg-[#00FF66]/15 border border-[#00FF66]/45 text-white'
                        : 'bg-[#101512] border border-white/10 text-white'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2.5 mb-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <AvatarCircle name={msg.senderName} src={msg.senderAvatar} size="xs" />
                        <span className="text-[10px] font-bold text-[#FFB800] truncate">
                          {msg.senderName}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteTargetMsg(msg);
                        }}
                        aria-label="Delete message options"
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white/5 text-[#9cb3a5] hover:text-[#FFB800] cursor-pointer"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>

                    {msg.kind === 'image' && msg.mediaDataUrl && (
                      <img
                        src={msg.mediaDataUrl}
                        alt={msg.text || 'Attachment'}
                        className="mb-2 max-h-48 w-full rounded-xl object-cover border border-[#00FF66]/20"
                      />
                    )}

                    {msg.text && (
                      <p className="whitespace-pre-wrap break-words leading-relaxed">{msg.text}</p>
                    )}

                    <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-[#9cb3a5] tabular">
                      <span>
                        {new Date(msg.createdAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      {mine && <TickBadge tick={msg.tickState} />}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={endRef} />
        </div>

        {error && (
          <div className="shrink-0 border-t border-[#FFB800]/30 bg-[#FFB800]/10 px-3.5 py-2 text-[11px] font-semibold text-[#FFB800]">
            {error}
          </div>
        )}

        {/* Clean Text-Focused Pinned Composer (Cluttered media icons removed) */}
        <form
          onSubmit={handleSendText}
          className="shrink-0 border-t border-[#00FF66]/15 bg-[#0b0e0c] p-2.5 flex items-center gap-2"
        >
          <input
            type="text"
            disabled={isCurrentChatBlocked}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={
              isCurrentChatBlocked
                ? 'Messaging blocked'
                : t('typeMessage')
            }
            className="h-[44px] min-w-0 flex-1 rounded-xl border border-[#00FF66]/25 bg-[#050505] px-3.5 text-xs text-white placeholder:text-[#9cb3a5]/60 focus:border-[#00FF66] focus:outline-none disabled:opacity-50"
          />

          <button
            type="submit"
            disabled={busy || isCurrentChatBlocked || !text.trim()}
            aria-label={t('send')}
            className="inline-flex min-h-[44px] shrink-0 items-center justify-center gap-1.5 rounded-xl vip-btn-neon px-4 text-xs font-extrabold disabled:opacity-45 cursor-pointer"
          >
            <Send className="h-4 w-4" aria-hidden="true" />
            <span>{t('send')}</span>
          </button>
        </form>

        {/* WhatsApp-Style Delete Message Modal ("Delete for me" & "Delete for everyone") */}
        {deleteTargetMsg && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Delete message"
            onClick={() => setDeleteTargetMsg(null)}
            className="absolute inset-0 z-40 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="vip-hero-3d w-full max-w-[340px] p-5 space-y-3 animate-view-enter"
            >
              <h3 className="font-display text-base font-extrabold text-white">
                Delete message?
              </h3>
              <p className="text-xs text-[#9cb3a5] truncate">
                {deleteTargetMsg.text || `[${deleteTargetMsg.kind}]`}
              </p>

              <div className="space-y-2 pt-1">
                {senderRole === 'user' && (
                  <button
                    type="button"
                    onClick={() => {
                      deleteMessageForMe(deleteTargetMsg.id, viewerKey);
                      setDeleteTargetMsg(null);
                    }}
                    className="flex min-h-[44px] w-full items-center justify-center rounded-xl vip-btn-surface text-xs font-extrabold text-[#FFB800] cursor-pointer"
                  >
                    Delete for me
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    deleteMessageForEveryone(deleteTargetMsg.id);
                    setDeleteTargetMsg(null);
                  }}
                  className="flex min-h-[44px] w-full items-center justify-center rounded-xl border border-[#FFB800]/65 bg-[#FFB800]/15 text-xs font-extrabold text-[#FFB800] cursor-pointer"
                >
                  Delete for everyone
                </button>

                <button
                  type="button"
                  onClick={() => setDeleteTargetMsg(null)}
                  className="flex min-h-[44px] w-full items-center justify-center rounded-xl bg-white/5 text-xs font-bold text-[#9cb3a5] hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Local Outgoing Call Overlay */}
        {localCallOverlay && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-between bg-[#050505]/95 p-6 text-center">
            <div className="pt-6 space-y-2">
              <div className="text-xs font-extrabold uppercase tracking-wider text-[#00FF66]">
                TaskPay {localCallOverlay.callType} Call
              </div>
              <AvatarCircle name={localCallOverlay.peerName} size="lg" />
              <h3 className="font-display text-xl font-extrabold text-white">
                {localCallOverlay.peerName}
              </h3>
              <p className="font-mono text-xs text-[#9cb3a5]">{localCallOverlay.peerNumber}</p>
              <p className="font-mono text-sm font-bold text-[#FFB800] tabular">
                {String(Math.floor(localCallOverlay.seconds / 60)).padStart(2, '0')}:
                {String(localCallOverlay.seconds % 60).padStart(2, '0')}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setLocalCallOverlay(null)}
              className="flex min-h-[48px] w-full max-w-[220px] items-center justify-center gap-2 rounded-2xl border border-[#FFB800] bg-[#FFB800]/20 text-xs font-extrabold text-[#FFB800] cursor-pointer"
            >
              <X className="h-4 w-4" />
              <span>End Call</span>
            </button>
          </div>
        )}
      </section>
    );
  }

  // ---------------------------------------------------------------------------
  // RENDER MODE C: Dedicated Support Hub Pages (Chats | Requests | Masked IDs | Updates | Calls)
  // ---------------------------------------------------------------------------
  return (
    <section className={fixedShellClass}>
      {/* Pinned Permanently Locked Profile Header */}
      <div className="shrink-0 border-b border-[#00FF66]/20 bg-[#0b0e0c]/95 backdrop-blur-md px-4 py-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <AvatarCircle name={displayName} src={displayAvatar} size="md" />
          <div className="min-w-0">
            <h1 className="font-display text-base font-extrabold text-white truncate">
              {displayName}
            </h1>
            <p dir="ltr" className="text-[11px] font-mono text-[#00FF66] truncate">
              {maskedOwnId}
            </p>
          </div>
        </div>

        <div className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-[#FFB800]/45 bg-[#FFB800]/12 px-2.5 py-1.5 text-[10px] font-extrabold text-[#FFB800]">
          <Lock className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Profile Locked</span>
        </div>
      </div>

      {/* Pinned Dedicated Page Navigation Tabs */}
      <div className="shrink-0 grid grid-cols-5 border-b border-[#00FF66]/15 bg-[#090c0a] p-1 gap-1">
        {(
          [
            { id: 'chats', label: 'Chats' },
            {
              id: 'requests',
              label: pendingIncomingCount > 0 ? `Req (${pendingIncomingCount})` : 'Requests',
            },
            { id: 'ids', label: 'Masked IDs' },
            { id: 'updates', label: 'Status' },
            { id: 'calls', label: 'Calls' },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => {
              setWaTab(tab.id);
              setFabOpen(false);
            }}
            className={`min-h-[38px] rounded-xl px-1 text-[10px] font-extrabold transition-colors cursor-pointer truncate ${
              waTab === tab.id ? 'vip-btn-neon' : 'text-[#9cb3a5] hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Disabled Chat Alert Banner (Disabled users can ONLY contact Admin 1) */}
      {isDisabledByAdmin3 && (
        <div
          role="alert"
          className="shrink-0 border-b border-[#FFB800]/50 bg-[#FFB800]/12 px-3.5 py-2 flex items-center justify-between gap-2 text-[11px] font-bold text-[#FFB800]"
        >
          <div className="flex items-center gap-1.5 min-w-0">
            <Ban className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">Chat has been disabled, please contact support admin.</span>
          </div>
          <button
            type="button"
            onClick={() =>
              setSelectedChat({
                kind: 'support',
                id: 'support-admin',
                name: 'TaskPay VIP Support (Admin 1)',
                subtitle: 'Main Chat Admin (Admin 1)',
              })
            }
            className="shrink-0 rounded-lg vip-btn-neon px-2.5 py-1 text-[10px] font-extrabold cursor-pointer"
          >
            Admin 1
          </button>
        </div>
      )}

      {/* DEDICATED PAGE 1: CHATS LIST */}
      {waTab === 'chats' && (
        <div className="flex-1 min-h-0 flex flex-col">
          <div className="shrink-0 p-3 border-b border-white/10">
            <div className="relative">
              <Search
                className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9cb3a5]"
                aria-hidden="true"
              />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search chats or masked IDs..."
                className="h-11 w-full rounded-xl border border-[#00FF66]/20 bg-[#050505] ps-10 pe-3.5 text-xs text-white placeholder:text-[#9cb3a5]/55 focus:border-[#00FF66] focus:outline-none"
              />
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain mobile-scroll divide-y divide-[#00FF66]/10 pb-20">
            {chatItems.length === 0 ? (
              <p className="py-12 text-center text-xs text-[#9cb3a5]">No matching chats found.</p>
            ) : (
              chatItems.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => {
                    setFabOpen(false);
                    setSelectedChat(item.chat);
                  }}
                  className="w-full px-4 py-3 flex items-center justify-between gap-3 text-start hover:bg-white/[0.03] transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <AvatarCircle name={item.name} src={item.avatar} isGroup={item.isGroup} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-display text-sm font-extrabold text-white truncate">
                          {item.name}
                        </span>
                        {item.requestBadge && (
                          <span className="rounded bg-[#FFB800]/15 px-1.5 py-0.5 text-[9px] font-extrabold text-[#FFB800]">
                            {item.requestBadge}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-[#9cb3a5] truncate">{item.preview}</p>
                    </div>
                  </div>
                  <div className="text-end shrink-0">
                    {item.time && (
                      <div className="text-[10px] font-mono text-[#9cb3a5] tabular">
                        {new Date(item.time).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                    )}
                    <div className="text-[10px] font-mono text-[#00FF66] truncate max-w-[96px]" dir="ltr">
                      {item.sub}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {/* DEDICATED PAGE 2: CHAT REQUESTS INBOX & SEND REQUEST */}
      {waTab === 'requests' && (
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain mobile-scroll p-3.5 space-y-4 pb-20">
          {/* Initiate Connection / Send Request Form (Strict 03XXXXXXXXX) */}
          <form
            onSubmit={handleSendDirectRequestForm}
            className="rounded-2xl border border-[#00FF66]/25 bg-[#090c0a] p-3.5 space-y-2.5"
          >
            <div className="flex items-center gap-2 text-xs font-extrabold text-[#00FF66]">
              <Inbox className="h-4 w-4" aria-hidden="true" />
              <span>Send New Chat Request</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={reqTargetName}
                onChange={(e) => setReqTargetName(e.target.value)}
                placeholder="Recipient Name"
                className="h-10 rounded-xl border border-[#00FF66]/20 bg-[#050505] px-3 text-xs text-white focus:border-[#00FF66] focus:outline-none"
              />
              <input
                type="tel"
                dir="ltr"
                inputMode="numeric"
                maxLength={11}
                value={reqTargetMobile}
                onChange={(e) =>
                  setReqTargetMobile(e.target.value.replace(/[^\d]/g, '').slice(0, 11))
                }
                placeholder="03001234567"
                className="h-10 rounded-xl border border-[#00FF66]/20 bg-[#050505] px-3 font-mono text-xs text-white focus:border-[#00FF66] focus:outline-none"
              />
            </div>
            {reqFormMsg && (
              <div className="rounded-xl border border-[#FFB800]/50 bg-[#FFB800]/10 px-3 py-2 text-[11px] font-semibold text-[#FFB800]">
                {reqFormMsg}
              </div>
            )}
            <button
              type="submit"
              className="flex min-h-[40px] w-full items-center justify-center gap-1.5 rounded-xl vip-btn-neon text-xs font-extrabold cursor-pointer"
            >
              <Send className="h-3.5 w-3.5" />
              <span>Send Request</span>
            </button>
          </form>

          {/* Incoming Requests Inbox */}
          <div className="space-y-2.5">
            <h2 className="text-xs font-extrabold text-[#FFB800] px-1">
              Incoming Chat Requests ({incomingRequests.length})
            </h2>
            {incomingRequests.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-[#0b0e0c] p-5 text-center text-xs text-[#9cb3a5]">
                No incoming chat requests.
              </div>
            ) : (
              incomingRequests.map((reqItem) => (
                <div
                  key={reqItem.id}
                  className="rounded-2xl border border-[#00FF66]/20 bg-[#0b0e0c] p-3.5 space-y-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <AvatarCircle name={reqItem.senderName} src={reqItem.senderAvatar} size="sm" />
                      <div className="min-w-0">
                        <div className="font-display text-xs font-extrabold text-white truncate">
                          {reqItem.senderName}
                        </div>
                        <div dir="ltr" className="text-[10px] font-mono text-[#00FF66]">
                          ID: {maskMobileNumber(reqItem.senderMobile)}
                        </div>
                      </div>
                    </div>
                    <span
                      className={`rounded-lg px-2 py-0.5 text-[10px] font-extrabold uppercase ${
                        reqItem.status === 'accepted'
                          ? 'bg-[#00FF66]/15 text-[#00FF66]'
                          : 'bg-[#FFB800]/15 text-[#FFB800]'
                      }`}
                    >
                      {reqItem.status}
                    </span>
                  </div>

                  {reqItem.status === 'pending' && (
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => respondToChatRequest(reqItem.id, 'accepted')}
                        className="flex min-h-[38px] items-center justify-center gap-1 rounded-xl vip-btn-neon text-xs font-extrabold cursor-pointer"
                      >
                        <Check className="h-3.5 w-3.5" />
                        <span>Accept</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => respondToChatRequest(reqItem.id, 'rejected')}
                        className="flex min-h-[38px] items-center justify-center gap-1 rounded-xl border border-[#FFB800]/60 bg-[#FFB800]/12 text-xs font-extrabold text-[#FFB800] cursor-pointer"
                      >
                        <X className="h-3.5 w-3.5" />
                        <span>Reject</span>
                      </button>
                    </div>
                  )}

                  {reqItem.status === 'accepted' && (
                    <button
                      type="button"
                      onClick={() =>
                        openChatWithPeer(
                          reqItem.senderName,
                          reqItem.senderMobile,
                          reqItem.senderAvatar
                        )
                      }
                      className="flex min-h-[38px] w-full items-center justify-center gap-1.5 rounded-xl vip-btn-surface text-xs font-extrabold text-[#00FF66] cursor-pointer"
                    >
                      <MessageSquare className="h-3.5 w-3.5" />
                      <span>Open Chat Window</span>
                    </button>
                  )}

                  {reqItem.status === 'rejected' && (
                    <div className="text-[11px] font-bold text-[#FFB800]">
                      Rejected — Chatting is blocked for this connection.
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Sent Outgoing Requests */}
          <div className="space-y-2.5">
            <h2 className="text-xs font-extrabold text-[#9cb3a5] px-1">
              Sent Requests ({outgoingRequests.length})
            </h2>
            {outgoingRequests.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-[#0b0e0c] p-5 text-center text-xs text-[#9cb3a5]">
                You haven&apos;t sent any chat requests yet.
              </div>
            ) : (
              outgoingRequests.map((reqItem) => (
                <div
                  key={reqItem.id}
                  className="rounded-2xl border border-white/10 bg-[#0b0e0c] p-3 flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-extrabold text-white truncate">
                      {reqItem.recipientName}
                    </div>
                    <div dir="ltr" className="text-[10px] font-mono text-[#9cb3a5]">
                      {maskMobileNumber(reqItem.recipientMobile)}
                    </div>
                  </div>
                  {reqItem.status === 'accepted' ? (
                    <button
                      type="button"
                      onClick={() =>
                        openChatWithPeer(reqItem.recipientName, reqItem.recipientMobile)
                      }
                      className="shrink-0 rounded-xl vip-btn-neon px-3 py-1.5 text-[10px] font-extrabold cursor-pointer"
                    >
                      Open Chat
                    </button>
                  ) : (
                    <span className="shrink-0 rounded-lg bg-[#FFB800]/15 px-2.5 py-1 text-[10px] font-extrabold uppercase text-[#FFB800]">
                      {reqItem.status === 'rejected' ? 'Rejected · Blocked' : 'Pending'}
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* DEDICATED PAGE 3: MASKED ID LIST VIEW (Privacy-Protected 03******XXX Directory) */}
      {waTab === 'ids' && (
        <div className="flex-1 min-h-0 flex flex-col">
          <div className="shrink-0 p-3 border-b border-white/10 space-y-2">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-bold text-[#00FF66]">Masked User ID Directory</span>
              <span className="text-[#9cb3a5]">Privacy: 03******XXX</span>
            </div>
            <div className="relative">
              <Search
                className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9cb3a5]"
                aria-hidden="true"
              />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name or masked ID..."
                className="h-10 w-full rounded-xl border border-[#00FF66]/20 bg-[#050505] ps-10 pe-3.5 text-xs text-white placeholder:text-[#9cb3a5]/55 focus:border-[#00FF66] focus:outline-none"
              />
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain mobile-scroll p-3.5 space-y-2.5 pb-20">
            {maskedDirectoryList.length === 0 ? (
              <p className="py-10 text-center text-xs text-[#9cb3a5]">
                No registered user IDs found.
              </p>
            ) : (
              maskedDirectoryList.map((entry) => {
                const reqStatus = getConnectionRequestStatus(
                  wa,
                  roomUid,
                  myMobile,
                  entry.uid,
                  entry.rawMobile || entry.maskedMobile
                );
                return (
                  <div
                    key={entry.uid}
                    className="rounded-2xl border border-[#00FF66]/20 bg-[#0b0e0c] p-3 flex items-center justify-between gap-2.5"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <AvatarCircle name={entry.name} src={entry.avatarDataUrl} size="sm" />
                      <div className="min-w-0">
                        <div className="font-display text-xs font-extrabold text-white truncate">
                          {entry.name}
                        </div>
                        <div dir="ltr" className="text-[11px] font-mono font-bold text-[#00FF66]">
                          {entry.maskedMobile}
                        </div>
                        <div className="text-[10px] text-[#9cb3a5]">
                          {entry.uid} · {entry.rank}
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0">
                      {isDisabledByAdmin3 ? (
                        <span className="rounded-lg bg-[#FFB800]/15 px-2.5 py-1 text-[10px] font-extrabold text-[#FFB800]">
                          Disabled
                        </span>
                      ) : reqStatus.state === 'accepted' && entry.rawMobile ? (
                        <button
                          type="button"
                          onClick={() =>
                            openChatWithPeer(entry.name, entry.rawMobile!, entry.avatarDataUrl)
                          }
                          className="min-h-[34px] rounded-xl vip-btn-neon px-3 text-[10px] font-extrabold cursor-pointer"
                        >
                          Chat
                        </button>
                      ) : reqStatus.state === 'rejected' ? (
                        <span className="rounded-lg bg-[#FFB800]/15 px-2.5 py-1 text-[10px] font-extrabold text-[#FFB800]">
                          Blocked
                        </span>
                      ) : reqStatus.state === 'pending_sent' ? (
                        <span className="rounded-lg border border-[#FFB800]/40 px-2.5 py-1 text-[10px] font-bold text-[#FFB800]">
                          Requested
                        </span>
                      ) : reqStatus.state === 'pending_received' ? (
                        <button
                          type="button"
                          onClick={() => setWaTab('requests')}
                          className="min-h-[34px] rounded-xl vip-btn-surface px-2.5 text-[10px] font-extrabold text-[#FFB800] cursor-pointer"
                        >
                          Accept / Reject
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            sendChatRequest({
                              senderUid: roomUid,
                              senderName: displayName,
                              senderMobile: myMobile,
                              senderAvatar: displayAvatar,
                              recipientUid: entry.uid,
                              recipientName: entry.name,
                              recipientMobile: entry.rawMobile || entry.maskedMobile,
                            });
                          }}
                          className="min-h-[34px] rounded-xl vip-btn-surface px-3 text-[10px] font-extrabold text-[#00FF66] cursor-pointer"
                        >
                          Request Chat
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* DEDICATED PAGE 4: UPDATES (STATUS) */}
      {waTab === 'updates' && (
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain mobile-scroll p-3.5 space-y-4 pb-20">
          <div className="rounded-2xl border border-[#00FF66]/25 bg-[#090c0a] p-3.5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-3 min-w-0">
                <AvatarCircle name={displayName} src={displayAvatar} />
                <div className="min-w-0">
                  <div className="font-display text-sm font-extrabold text-white truncate">
                    My Status
                  </div>
                  <div className="text-[11px] text-[#9cb3a5]">
                    Share photo, video, or text update
                  </div>
                </div>
              </div>
              <Radio className="h-4 w-4 text-[#00FF66] shrink-0" aria-hidden="true" />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setShowTextStatusModal(true)}
                className="flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl vip-btn-surface text-xs font-bold text-[#FFB800] cursor-pointer"
              >
                <Pencil className="h-3.5 w-3.5" />
                <span>Text Status</span>
              </button>
              <label className="flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl vip-btn-neon text-xs font-extrabold cursor-pointer">
                <Film className="h-3.5 w-3.5" />
                <span>Photo / Video</span>
                <input
                  ref={statusMediaInputRef}
                  type="file"
                  accept="image/*,video/*"
                  onChange={handleUploadStatusMedia}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          <div className="space-y-2.5">
            <h2 className="text-xs font-bold text-[#9cb3a5] px-1">Recent Status Updates</h2>
            {wa.statusUpdates.map((st) => (
              <div
                key={st.id}
                className="rounded-2xl border border-white/10 bg-[#0b0e0c] p-3 flex items-center justify-between gap-3"
              >
                <button
                  type="button"
                  onClick={() => {
                    incrementStatusView(st.id);
                    setViewingStatus(st);
                  }}
                  className="flex items-center gap-3 min-w-0 flex-1 text-start cursor-pointer"
                >
                  <AvatarCircle name={st.authorName} src={st.authorAvatar} />
                  <div className="min-w-0">
                    <div className="font-display text-xs font-extrabold text-white truncate">
                      {st.authorName}
                    </div>
                    <p className="text-[11px] text-[#9cb3a5] truncate">
                      {st.kind === 'video' ? '[Video Status] ' : st.kind === 'image' ? '[Photo Status] ' : ''}
                      {st.text}
                    </p>
                    <div className="mt-0.5 text-[10px] text-[#00FF66] tabular">
                      {new Date(st.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}{' '}
                      · {st.views} views
                    </div>
                  </div>
                </button>

                {st.authorUid === roomUid && (
                  <button
                    type="button"
                    onClick={() => deleteStatusUpdate(st.id)}
                    aria-label="Delete my status"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[#FFB800] hover:bg-white/5 cursor-pointer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* DEDICATED PAGE 5: CALLS */}
      {waTab === 'calls' && (
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain mobile-scroll p-3.5 space-y-3 pb-20">
          {activeCall && activeCall.status !== 'ended' && (
            <div className="rounded-2xl border border-[#00FF66] bg-[#00FF66]/10 p-3.5 flex items-center justify-between gap-2">
              <div>
                <div className="text-xs font-extrabold text-[#00FF66]">
                  Live Admin {activeCall.callType.toUpperCase()} Call
                </div>
                <div className="text-[11px] text-white">Status: {activeCall.status}</div>
              </div>
              <PhoneCall className="h-5 w-5 text-[#00FF66]" />
            </div>
          )}

          <div className="space-y-2">
            <h2 className="text-xs font-bold text-[#9cb3a5] px-1">Quick Call Contacts</h2>
            {userContacts.map((cnt) => {
              const name = `${cnt.firstName} ${cnt.lastName}`;
              const lockCheck = getUserLockRestriction(wa, roomUid, cnt.id, cnt.phoneNumber);
              return (
                <div
                  key={cnt.id}
                  className="rounded-2xl border border-white/10 bg-[#0b0e0c] px-3.5 py-2.5 flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <AvatarCircle name={name} src={cnt.avatarDataUrl} size="sm" />
                    <div className="min-w-0">
                      <div className="font-display text-xs font-extrabold text-white truncate">
                        {name}
                      </div>
                      <div dir="ltr" className="text-[10px] font-mono text-[#9cb3a5]">
                        {maskMobileNumber(cnt.phoneNumber)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      disabled={lockCheck.blocked}
                      onClick={() => startLocalCall(name, maskMobileNumber(cnt.phoneNumber), 'audio')}
                      aria-label={`Audio call ${name}`}
                      className="flex h-10 w-10 items-center justify-center rounded-xl vip-btn-surface text-[#00FF66] disabled:opacity-40 cursor-pointer"
                    >
                      <Phone className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      disabled={lockCheck.blocked}
                      onClick={() => startLocalCall(name, maskMobileNumber(cnt.phoneNumber), 'video')}
                      aria-label={`Video call ${name}`}
                      className="flex h-10 w-10 items-center justify-center rounded-xl vip-btn-neon disabled:opacity-40 cursor-pointer"
                    >
                      <Video className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="space-y-2 pt-2">
            <h2 className="text-xs font-bold text-[#9cb3a5] px-1">Recent Call Log</h2>
            {wa.callLogs.length === 0 ? (
              <p className="py-6 text-center text-xs text-[#9cb3a5]">No recent calls logged.</p>
            ) : (
              wa.callLogs.map((log) => (
                <div
                  key={log.id}
                  className="rounded-xl border border-white/10 bg-[#090c0a] px-3.5 py-2.5 flex items-center justify-between gap-2 text-xs"
                >
                  <div className="min-w-0">
                    <div className="font-bold text-white truncate">{log.peerName}</div>
                    <div className="text-[10px] text-[#9cb3a5]">
                      {log.direction} {log.callType} · {new Date(log.createdAt).toLocaleTimeString()}
                    </div>
                  </div>
                  <span className="font-mono text-[11px] font-bold text-[#00FF66]">
                    {log.durationLabel}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* FLOATING "+" BUTTON WITH ONLY TWO OPTIONS ("New Group" & "New Contact") */}
      <div className="absolute bottom-4 end-4 z-20 flex flex-col items-end gap-2">
        {fabOpen && (
          <div
            role="menu"
            className="vip-hero-3d w-48 p-1.5 space-y-1 shadow-[0_14px_34px_rgba(0,0,0,0.85)] animate-view-enter"
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setFabOpen(false);
                setShowNewGroupModal(true);
              }}
              className="flex min-h-[44px] w-full items-center gap-2.5 rounded-xl px-3 text-xs font-extrabold text-white hover:bg-[#00FF66]/15 cursor-pointer"
            >
              <Users className="h-4 w-4 text-[#00FF66]" aria-hidden="true" />
              <span>New Group</span>
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setFabOpen(false);
                setShowNewContactModal(true);
              }}
              className="flex min-h-[44px] w-full items-center gap-2.5 rounded-xl px-3 text-xs font-extrabold text-white hover:bg-[#00FF66]/15 cursor-pointer"
            >
              <UserPlus className="h-4 w-4 text-[#FFB800]" aria-hidden="true" />
              <span>New Contact</span>
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={() => setFabOpen((v) => !v)}
          aria-label="Open new chat menu"
          aria-expanded={fabOpen}
          className="flex h-14 w-14 items-center justify-center rounded-2xl vip-btn-neon shadow-[0_12px_28px_rgba(0,255,102,0.45)] transition-transform active:scale-95 cursor-pointer"
        >
          {fabOpen ? <X className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
        </button>
      </div>

      {/* MODAL: New Contact Form (Strict 11-digit starting with "03" + sends Chat Request) */}
      {showNewContactModal && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setShowNewContactModal(false)}
          className="absolute inset-0 z-40 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleSaveNewContact}
            className="vip-hero-3d w-full max-w-[350px] p-5 space-y-3"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-display text-base font-extrabold text-white">New Contact</h3>
              <button
                type="button"
                onClick={() => setShowNewContactModal(false)}
                className="text-[#9cb3a5] hover:text-white cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex items-center gap-3">
              <AvatarCircle name={`${cntFirst} ${cntLast}`.trim() || 'NC'} src={cntAvatar} />
              <label className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl vip-btn-surface px-3 text-xs font-bold text-[#00FF66] cursor-pointer">
                <ImageIcon className="h-3.5 w-3.5" />
                <span>Contact Photo</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (f) setCntAvatar(await readFileAsMediaUrl(f));
                  }}
                />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-semibold text-[#9cb3a5]">First Name</label>
                <input
                  type="text"
                  value={cntFirst}
                  onChange={(e) => setCntFirst(e.target.value)}
                  placeholder="First Name"
                  className="mt-1 h-11 w-full rounded-xl border border-[#00FF66]/25 bg-[#050505] px-3 text-xs text-white focus:border-[#00FF66] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[#9cb3a5]">Last Name</label>
                <input
                  type="text"
                  value={cntLast}
                  onChange={(e) => setCntLast(e.target.value)}
                  placeholder="Last Name"
                  className="mt-1 h-11 w-full rounded-xl border border-[#00FF66]/25 bg-[#050505] px-3 text-xs text-white focus:border-[#00FF66] focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[#9cb3a5]">
                Mobile ID / Number (11 digits starting with 03)
              </label>
              <input
                type="tel"
                dir="ltr"
                inputMode="numeric"
                maxLength={11}
                value={cntNumber}
                onChange={(e) => setCntNumber(e.target.value.replace(/[^\d]/g, '').slice(0, 11))}
                placeholder="03001234567"
                className="mt-1 h-11 w-full rounded-xl border border-[#00FF66]/25 bg-[#050505] px-3 font-mono text-xs text-white focus:border-[#00FF66] focus:outline-none"
              />
            </div>

            {cntError && (
              <div className="rounded-xl border border-[#FFB800]/60 bg-[#FFB800]/10 px-3 py-2 text-[11px] font-semibold text-[#FFB800] flex items-center gap-1.5">
                <ShieldAlert className="h-4 w-4 shrink-0" />
                <span>{cntError}</span>
              </div>
            )}

            <button
              type="submit"
              className="min-h-[44px] w-full rounded-xl vip-btn-neon text-xs font-extrabold cursor-pointer"
            >
              Save Contact & Send Request
            </button>
          </form>
        </div>
      )}

      {/* MODAL: New Group Form */}
      {showNewGroupModal && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setShowNewGroupModal(false)}
          className="absolute inset-0 z-40 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleCreateGroup}
            className="vip-hero-3d w-full max-w-[350px] p-5 space-y-3"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-display text-base font-extrabold text-white">New Group</h3>
              <button
                type="button"
                onClick={() => setShowNewGroupModal(false)}
                className="text-[#9cb3a5] hover:text-white cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex items-center gap-3">
              <AvatarCircle name={grpName || 'G'} src={grpAvatar} isGroup />
              <label className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl vip-btn-surface px-3 text-xs font-bold text-[#00FF66] cursor-pointer">
                <ImageIcon className="h-3.5 w-3.5" />
                <span>Group Icon</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (f) setGrpAvatar(await readFileAsMediaUrl(f));
                  }}
                />
              </label>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[#9cb3a5]">Group Name</label>
              <input
                type="text"
                value={grpName}
                onChange={(e) => setGrpName(e.target.value)}
                placeholder="e.g. TaskPay VIP Team"
                className="mt-1 h-11 w-full rounded-xl border border-[#00FF66]/25 bg-[#050505] px-3 text-xs text-white focus:border-[#00FF66] focus:outline-none"
              />
            </div>

            <div>
              <div className="text-[11px] font-semibold text-[#9cb3a5] mb-1.5">
                Select Contacts ({grpSelectedIds.length} selected)
              </div>
              <div className="max-h-32 overflow-y-auto mobile-scroll space-y-1.5 rounded-xl border border-white/10 bg-[#050505] p-2">
                {userContacts.length === 0 ? (
                  <p className="text-[11px] text-[#9cb3a5] text-center py-2">No saved contacts yet</p>
                ) : (
                  userContacts.map((c) => {
                    const checked = grpSelectedIds.includes(c.id);
                    return (
                      <label
                        key={c.id}
                        className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-xs hover:bg-white/5 cursor-pointer"
                      >
                        <span className="truncate text-white">
                          {c.firstName} {c.lastName}
                        </span>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            setGrpSelectedIds((prev) =>
                              checked ? prev.filter((id) => id !== c.id) : [...prev, c.id]
                            )
                          }
                          className="accent-[#00FF66]"
                        />
                      </label>
                    );
                  })
                )}
              </div>
            </div>

            {grpError && (
              <div className="rounded-xl border border-[#FFB800]/60 bg-[#FFB800]/10 px-3 py-2 text-[11px] font-semibold text-[#FFB800]">
                {grpError}
              </div>
            )}

            <button
              type="submit"
              className="min-h-[44px] w-full rounded-xl vip-btn-neon text-xs font-extrabold cursor-pointer"
            >
              Create Group
            </button>
          </form>
        </div>
      )}

      {/* MODAL: Text Status Composer */}
      {showTextStatusModal && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setShowTextStatusModal(false)}
          className="absolute inset-0 z-40 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={handlePublishTextStatus}
            className="vip-hero-3d w-full max-w-[350px] p-5 space-y-3"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-display text-base font-extrabold text-white">Post Status Update</h3>
              <button
                type="button"
                onClick={() => setShowTextStatusModal(false)}
                className="text-[#9cb3a5] hover:text-white cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <textarea
              rows={4}
              value={statusText}
              onChange={(e) => setStatusText(e.target.value)}
              placeholder="Write a status update for your contacts & Admin monitor..."
              className="w-full rounded-xl border border-[#00FF66]/25 bg-[#050505] p-3 text-xs text-white focus:border-[#00FF66] focus:outline-none"
            />
            <button
              type="submit"
              className="min-h-[44px] w-full rounded-xl vip-btn-neon text-xs font-extrabold cursor-pointer"
            >
              Post Status
            </button>
          </form>
        </div>
      )}

      {/* MODAL: Full Status Viewer */}
      {viewingStatus && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setViewingStatus(null)}
          className="absolute inset-0 z-50 flex flex-col justify-between bg-[#050505]/95 p-5"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <AvatarCircle name={viewingStatus.authorName} src={viewingStatus.authorAvatar} size="sm" />
              <div className="min-w-0">
                <div className="font-display text-xs font-extrabold text-white truncate">
                  {viewingStatus.authorName}
                </div>
                <div className="text-[10px] text-[#9cb3a5]">
                  {new Date(viewingStatus.createdAt).toLocaleString()}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setViewingStatus(null)}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-white cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div
            onClick={(e) => e.stopPropagation()}
            className="my-auto flex flex-col items-center justify-center space-y-3"
          >
            {viewingStatus.kind === 'image' && viewingStatus.mediaDataUrl && (
              <img
                src={viewingStatus.mediaDataUrl}
                alt="Status"
                className="max-h-72 rounded-2xl object-contain border border-[#00FF66]/30"
              />
            )}
            {viewingStatus.kind === 'video' && viewingStatus.mediaDataUrl && (
              <video
                controls
                autoPlay
                src={viewingStatus.mediaDataUrl}
                className="max-h-72 rounded-2xl border border-[#00FF66]/30"
              />
            )}
            {viewingStatus.text && (
              <p className="rounded-2xl border border-[#00FF66]/25 bg-[#0b0e0c] px-4 py-3 text-center text-sm font-semibold text-white">
                {viewingStatus.text}
              </p>
            )}
          </div>

          <div className="flex items-center justify-center gap-1.5 text-xs text-[#00FF66]">
            <Eye className="h-4 w-4" />
            <span className="tabular font-bold">{viewingStatus.views} views</span>
          </div>
        </div>
      )}

      {/* Local Outgoing Call Overlay */}
      {localCallOverlay && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-between bg-[#050505]/95 p-6 text-center">
          <div className="pt-6 space-y-2">
            <div className="text-xs font-extrabold uppercase tracking-wider text-[#00FF66]">
              TaskPay {localCallOverlay.callType} Call
            </div>
            <AvatarCircle name={localCallOverlay.peerName} size="lg" />
            <h3 className="font-display text-xl font-extrabold text-white">
              {localCallOverlay.peerName}
            </h3>
            <p className="font-mono text-xs text-[#9cb3a5]">{localCallOverlay.peerNumber}</p>
            <p className="font-mono text-sm font-bold text-[#FFB800] tabular">
              {String(Math.floor(localCallOverlay.seconds / 60)).padStart(2, '0')}:
              {String(localCallOverlay.seconds % 60).padStart(2, '0')}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setLocalCallOverlay(null)}
            className="flex min-h-[48px] w-full max-w-[220px] items-center justify-center gap-2 rounded-2xl border border-[#FFB800] bg-[#FFB800]/20 text-xs font-extrabold text-[#FFB800] cursor-pointer"
          >
            <X className="h-4 w-4" />
            <span>End Call</span>
          </button>
        </div>
      )}
    </section>
  );
};
