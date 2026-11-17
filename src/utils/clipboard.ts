import type { TaskRecord } from '../types/taskpay';

const EMAIL_FINDER_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi;

export async function copyTextToClipboard(text: string): Promise<boolean> {
  const clean = text.trim();
  if (!clean) return false;

  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(clean);
      return true;
    } catch {
      // Fall through to execCommand fallback (handles WebViews / iframes / mobile browsers)
    }
  }

  if (typeof document !== 'undefined') {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = clean;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.top = '-9999px';
      textarea.style.left = '-9999px';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      textarea.setSelectionRange(0, clean.length);
      const ok = document.execCommand('copy');
      document.body.removeChild(textarea);
      return ok;
    } catch {
      return false;
    }
  }

  return false;
}

export function extractLinkedUserEmails(
  uid: string,
  bio?: string,
  tasks: TaskRecord[] = []
): { email: string; status: 'pending' | 'approved' | 'rejected' | 'bio' }[] {
  const seen = new Map<string, { email: string; status: 'pending' | 'approved' | 'rejected' | 'bio' }>();

  // 1. User's submitted task emails (newest first)
  const userTasks = tasks
    .filter((t) => t.uid === uid && Boolean(t.email))
    .slice()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  for (const t of userTasks) {
    const clean = t.email.trim().toLowerCase();
    if (!clean) continue;
    if (!seen.has(clean)) {
      seen.set(clean, { email: t.email.trim(), status: t.status });
    }
  }

  // 2. Any email included inside Support Registration Description / Bio
  if (bio) {
    const matches = bio.match(EMAIL_FINDER_RE) ?? [];
    for (const raw of matches) {
      const clean = raw.trim().toLowerCase();
      if (!seen.has(clean)) {
        seen.set(clean, { email: raw.trim(), status: 'bio' });
      }
    }
  }

  return Array.from(seen.values());
}
