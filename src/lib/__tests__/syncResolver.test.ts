import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolveConflicts } from '../syncResolver';
import type { OfflineAnimation } from '../offlineStorage';

// Mock apiFetch
vi.mock('../apiFetch', () => ({
  apiFetch: vi.fn(),
}));

// Mock offlineStorage markSynced
vi.mock('../offlineStorage', () => ({
  markSynced: vi.fn().mockResolvedValue(undefined),
}));

import { apiFetch } from '../apiFetch';
import { markSynced } from '../offlineStorage';

const mockedFetch = apiFetch as ReturnType<typeof vi.fn>;

function makeLocal(overrides: Partial<OfflineAnimation> = {}): OfflineAnimation {
  return {
    id: 'anim-1',
    name: 'Test Animation',
    jsonData: { v: '5.7.1', layers: [] },
    lastModified: 1000,
    lastSynced: 500,
    dirty: true,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('syncResolver', () => {
  it('syncs when server has no changes since last sync', async () => {
    mockedFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: 'anim-1',
        name: 'Test Animation',
        data: { v: '5.7.1', layers: [] },
        updatedAt: new Date(400).toISOString(), // Before lastSynced (500)
      }),
    }).mockResolvedValueOnce({ ok: true }); // PUT call

    const result = await resolveConflicts([makeLocal()]);

    expect(result.synced).toContain('anim-1');
    expect(result.conflicts).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
    expect(markSynced).toHaveBeenCalledWith('anim-1');
  });

  it('syncs when local is newer (last-write-wins)', async () => {
    mockedFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: 'anim-1',
        name: 'Test Animation',
        data: { v: '5.7.1', layers: [] },
        updatedAt: new Date(800).toISOString(), // Newer than lastSynced but older than lastModified
      }),
    }).mockResolvedValueOnce({ ok: true });

    const result = await resolveConflicts([makeLocal({ lastModified: 1000, lastSynced: 500 })]);

    expect(result.synced).toContain('anim-1');
    expect(result.conflicts).toHaveLength(0);
  });

  it('reports conflict when server is newer', async () => {
    mockedFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: 'anim-1',
        name: 'Server Version',
        data: { v: '5.8.0', layers: [{ type: 'shape' }] },
        updatedAt: new Date(2000).toISOString(), // Newer than local lastModified
      }),
    });

    const result = await resolveConflicts([makeLocal({ lastModified: 1000 })]);

    expect(result.synced).toHaveLength(0);
    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0].id).toBe('anim-1');
    expect(result.conflicts[0].serverVersion.name).toBe('Server Version');
    expect(result.conflicts[0].localVersion.name).toBe('Test Animation');
  });

  it('pushes local when server returns 404', async () => {
    mockedFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
    }).mockResolvedValueOnce({ ok: true }); // POST to create

    // The current implementation calls pushToServer which uses PUT, not POST for 404
    // But it still calls markSynced
    const result = await resolveConflicts([makeLocal()]);

    expect(result.synced).toContain('anim-1');
    expect(markSynced).toHaveBeenCalledWith('anim-1');
  });

  it('reports error on non-404 failure', async () => {
    mockedFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
    });

    const result = await resolveConflicts([makeLocal()]);

    expect(result.errors).toContain('anim-1');
    expect(result.synced).toHaveLength(0);
  });

  it('reports error on network failure', async () => {
    mockedFetch.mockRejectedValueOnce(new Error('Network error'));

    const result = await resolveConflicts([makeLocal()]);

    expect(result.errors).toContain('anim-1');
  });
});
