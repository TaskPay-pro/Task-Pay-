import express from 'express';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import type {
  ActiveCallSession,
  ChatMessage,
  EarningFeedItem,
  NetworkGrowthPoint,
  PaymentMethod,
  TaskRecord,
  UserRecord,
  VIPRank,
  WithdrawalRecord,
} from './src/types/taskpay.ts';

const PORT = 3000;
const DATA_DIR = path.resolve(process.cwd(), '.data');
const DB_FILE = path.join(DATA_DIR, 'taskpay-db.json');

const ADMIN_PASS = 'admin@786';
const ADMIN_ROLE_BY_MOBILE: Record<string, 'ADMIN-1' | 'ADMIN-2' | 'ADMIN-3'> = {
  '03265410214': 'ADMIN-1',
  '03000000001': 'ADMIN-1',
  '03000000002': 'ADMIN-2',
  '03000000003': 'ADMIN-3',
};
const ADMIN_TOKEN = 'taskpay-admin-vip-token-2026';
const TASK_PASSCODE = 'aass1122';

interface DatabaseSchema {
  taskRewardRate: number;
  users: (UserRecord & { password: string })[];
  tasks: TaskRecord[];
  withdrawals: WithdrawalRecord[];
  feed: EarningFeedItem[];
  messages: ChatMessage[];
  calls: ActiveCallSession[];
}

function computeRank(totalEarned: number): VIPRank {
  if (totalEarned >= 5000) return 'Diamond VIP';
  if (totalEarned >= 2000) return 'Emerald VIP';
  if (totalEarned >= 600) return 'Gold VIP';
  if (totalEarned >= 150) return 'Silver VIP';
  return 'Bronze VIP';
}

function createInitialDb(): DatabaseSchema {
  const now = Date.now();
  return {
    taskRewardRate: 40,
    users: [
      {
        uid: 'TP-1001',
        name: 'Hamza Tariq',
        contact: '03018451290',
        password: 'vip12345',
        inviteCode: 'TP1001',
        balance: 420,
        totalEarned: 820,
        referralProfit: 30,
        referralCount: 3,
        rank: 'Gold VIP',
        status: 'active',
        online: true,
        createdAt: new Date(now - 6 * 86400_000).toISOString(),
        updatedAt: new Date(now - 3600_000).toISOString(),
      },
      {
        uid: 'TP-1002',
        name: 'Ayesha Siddiqui',
        contact: '03128451290',
        password: 'vip12345',
        inviteCode: 'TP1002',
        invitedBy: 'TP1001',
        balance: 210,
        totalEarned: 210,
        referralProfit: 10,
        referralCount: 1,
        rank: 'Silver VIP',
        status: 'active',
        online: true,
        createdAt: new Date(now - 3 * 86400_000).toISOString(),
        updatedAt: new Date(now - 1800_000).toISOString(),
      },
      {
        uid: 'TP-1003',
        name: 'Bilal Mahmood',
        contact: '03219876543',
        password: 'vip12345',
        inviteCode: 'TP1003',
        invitedBy: 'TP1001',
        balance: 60,
        totalEarned: 60,
        referralProfit: 0,
        referralCount: 0,
        rank: 'Bronze VIP',
        status: 'active',
        online: false,
        createdAt: new Date(now - 86400_000).toISOString(),
        updatedAt: new Date(now - 7200_000).toISOString(),
      },
    ],
    tasks: [
      {
        id: 'tsk-seed-1',
        uid: 'TP-1001',
        userName: 'Hamza Tariq',
        email: 'usman.dev88@gmail.com',
        rewardRate: 40,
        status: 'approved',
        createdAt: new Date(now - 2 * 86400_000).toISOString(),
        updatedAt: new Date(now - 86400_000).toISOString(),
      },
      {
        id: 'tsk-seed-2',
        uid: 'TP-1002',
        userName: 'Ayesha Siddiqui',
        email: 'sara.lahore99@gmail.com',
        rewardRate: 40,
        status: 'pending',
        createdAt: new Date(now - 3600_000 * 2).toISOString(),
        updatedAt: new Date(now - 3600_000 * 2).toISOString(),
      },
    ],
    withdrawals: [
      {
        id: 'wd-seed-1',
        uid: 'TP-1001',
        userName: 'Hamza Tariq',
        method: 'JazzCash',
        accountHolder: 'Hamza Tariq',
        accountNumber: '03018451290',
        amount: 400,
        status: 'approved',
        createdAt: new Date(now - 86400_000).toISOString(),
        updatedAt: new Date(now - 43200_000).toISOString(),
      },
    ],
    feed: [
      {
        id: 'fd-seed-1',
        uid: 'TP-1001',
        userName: 'Hamza Tariq',
        kind: 'withdrawal',
        label: 'JazzCash payout approved',
        amount: 400,
        createdAt: new Date(now - 43200_000).toISOString(),
      },
      {
        id: 'fd-seed-2',
        uid: 'TP-1001',
        userName: 'Hamza Tariq',
        kind: 'task',
        label: 'Approved email task reward',
        amount: 40,
        createdAt: new Date(now - 86400_000).toISOString(),
      },
      {
        id: 'fd-seed-3',
        uid: 'TP-1002',
        userName: 'Ayesha Siddiqui',
        kind: 'signup_bonus',
        label: 'VIP Welcome Bonus',
        amount: 20,
        createdAt: new Date(now - 3 * 86400_000).toISOString(),
      },
    ],
    messages: [
      {
        id: 'msg-seed-1',
        roomUid: 'TP-1001',
        senderRole: 'admin',
        senderUid: 'ADMIN',
        senderName: 'TaskPay VIP Support',
        kind: 'text',
        text: 'Welcome to TaskPay VIP Support. Send text, screenshots, or voice notes anytime.',
        tickState: 3,
        createdAt: new Date(now - 7200_000).toISOString(),
      },
    ],
    calls: [],
  };
}

function loadDb(): DatabaseSchema {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_FILE)) {
    const initial = createInitialDb();
    fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2));
    return initial;
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8')) as DatabaseSchema;
    let migrated = false;
    for (const u of parsed.users || []) {
      if (u.uid === 'TP-1002' && u.contact.includes('@')) {
        u.contact = '03128451290';
        migrated = true;
      }
    }
    if (migrated) {
      fs.writeFileSync(DB_FILE, JSON.stringify(parsed, null, 2));
    }
    return parsed;
  } catch {
    const initial = createInitialDb();
    fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2));
    return initial;
  }
}

let db = loadDb();

function saveDb() {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

function sanitizeUser(u: UserRecord & { password?: string }): UserRecord {
  const { password: _p, ...rest } = u;
  return rest;
}

const VALID_CONTACT_RE = /^03\d{9}$/;
const VALID_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;
const VALID_INVITE_RE = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z0-9]{4,16}$/;

function normalizeContact(raw: string): string {
  return raw.trim().replace(/\s|-/g, '').toLowerCase();
}

function maskMobile(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 5) return '03******000';
  const prefix = digits.startsWith('03') ? '03' : digits.slice(0, 2);
  const suffix = digits.slice(-3);
  const stars = '*'.repeat(Math.max(4, digits.length - 5));
  return `${prefix}${stars}${suffix}`;
}

interface ClientMeta {
  ws: WebSocket;
  uid?: string;
  isAdmin?: boolean;
}

const clients = new Set<ClientMeta>();

function buildGrowthSeries(totalUsers: number, approvedTasks: number, onlineCount: number): NetworkGrowthPoint[] {
  const days = ['D-5', 'D-4', 'D-3', 'D-2', 'Yday', 'Live'];
  const baseUsers = Math.max(1, totalUsers);
  const baseTasks = Math.max(1, approvedTasks);
  return days.map((label, idx) => {
    const factor = (idx + 1) / days.length;
    return {
      label,
      users: Math.max(1, Math.round(baseUsers * (0.35 + 0.65 * factor))),
      tasks: Math.max(0, Math.round(baseTasks * (0.2 + 0.8 * factor))),
      online: idx === days.length - 1 ? onlineCount : Math.max(1, Math.round(onlineCount * (0.5 + 0.4 * factor))),
    };
  });
}

function buildPayload(uid?: string, isAdmin = false) {
  const onlineSockets = new Set(
    Array.from(clients)
      .map((c) => c.uid)
      .filter(Boolean)
  );
  const onlineCount = Math.min(
    db.users.length,
    Math.max(
      db.users.filter((u) => u.online || onlineSockets.has(u.uid)).length,
      onlineSockets.size
    )
  );
  const totalUsers = db.users.length;
  const offlineCount = Math.max(0, totalUsers - onlineCount);
  const approvedTasks = db.tasks.filter((t) => t.status === 'approved').length;
  const growthPercent = Math.min(99, Math.max(24, 30 + totalUsers * 6 + approvedTasks * 4));

  const user = uid ? db.users.find((u) => u.uid === uid) : undefined;
  const activeCall = uid
    ? db.calls.find((c) => c.targetUid === uid && c.status !== 'ended') ?? null
    : null;

  return {
    snapshot: {
      taskRewardRate: db.taskRewardRate,
      totalUsers,
      onlineCount,
      offlineCount,
      growthPercent,
      growthSeries: buildGrowthSeries(totalUsers, approvedTasks, onlineCount),
      liveFeed: db.feed.slice(0, 25),
    },
    publicDirectory: db.users.map((u) => ({
      uid: u.uid,
      name: u.name,
      maskedMobile: maskMobile(u.contact),
      status: u.status,
      rank: u.rank,
    })),
    user: user ? sanitizeUser(user) : null,
    tasks: uid ? db.tasks.filter((t) => t.uid === uid) : [],
    withdrawals: uid ? db.withdrawals.filter((w) => w.uid === uid) : [],
    referrals: user
      ? db.users
          .filter((u) => u.invitedBy?.toUpperCase() === user.inviteCode.toUpperCase())
          .map((u) => ({
            uid: u.uid,
            name: u.name,
            createdAt: u.createdAt,
            totalEarned: u.totalEarned,
            milestoneBonusPaid: !!u.milestoneBonusPaid,
          }))
      : [],
    userHistory: uid ? db.feed.filter((f) => f.uid === uid) : [],
    messages: uid ? db.messages.filter((m) => m.roomUid === uid) : [],
    activeCall,
    ...(isAdmin
      ? {
          allUsers: db.users.map((u) => ({
            ...sanitizeUser(u),
            online: Boolean(u.online || onlineSockets.has(u.uid)),
          })),
          allTasks: db.tasks,
          allWithdrawals: db.withdrawals,
          allMessages: db.messages,
          allCalls: db.calls.filter((c) => c.status !== 'ended'),
          allFeed: db.feed.slice(0, 100),
        }
      : {}),
  };
}

function broadcastAll() {
  saveDb();
  for (const client of clients) {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(
        JSON.stringify({
          type: 'sync',
          payload: buildPayload(client.uid, !!client.isAdmin),
        })
      );
    }
  }
}

function sendToTargets(targetUid: string, fromRole: 'user' | 'admin', payload: unknown) {
  const encoded = JSON.stringify(payload);
  for (const client of clients) {
    if (client.ws.readyState !== WebSocket.OPEN) continue;
    if (fromRole === 'admin' && client.uid === targetUid) {
      client.ws.send(encoded);
    } else if (fromRole === 'user' && client.isAdmin) {
      client.ws.send(encoded);
    }
  }
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '6mb' }));

  const server = http.createServer(app);
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req, socket, head) => {
    const pathname = new URL(req.url || '/', 'http://localhost').pathname;
    if (pathname === '/ws') {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws, req);
      });
    }
  });

  wss.on('connection', (ws) => {
    const meta: ClientMeta = { ws };
    clients.add(meta);

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as {
          type: string;
          uid?: string;
          adminToken?: string;
          callId?: string;
          targetUid?: string;
          fromRole?: 'user' | 'admin';
          sdp?: RTCSessionDescriptionInit;
          candidate?: RTCIceCandidateInit;
        };
        if (msg.type === 'identify') {
          meta.uid = msg.uid;
          meta.isAdmin = msg.adminToken === ADMIN_TOKEN;
          if (meta.uid) {
            const u = db.users.find((x) => x.uid === meta.uid);
            if (u) u.online = true;
          }
          for (const m of db.messages) {
            if (m.tickState === 1) {
              if (meta.isAdmin && m.senderRole === 'user') m.tickState = 2;
              if (meta.uid && m.roomUid === meta.uid && m.senderRole === 'admin') m.tickState = 2;
            }
          }
          ws.send(
            JSON.stringify({
              type: 'sync',
              payload: buildPayload(meta.uid, !!meta.isAdmin),
            })
          );
          broadcastAll();
        } else if (
          (msg.type === 'webrtc:offer' ||
            msg.type === 'webrtc:answer' ||
            msg.type === 'webrtc:ice') &&
          msg.targetUid &&
          msg.fromRole
        ) {
          sendToTargets(msg.targetUid, msg.fromRole, msg);
        }
      } catch {
        // Ignore malformed socket frames
      }
    });

    ws.on('close', () => {
      const uid = meta.uid;
      clients.delete(meta);
      if (uid && !Array.from(clients).some((c) => c.uid === uid)) {
        const u = db.users.find((x) => x.uid === uid);
        if (u) u.online = false;
      }
      broadcastAll();
    });
  });

  // Public snapshot endpoint
  app.get('/api/state', (req, res) => {
    const uid = typeof req.query.uid === 'string' ? req.query.uid : undefined;
    const isAdmin = req.headers['x-admin-token'] === ADMIN_TOKEN;
    res.json(buildPayload(uid, isAdmin));
  });

  // Auth: Register
  app.post('/api/auth/register', (req, res) => {
    const { name, contact, password, inviteCode } = req.body as {
      name?: string;
      contact?: string;
      password?: string;
      inviteCode?: string;
    };

    const cleanName = (name || '').trim();
    const cleanContact = normalizeContact(contact || '');
    const cleanPassword = (password || '').trim();
    const cleanInvite = (inviteCode || '').trim().toUpperCase();

    if (cleanName.length < 2 || cleanName.length > 40) {
      return res.status(400).json({ error: 'Name must be 2 to 40 characters.' });
    }
    if (!VALID_CONTACT_RE.test(cleanContact)) {
      return res
        .status(400)
        .json({ error: 'Enter a valid 11-digit Pakistani mobile number starting with 03 (e.g. 03001234567).' });
    }
    if (cleanPassword.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    }
    if (cleanInvite && !VALID_INVITE_RE.test(cleanInvite)) {
      return res.status(400).json({ error: 'Invite code must combine letters and numbers (e.g. TP1001).' });
    }
    if (ADMIN_ROLE_BY_MOBILE[cleanContact]) {
      return res.status(409).json({ error: 'This mobile number is reserved.' });
    }
    if (db.users.some((u) => normalizeContact(u.contact) === cleanContact)) {
      return res.status(409).json({ error: 'Duplicate account prevented: This mobile number is already registered.' });
    }

    const uid = `TP-${Math.floor(1000 + Math.random() * 8999)}-${Date.now().toString().slice(-3)}`;
    const randomLetters = String.fromCharCode(
      65 + Math.floor(Math.random() * 26),
      65 + Math.floor(Math.random() * 26)
    );
    const myInviteCode = `TP${randomLetters}${Math.floor(1000 + Math.random() * 8999)}`;
    const nowIso = new Date().toISOString();

    let inviter: (UserRecord & { password: string }) | undefined;
    if (cleanInvite) {
      inviter = db.users.find((u) => u.inviteCode.toUpperCase() === cleanInvite);
    }

    const newUser: UserRecord & { password: string } = {
      uid,
      name: cleanName,
      contact: cleanContact,
      password: cleanPassword,
      inviteCode: myInviteCode,
      invitedBy: inviter ? inviter.inviteCode : undefined,
      balance: 20,
      totalEarned: 20,
      referralProfit: 0,
      referralCount: 0,
      rank: 'Bronze VIP',
      status: 'active',
      online: true,
      milestoneBonusPaid: false,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    db.users.unshift(newUser);
    db.feed.unshift({
      id: `fd-${Date.now()}`,
      uid,
      userName: cleanName,
      kind: 'signup_bonus',
      label: 'VIP Welcome Bonus',
      amount: 20,
      createdAt: nowIso,
    });

    if (inviter) {
      inviter.referralCount += 1;
      inviter.updatedAt = nowIso;
    }

    db.messages.push({
      id: `msg-welcome-${Date.now()}`,
      roomUid: uid,
      senderRole: 'admin',
      senderUid: 'ADMIN',
      senderName: 'TaskPay VIP Support',
      kind: 'text',
      text: `Welcome ${cleanName}! Your PKR 20 signup bonus has been credited. Use passcode aass1122 for manual tasks.`,
      tickState: 2,
      createdAt: nowIso,
    });

    broadcastAll();
    res.json({ user: sanitizeUser(newUser), payload: buildPayload(uid, false) });
  });

  // Auth: Unified Smart Login (Handles both Member login and Hidden Admin login)
  app.post('/api/auth/login', (req, res) => {
    const { contact, password } = req.body as { contact?: string; password?: string };
    const cleanContact = normalizeContact(contact || '');
    const cleanPassword = (password || '').trim();

    if (!VALID_CONTACT_RE.test(cleanContact)) {
      return res
        .status(400)
        .json({ error: 'Enter a valid 11-digit Pakistani mobile number starting with 03.' });
    }

    const matchedAdminRole = ADMIN_ROLE_BY_MOBILE[cleanContact];
    if (matchedAdminRole && cleanPassword === ADMIN_PASS) {
      return res.json({
        isAdmin: true,
        adminRole: matchedAdminRole,
        token: ADMIN_TOKEN,
        payload: buildPayload(undefined, true),
      });
    }

    const found = db.users.find(
      (u) => normalizeContact(u.contact) === cleanContact && u.password === cleanPassword
    );
    if (!found) {
      return res.status(401).json({ error: 'Invalid mobile number or password.' });
    }
    found.online = true;
    found.updatedAt = new Date().toISOString();
    broadcastAll();
    res.json({ isAdmin: false, user: sanitizeUser(found), payload: buildPayload(found.uid, false) });
  });

  // Profile Update (Explicit Save Changes only; old password verification required for password change)
  app.post('/api/profile/update', (req, res) => {
    const { uid, name, currentPassword, newPassword } = req.body as {
      uid?: string;
      name?: string;
      currentPassword?: string;
      newPassword?: string;
    };
    const user = db.users.find((u) => u.uid === uid);
    if (!user) return res.status(404).json({ error: 'Account not found.' });

    if (name !== undefined) {
      const cleanName = name.trim();
      if (cleanName.length < 2 || cleanName.length > 40) {
        return res.status(400).json({ error: 'Name must be 2 to 40 characters.' });
      }
      user.name = cleanName;
    }

    if (newPassword) {
      if (currentPassword !== user.password) {
        return res.status(400).json({ error: 'Old password verification failed.' });
      }
      if (newPassword.length < 8) {
        return res.status(400).json({ error: 'New password must be at least 8 characters.' });
      }
      user.password = newPassword;
    }

    user.updatedAt = new Date().toISOString();
    broadcastAll();
    res.json({ user: sanitizeUser(user) });
  });

  // Submit Manual Email Tasks (one by one or list)
  app.post('/api/tasks/submit', (req, res) => {
    const { uid, passcode, emails } = req.body as {
      uid?: string;
      passcode?: string;
      emails?: string[];
    };
    const user = db.users.find((u) => u.uid === uid);
    if (!user) return res.status(404).json({ error: 'Account not found.' });
    if ((passcode || '').trim() !== TASK_PASSCODE) {
      return res.status(400).json({ error: 'Invalid passcode. Strict passcode is aass1122.' });
    }

    const list = Array.isArray(emails) ? emails : [];
    const existingSet = new Set(db.tasks.map((t) => t.email.toLowerCase()));
    const added: TaskRecord[] = [];
    let skippedDup = 0;
    let skippedInvalid = 0;
    const now = Date.now();

    for (const raw of list) {
      if (typeof raw !== 'string') continue;
      const email = raw.replace(/^[<("'`]+|[>)"'`]+$/g, '').trim().toLowerCase();
      if (!email) continue;
      if (!VALID_EMAIL_RE.test(email)) {
        skippedInvalid++;
        continue;
      }
      if (existingSet.has(email)) {
        skippedDup++;
        continue;
      }
      existingSet.add(email);
      added.push({
        id: `tsk-${now}-${added.length}-${Math.floor(Math.random() * 10000)}`,
        uid: user.uid,
        userName: user.name,
        email,
        rewardRate: db.taskRewardRate,
        status: 'pending',
        createdAt: new Date(now + added.length).toISOString(),
        updatedAt: new Date(now + added.length).toISOString(),
      });
    }

    if (added.length === 0) {
      return res.status(400).json({
        error: skippedDup > 0 ? 'This email has already been submitted.' : 'Enter a valid email address.',
      });
    }

    db.tasks.unshift(...added);
    broadcastAll();
    res.json({ addedCount: added.length, skippedDup, skippedInvalid });
  });

  // Request Withdrawal (PKR 200 - 50,000, strictly blocks disabled users)
  app.post('/api/withdrawals/request', (req, res) => {
    const { uid, method, accountHolder, accountNumber, cnic, amount } = req.body as {
      uid?: string;
      method?: PaymentMethod;
      accountHolder?: string;
      accountNumber?: string;
      cnic?: string;
      amount?: number;
    };
    const user = db.users.find((u) => u.uid === uid);
    if (!user) return res.status(404).json({ error: 'Account not found.' });
    if (user.status === 'disabled') {
      return res.status(403).json({
        error: 'Account disabled by Admin: Withdrawals are strictly blocked. Contact VIP Support.',
      });
    }

    const num = Number(amount);
    if (!Number.isFinite(num) || num < 200 || num > 50000) {
      return res.status(400).json({ error: 'Withdrawal must be between PKR 200 and PKR 50,000.' });
    }
    if (num > user.balance) {
      return res.status(400).json({ error: 'Insufficient balance.' });
    }
    if (!accountHolder || accountHolder.trim().length < 2) {
      return res.status(400).json({ error: 'Enter valid account holder name.' });
    }
    if (!accountNumber || accountNumber.trim().length < 6) {
      return res.status(400).json({ error: 'Enter valid account mobile number.' });
    }

    const cleanCnic = cnic ? cnic.trim() : '';
    if (cleanCnic && !/^\d{5}-?\d{7}-?\d{1}$/.test(cleanCnic)) {
      return res.status(400).json({ error: 'Optional CNIC must be 13 digits (e.g. 35202-1234567-1).' });
    }

    const nowIso = new Date().toISOString();
    user.balance -= num;
    user.updatedAt = nowIso;

    const record: WithdrawalRecord = {
      id: `wd-${Date.now()}`,
      uid: user.uid,
      userName: user.name,
      method: method || 'JazzCash',
      accountHolder: accountHolder.trim(),
      accountNumber: accountNumber.trim(),
      ...(cleanCnic ? { cnic: cleanCnic } : {}),
      amount: num,
      status: 'pending',
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    db.withdrawals.unshift(record);
    broadcastAll();
    res.json({ withdrawal: record });
  });

  // Support Chat: Send Message (text, image, voice)
  app.post('/api/chat/send', (req, res) => {
    const { roomUid, senderRole, senderUid, senderName, kind, text, mediaDataUrl, durationSec } =
      req.body as {
        roomUid?: string;
        senderRole?: 'user' | 'admin';
        senderUid?: string;
        senderName?: string;
        kind?: 'text' | 'image' | 'voice';
        text?: string;
        mediaDataUrl?: string;
        durationSec?: number;
      };

    if (senderRole === 'admin' && req.headers['x-admin-token'] !== ADMIN_TOKEN) {
      return res.status(403).json({ error: 'Admin authorization required.' });
    }
    if (!roomUid || !senderUid) {
      return res.status(400).json({ error: 'Missing room or sender.' });
    }

    const targetOnline = Array.from(clients).some(
      (c) => (senderRole === 'user' ? c.isAdmin : c.uid === roomUid)
    );

    const msg: ChatMessage = {
      id: `msg-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      roomUid,
      senderRole: senderRole || 'user',
      senderUid,
      senderName: senderName || 'Member',
      kind: kind || 'text',
      text: text?.slice(0, 2000),
      mediaDataUrl,
      durationSec,
      tickState: targetOnline ? 2 : 1,
      createdAt: new Date().toISOString(),
    };
    db.messages.push(msg);
    broadcastAll();
    res.json({ message: msg });
  });

  // Support Chat: Mark Read (Tick State 3)
  app.post('/api/chat/read', (req, res) => {
    const { roomUid, readerRole } = req.body as { roomUid?: string; readerRole?: 'user' | 'admin' };
    let changed = false;
    for (const m of db.messages) {
      if (m.roomUid === roomUid && m.senderRole !== readerRole && m.tickState < 3) {
        m.tickState = 3;
        changed = true;
      }
    }
    if (changed) broadcastAll();
    res.json({ ok: true });
  });

  // Support Call: User or Admin accepts or ends call
  app.post('/api/calls/update', (req, res) => {
    const { callId, status } = req.body as { callId?: string; status?: 'accepted' | 'ended' };
    const call = db.calls.find((c) => c.id === callId);
    if (!call) return res.status(404).json({ error: 'Call session not found.' });
    call.status = status || 'ended';
    call.updatedAt = new Date().toISOString();
    broadcastAll();
    res.json({ call });
  });

  // Admin Login (Hidden endpoint kept compatible with mobile role numbers)
  app.post('/api/admin/login', (req, res) => {
    const { username, password } = req.body as { username?: string; password?: string };
    const cleanUser = normalizeContact(username || '');
    const role = ADMIN_ROLE_BY_MOBILE[cleanUser];
    if (role && (password || '').trim() === ADMIN_PASS) {
      return res.json({ token: ADMIN_TOKEN, adminRole: role, payload: buildPayload(undefined, true) });
    }
    return res.status(401).json({ error: 'Invalid credentials.' });
  });

  // Admin Middleware
  const requireAdmin: express.RequestHandler = (req, res, next) => {
    if (req.headers['x-admin-token'] !== ADMIN_TOKEN) {
      return res.status(403).json({ error: 'Unauthorized admin request.' });
    }
    next();
  };

  // Helper: Credit 30% lifetime referral commission + one-time PKR 30 milestone bonus at 5 approved tasks
  function creditInviterOnTaskApproval(
    user: UserRecord & { password: string },
    approvedAmount: number,
    nowIso: string
  ) {
    if (!user.invitedBy) return;
    const inviter = db.users.find(
      (u) => u.inviteCode.toUpperCase() === user.invitedBy!.toUpperCase()
    );
    if (!inviter || inviter.uid === user.uid) return;

    const commission = Math.round(approvedAmount * 0.3 * 100) / 100;
    if (commission > 0) {
      inviter.balance = Math.round((inviter.balance + commission) * 100) / 100;
      inviter.totalEarned = Math.round((inviter.totalEarned + commission) * 100) / 100;
      inviter.referralProfit = Math.round((inviter.referralProfit + commission) * 100) / 100;
      inviter.rank = computeRank(inviter.totalEarned);
      inviter.updatedAt = nowIso;
      db.feed.unshift({
        id: `fd-comm-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
        uid: inviter.uid,
        userName: inviter.name,
        kind: 'referral',
        label: `30% Commission (${user.name})`,
        amount: commission,
        createdAt: nowIso,
      });
    }

    const totalApprovedForUser = db.tasks.filter(
      (t) => t.uid === user.uid && t.status === 'approved'
    ).length;

    if (!user.milestoneBonusPaid && totalApprovedForUser >= 5) {
      user.milestoneBonusPaid = true;
      inviter.balance = Math.round((inviter.balance + 30) * 100) / 100;
      inviter.totalEarned = Math.round((inviter.totalEarned + 30) * 100) / 100;
      inviter.referralProfit = Math.round((inviter.referralProfit + 30) * 100) / 100;
      inviter.rank = computeRank(inviter.totalEarned);
      inviter.updatedAt = nowIso;
      db.feed.unshift({
        id: `fd-mile-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
        uid: inviter.uid,
        userName: inviter.name,
        kind: 'referral',
        label: `PKR 30 First-5 Milestone Bonus (${user.name})`,
        amount: 30,
        createdAt: nowIso,
      });
    }
  }

  // Admin: Update Dynamic Task Rate
  app.post('/api/admin/rate', requireAdmin, (req, res) => {
    const rate = Number(req.body.rate);
    if (!Number.isFinite(rate) || rate < 1 || rate > 5000) {
      return res.status(400).json({ error: 'Rate must be between PKR 1 and PKR 5,000.' });
    }
    db.taskRewardRate = Math.round(rate);
    broadcastAll();
    res.json({ taskRewardRate: db.taskRewardRate });
  });

  // Admin: Approve or Reject Individual Task
  app.post('/api/admin/tasks/review', requireAdmin, (req, res) => {
    const { taskId, decision } = req.body as { taskId?: string; decision?: 'approved' | 'rejected' };
    const task = db.tasks.find((t) => t.id === taskId);
    if (!task) return res.status(404).json({ error: 'Task not found.' });
    if (task.status !== 'pending') {
      return res.status(400).json({ error: 'Task already reviewed.' });
    }

    const nowIso = new Date().toISOString();
    task.status = decision === 'approved' ? 'approved' : 'rejected';
    task.updatedAt = nowIso;

    if (task.status === 'approved') {
      const user = db.users.find((u) => u.uid === task.uid);
      if (user) {
        user.balance = Math.round((user.balance + task.rewardRate) * 100) / 100;
        user.totalEarned = Math.round((user.totalEarned + task.rewardRate) * 100) / 100;
        user.rank = computeRank(user.totalEarned);
        user.updatedAt = nowIso;
        db.feed.unshift({
          id: `fd-tsk-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
          uid: user.uid,
          userName: user.name,
          kind: 'task',
          label: `Approved email: ${task.email}`,
          amount: task.rewardRate,
          createdAt: nowIso,
        });
        creditInviterOnTaskApproval(user, task.rewardRate, nowIso);
      }
    }
    broadcastAll();
    res.json({ task });
  });

  // Admin: Bulk Approve or Reject all pending tasks for a user
  app.post('/api/admin/tasks/review-bulk', requireAdmin, (req, res) => {
    const { uid, decision } = req.body as { uid?: string; decision?: 'approved' | 'rejected' };
    if (!uid) return res.status(400).json({ error: 'User ID required.' });

    const targets = db.tasks.filter((t) => t.uid === uid && t.status === 'pending');
    if (targets.length === 0) {
      return res.status(400).json({ error: 'No pending tasks for this user.' });
    }

    const nowIso = new Date().toISOString();
    const user = db.users.find((u) => u.uid === uid);
    let totalCredit = 0;

    for (const task of targets) {
      task.status = decision === 'approved' ? 'approved' : 'rejected';
      task.updatedAt = nowIso;
      if (task.status === 'approved') {
        totalCredit += task.rewardRate;
      }
    }

    if (decision === 'approved' && user && totalCredit > 0) {
      user.balance = Math.round((user.balance + totalCredit) * 100) / 100;
      user.totalEarned = Math.round((user.totalEarned + totalCredit) * 100) / 100;
      user.rank = computeRank(user.totalEarned);
      user.updatedAt = nowIso;
      db.feed.unshift({
        id: `fd-bulk-${Date.now()}`,
        uid: user.uid,
        userName: user.name,
        kind: 'task',
        label: `Bulk approved ${targets.length} email tasks`,
        amount: totalCredit,
        createdAt: nowIso,
      });
      creditInviterOnTaskApproval(user, totalCredit, nowIso);
    }

    broadcastAll();
    res.json({ count: targets.length, totalCredit });
  });

  // Admin: Approve or Reject Withdrawal
  app.post('/api/admin/withdrawals/review', requireAdmin, (req, res) => {
    const { withdrawalId, decision } = req.body as {
      withdrawalId?: string;
      decision?: 'approved' | 'rejected';
    };
    const wd = db.withdrawals.find((w) => w.id === withdrawalId);
    if (!wd) return res.status(404).json({ error: 'Withdrawal not found.' });
    if (wd.status !== 'pending') {
      return res.status(400).json({ error: 'Withdrawal already reviewed.' });
    }

    const nowIso = new Date().toISOString();
    wd.status = decision === 'approved' ? 'approved' : 'rejected';
    wd.updatedAt = nowIso;

    const user = db.users.find((u) => u.uid === wd.uid);
    if (wd.status === 'approved' && user) {
      db.feed.unshift({
        id: `fd-wd-${Date.now()}`,
        uid: user.uid,
        userName: user.name,
        kind: 'withdrawal',
        label: `${wd.method} payout approved`,
        amount: wd.amount,
        createdAt: nowIso,
      });
    } else if (wd.status === 'rejected' && user) {
      user.balance += wd.amount;
      user.updatedAt = nowIso;
      db.feed.unshift({
        id: `fd-refd-${Date.now()}`,
        uid: user.uid,
        userName: user.name,
        kind: 'refund',
        label: `${wd.method} withdrawal refunded`,
        amount: wd.amount,
        createdAt: nowIso,
      });
    }

    broadcastAll();
    res.json({ withdrawal: wd });
  });

  // Admin: Adjust User Balance / Custom Bonus
  app.post('/api/admin/users/balance', requireAdmin, (req, res) => {
    const { uid, mode, amount, note } = req.body as {
      uid?: string;
      mode?: 'add' | 'set';
      amount?: number;
      note?: string;
    };
    const user = db.users.find((u) => u.uid === uid);
    if (!user) return res.status(404).json({ error: 'Member not found.' });

    const num = Number(amount);
    if (!Number.isFinite(num)) {
      return res.status(400).json({ error: 'Enter a valid numeric PKR amount.' });
    }

    const nowIso = new Date().toISOString();
    const prevBalance = user.balance;
    let delta = 0;

    if (mode === 'set') {
      if (num < 0) return res.status(400).json({ error: 'Balance cannot be negative.' });
      delta = num - prevBalance;
      user.balance = Math.round(num);
    } else {
      const next = prevBalance + num;
      if (next < 0) return res.status(400).json({ error: 'Resulting balance cannot be negative.' });
      delta = Math.round(num);
      user.balance = Math.round(next);
    }

    if (delta > 0) {
      user.totalEarned += delta;
      user.rank = computeRank(user.totalEarned);
    }
    user.updatedAt = nowIso;

    db.feed.unshift({
      id: `fd-bonus-${Date.now()}`,
      uid: user.uid,
      userName: user.name,
      kind: 'bonus',
      label: note?.trim() || (delta >= 0 ? 'Admin VIP Custom Bonus' : 'Admin Balance Adjustment'),
      amount: Math.abs(delta),
      createdAt: nowIso,
    });

    broadcastAll();
    res.json({ user: sanitizeUser(user) });
  });

  // Admin: Member Controls (enable / disable / delete)
  app.post('/api/admin/users/action', requireAdmin, (req, res) => {
    const { uid, action } = req.body as {
      uid?: string;
      action?: 'enable' | 'disable' | 'delete';
    };
    const idx = db.users.findIndex((u) => u.uid === uid);
    if (idx === -1) return res.status(404).json({ error: 'Member not found.' });

    if (action === 'delete') {
      db.users.splice(idx, 1);
      db.tasks = db.tasks.filter((t) => t.uid !== uid);
      db.withdrawals = db.withdrawals.filter((w) => w.uid !== uid);
      db.feed = db.feed.filter((f) => f.uid !== uid);
      db.messages = db.messages.filter((m) => m.roomUid !== uid);
      db.calls = db.calls.filter((c) => c.targetUid !== uid);
    } else {
      db.users[idx].status = action === 'disable' ? 'disabled' : 'active';
      db.users[idx].updatedAt = new Date().toISOString();
    }

    broadcastAll();
    res.json({ ok: true });
  });

  // Admin: Trigger Persistent Audio / Video Call Banner & Ringing Alert
  app.post('/api/admin/calls/start', requireAdmin, (req, res) => {
    const { targetUid, callType } = req.body as {
      targetUid?: string;
      callType?: 'audio' | 'video';
    };
    const user = db.users.find((u) => u.uid === targetUid);
    if (!user) return res.status(404).json({ error: 'Member not found.' });

    const nowIso = new Date().toISOString();
    for (const c of db.calls) {
      if (c.targetUid === user.uid && c.status !== 'ended') {
        c.status = 'ended';
        c.updatedAt = nowIso;
      }
    }

    const call: ActiveCallSession = {
      id: `call-${Date.now()}`,
      targetUid: user.uid,
      targetName: user.name,
      callType: callType === 'video' ? 'video' : 'audio',
      status: 'ringing',
      startedBy: 'TaskPay VIP Admin',
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    db.calls.unshift(call);
    broadcastAll();
    res.json({ call });
  });

  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        ws: { server },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`TaskPay VIP Full-Stack server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
