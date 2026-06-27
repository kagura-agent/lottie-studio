/**
 * Wrapper around fetch() that automatically injects the X-Creator-Id
 * and X-Creator-Name headers for anonymous creator attribution.
 */

import { getCreatorId, getCreatorName } from "@/lib/creatorId";

export function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const creatorId = getCreatorId();
  const creatorName = getCreatorName();

  const headers = new Headers(init?.headers);
  if (creatorId) {
    headers.set("X-Creator-Id", creatorId);
  }
  if (creatorName) {
    headers.set("X-Creator-Name", creatorName);
  }

  return fetch(input, { ...init, headers });
}
