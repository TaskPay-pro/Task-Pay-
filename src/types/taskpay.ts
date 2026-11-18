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

export interface PublicDirectoryMember {
  uid: string;
  name: string;
  maskedMobile: string;
  status: 'active' | 'disabled';
  rank: VIPRank;
}

export interface SupportRegistrationRecord {
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

export function formatBalanceK(value: number): string {
  const num = Number(value) || 0;
  if (Math.abs(num) >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  return Math.round(num).toLocaleString();
}

export interface LeaderboardEntry {
  uid: string;
  name: string;
  maskedMobile: string;
  balance: number;
  totalEarned: number;
  rankNumber: number;
  vipTier: VIPRank;
}

export type SubAdminRoleLabel = 'ADMIN-1' | 'ADMIN-2' | 'ADMIN-3' | 'ALL';

export interface SubAdminRecord {
  id: string;
  name: string;
  mobile: string;
  roleLabel: SubAdminRoleLabel;
  status: 'active' | 'disabled';
  createdAt: string;
  lastLoginAt?: string;
}

export interface AdminDeviceLogRecord {
  id: string;
  subAdminId: string;
  subAdminName: string;
  subAdminMobile: string;
  deviceName: string;
  browserDetails: string;
  ipAddress: string;
  userAgent: string;
  loggedInAt: string;
}

export interface SyncStatePayload {
  snapshot: PublicDashboardSnapshot;
  publicDirectory?: PublicDirectoryMember[];
  leaderboard?: LeaderboardEntry[];
  uidNotFound?: boolean;
  wipedUids?: { uid: string; mobile?: string }[];
  adminLevel?: 'main' | 'sub';
  adminDisabled?: boolean;
  adminDisabledMessage?: string;
  subAdminProfile?: SubAdminRecord | null;
  subAdmins?: SubAdminRecord[];
  adminDeviceLogs?: AdminDeviceLogRecord[];
  user: UserRecord | null;
  tasks: TaskRecord[];
  withdrawals: WithdrawalRecord[];
  referrals: Pick<UserRecord, 'uid' | 'name' | 'createdAt' | 'totalEarned' | 'milestoneBonusPaid'>[];
  userHistory: EarningFeedItem[];
  messages: ChatMessage[];
  activeCall: ActiveCallSession | null;
  supportRegistration?: SupportRegistrationRecord | null;
  supportApprovalHistory?: SupportRegistrationRecord[];
  disabledChatUids?: string[];
  allUsers?: UserRecord[];
  allTasks?: TaskRecord[];
  allWithdrawals?: WithdrawalRecord[];
  allMessages?: ChatMessage[];
  allCalls?: ActiveCallSession[];
  allFeed?: EarningFeedItem[];
  allSupportRegistrations?: SupportRegistrationRecord[];
  allSupportApprovalHistory?: SupportRegistrationRecord[];
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
