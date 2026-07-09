'use client';

import { useEffect } from 'react';

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          // Listen for sync messages from SW
          navigator.serviceWorker.addEventListener('message', (event) => {
            if (event.data?.type === 'SYNC_REQUESTED') {
              // Dispatch custom event so components can react
              window.dispatchEvent(new CustomEvent('sw-sync-requested'));
            }
          });

          // Register background sync if supported
          if ('sync' in registration) {
            // Sync tags will be registered when messages are queued
            console.debug('[SW] Background sync available');
          }
        })
        .catch((error) => {
          console.error('Service worker registration failed:', error);
        });
    }
  }, []);

  return null;
}

/**
 * Request a background sync for chat messages.
 * Falls back to immediate sync if Background Sync API not available.
 */
export async function requestMessageSync(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;

  const registration = await navigator.serviceWorker.ready;
  if ('sync' in registration) {
    await (registration as ServiceWorkerRegistration & { sync: { register: (tag: string) => Promise<void> } }).sync.register('sync-chat-messages');
  } else {
    // Fallback: dispatch sync event directly
    window.dispatchEvent(new CustomEvent('sw-sync-requested'));
  }
}

/**
 * Request a background sync for animation data.
 */
export async function requestAnimationSync(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;

  const registration = await navigator.serviceWorker.ready;
  if ('sync' in registration) {
    await (registration as ServiceWorkerRegistration & { sync: { register: (tag: string) => Promise<void> } }).sync.register('sync-animations');
  } else {
    window.dispatchEvent(new CustomEvent('sw-sync-requested'));
  }
}
