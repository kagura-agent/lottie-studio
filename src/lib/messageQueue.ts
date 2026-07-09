/**
 * Offline message queue.
 * Stores chat messages in IndexedDB when offline, replays on reconnect.
 */

import type { QueuedMessage } from './offlineStorage';

const DB_NAME = 'lottie-studio-offline';
const DB_VERSION = 1;
const STORE_QUEUE = 'message-queue';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function enqueueMessage(
  animationId: string,
  content: string,
  imageUrl?: string
): Promise<QueuedMessage> {
  const msg: QueuedMessage = {
    id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    animationId,
    content,
    timestamp: Date.now(),
    imageUrl,
  };

  const db = await openDB();
  const tx = db.transaction(STORE_QUEUE, 'readwrite');
  tx.objectStore(STORE_QUEUE).put(msg);
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
  return msg;
}

export async function getPendingMessages(): Promise<QueuedMessage[]> {
  const db = await openDB();
  const tx = db.transaction(STORE_QUEUE, 'readonly');
  const store = tx.objectStore(STORE_QUEUE);
  const index = store.index('timestamp');

  const result = await new Promise<QueuedMessage[]>((resolve, reject) => {
    const req = index.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return result;
}

export async function removeMessage(id: string): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_QUEUE, 'readwrite');
  tx.objectStore(STORE_QUEUE).delete(id);
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function flushMessages(
  sender: (msg: QueuedMessage) => Promise<boolean>
): Promise<{ sent: number; failed: number }> {
  const pending = await getPendingMessages();
  let sent = 0;
  let failed = 0;

  for (const msg of pending) {
    try {
      const ok = await sender(msg);
      if (ok) {
        await removeMessage(msg.id);
        sent++;
      } else {
        failed++;
      }
    } catch {
      failed++;
      break; // Stop flushing on error (likely offline again)
    }
  }

  return { sent, failed };
}

export async function clearQueue(): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_QUEUE, 'readwrite');
  tx.objectStore(STORE_QUEUE).clear();
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}
