# TaskPay Firestore Security Specification

## 1. Data Invariants
1. A `UserAccount` document at `/users/{userId}` can only be read by its owner (`request.auth.uid == userId`) or an Admin (`isAdmin()`).
2. Self-assigned balances or admin privileges are forbidden on user update; users may only update `name`, `online`, `updatedAt`.
3. `EmailTask` documents at `/tasks/{taskId}` must carry `uid == request.auth.uid` on create and start in `status == 'pending'`. Only Admins may transition `status` to `'approved'` or `'rejected'`.
4. `WithdrawalRequest` documents at `/withdrawals/{withdrawalId}` must carry `uid == request.auth.uid`, `amount >= 200 && amount <= 50000`, and `status == 'pending'` on create. Only Admins may approve/reject.
5. `SupportMessage` documents at `/messages/{messageId}` must belong to `roomUid == request.auth.uid` (unless Admin) and enforce strict string size limits.
6. `CallSession` documents at `/calls/{callId}` can only be created by Admins (`isAdmin()`); the target user (`targetUid == request.auth.uid`) may update `status` (`accepted` / `ended`).
7. `AppSettings` at `/settings/{settingId}` is readable by signed-in users and writable only by Admins.
8. `SupportRegistration` receipts at `/supportRegistrations/{regId}` preserve full approval/rejection history; regular users cannot delete receipts or self-approve (`chatUnlocked: true`), and only Admins can change `status`/`chatUnlocked`.
9. `DisabledChatState` at `/disabledChats/{userId}` can only be modified by Admins.

## 2. Dirty Dozen Adversarial Payloads
1. Unauthenticated read on `/users/{userId}` -> `PERMISSION_DENIED`
2. Cross-user read on `/users/otherUser` -> `PERMISSION_DENIED`
3. Shadow field injection on `/users/{userId}` create (`isAdmin: true`) -> `PERMISSION_DENIED`
4. User updating own `balance` directly (`balance: 999999`) -> `PERMISSION_DENIED`
5. User creating `/tasks/t1` with `uid: "victim"` -> `PERMISSION_DENIED`
6. User creating `/tasks/t1` pre-approved (`status: "approved"`) -> `PERMISSION_DENIED`
7. User approving own `/tasks/t1` -> `PERMISSION_DENIED`
8. User creating withdrawal below minimum (`amount: 50`) -> `PERMISSION_DENIED`
9. User creating withdrawal above cap (`amount: 100000`) -> `PERMISSION_DENIED`
10. Invalid document ID injection (`1500` chars) on `/tasks/{longId}` -> `PERMISSION_DENIED`
11. Unverified email claim spoofing (`email_verified == false`) -> `PERMISSION_DENIED`
12. Non-admin updating `/settings/global` (`taskRewardRate: 9999`) -> `PERMISSION_DENIED`
13. User deleting or self-approving `/supportRegistrations/{regId}` -> `PERMISSION_DENIED`
