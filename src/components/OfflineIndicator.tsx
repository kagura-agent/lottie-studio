'use client';

import { useOnlineStatus } from '@/hooks/useOnlineStatus';

export default function OfflineIndicator() {
  const { isOnline, wasOffline, dismissReconnect } = useOnlineStatus();

  if (isOnline && !wasOffline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
        isOnline
          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
          : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
      }`}
    >
      {isOnline ? (
        <>
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 12.55a11 11 0 0 1 14.08 0M1.42 9a16 16 0 0 1 21.16 0M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01" />
          </svg>
          <span>Back online — syncing...</span>
          <button
            onClick={dismissReconnect}
            className="ml-auto text-emerald-400/70 hover:text-emerald-400 transition-colors"
            aria-label="Dismiss"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </>
      ) : (
        <>
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M1 1l22 22M16.72 11.06A10.94 10.94 0 0 1 19 12.55M5 12.55a10.94 10.94 0 0 1 5.17-2.39M10.71 5.05A16 16 0 0 1 22.58 9M1.42 9a15.91 15.91 0 0 1 4.7-2.88M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01" />
          </svg>
          <span>You are offline — saved animations still available</span>
        </>
      )}
    </div>
  );
}
