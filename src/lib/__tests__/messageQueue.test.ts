import { describe, it, expect, beforeEach, vi } from 'vitest';
import { enqueueMessage, getPendingMessages, removeMessage, flushMessages, clearQueue } from '../messageQueue';

let queueStore: Map<string, unknown>;

beforeEach(() => {
  queueStore = new Map();

  const mockObjectStore = () => ({
    put: (record: { id: string }) => {
      queueStore.set(record.id, structuredClone(record));
      const req = { result: undefined, onsuccess: null as (() => void) | null, onerror: null as (() => void) | null };
      queueMicrotask(() => req.onsuccess?.());
      return req;
    },
    get: (key: string) => {
      const req = { result: queueStore.get(key), onsuccess: null as (() => void) | null, onerror: null as (() => void) | null };
      queueMicrotask(() => req.onsuccess?.());
      return req;
    },
    getAll: () => {
      const req = { result: [...queueStore.values()], onsuccess: null as (() => void) | null, onerror: null as (() => void) | null };
      queueMicrotask(() => req.onsuccess?.());
      return req;
    },
    delete: (key: string) => {
      queueStore.delete(key);
      const req = { result: undefined, onsuccess: null as (() => void) | null, onerror: null as (() => void) | null };
      queueMicrotask(() => req.onsuccess?.());
      return req;
    },
    clear: () => {
      queueStore.clear();
      const req = { result: undefined, onsuccess: null as (() => void) | null, onerror: null as (() => void) | null };
      queueMicrotask(() => req.onsuccess?.());
      return req;
    },
    index: () => ({
      getAll: () => {
        const sorted = ([...queueStore.values()] as Array<{ timestamp: number }>).sort(
          (a, b) => a.timestamp - b.timestamp
        );
        const req = { result: sorted, onsuccess: null as (() => void) | null, onerror: null as (() => void) | null };
        queueMicrotask(() => req.onsuccess?.());
        return req;
      },
    }),
  });

  const mockDB = {
    transaction: () => {
      const tx = {
        objectStore: () => mockObjectStore(),
        oncomplete: null as (() => void) | null,
        onerror: null as (() => void) | null,
        error: null,
      };
      queueMicrotask(() => tx.oncomplete?.());
      return tx;
    },
    close: vi.fn(),
    objectStoreNames: { contains: () => true },
    createObjectStore: vi.fn(() => ({ createIndex: vi.fn() })),
  };

  vi.stubGlobal('indexedDB', {
    open: () => {
      const req = {
        result: mockDB,
        error: null,
        onsuccess: null as (() => void) | null,
        onerror: null as (() => void) | null,
        onupgradeneeded: null as (() => void) | null,
      };
      queueMicrotask(() => {
        req.onsuccess?.();
      });
      return req;
    },
  });
});

describe('messageQueue', () => {
  it('enqueues a message and retrieves it', async () => {
    const msg = await enqueueMessage('anim-1', 'Hello offline');
    expect(msg.id).toBeTruthy();
    expect(msg.animationId).toBe('anim-1');
    expect(msg.content).toBe('Hello offline');
    expect(msg.timestamp).toBeGreaterThan(0);

    const pending = await getPendingMessages();
    expect(pending).toHaveLength(1);
    expect(pending[0].content).toBe('Hello offline');
  });

  it('enqueues multiple messages in order', async () => {
    await enqueueMessage('anim-1', 'First');
    await enqueueMessage('anim-1', 'Second');
    await enqueueMessage('anim-1', 'Third');

    const pending = await getPendingMessages();
    expect(pending).toHaveLength(3);
    expect(pending[0].content).toBe('First');
    expect(pending[2].content).toBe('Third');
  });

  it('removes a specific message', async () => {
    const msg = await enqueueMessage('anim-1', 'Remove me');
    await removeMessage(msg.id);
    const pending = await getPendingMessages();
    expect(pending).toHaveLength(0);
  });

  it('flushMessages sends and removes successful messages', async () => {
    await enqueueMessage('anim-1', 'msg-1');
    await enqueueMessage('anim-1', 'msg-2');

    const sender = vi.fn().mockResolvedValue(true);
    const result = await flushMessages(sender);

    expect(result.sent).toBe(2);
    expect(result.failed).toBe(0);
    expect(sender).toHaveBeenCalledTimes(2);
  });

  it('flushMessages stops on sender failure', async () => {
    await enqueueMessage('anim-1', 'msg-1');
    await enqueueMessage('anim-1', 'msg-2');

    const sender = vi.fn().mockRejectedValue(new Error('offline'));
    const result = await flushMessages(sender);

    expect(result.sent).toBe(0);
    expect(result.failed).toBe(1);
  });

  it('clears the entire queue', async () => {
    await enqueueMessage('anim-1', 'msg-1');
    await enqueueMessage('anim-1', 'msg-2');
    await clearQueue();
    const pending = await getPendingMessages();
    expect(pending).toHaveLength(0);
  });

  it('stores optional imageUrl', async () => {
    const msg = await enqueueMessage('anim-1', 'with image', 'data:image/png;base64,...');
    expect(msg.imageUrl).toBe('data:image/png;base64,...');
  });
});
