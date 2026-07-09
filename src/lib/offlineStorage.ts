/**
 * IndexedDB-based offline storage for animations.
 * Stores animation metadata + JSON data for offline access.
 */

const DB_NAME = 'lottie-studio-offline';
const DB_VERSION = 1;
const STORE_ANIMATIONS = 'animations';
const STORE_QUEUE = 'message-queue';

export interface OfflineAnimation {
  id: string;
  name: string;
  jsonData: object;
  thumbnail?: string;
  lastModified: number; // Unix timestamp ms
  lastSynced: number;   // Unix timestamp ms (last successful server sync)
  dirty: boolean;       // true = local changes not yet synced
}

export interface QueuedMessage {
  id: string;
  animationId: string;
  content: string;
  timestamp: number;
  imageUrl?: string;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_ANIMATIONS)) {
        db.createObjectStore(STORE_ANIMATIONS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_QUEUE)) {
        const store = db.createObjectStore(STORE_QUEUE, { keyPath: 'id' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveAnimation(
  id: string,
  name: string,
  jsonData: object,
  options?: { thumbnail?: string; synced?: boolean }
): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_ANIMATIONS, 'readwrite');
  const store = tx.objectStore(STORE_ANIMATIONS);

  const existing = await new Promise<OfflineAnimation | undefined>((resolve) => {
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(undefined);
  });

  const now = Date.now();
  const record: OfflineAnimation = {
    id,
    name,
    jsonData,
    thumbnail: options?.thumbnail ?? existing?.thumbnail,
    lastModified: now,
    lastSynced: options?.synced ? now : (existing?.lastSynced ?? 0),
    dirty: !options?.synced,
  };

  store.put(record);
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function getAnimation(id: string): Promise<OfflineAnimation | undefined> {
  const db = await openDB();
  const tx = db.transaction(STORE_ANIMATIONS, 'readonly');
  const store = tx.objectStore(STORE_ANIMATIONS);

  const result = await new Promise<OfflineAnimation | undefined>((resolve, reject) => {
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return result;
}

export async function listAnimations(): Promise<OfflineAnimation[]> {
  const db = await openDB();
  const tx = db.transaction(STORE_ANIMATIONS, 'readonly');
  const store = tx.objectStore(STORE_ANIMATIONS);

  const result = await new Promise<OfflineAnimation[]>((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return result;
}

export async function deleteAnimation(id: string): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_ANIMATIONS, 'readwrite');
  tx.objectStore(STORE_ANIMATIONS).delete(id);
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function getDirtyAnimations(): Promise<OfflineAnimation[]> {
  const all = await listAnimations();
  return all.filter((a) => a.dirty);
}

export async function markSynced(id: string): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_ANIMATIONS, 'readwrite');
  const store = tx.objectStore(STORE_ANIMATIONS);

  const existing = await new Promise<OfflineAnimation | undefined>((resolve) => {
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(undefined);
  });

  if (existing) {
    existing.lastSynced = Date.now();
    existing.dirty = false;
    store.put(existing);
  }

  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}
