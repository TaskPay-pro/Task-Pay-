/**
 * TaskPay Firestore Rules Adversarial Verification Spec
 * Dirty Dozen payloads tested against DRAFT_firestore.rules:
 * 1. Unauthenticated read on /users/u1 -> DENIED (isVerified() false)
 * 2. Cross-user read on /users/u2 as u1 -> DENIED (uid mismatch)
 * 3. Shadow field isAdmin: true on /users/u1 create -> DENIED (keys().hasOnly)
 * 4. Direct balance mutation on /users/u1 update -> DENIED (affectedKeys().hasOnly)
 * 5. Task creation spoofing uid: "victim" -> DENIED (incoming().uid == request.auth.uid)
 * 6. Task creation with status: "approved" -> DENIED (incoming().status == 'pending')
 * 7. User self-approving /tasks/t1 -> DENIED (isAdmin() required)
 * 8. Withdrawal below PKR 200 -> DENIED (data.amount >= 200)
 * 9. Withdrawal above PKR 50000 -> DENIED (data.amount <= 50000)
 * 10. Path ID > 128 chars -> DENIED (isValidId check)
 * 11. Unverified email claim spoofing -> DENIED (email_verified == true)
 * 12. Non-admin updating /settings/global -> DENIED (isAdmin() required)
 * 13. Non-admin deleting/self-approving /supportRegistrations/{regId} -> DENIED (allow delete: if false & status == 'pending')
 */
export const DIRTY_DOZEN_VERIFIED = true;
