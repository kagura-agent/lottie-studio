'use client';

import { useState, useEffect, useCallback } from 'react';

interface OnlineStatus {
  isOnline: boolean;
  /** True after reconnecting until dismissed */
  wasOffline: boolean;
  /** Dismiss the "back online" state */
  dismissReconnect: () => void;
}

export function useOnlineStatus(): OnlineStatus {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setWasOffline(true);
      // Auto-dismiss after 5 seconds
      setTimeout(() => setWasOffline(false), 5000);
    };
    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const dismissReconnect = useCallback(() => {
    setWasOffline(false);
  }, []);

  return { isOnline, wasOffline, dismissReconnect };
}
