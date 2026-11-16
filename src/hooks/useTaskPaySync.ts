import { useCallback, useEffect, useRef, useState } from 'react';
import { onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import {
  auth,
  db,
  handleFirestoreError,
  OperationType,
  signInWithGoogleCloud,
  testConnection,
} from '../firebase';
import type {
  PaymentMethod,
  SyncStatePayload,
  UserRecord,
  WebRTCSignalMessage,
} from '../types/taskpay';

const UID_STORAGE_KEY = 'taskpay_uid_v1';
const ADMIN_TOKEN_KEY = 'taskpay_admin_token_v1';

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

  const fetchSnapshot = useCallback(async (targetUid: string | null, token: string | null) => {
    try {
      const qs = targetUid ? `?uid=${encodeURIComponent(targetUid)}` : '';
      const res = await fetch(`/api/state${qs}`, {
        headers: token ? { 'x-admin-token': token } : {},
      });
      if (res.ok) {
        const json = (await res.json()) as SyncStatePayload;
        setData(json);
      }
    } catch {
      // Handled by WebSocket retry
    }
  }, []);

  useEffect(() => {
    testConnection();
    const unsub = onAuthStateChanged(auth, (u) => {
      setFirebaseUser(u);
    });
    return () => unsub();
  }, []);

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
            setData(msg.payload);
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
  }, [uid, adminToken, fetchSnapshot]);

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
      setData(res.payload);
      if (firebaseUser) await syncUserToFirestore(res.user);
      return res.user;
    },
    [postJson, firebaseUser, syncUserToFirestore]
  );

  const login = useCallback(
    async (contact: string, password: string): Promise<{ isAdmin: boolean; user?: UserRecord }> => {
      const res = await postJson<{
        isAdmin?: boolean;
        token?: string;
        user?: UserRecord;
        payload: SyncStatePayload;
      }>('/api/auth/login', { contact, password });

      if (res.isAdmin && res.token) {
        window.localStorage.removeItem(UID_STORAGE_KEY);
        window.localStorage.setItem(ADMIN_TOKEN_KEY, res.token);
        setUid(null);
        setAdminToken(res.token);
        setData(res.payload);
        return { isAdmin: true };
      }

      if (res.user) {
        window.localStorage.removeItem(ADMIN_TOKEN_KEY);
        window.localStorage.setItem(UID_STORAGE_KEY, res.user.uid);
        setAdminToken(null);
        setUid(res.user.uid);
        setData(res.payload);
        return { isAdmin: false, user: res.user };
      }

      throw new Error('Authentication failed.');
    },
    [postJson]
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
      return postJson(
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
    },
    [uid, data.user?.name, postJson]
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
    adminLogin,
    adminLogout,
    adminSetRate,
    adminReviewTask,
    adminBulkReviewTasks,
    adminReviewWithdrawal,
    adminAdjustBalance,
    adminMemberAction,
    adminStartCall,
    syncGoogleCloud,
  };
}
