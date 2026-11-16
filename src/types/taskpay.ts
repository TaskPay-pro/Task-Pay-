export type VIPRank =
  | 'Bronze VIP'
  | 'Silver VIP'
  | 'Gold VIP'
  | 'Emerald VIP'
  | 'Diamond VIP';

export type PaymentMethod =
  | 'JazzCash'
  | 'EasyPaisa'
  | 'SadaPay'
  | 'NayaPay'
  | 'UPaisa'
  | 'AEPAY';

export const PAYMENT_METHODS: {
  id: string;
  name: PaymentMethod;
  displayName: string;
  code: string;
  tagline: string;
}[] = [
  { id: 'jazzcash', name: 'JazzCash', displayName: 'JazzCash', code: 'JC', tagline: 'Mobile Account' },
  { id: 'easypaisa', name: 'EasyPaisa', displayName: 'Easypaisa', code: 'EP', tagline: 'Telenor Microfinance' },
  { id: 'sadapay', name: 'SadaPay', displayName: 'SadaPay', code: 'SP', tagline: 'Digital Wallet' },
  { id: 'nayapay', name: 'NayaPay', displayName: 'NayaPay', code: 'NP', tagline: 'E-Money Wallet' },
  { id: 'upaisa', name: 'UPaisa', displayName: 'UPaisa', code: 'UP', tagline: 'U Microfinance' },
  { id: 'aepay', name: 'AEPAY', displayName: 'AEPAY', code: 'AE', tagline: 'Express Payout' },
];

export const TASK_PASSCODE = 'aass1122';
export const TASKPAY_LOGO_SRC =
  '/assets/aistudio/file_000000002db481faa2e01f9be3412f55_54beff74.png';

export interface UserRecord {
  uid: string;
  name: string;
  contact: string;
  password?: string;
  inviteCode: string;
  invitedBy?: string;
  balance: number;
  totalEarned: number;
  referralProfit: number;
  referralCount: number;
  rank: VIPRank;
  status: 'active' | 'disabled';
  online: boolean;
  milestoneBonusPaid?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TaskRecord {
  id: string;
  uid: string;
  userName: string;
  email: string;
  rewardRate: number;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  updatedAt: string;
}

export interface WithdrawalRecord {
  id: string;
  uid: string;
  userName: string;
  method: PaymentMethod;
  accountHolder: string;
  accountNumber: string;
  cnic?: string;
  amount: number;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  updatedAt: string;
}

export interface EarningFeedItem {
  id: string;
  uid: string;
  userName: string;
  kind: 'signup_bonus' | 'task' | 'referral' | 'refund' | 'withdrawal' | 'bonus';
  label: string;
  amount: number;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  roomUid: string;
  senderRole: 'user' | 'admin';
  senderUid: string;
  senderName: string;
  kind: 'text' | 'image' | 'voice';
  text?: string;
  mediaDataUrl?: string;
  durationSec?: number;
  tickState: 1 | 2 | 3; // 1 = sent, 2 = delivered, 3 = read
  createdAt: string;
}

export interface ActiveCallSession {
  id: string;
  targetUid: string;
  targetName: string;
  callType: 'audio' | 'video';
  status: 'ringing' | 'accepted' | 'ended';
  startedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface NetworkGrowthPoint {
  label: string;
  users: number;
  tasks: number;
  online: number;
}

export interface PublicDashboardSnapshot {
  taskRewardRate: number;
  totalUsers: number;
  onlineCount: number;
  offlineCount: number;
  growthPercent: number;
  growthSeries: NetworkGrowthPoint[];
  liveFeed: EarningFeedItem[];
}

export interface SyncStatePayload {
  snapshot: PublicDashboardSnapshot;
  user: UserRecord | null;
  tasks: TaskRecord[];
  withdrawals: WithdrawalRecord[];
  referrals: Pick<UserRecord, 'uid' | 'name' | 'createdAt' | 'totalEarned' | 'milestoneBonusPaid'>[];
  userHistory: EarningFeedItem[];
  messages: ChatMessage[];
  activeCall: ActiveCallSession | null;
  allUsers?: UserRecord[];
  allTasks?: TaskRecord[];
  allWithdrawals?: WithdrawalRecord[];
  allMessages?: ChatMessage[];
  allCalls?: ActiveCallSession[];
  allFeed?: EarningFeedItem[];
}

export interface BannerNotification {
  id: string;
  title: string;
  message: string;
  tone: 'success' | 'warning';
}

export interface WebRTCSignalMessage {
  type: 'webrtc:offer' | 'webrtc:answer' | 'webrtc:ice';
  callId: string;
  targetUid: string;
  fromRole: 'user' | 'admin';
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
}
