import { useCallback, useEffect, useState } from 'react';
import { captureAndPersistReferralFromLocation } from '../utils/referral';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

const PWA_EVENT_NAME = 'taskpay-pwa-standalone-sync';

let sharedDeferredPrompt: BeforeInstallPromptEvent | null = null;

function checkIsStandalonePWA(): boolean {
  if (typeof window === 'undefined') return false;
  const displayStandalone =
    typeof window.matchMedia === 'function' &&
    (window.matchMedia('(display-mode: standalone)').matches ||
      window.matchMedia('(display-mode: fullscreen)').matches);
  const iosStandalone =
    (window.navigator as unknown as { standalone?: boolean }).standalone === true;
  const androidReferrer =
    typeof document !== 'undefined' && document.referrer.startsWith('android-app://');
  return Boolean(displayStandalone || iosStandalone || androidReferrer);
}

function redirectBrowserBypassToRoot(): void {
  if (typeof window === 'undefined') return;
  if (checkIsStandalonePWA()) return;
  // Preserve referral code before cleaning any query/path/hash bypass attempts
  captureAndPersistReferralFromLocation();
  if (
    window.location.pathname !== '/' ||
    window.location.search !== '' ||
    window.location.hash !== ''
  ) {
    window.history.replaceState(null, '', '/');
  }
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(
    () => sharedDeferredPrompt
  );
  const [isInstalled, setIsInstalled] = useState<boolean>(() => checkIsStandalonePWA());
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const syncStandaloneState = () => {
      const standalone = checkIsStandalonePWA();
      setIsInstalled(standalone);
      if (!standalone) {
        redirectBrowserBypassToRoot();
      }
    };

    syncStandaloneState();

    const userAgent = window.navigator.userAgent.toLowerCase();
    setIsIOS(/iphone|ipad|ipod/.test(userAgent));

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      sharedDeferredPrompt = e as BeforeInstallPromptEvent;
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      sharedDeferredPrompt = null;
      setDeferredPrompt(null);
      syncStandaloneState();
      window.dispatchEvent(new Event(PWA_EVENT_NAME));
    };

    const handleSyncEvent = () => {
      syncStandaloneState();
      setDeferredPrompt(sharedDeferredPrompt);
    };

    const handleNavigationBypass = () => {
      if (!checkIsStandalonePWA()) {
        redirectBrowserBypassToRoot();
        setIsInstalled(false);
      }
    };

    const mql =
      typeof window.matchMedia === 'function'
        ? window.matchMedia('(display-mode: standalone)')
        : null;

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    window.addEventListener('popstate', handleNavigationBypass);
    window.addEventListener('hashchange', handleNavigationBypass);
    window.addEventListener(PWA_EVENT_NAME, handleSyncEvent);
    mql?.addEventListener?.('change', syncStandaloneState);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('popstate', handleNavigationBypass);
      window.removeEventListener('hashchange', handleNavigationBypass);
      window.removeEventListener(PWA_EVENT_NAME, handleSyncEvent);
      mql?.removeEventListener?.('change', syncStandaloneState);
    };
  }, []);

  // Kept for backwards compatibility with internal components without allowing browser bypasses
  const unlockInstalledState = useCallback(() => {
    setIsInstalled(checkIsStandalonePWA());
  }, []);

  const install = useCallback(async (): Promise<'accepted' | 'dismissed' | 'unavailable'> => {
    const promptEvent = deferredPrompt ?? sharedDeferredPrompt;
    if (!promptEvent) return 'unavailable';
    try {
      await promptEvent.prompt();
      const { outcome } = await promptEvent.userChoice;
      if (outcome === 'accepted') {
        sharedDeferredPrompt = null;
        setDeferredPrompt(null);
        return 'accepted';
      }
      return 'dismissed';
    } catch {
      return 'unavailable';
    }
  }, [deferredPrompt]);

  return {
    isInstallable: !!(deferredPrompt ?? sharedDeferredPrompt),
    isInstalled,
    isIOS,
    install,
    unlockInstalledState,
  };
}
