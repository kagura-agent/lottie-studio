import { describe, it, expect, beforeEach, vi } from 'vitest';

// We need a mock that properly handles the async flow of the real code.
// The real offlineStorage does: open db -> tx -> store.get (await) -> store.put -> await tx.oncomplete
// Our mock needs oncomplete to fire AFTER internal operations resolve.

let store: Map<string, unknown>;

function createMockIndexedDB() {
  const mockObjectStore = () => ({
    get: (key: string) => {
      const req = { result: store.get(key), onsuccess: null as (() => void) | null, onerror: null as (() => void) | null };
      Promise.resolve().then(() => req.onsuccess?.());
      return req;
    },
    put: (record: { id: string }) => {
      store.set(record.id, structuredClone(record));
      const req = { result: undefined, onsuccess: null as (() => void) | null, onerror: null as (() => void) | null };
      Promise.resolve().then(() => req.onsuccess?.());
      return req;
    },
    getAll: () => {
      const req = { result: [...store.values()], onsuccess: null as (() => void) | null, onerror: null as (() => void) | null };
      Promise.resolve().then(() => req.onsuccess?.());
      return req;
    },
    delete: (key: string) => {
      store.delete(key);
      const req = { result: undefined, onsuccess: null as (() => void) | null, onerror: null as (() => void) | null };
      Promise.resolve().then(() => req.onsuccess?.());
      return req;
    },
    clear: () => {
      store.clear();
      const req = { result: undefined, onsuccess: null as (() => void) | null, onerror: null as (() => void) | null };
      Promise.resolve().then(() => req.onsuccess?.());
      return req;
    },
    index: () => ({
      getAll: () => {
        const req = { result: [...store.values()], onsuccess: null as (() => void) | null, onerror: null as (() => void) | null };
        Promise.resolve().then(() => req.onsuccess?.());
        return req;
      },
    }),
  });

  const mockDB = {
    objectStoreNames: { contains: () => true },
    createObjectStore: () => ({ createIndex: vi.fn() }),
    transaction: () => {
      const os = mockObjectStore();
      const tx = {
        objectStore: () => os,
        oncomplete: null as (() => void) | null,
        onerror: null as (() => void) | null,
        error: null,
      };
      // Fire oncomplete on a setTimeout so all microtask-based
      // inner operations (get/put) resolve first
      setTimeout(() => tx.oncomplete?.(), 0);
      return tx;
    },
    close: vi.fn(),
  };

  return {
    open: () => {
      const req = {
        result: mockDB,
        onsuccess: null as (() => void) | null,
        onerror: null as (() => void) | null,
        onupgradeneeded: null as ((e: unknown) => void) | null,
      };
      Promise.resolve().then(() => {
        req.onupgradeneeded?.({ target: req });
        req.onsuccess?.();
      });
      return req;
    },
  };
}

beforeEach(() => {
  store = new Map();
  vi.stubGlobal('indexedDB', createMockIndexedDB());
});

// Dynamic import to get fresh module after mock is set up
async function getModule() {
  // Force re-evaluation not possible with vi.resetModules in this pattern,
  // but since the module just calls indexedDB.open at runtime, stubGlobal works.
  const mod = await import('../offlineStorage');
  return mod;
}

describe('offlineStorage', () => {
  it('saves and retrieves an animation', async () => {
    const { saveAnimation, getAnimation } = await getModule();
    await saveAnimation('test-1', 'Test Anim', { v: '5.7.1', layers: [] });
    const result = await getAnimation('test-1');
    expect(result).toBeDefined();
    expect(result!.id).toBe('test-1');
    expect(result!.name).toBe('Test Anim');
    expect(result!.jsonData).toEqual({ v: '5.7.1', layers: [] });
    expect(result!.lastModified).toBeGreaterThan(0);
  });

  it('returns undefined for non-existent animation', async () => {
    const { getAnimation } = await getModule();
    const result = await getAnimation('non-existent');
    expect(result).toBeUndefined();
  });

  it('lists all saved animations', async () => {
    const { saveAnimation, listAnimations } = await getModule();
    await saveAnimation('a1', 'First', { v: '1' });
    await saveAnimation('a2', 'Second', { v: '2' });
    const list = await listAnimations();
    expect(list).toHaveLength(2);
    const ids = list.map((a) => a.id).sort();
    expect(ids).toEqual(['a1', 'a2']);
  });

  it('deletes an animation', async () => {
    const { saveAnimation, getAnimation, deleteAnimation } = await getModule();
    await saveAnimation('del-me', 'Delete Me', {});
    await deleteAnimation('del-me');
    const result = await getAnimation('del-me');
    expect(result).toBeUndefined();
  });

  it('overwrites an existing animation on save', async () => {
    const { saveAnimation, getAnimation } = await getModule();
    await saveAnimation('up1', 'Original', { v: '1' });
    await saveAnimation('up1', 'Updated', { v: '2' });
    const result = await getAnimation('up1');
    expect(result!.name).toBe('Updated');
    expect(result!.jsonData).toEqual({ v: '2' });
  });

  it('marks animations as dirty by default', async () => {
    const { saveAnimation, getDirtyAnimations } = await getModule();
    await saveAnimation('d1', 'Dirty', { layers: [] });
    const dirty = await getDirtyAnimations();
    expect(dirty).toHaveLength(1);
    expect(dirty[0].id).toBe('d1');
  });

  it('marks animations as synced', async () => {
    const { saveAnimation, getAnimation, getDirtyAnimations, markSynced } = await getModule();
    await saveAnimation('s1', 'Synced', { layers: [] });
    await markSynced('s1');
    const dirty = await getDirtyAnimations();
    expect(dirty).toHaveLength(0);
    const anim = await getAnimation('s1');
    expect(anim!.dirty).toBe(false);
  });

  it('saves with synced option', async () => {
    const { saveAnimation, getAnimation } = await getModule();
    await saveAnimation('syn1', 'Already synced', { v: '1' }, { synced: true });
    const result = await getAnimation('syn1');
    expect(result!.dirty).toBe(false);
    expect(result!.lastSynced).toBeGreaterThan(0);
  });
});
