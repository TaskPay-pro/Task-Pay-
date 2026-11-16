import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-20 md:bottom-4 left-4 right-4 md:right-auto z-50 flex items-center gap-2.5 rounded-xl border border-primary/40 bg-card px-4 py-2.5 text-xs font-medium text-foreground shadow-xl"
    >
      <WifiOff className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
      <span>Offline mode — cached data is active</span>
    </div>
  );
};
