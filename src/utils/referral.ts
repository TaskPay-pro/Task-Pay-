const SAVED_REF_STORAGE_KEY = 'taskpay_saved_ref_v1';
const INVITE_CODE_RE = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z0-9]{4,16}$/;

export function normalizeInviteCode(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  if (trimmed.includes('ref=') || trimmed.startsWith('http')) {
    try {
      const parsed = new URL(
        trimmed.startsWith('http')
          ? trimmed
          : `https://taskpay.app/?${trimmed.replace(/^\?/, '')}`
      );
      const refParam = parsed.searchParams.get('ref')?.trim().toUpperCase();
      if (refParam && INVITE_CODE_RE.test(refParam)) {
        return refParam;
      }
    } catch {
      // Fall through to plain code validation
    }
  }

  const candidate = trimmed.toUpperCase();
  return INVITE_CODE_RE.test(candidate) ? candidate : null;
}

export function saveReferralCode(raw: string | null | undefined): string | null {
  const code = normalizeInviteCode(raw);
  if (!code || typeof window === 'undefined') return null;
  try {
    window.localStorage.setItem(SAVED_REF_STORAGE_KEY, code);
  } catch {
    // Ignore storage quota errors
  }
  return code;
}

export function captureAndPersistReferralFromLocation(): string | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const fromUrl = params.get('ref');
  if (fromUrl) {
    const saved = saveReferralCode(fromUrl);
    if (saved) return saved;
  }
  return getSavedReferralCode();
}

export function getSavedReferralCode(): string | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const fromUrl = normalizeInviteCode(params.get('ref'));
  if (fromUrl) {
    saveReferralCode(fromUrl);
    return fromUrl;
  }

  try {
    return normalizeInviteCode(window.localStorage.getItem(SAVED_REF_STORAGE_KEY));
  } catch {
    return null;
  }
}
