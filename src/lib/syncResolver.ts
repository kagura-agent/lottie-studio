/**
 * Sync conflict resolution for offline edits.
 * Compares local lastModified vs server lastModified.
 * Strategy: last-write-wins with option to keep both (duplicate).
 */

import type { OfflineAnimation } from './offlineStorage';
import { markSynced } from './offlineStorage';
import { apiFetch } from './apiFetch';

export interface SyncResult {
  /** Animations successfully synced (no conflict) */
  synced: string[];
  /** Animations with conflicts — both versions available */
  conflicts: ConflictEntry[];
  /** Animations that failed to sync (network error etc) */
  errors: string[];
}

export interface ConflictEntry {
  id: string;
  localVersion: { name: string; jsonData: object; lastModified: number };
  serverVersion: { name: string; jsonData: object; lastModified: number };
}

interface ServerAnimation {
  id: string;
  name: string;
  data: object;
  updatedAt: string; // ISO date
}

export async function resolveConflicts(
  dirtyAnimations: OfflineAnimation[]
): Promise<SyncResult> {
  const result: SyncResult = { synced: [], conflicts: [], errors: [] };

  for (const local of dirtyAnimations) {
    try {
      // Fetch current server version
      const response = await apiFetch(`/api/animations/${local.id}`);

      if (!response.ok) {
        if (response.status === 404) {
          // Animation was deleted on server — push local as new
          await pushToServer(local);
          await markSynced(local.id);
          result.synced.push(local.id);
        } else {
          result.errors.push(local.id);
        }
        continue;
      }

      const server: ServerAnimation = await response.json();
      const serverModified = new Date(server.updatedAt).getTime();

      if (local.lastSynced >= serverModified) {
        // No server changes since last sync — safe to push local
        await pushToServer(local);
        await markSynced(local.id);
        result.synced.push(local.id);
      } else if (local.lastModified > serverModified) {
        // Both changed, but local is newer — last-write-wins
        await pushToServer(local);
        await markSynced(local.id);
        result.synced.push(local.id);
      } else {
        // Server is newer — conflict
        result.conflicts.push({
          id: local.id,
          localVersion: {
            name: local.name,
            jsonData: local.jsonData,
            lastModified: local.lastModified,
          },
          serverVersion: {
            name: server.name,
            jsonData: server.data,
            lastModified: serverModified,
          },
        });
      }
    } catch {
      result.errors.push(local.id);
    }
  }

  return result;
}

async function pushToServer(animation: OfflineAnimation): Promise<void> {
  await apiFetch(`/api/animations/${animation.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: animation.name,
      data: animation.jsonData,
    }),
  });
}

/**
 * Resolve a conflict by choosing a version.
 * 'local' = overwrite server with local data.
 * 'server' = discard local changes.
 * 'both' = keep server as-is, duplicate local as new animation.
 */
export async function resolveConflict(
  conflict: ConflictEntry,
  resolution: 'local' | 'server' | 'both'
): Promise<void> {
  switch (resolution) {
    case 'local':
      await apiFetch(`/api/animations/${conflict.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: conflict.localVersion.name,
          data: conflict.localVersion.jsonData,
        }),
      });
      await markSynced(conflict.id);
      break;

    case 'server':
      // Just mark as synced — server version is already correct
      await markSynced(conflict.id);
      break;

    case 'both':
      // Keep server version, create a duplicate for local
      await apiFetch('/api/animations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${conflict.localVersion.name} (offline edit)`,
          data: conflict.localVersion.jsonData,
        }),
      });
      await markSynced(conflict.id);
      break;
  }
}
