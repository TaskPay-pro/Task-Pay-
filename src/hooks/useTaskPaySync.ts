import { useCallback, useEffect, useRef, useState } from 'react';
import { onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth';
import { collection, doc, onSnapshot, query, setDoc, updateDoc, where } from 'firebase/firestore';
import {
  auth,
  db,
  handleFirestoreError,
  OperationType,
  signInWithGoogleCloud,
  testConnection,
} from '../firebase';
import type {
  ChatMessage,
  PaymentMethod,
  SupportRegistrationRecord,
  SyncStatePayload,
  UserRecord,
  WebRTCSignalMessage,
} from '../types/taskpay';
import {
  hydrateServerSupportState,
  setActiveAdminId,
  type WaSupportRegistration,
} from '../utils/whatsappChatStore';

const UID_STORAGE_KEY = 'taskpay_uid_v1';
const ADMIN_TOKEN_KEY = 'taskpay_admin_token_v1';
const MASTER_ADMIN_MOBILE = '03265410214';
const MASTER_ADMIN_PASS = 'admin@786';
const MASTER_ADMIN_TOKEN = 'taskpay-admin-vip-token-2026';

const EMPTY_PAYLOAD: SyncStatePayload = {
  snapshot: {
    taskRewardRate: 40,
    totalUsers: 0,
    onlineCount: 0,
    offlineCount: 0,
    growthPercent: 30,
    growthSeries: [],
    liveFeed: [],
  },
  user: null,
  tasks: [],
  withdrawals: [],
  referrals: [],
  userHistory: [],
  messages: [],
  activeCall: null,
};

export function useTaskPaySync(onSignal?: (msg: WebRTCSignalMessage) => void) {
  const [uid, setUid] = useState<string | null>(() =>
    typeof window !== 'undefined' ? window.localStorage.getItem(UID_STORAGE_KEY) : null
  );
  const [adminToken, setAdminToken] = useState<string | null>(() =>
    typeof window !== 'undefined' ? window.localStorage.getItem(ADMIN_TOKEN_KEY) : null
  );
  const [data, setData] = useState<SyncStatePayload>(EMPTY_PAYLOAD);
  const [wsConnected, setWsConnected] = useState(false);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const onSignalRef = useRef(onSignal);
  onSignalRef.current = onSignal;

  const applyPayload = useCallback((payload: SyncStatePayload) => {
    hydrateServerSupportState({
      supportRegistration: payload.supportRegistration,
      supportApprovalHistory: payload.supportApprovalHistory,
      allSupportRegistrations: payload.allSupportRegistrations,
      allSupportApprovalHistory: payload.allSupportApprovalHistory,
      disabledChatUids: payload.disabledChatUids,
    });
    setData(payload);
  }, []);

  const fetchSnapshot = useCallback(
    async (targetUid: string | null, token: string | null) => {
      try {
        const qs = targetUid ? `?uid=${encodeURIComponent(targetUid)}` : '';
        const res = await fetch(`/api/state${qs}`, {
          headers: token ? { 'x-admin-token': token } : {},
        });
        if (res.ok) {
          const text = await res.text();
          if (text && text.trim().startsWith('{')) {
            const json = JSON.parse(text) as SyncStatePayload;
            applyPayload(json);
          }
        }
      } catch {
        // Handled by WebSocket retry
      }
    },
    [applyPayload]
  );

  useEffect(() => {
    testConnection();
    const unsub = onAuthStateChanged(auth, (u) => {
      setFirebaseUser(u);
    });
    return () => unsub();
  }, []);

  // Firestore real-time listener when Firebase user is authenticated & verified
  useEffect(() => {
    if (!firebaseUser || !firebaseUser.emailVerified) return;
    const isFirebaseAdmin = firebaseUser.email === 'shahbazali6863852@gmail.com';
    const unsubs: (() => void)[] = [];

    const regPath = 'supportRegistrations';
    const regQ = isFirebaseAdmin
      ? collection(db, regPath)
      : query(collection(db, regPath), where('uid', '==', firebaseUser.uid));

    unsubs.push(
      onSnapshot(
        regQ,
        (snap) => {
          const cloudRegs = snap.docs
            .map((d) => d.data() as SupportRegistrationRecord)
            .filter((r) => Boolean(r && r.uid));
          if (cloudRegs.length > 0) {
            hydrateServerSupportState({
              allSupportApprovalHistory: cloudRegs,
              allSupportRegistrations: isFirebaseAdmin ? cloudRegs : undefined,
              supportApprovalHistory: isFirebaseAdmin ? undefined : cloudRegs,
              supportRegistration: isFirebaseAdmin ? undefined : cloudRegs[0],
            });
            setData((prev) => ({
              ...prev,
              supportApprovalHistory: isFirebaseAdmin
                ? prev.supportApprovalHistory
                : cloudRegs,
              allSupportApprovalHistory: isFirebaseAdmin
                ? cloudRegs
                : prev.allSupportApprovalHistory,
            }));
          }
        },
        (error) => {
          handleFirestoreError(error, OperationType.LIST, regPath);
        }
      )
    );

    const msgPath = 'messages';
    const msgQ = isFirebaseAdmin
      ? collection(db, msgPath)
      : query(collection(db, msgPath), where('roomUid', '==', firebaseUser.uid));

    unsubs.push(
      onSnapshot(
        msgQ,
        (snap) => {
          const cloudMsgs = snap.docs.map((d) => d.data() as ChatMessage);
          if (cloudMsgs.length > 0) {
            setData((prev) => {
              const mergeLists = (existing: ChatMessage[] = []) => {
                const map = new Map(existing.map((m) => [m.id, m]));
                for (const m of cloudMsgs) {
                  if (!map.has(m.id)) map.set(m.id, m);
                }
                return Array.from(map.values()).sort(
                  (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
                );
              };
              return {
                ...prev,
                messages: isFirebaseAdmin ? prev.messages : mergeLists(prev.messages),
                allMessages: isFirebaseAdmin ? mergeLists(prev.allMessages) : prev.allMessages,
              };
            });
          }
        },
        (error) => {
          handleFirestoreError(error, OperationType.LIST, msgPath);
        }
      )
    );

    if (isFirebaseAdmin) {
      const disPath = 'disabledChats';
      unsubs.push(
        onSnapshot(
          collection(db, disPath),
          (snap) => {
            const disabledUids = snap.docs
              .map((d) => d.data() as { uid?: string; disabled?: boolean })
              .filter((d) => d.disabled && d.uid)
              .map((d) => d.uid!);
            hydrateServerSupportState({ disabledChatUids: disabledUids });
          },
          (error) => {
            handleFirestoreError(error, OperationType.LIST, disPath);
          }
        )
      );
    }

    return () => {
      for (const u of unsubs) u();
    };
  }, [firebaseUser]);

  const syncUserToFirestore = useCallback(
    async (user: UserRecord) => {
      if (!firebaseUser || !firebaseUser.emailVerified) return;
      const path = `users/${firebaseUser.uid}`;
      try {
        await setDoc(
          doc(db, 'users', firebaseUser.uid),
          {
            uid: firebaseUser.uid,
            name: user.name,
            contact: user.contact,
            inviteCode: user.inviteCode,
            balance: user.balance,
            totalEarned: user.totalEarned,
            rank: user.rank,
            status: user.status,
            online: user.online,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
          },
          { merge: true }
        );
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, path);
      }
    },
    [firebaseUser]
  );

  const syncSupportRegToFirestore = useCallback(
    async (reg: SupportRegistrationRecord) => {
      if (!firebaseUser || !firebaseUser.emailVerified) return;
      const regDocId = (reg.receiptId || reg.uid).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
      const path = `supportRegistrations/${regDocId}`;
      try {
        await setDoc(doc(db, 'supportRegistrations', regDocId), {
          uid: reg.uid.slice(0, 128),
          receiptId: regDocId,
          firstName: reg.firstName.slice(0, 40),
          lastName: reg.lastName.slice(0, 40),
          mobileNumber: reg.mobileNumber.slice(0, 11),
          bio: (reg.bio || '').slice(0, 600),
          status: reg.status,
          ...(reg.rejectionReason ? { rejectionReason: reg.rejectionReason.slice(0, 300) } : {}),
          submittedAt: reg.submittedAt.slice(0, 40),
          ...(reg.reviewedAt ? { reviewedAt: reg.reviewedAt.slice(0, 40) } : {}),
          chatUnlocked: Boolean(reg.chatUnlocked),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, path);
      }
    },
    [firebaseUser]
  );

  useEffect(() => {
    let closed = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      if (closed) return;
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${proto}//${window.location.host}/ws`);
      wsRef.current = ws;

      ws.onopen = () => {
        setWsConnected(true);
        ws.send(
          JSON.stringify({
            type: 'identify',
            uid: uid ?? undefined,
            adminToken: adminToken ?? undefined,
          })
        );
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string) as
            | { type: 'sync'; payload: SyncStatePayload }
            | WebRTCSignalMessage;
          if (msg.type === 'sync' && 'payload' in msg && msg.payload) {
            applyPayload(msg.payload);
          } else if (
            msg.type === 'webrtc:offer' ||
            msg.type === 'webrtc:answer' ||
            msg.type === 'webrtc:ice'
          ) {
            onSignalRef.current?.(msg as WebRTCSignalMessage);
          }
        } catch {
          // Ignore malformed message
        }
      };

      ws.onclose = () => {
        setWsConnected(false);
        if (!closed) {
          reconnectTimer = setTimeout(connect, 1800);
        }
      };
    };

    fetchSnapshot(uid, adminToken);
    connect();

    return () => {
      closed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      wsRef.current?.close();
    };
  }, [uid, adminToken, fetchSnapshot, applyPayload]);

  const sendSignal = useCallback((signal: WebRTCSignalMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(signal));
    }
  }, []);

  const postJson = useCallback(
    async <T,>(url: string, body: unknown, requireAdmin = false): Promise<T> => {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (requireAdmin && adminToken) {
        headers['x-admin-token'] = adminToken;
      }
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });
      const rawText = await res.text();
      let json: (T & { error?: string }) | null = null;
      if (rawText) {
        try {
          json = JSON.parse(rawText) as T & { error?: string };
        } catch {
          json = null;
        }
      }
      if (!res.ok) {
        throw new Error(json?.error || `Request failed (${res.status})`);
      }
      if (!json) {
        throw new Error('Unexpected server response.');
      }
      return json;
    },
    [adminToken]
  );

  const register = useCallback(
    async (name: string, contact: string, password: string, inviteCode?: string) => {
      const res = await postJson<{ user: UserRecord; payload: SyncStatePayload }>(
        '/api/auth/register',
        { name, contact, password, inviteCode }
      );
      window.localStorage.setItem(UID_STORAGE_KEY, res.user.uid);
      setUid(res.user.uid);
      applyPayload(res.payload);
      if (firebaseUser) await syncUserToFirestore(res.user);
      return res.user;
    },
    [postJson, firebaseUser, syncUserToFirestore, applyPayload]
  );

  const login = useCallback(
    async (contact: string, password: string): Promise<{ isAdmin: boolean; user?: UserRecord }> => {
      const cleanContact = contact.trim().replace(/[\s-]/g, '');
      const cleanPass = password.trim();

      try {
        const res = await postJson<{
          isAdmin?: boolean;
          adminRole?: 'ADMIN-1' | 'ADMIN-2' | 'ADMIN-3';
          token?: string;
          user?: UserRecord;
          payload: SyncStatePayload;
        }>('/api/auth/login', { contact: cleanContact, password: cleanPass });

        if (res.isAdmin && res.token) {
          window.localStorage.removeItem(UID_STORAGE_KEY);
          window.localStorage.setItem(ADMIN_TOKEN_KEY, res.token);
          setActiveAdminId(res.adminRole || 'ADMIN-1');
          setUid(null);
          setAdminToken(res.token);
          applyPayload(res.payload);
          return { isAdmin: true };
        }

        if (res.user) {
          window.localStorage.removeItem(ADMIN_TOKEN_KEY);
          window.localStorage.setItem(UID_STORAGE_KEY, res.user.uid);
          setAdminToken(null);
          setUid(res.user.uid);
          applyPayload(res.payload);
          return { isAdmin: false, user: res.user };
        }
      } catch (err) {
        // Static-host fallback: if backend /api/* is unavailable (e.g. CDN SPA redirect) and Master Admin logs in
        if (cleanContact === MASTER_ADMIN_MOBILE && cleanPass === MASTER_ADMIN_PASS) {
          window.localStorage.removeItem(UID_STORAGE_KEY);
          window.localStorage.setItem(ADMIN_TOKEN_KEY, MASTER_ADMIN_TOKEN);
          setActiveAdminId('ADMIN-1');
          setUid(null);
          setAdminToken(MASTER_ADMIN_TOKEN);
          return { isAdmin: true };
        }
        throw err;
      }

      throw new Error('Authentication failed.');
    },
    [postJson, applyPayload]
  );

  const logout = useCallback(() => {
    window.localStorage.removeItem(UID_STORAGE_KEY);
    setUid(null);
    setData((prev) => ({
      ...EMPTY_PAYLOAD,
      snapshot: prev.snapshot,
      allUsers: prev.allUsers,
      allTasks: prev.allTasks,
      allWithdrawals: prev.allWithdrawals,
      allMessages: prev.allMessages,
      allCalls: prev.allCalls,
      allFeed: prev.allFeed,
    }));
  }, []);

  const updateProfile = useCallback(
    async (name: string, currentPassword?: string, newPassword?: string) => {
      if (!uid) throw new Error('Not signed in');
      return postJson<{ user: UserRecord }>('/api/profile/update', {
        uid,
        name,
        currentPassword,
        newPassword,
      });
    },
    [uid, postJson]
  );

  const submitTasks = useCallback(
    async (passcode: string, emails: string[]) => {
      if (!uid) throw new Error('Not signed in');
      return postJson<{ addedCount: number; skippedDup: number; skippedInvalid: number }>(
        '/api/tasks/submit',
        { uid, passcode, emails }
      );
    },
    [uid, postJson]
  );

  const requestWithdrawal = useCallback(
    async (
      method: PaymentMethod,
      accountHolder: string,
      accountNumber: string,
      amount: number,
      cnic?: string
    ) => {
      if (!uid) throw new Error('Not signed in');
      return postJson('/api/withdrawals/request', {
        uid,
        method,
        accountHolder,
        accountNumber,
        cnic,
        amount,
      });
    },
    [uid, postJson]
  );

  const sendChatMessage = useCallback(
    async (
      roomUid: string,
      senderRole: 'user' | 'admin',
      kind: 'text' | 'image' | 'voice',
      text?: string,
      mediaDataUrl?: string,
      durationSec?: number
    ) => {
      const senderUid = senderRole === 'admin' ? 'ADMIN' : uid || roomUid;
      const senderName =
        senderRole === 'admin' ? 'TaskPay VIP Support' : data.user?.name || 'Member';
      const result = await postJson<{ message?: ChatMessage }>(
        '/api/chat/send',
        {
          roomUid,
          senderRole,
          senderUid,
          senderName,
          kind,
          text,
          mediaDataUrl,
          durationSec,
        },
        senderRole === 'admin'
      );
      if (firebaseUser?.emailVerified && result?.message) {
        const msg = result.message;
        const msgPath = `messages/${msg.id}`;
        try {
          await setDoc(doc(db, 'messages', msg.id), {
            id: msg.id,
            roomUid: msg.roomUid,
            senderRole: msg.senderRole,
            senderUid: msg.senderUid,
            senderName: msg.senderName.slice(0, 40),
            kind: msg.kind,
            ...(msg.text ? { text: msg.text.slice(0, 2000) } : {}),
            ...(msg.mediaDataUrl && msg.mediaDataUrl.length <= 600000
              ? { mediaDataUrl: msg.mediaDataUrl }
              : {}),
            tickState: msg.tickState,
            createdAt: msg.createdAt,
          });
        } catch (error) {
          handleFirestoreError(error, OperationType.CREATE, msgPath);
        }
      }
      return result;
    },
    [uid, data.user?.name, postJson, firebaseUser]
  );

  const markChatRead = useCallback(
    async (roomUid: string, readerRole: 'user' | 'admin') => {
      await postJson('/api/chat/read', { roomUid, readerRole });
    },
    [postJson]
  );

  const updateCallStatus = useCallback(
    async (callId: string, status: 'accepted' | 'ended') => {
      await postJson('/api/calls/update', { callId, status });
    },
    [postJson]
  );

  const adminLogin = useCallback(
    async (username: string, password: string) => {
      const res = await postJson<{ token: string; payload: SyncStatePayload }>(
        '/api/admin/login',
        { username, password }
      );
      window.localStorage.setItem(ADMIN_TOKEN_KEY, res.token);
      setAdminToken(res.token);
      setData((prev) => ({ ...prev, ...res.payload }));
    },
    [postJson]
  );

  const adminLogout = useCallback(() => {
    window.localStorage.removeItem(ADMIN_TOKEN_KEY);
    setAdminToken(null);
  }, []);

  const adminSetRate = useCallback(
    async (rate: number) => {
      await postJson('/api/admin/rate', { rate }, true);
    },
    [postJson]
  );

  const adminReviewTask = useCallback(
    async (taskId: string, decision: 'approved' | 'rejected') => {
      await postJson('/api/admin/tasks/review', { taskId, decision }, true);
    },
    [postJson]
  );

  const adminBulkReviewTasks = useCallback(
    async (targetUid: string, decision: 'approved' | 'rejected') => {
      return postJson<{ count: number; totalCredit: number }>(
        '/api/admin/tasks/review-bulk',
        { uid: targetUid, decision },
        true
      );
    },
    [postJson]
  );

  const adminReviewWithdrawal = useCallback(
    async (withdrawalId: string, decision: 'approved' | 'rejected') => {
      await postJson('/api/admin/withdrawals/review', { withdrawalId, decision }, true);
    },
    [postJson]
  );

  const adminAdjustBalance = useCallback(
    async (targetUid: string, mode: 'add' | 'set', amount: number, note?: string) => {
      await postJson('/api/admin/users/balance', { uid: targetUid, mode, amount, note }, true);
    },
    [postJson]
  );

  const adminMemberAction = useCallback(
    async (targetUid: string, action: 'enable' | 'disable' | 'delete') => {
      await postJson('/api/admin/users/action', { uid: targetUid, action }, true);
    },
    [postJson]
  );

  const submitSupportRegistration = useCallback(
    async (params: {
      uid?: string;
      receiptId?: string;
      firstName: string;
      lastName: string;
      mobileNumber: string;
      bio: string;
      avatarDataUrl?: string;
      submittedAt?: string;
      status?: 'pending' | 'approved' | 'rejected';
      reviewedAt?: string;
      rejectionReason?: string;
      syncIfMissing?: boolean;
    }) => {
      const targetUid = params.uid || uid;
      if (!targetUid) return null;
      try {
        const res = await postJson<{ registration: SupportRegistrationRecord }>(
          '/api/support/register',
          { ...params, uid: targetUid }
        );
        if (res?.registration && firebaseUser?.emailVerified) {
          await syncSupportRegToFirestore(res.registration);
        }
        return res;
      } catch {
        return null;
      }
    },
    [uid, postJson, firebaseUser, syncSupportRegToFirestore]
  );

  const adminReviewSupportRegistration = useCallback(
    async (
      targetUid: string,
      decision: 'approved' | 'rejected',
      rejectionReason?: string,
      receiptId?: string,
      snapshot?: Partial<WaSupportRegistration>
    ) => {
      try {
        const res = await postJson<{ registration?: SupportRegistrationRecord }>(
          '/api/admin/support/review',
          {
            uid: targetUid,
            receiptId,
            decision,
            rejectionReason,
            snapshot,
          },
          true
        );
        if (res?.registration && firebaseUser?.emailVerified) {
          const reg = res.registration;
          const regDocId = (reg.receiptId || reg.uid).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
          const regPath = `supportRegistrations/${regDocId}`;
          try {
            await updateDoc(doc(db, 'supportRegistrations', regDocId), {
              status: reg.status,
              ...(reg.rejectionReason ? { rejectionReason: reg.rejectionReason.slice(0, 300) } : {}),
              reviewedAt: reg.reviewedAt || new Date().toISOString(),
              chatUnlocked: reg.chatUnlocked,
            });
          } catch {
            try {
              await syncSupportRegToFirestore(reg);
            } catch (error) {
              handleFirestoreError(error, OperationType.UPDATE, regPath);
            }
          }
        }
      } catch {
        // Local store already updated if static/offline
      }
    },
    [postJson, firebaseUser, syncSupportRegToFirestore]
  );

  const adminToggleDisableChat = useCallback(
    async (targetUid: string) => {
      try {
        const res = await postJson<{ disabledChatUids?: string[] }>(
          '/api/admin/support/toggle-disable',
          { uid: targetUid },
          true
        );
        if (firebaseUser?.emailVerified && res?.disabledChatUids) {
          const isDisabledNow = res.disabledChatUids.includes(targetUid);
          const disPath = `disabledChats/${targetUid}`;
          try {
            await setDoc(doc(db, 'disabledChats', targetUid), {
              uid: targetUid,
              disabled: isDisabledNow,
              updatedAt: new Date().toISOString(),
            });
          } catch (error) {
            handleFirestoreError(error, OperationType.WRITE, disPath);
          }
        }
      } catch {
        // Local store already updated if static/offline
      }
    },
    [postJson, firebaseUser]
  );

  const adminStartCall = useCallback(
    async (targetUid: string, callType: 'audio' | 'video') => {
      return postJson<{ call: NonNullable<SyncStatePayload['activeCall']> }>(
        '/api/admin/calls/start',
        { targetUid, callType },
        true
      );
    },
    [postJson]
  );

  const syncGoogleCloud = useCallback(async () => {
    const gUser = await signInWithGoogleCloud();
    setFirebaseUser(gUser);
    if (data.user) {
      await syncUserToFirestore(data.user);
    }
    return gUser;
  }, [data.user, syncUserToFirestore]);

  return {
    uid,
    isAdmin: !!adminToken,
    wsConnected,
    firebaseUser,
    data,
    sendSignal,
    register,
    login,
    logout,
    updateProfile,
    submitTasks,
    requestWithdrawal,
    sendChatMessage,
    markChatRead,
    updateCallStatus,
    submitSupportRegistration,
    adminLogin,
    adminLogout,
    adminSetRate,
    adminReviewTask,
    adminBulkReviewTasks,
    adminReviewWithdrawal,
    adminAdjustBalance,
    adminMemberAction,
    adminReviewSupportRegistration,
    adminToggleDisableChat,
    adminStartCall,
    syncGoogleCloud,
  };
}
