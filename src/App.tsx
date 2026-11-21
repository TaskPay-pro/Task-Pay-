import React, { useCallback, useEffect, useRef, useState } from 'react';
import { I18nProvider, useI18n } from './data/i18n';
import { useTaskPaySync } from './hooks/useTaskPaySync';
import { OfflineIndicator } from './components/OfflineIndicator';
import { SplashScreen } from './components/SplashScreen';
import { TaskPayHeader, type TaskPayTab } from './components/TaskPayHeader';
import { MobileBottomDock } from './components/MobileBottomDock';
import { TopNotificationBanner } from './components/TopNotificationBanner';
import { CallOverlayModal } from './components/CallOverlayModal';
import { DashboardView } from './components/views/DashboardView';
import { ManualTasksView } from './components/views/ManualTasksView';
import { ReferralsWithdrawalsView } from './components/views/ReferralsWithdrawalsView';
import { SupportChatView } from './components/views/SupportChatView';
import { ProfileMenuView } from './components/views/ProfileMenuView';
import { AdminPanelView } from './components/views/AdminPanelView';
import { captureAndPersistReferralFromLocation } from './utils/referral';
import type {
  BannerNotification,
  WebRTCSignalMessage,
  WithdrawalRecord,
} from './types/taskpay';

const TaskPayShell: React.FC = () => {
  const { lang, t } = useI18n();
  const [showSplash, setShowSplash] = useState(true);
  const [activeTab, setActiveTab] = useState<TaskPayTab>('home');
  const [banner, setBanner] = useState<BannerNotification | null>(null);
  const [latestSignal, setLatestSignal] = useState<WebRTCSignalMessage | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const bannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    captureAndPersistReferralFromLocation();
  }, []);

  const pushBanner = useCallback(
    (title: string, message: string, tone: 'success' | 'warning' = 'success') => {
      if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
      setBanner({ id: `bn-${Date.now()}`, title, message, tone });
      bannerTimerRef.current = setTimeout(() => {
        setBanner(null);
      }, 4200);
    },
    []
  );

  const handleIncomingSignal = useCallback((msg: WebRTCSignalMessage) => {
    setLatestSignal(msg);
  }, []);

  const {
    isAdmin,
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
    adminCreateSubAdmin,
    adminToggleSubAdmin,
    adminDeleteSubAdmin,
    syncGoogleCloud,
  } = useTaskPaySync(handleIncomingSignal);

  const navigate = useCallback((tab: TaskPayTab) => {
    setActiveTab(tab);
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const isAuthenticatedUser = !!data.user && !isAdmin;
  const effectiveTab: TaskPayTab = isAuthenticatedUser ? activeTab : 'home';

  // Determine active call for overlay (either user's incoming call OR admin's outgoing active call)
  const adminActiveCall = isAdmin
    ? data.allCalls?.find((c) => c.status !== 'ended') ?? null
    : null;
  const overlayCall = adminActiveCall ?? data.activeCall;
  const overlayRole: 'user' | 'admin' = adminActiveCall ? 'admin' : 'user';

  return (
    <div className="min-h-[100dvh] w-full bg-[#050505] flex items-center justify-center sm:py-4">
      <OfflineIndicator />
      {/* Mobile-First Vertical App Layout */}
      <div
        dir={lang === 'ur' ? 'rtl' : 'ltr'}
        className="relative flex flex-col w-full max-w-[430px] h-[100dvh] sm:h-[860px] sm:max-h-[94dvh] bg-[#050505] text-white sm:rounded-[2.5rem] sm:border-[3px] sm:border-[#00FF66]/35 sm:shadow-[0_0_65px_-15px_rgba(0,255,102,0.32)] overflow-hidden"
      >
        {showSplash && <SplashScreen onDone={() => setShowSplash(false)} />}

        <TaskPayHeader onNavigate={navigate} />

        <TopNotificationBanner
          banner={banner}
          onDismiss={() => setBanner(null)}
        />

        {isAuthenticatedUser && data.user?.status === 'disabled' && (
          <div role="alert" className="px-3 pt-2 shrink-0">
            <div className="rounded-2xl border border-[#FFB800]/70 bg-[#FFB800]/12 px-3.5 py-2 text-[11px] font-bold text-[#FFB800]">
              {t('disabledWithdrawWarning')}
            </div>
          </div>
        )}

        <main
          ref={scrollContainerRef}
          className={
            !isAdmin && effectiveTab === 'support'
              ? 'flex-1 min-h-0 overflow-hidden p-2.5 flex flex-col'
              : 'flex-1 overflow-y-auto mobile-scroll px-3.5 py-4 pb-6'
          }
        >
          {isAdmin ? (
            <AdminPanelView
              isAdmin={isAdmin}
              data={data}
              onAdminLogout={() => {
                adminLogout();
                setActiveTab('home');
                pushBanner('Signed Out', 'Returned to standard login screen.', 'warning');
              }}
              onSetRate={async (rate) => {
                await adminSetRate(rate);
                pushBanner('Rate Updated', `Dynamic email reward rate set to PKR ${rate}.`);
              }}
              onReviewTask={async (taskId, decision) => {
                await adminReviewTask(taskId, decision);
                pushBanner(
                  `Task ${decision === 'approved' ? 'Approved' : 'Rejected'}`,
                  `Email task marked as ${decision}.`,
                  decision === 'approved' ? 'success' : 'warning'
                );
              }}
              onBulkReviewTasks={async (targetUid, decision) => {
                const res = await adminBulkReviewTasks(targetUid, decision);
                pushBanner(
                  `Bulk ${decision === 'approved' ? 'Approval' : 'Rejection'}`,
                  `${res.count} task(s) processed for ${targetUid}.`,
                  decision === 'approved' ? 'success' : 'warning'
                );
                return res;
              }}
              onReviewWithdrawal={async (withdrawalId, decision) => {
                await adminReviewWithdrawal(withdrawalId, decision);
                pushBanner(
                  `Withdrawal ${decision === 'approved' ? 'Approved' : 'Rejected'}`,
                  `Receipt ${withdrawalId} marked ${decision}.`,
                  decision === 'approved' ? 'success' : 'warning'
                );
              }}
              onAdjustBalance={async (targetUid, mode, amount, note) => {
                await adminAdjustBalance(targetUid, mode, amount, note);
                pushBanner('Balance Updated', `Custom balance adjustment applied for ${targetUid}.`);
              }}
              onMemberAction={async (targetUid, action) => {
                await adminMemberAction(targetUid, action);
                pushBanner(
                  `Member ${action}`,
                  `User ${targetUid} updated (${action}).`,
                  action === 'enable' ? 'success' : 'warning'
                );
              }}
              onStartCall={async (targetUid, callType) => {
                await adminStartCall(targetUid, callType);
                pushBanner(
                  `Calling ${targetUid}`,
                  `Initiating live ${callType} call with ringing alert...`
                );
              }}
              onSendMessage={sendChatMessage}
              onMarkChatRead={markChatRead}
              onReviewSupportRegistration={async (
                targetUid,
                decision,
                reason,
                receiptId,
                snapshot
              ) => {
                await adminReviewSupportRegistration(
                  targetUid,
                  decision,
                  reason,
                  receiptId,
                  snapshot
                );
                pushBanner(
                  `Support ${decision === 'approved' ? 'Approved' : 'Rejected'}`,
                  `Receipt ${receiptId || targetUid} updated (${decision}).`,
                  decision === 'approved' ? 'success' : 'warning'
                );
              }}
              onToggleDisableChat={async (targetUid) => {
                await adminToggleDisableChat(targetUid);
                pushBanner(
                  'Chat Access Updated',
                  `Updated Admin 3 chat restriction for ${targetUid}.`,
                  'warning'
                );
              }}
              onCreateSubAdmin={async (name, mobile, password, roleLabel) => {
                await adminCreateSubAdmin(name, mobile, password, roleLabel);
                pushBanner('Sub-Admin Created', `${name} (${roleLabel}) activated.`);
              }}
              onToggleSubAdmin={async (subAdminId) => {
                await adminToggleSubAdmin(subAdminId);
                pushBanner(
                  'Sub-Admin Status Changed',
                  'Remote Kill-Switch state synced live across devices.',
                  'warning'
                );
              }}
              onDeleteSubAdmin={async (subAdminId) => {
                await adminDeleteSubAdmin(subAdminId);
                pushBanner('Sub-Admin Removed', 'Secondary admin removed.', 'warning');
              }}
            />
          ) : (
            <>
              {effectiveTab === 'home' && (
                <DashboardView
                  data={data}
                  wsConnected={wsConnected}
                  onNavigate={navigate}
                  onRegister={async (name, contact, password, inviteCode) => {
                    const user = await register(name, contact, password, inviteCode);
                    pushBanner(
                      'PKR 20 VIP Bonus Credited!',
                      `Welcome ${user.name}! Your account (${user.uid}) is active.`,
                      'success'
                    );
                  }}
                  onLogin={async (contact, password) => {
                    const res = await login(contact, password);
                    if (res.isAdmin) {
                      setActiveTab('home');
                      pushBanner(
                        'Control Center Active',
                        'Signed in with full administrative access.',
                        'success'
                      );
                    } else if (res.user) {
                      pushBanner(
                        res.user.status === 'disabled' ? 'Account Restricted' : 'Welcome Back!',
                        res.user.status === 'disabled'
                          ? t('disabledWithdrawWarning')
                          : `Signed in as ${res.user.name} · Balance PKR ${res.user.balance.toLocaleString()}`,
                        res.user.status === 'disabled' ? 'warning' : 'success'
                      );
                    }
                  }}
                />
              )}

              {effectiveTab === 'tasks' && (
                <ManualTasksView
                  data={data}
                  onSubmitTasks={async (passcode, emails) => {
                    const res = await submitTasks(passcode, emails);
                    pushBanner(
                      'Email Tasks Submitted',
                      `${res.addedCount} email(s) sent for verification (+PKR ${data.snapshot.taskRewardRate} each when approved).`
                    );
                    return res;
                  }}
                  onRequireAuth={() => navigate('home')}
                />
              )}

              {(effectiveTab === 'invite' || effectiveTab === 'wallet') && (
                <ReferralsWithdrawalsView
                  mode={effectiveTab}
                  data={data}
                  onRequestWithdrawal={async (method, holder, number, amount, cnic) => {
                    const res = (await requestWithdrawal(method, holder, number, amount, cnic)) as {
                      withdrawal?: WithdrawalRecord;
                    };
                    pushBanner(
                      'Withdrawal Receipt Issued',
                      `PKR ${amount.toLocaleString()} via ${method} routed live.`
                    );
                    return res?.withdrawal;
                  }}
                  onRequireAuth={() => navigate('home')}
                />
              )}

              {effectiveTab === 'support' && (
                <SupportChatView
                  roomUid={data.user?.uid ?? ''}
                  senderRole="user"
                  messages={data.messages}
                  title={t('supportTitle')}
                  subtitle={t('supportSub')}
                  currentUser={data.user}
                  publicDirectory={data.publicDirectory}
                  activeCall={data.activeCall}
                  userTasks={data.tasks}
                  serverSupportRegistration={data.supportRegistration}
                  supportApprovalHistory={data.supportApprovalHistory}
                  onSend={sendChatMessage}
                  onMarkRead={markChatRead}
                  onSubmitSupportRegistration={submitSupportRegistration}
                  onRequireAuth={() => navigate('home')}
                  isSignedIn={!!data.user}
                />
              )}

              {effectiveTab === 'profile' && (
                <ProfileMenuView
                  data={data}
                  firebaseUser={firebaseUser}
                  onUpdateProfile={async (name, currentPassword, newPassword) => {
                    const res = await updateProfile(name, currentPassword, newPassword);
                    pushBanner('Profile Saved', 'Your profile changes have been saved.');
                    return res;
                  }}
                  onSyncGoogleCloud={syncGoogleCloud}
                  onLogout={() => {
                    logout();
                    pushBanner('Signed Out', 'You have safely logged out of TaskPay VIP.');
                    navigate('home');
                  }}
                  onRequireAuth={() => navigate('home')}
                />
              )}
            </>
          )}
        </main>

        {/* Bottom navigation bar is strictly hidden until a user logs in (and hidden in Admin view) */}
        {isAuthenticatedUser && (
          <MobileBottomDock activeTab={effectiveTab} onNavigate={navigate} />
        )}

        {/* Full-screen Ringing & Two-Way WebRTC Audio/Video Call Overlay */}
        <CallOverlayModal
          call={overlayCall}
          role={overlayRole}
          latestSignal={latestSignal}
          onSendSignal={sendSignal}
          onAccept={(callId) => updateCallStatus(callId, 'accepted')}
          onEnd={(callId) => updateCallStatus(callId, 'ended')}
        />
      </div>
    </div>
  );
};

export default function App() {
  return (
    <I18nProvider>
      <TaskPayShell />
    </I18nProvider>
  );
}
