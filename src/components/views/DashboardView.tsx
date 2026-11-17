import React, { useState } from 'react';
import {
  Activity,
  Award,
  CheckCircle2,
  Clock,
  Pause,
  Play,
  TrendingUp,
  Users,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { useI18n } from '../../data/i18n';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import {
  TASKPAY_LOGO_SRC,
  type NetworkGrowthPoint,
  type SyncStatePayload,
} from '../../types/taskpay';
import type { TaskPayTab } from '../TaskPayHeader';
import { AuthPanel } from './AuthPanel';

interface DashboardViewProps {
  data: SyncStatePayload;
  wsConnected: boolean;
  onNavigate: (tab: TaskPayTab) => void;
  onRegister: (
    name: string,
    contact: string,
    password: string,
    inviteCode?: string
  ) => Promise<void>;
  onLogin: (contact: string, password: string) => Promise<unknown>;
}

const LiveGrowthInteractiveChart: React.FC<{
  series: NetworkGrowthPoint[];
  growthPercent: number;
  taskRate: number;
}> = ({ series, growthPercent, taskRate }) => {
  const [metric, setMetric] = useState<'users' | 'tasks' | 'online'>('users');
  const [activeIdx, setActiveIdx] = useState<number>(Math.max(0, series.length - 1));

  const points =
    series.length > 0
      ? series
      : [
          { label: 'D-2', users: 1, tasks: 1, online: 1 },
          { label: 'Yday', users: 2, tasks: 2, online: 2 },
          { label: 'Live', users: 3, tasks: 3, online: 2 },
        ];

  const safeIdx = Math.min(activeIdx, points.length - 1);
  const values = points.map((p) => p[metric]);
  const maxVal = Math.max(1, ...values);
  const minVal = Math.min(0, ...values);
  const span = Math.max(1, maxVal - minVal);

  const width = 320;
  const height = 112;
  const padX = 16;
  const padY = 16;
  const usableW = width - padX * 2;
  const usableH = height - padY * 2;

  const coords = points.map((p, idx) => {
    const x =
      points.length === 1
        ? width / 2
        : padX + (idx / (points.length - 1)) * usableW;
    const y = padY + usableH - ((p[metric] - minVal) / span) * usableH;
    return { x, y, ...p };
  });

  const linePath = coords
    .map((c, idx) => `${idx === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`)
    .join(' ');
  const areaPath = `${linePath} L ${coords[coords.length - 1].x.toFixed(1)} ${height - 6} L ${coords[0].x.toFixed(1)} ${height - 6} Z`;
  const activePoint = coords[safeIdx];

  return (
    <div className="mt-4">
      {/* Interactive Metric Switcher */}
      <div className="flex items-center justify-between gap-2">
        <div className="inline-flex rounded-xl border border-[#00FF66]/20 bg-[#050505] p-0.5 text-[11px] font-bold">
          {(['users', 'tasks', 'online'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMetric(m)}
              className={`min-h-[32px] rounded-lg px-2.5 capitalize cursor-pointer ${
                metric === m ? 'bg-[#00FF66] text-[#050505]' : 'text-[#9cb3a5]'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
        <span className="font-mono text-xs font-extrabold text-[#00FF66] tabular">
          +{growthPercent}%
        </span>
      </div>

      {/* Selected Point Readout */}
      <div className="mt-2.5 flex items-center justify-between rounded-xl border border-white/10 bg-[#050505] px-3 py-2 text-xs">
        <span className="font-semibold text-[#9cb3a5]">
          {activePoint.label} · {metric.toUpperCase()}
        </span>
        <span className="font-display text-sm font-extrabold text-[#00FF66] tabular">
          {activePoint[metric].toLocaleString()}
        </span>
      </div>

      {/* Interactive SVG Area/Line Chart */}
      <div className="mt-2 rounded-2xl border border-[#00FF66]/20 bg-[#050505] p-2">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-28 overflow-visible">
          <defs>
            <linearGradient id="tpGrowthGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#00FF66" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#00FF66" stopOpacity="0.0" />
            </linearGradient>
          </defs>
          <path d={areaPath} fill="url(#tpGrowthGrad)" />
          <path
            d={linePath}
            fill="none"
            stroke="#00FF66"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {coords.map((c, idx) => {
            const isSel = idx === safeIdx;
            return (
              <g
                key={c.label}
                onClick={() => setActiveIdx(idx)}
                className="cursor-pointer"
              >
                <circle cx={c.x} cy={c.y} r="14" fill="transparent" />
                <circle
                  cx={c.x}
                  cy={c.y}
                  r={isSel ? 5.5 : 3.5}
                  fill={isSel ? '#FFFFFF' : '#00FF66'}
                  stroke="#00FF66"
                  strokeWidth={isSel ? 2.5 : 1.5}
                />
              </g>
            );
          })}
        </svg>

        {/* Tappable X-axis Day Buttons */}
        <div className="mt-1 grid grid-cols-6 gap-1 px-1">
          {coords.map((c, idx) => (
            <button
              key={c.label}
              type="button"
              onClick={() => setActiveIdx(idx)}
              className={`min-h-[28px] rounded-lg text-[10px] font-bold cursor-pointer ${
                idx === safeIdx
                  ? 'bg-[#00FF66]/20 text-[#00FF66]'
                  : 'text-[#9cb3a5] hover:text-white'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-2.5 text-[11px] text-[#9cb3a5] tabular">
        Task Rate: <strong className="text-[#00FF66]">PKR {taskRate}</strong> / approved email
      </div>
    </div>
  );
};

export const DashboardView: React.FC<DashboardViewProps> = ({
  data,
  wsConnected,
  onNavigate,
  onRegister,
  onLogin,
}) => {
  const { t } = useI18n();
  const browserOnline = useOnlineStatus();
  const isLiveOnline = browserOnline && wsConnected;
  const { user, tasks, referrals, snapshot } = data;

  const [feedPaused, setFeedPaused] = useState(false);

  const pendingCount = tasks.filter((x) => x.status === 'pending').length;
  const approvedCount = tasks.filter((x) => x.status === 'approved').length;

  const feedItems = snapshot.liveFeed.slice(0, 20);
  const scrollingFeed =
    !feedPaused && feedItems.length > 3 ? [...feedItems, ...feedItems] : feedItems;

  return (
    <div className="space-y-4 animate-view-enter">
      {user ? (
        <>
          {/* Gorgeous White & Neon Green Shadow Balance Card */}
          <section className="vip-balance-white p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs font-extrabold text-[#00993d] truncate">
                  {user.name}
                </div>
                <div className="mt-0.5 text-[11px] font-semibold text-[#050505]/70 truncate">
                  {user.uid} · {user.contact}
                </div>
              </div>

              <div className="inline-flex items-center gap-1.5 rounded-xl bg-[#050505] px-3 py-1.5 shadow-[0_4px_14px_rgba(0,255,102,0.35)] shrink-0">
                <Award className="h-3.5 w-3.5 text-[#00FF66]" aria-hidden="true" />
                <span className="font-display text-[11px] font-extrabold text-[#00FF66] whitespace-nowrap">
                  {user.rank}
                </span>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 border-t border-[#050505]/10 pt-4">
              <div>
                <div className="text-[11px] font-bold text-[#050505]/65">{t('balance')}</div>
                <div
                  dir="ltr"
                  className="mt-0.5 font-display text-2xl font-extrabold tabular text-[#050505]"
                >
                  PKR {user.balance.toLocaleString()}
                </div>
              </div>
              <div>
                <div className="text-[11px] font-bold text-[#050505]/65">{t('totalEarned')}</div>
                <div
                  dir="ltr"
                  className="mt-0.5 font-display text-xl font-extrabold tabular text-[#00993d]"
                >
                  PKR {user.totalEarned.toLocaleString()}
                </div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onNavigate('tasks')}
                className="min-h-[44px] rounded-xl bg-[#050505] px-3 py-2 text-xs font-extrabold text-[#00FF66] shadow-md cursor-pointer"
              >
                {t('navTasks')}
              </button>
              <button
                type="button"
                onClick={() => onNavigate('wallet')}
                className="min-h-[44px] rounded-xl bg-[#00FF66] px-3 py-2 text-xs font-extrabold text-[#050505] shadow-[0_6px_18px_rgba(0,255,102,0.45)] cursor-pointer"
              >
                {t('navWallet')}
              </button>
            </div>
          </section>

          {/* User Stats 2x2 Grid */}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => onNavigate('invite')}
              className="vip-card-3d p-4 text-start cursor-pointer"
            >
              <Users className="h-5 w-5 text-[#00FF66]" aria-hidden="true" />
              <div className="mt-2 font-display text-2xl font-extrabold tabular text-white">
                {referrals.length}
              </div>
              <div className="text-xs text-[#9cb3a5]">{t('referralsCount')}</div>
            </button>

            <button
              type="button"
              onClick={() => onNavigate('tasks')}
              className="vip-card-3d p-4 text-start cursor-pointer"
            >
              <CheckCircle2 className="h-5 w-5 text-[#00FF66]" aria-hidden="true" />
              <div className="mt-2 font-display text-2xl font-extrabold tabular text-[#00FF66]">
                {approvedCount}
              </div>
              <div className="text-xs text-[#9cb3a5]">{t('approvedTasks')}</div>
            </button>

            <button
              type="button"
              onClick={() => onNavigate('tasks')}
              className="vip-card-3d p-4 text-start cursor-pointer"
            >
              <Clock className="h-5 w-5 text-[#FFB800]" aria-hidden="true" />
              <div className="mt-2 font-display text-2xl font-extrabold tabular text-[#FFB800]">
                {pendingCount}
              </div>
              <div className="text-xs text-[#9cb3a5]">{t('pendingTasks')}</div>
            </button>

            <div className="vip-card-3d p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                {isLiveOnline ? (
                  <Wifi className="h-5 w-5 text-[#00FF66]" aria-hidden="true" />
                ) : (
                  <WifiOff className="h-5 w-5 text-[#FFB800]" aria-hidden="true" />
                )}
                <span
                  className={`text-[10px] font-extrabold ${
                    isLiveOnline ? 'text-[#00FF66]' : 'text-[#FFB800]'
                  }`}
                >
                  {isLiveOnline ? 'ONLINE' : 'OFFLINE'}
                </span>
              </div>
              <div className="mt-2 flex items-baseline justify-between gap-1 text-xs tabular">
                <div>
                  <span className="font-display text-lg font-extrabold text-[#00FF66]">
                    {snapshot.onlineCount}
                  </span>{' '}
                  <span className="text-[10px] text-[#9cb3a5]">{t('onlineMembers')}</span>
                </div>
                <div>
                  <span className="font-display text-sm font-bold text-white">
                    {snapshot.offlineCount}
                  </span>{' '}
                  <span className="text-[10px] text-[#9cb3a5]">{t('offlineMembers')}</span>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="space-y-4">
          <div className="vip-hero-3d p-5 space-y-4">
            <div className="flex items-center gap-3.5">
              <div className="rounded-2xl p-0.5 border border-[#00FF66] shadow-[0_0_24px_rgba(0,255,102,0.4)] shrink-0">
                <img
                  src={TASKPAY_LOGO_SRC}
                  alt="TaskPay 3D VIP"
                  className="h-16 w-16 rounded-[14px] object-cover"
                />
              </div>
              <div>
                <h1 className="font-display text-xl font-extrabold text-white text-balance">
                  {t('welcomeTitle')}
                </h1>
                <p className="mt-0.5 text-xs font-semibold text-[#00FF66]">{t('tagline')}</p>
              </div>
            </div>

            <p className="text-xs text-[#9cb3a5] leading-relaxed">{t('welcomeSub')}</p>

            <div className="grid grid-cols-3 gap-2">
              <div className="vip-card-3d p-3 text-center">
                <div className="font-display text-sm font-extrabold tabular text-[#00FF66]" dir="ltr">
                  PKR 20
                </div>
                <div className="mt-0.5 text-[10px] text-[#9cb3a5]">Signup</div>
              </div>
              <div className="vip-card-3d p-3 text-center">
                <div className="font-display text-sm font-extrabold tabular text-[#00FF66]" dir="ltr">
                  PKR {snapshot.taskRewardRate}
                </div>
                <div className="mt-0.5 text-[10px] text-[#9cb3a5]">Per Task</div>
              </div>
              <div className="vip-card-3d p-3 text-center">
                <div className="font-display text-sm font-extrabold tabular text-[#00FF66]" dir="ltr">
                  30% + 30
                </div>
                <div className="mt-0.5 text-[10px] text-[#9cb3a5]">Referral</div>
              </div>
            </div>

            {/* Online / Offline User Count Box */}
            <div className="vip-card-3d p-3.5 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                {isLiveOnline ? (
                  <Wifi className="h-4 w-4 text-[#00FF66]" aria-hidden="true" />
                ) : (
                  <WifiOff className="h-4 w-4 text-[#FFB800]" aria-hidden="true" />
                )}
                <div>
                  <div className="text-xs font-bold text-white">{t('networkStatus')}</div>
                  <div
                    className={`text-[11px] ${
                      isLiveOnline ? 'text-[#00FF66]' : 'text-[#FFB800]'
                    }`}
                  >
                    {isLiveOnline ? t('onlineLabel') : t('offlineLabel')}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 text-end tabular">
                <div>
                  <div className="font-display text-sm font-extrabold text-[#00FF66]">
                    {snapshot.onlineCount}
                  </div>
                  <div className="text-[10px] text-[#9cb3a5]">{t('onlineMembers')}</div>
                </div>
                <div>
                  <div className="font-display text-sm font-extrabold text-white">
                    {snapshot.offlineCount}
                  </div>
                  <div className="text-[10px] text-[#9cb3a5]">{t('offlineMembers')}</div>
                </div>
              </div>
            </div>
          </div>

          <AuthPanel onRegister={onRegister} onLogin={onLogin} />
        </div>
      )}

      {/* Total Registered Users Counter + Live Network Growth Interactive Chart */}
      <section className="vip-card-3d p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold text-[#9cb3a5]">{t('totalUsers')}</div>
            <div className="mt-1 font-display text-3xl font-extrabold tabular text-[#00FF66]">
              {snapshot.totalUsers.toLocaleString()}
            </div>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#00FF66]/30 bg-[#00FF66]/10 text-[#00FF66]">
            <TrendingUp className="h-5 w-5" aria-hidden="true" />
          </div>
        </div>

        <LiveGrowthInteractiveChart
          series={snapshot.growthSeries}
          growthPercent={snapshot.growthPercent}
          taskRate={snapshot.taskRewardRate}
        />
      </section>

      {/* Interactive Live Earnings Feed (Pause/Resume + Manual Scroll) */}
      <section className="vip-card-3d p-5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-[#00FF66]" aria-hidden="true" />
            <h2 className="font-display text-sm font-extrabold text-white">{t('liveFeed')}</h2>
          </div>
          <button
            type="button"
            onClick={() => setFeedPaused((p) => !p)}
            className={`inline-flex min-h-[30px] items-center gap-1 rounded-lg px-2.5 font-mono text-[10px] font-bold cursor-pointer ${
              feedPaused
                ? 'vip-btn-neon'
                : 'border border-[#00FF66]/35 bg-[#050505] text-[#00FF66]'
            }`}
          >
            {feedPaused ? (
              <>
                <Play className="h-3 w-3" aria-hidden="true" />
                <span>Resume</span>
              </>
            ) : (
              <>
                <Pause className="h-3 w-3" aria-hidden="true" />
                <span>Pause</span>
              </>
            )}
          </button>
        </div>

        {feedItems.length === 0 ? (
          <p className="py-8 text-center text-xs text-[#9cb3a5]">{t('noRecords')}</p>
        ) : (
          <div className="mt-3 h-52 overflow-y-auto mobile-scroll rounded-xl border border-[#00FF66]/15 bg-[#050505] px-3">
            <ul
              className={`divide-y divide-[#00FF66]/10 ${
                !feedPaused && feedItems.length > 3 ? 'animate-feed-scroll' : ''
              }`}
            >
              {scrollingFeed.map((item, idx) => (
                <li
                  key={`${item.id}-${idx}`}
                  className="flex items-center justify-between gap-2.5 py-2.5 text-xs"
                >
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-white">
                      {item.userName} ·{' '}
                      <span className="font-normal text-[#9cb3a5]">{item.label}</span>
                    </div>
                    <div className="text-[10px] text-[#9cb3a5]">
                      {new Date(item.createdAt).toLocaleTimeString()}
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
    </div>
  );
};
