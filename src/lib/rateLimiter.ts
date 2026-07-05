const globalForApiRate = globalThis as unknown as {
  __lottieApiRateWindows?: Map<string, number[]>;
};
const windows =
  globalForApiRate.__lottieApiRateWindows ??
  (globalForApiRate.__lottieApiRateWindows = new Map<string, number[]>());

export function checkApiRate(
  keyId: string,
  limit: number
): { ok: true } | { ok: false; retryAfterSec: number } {
  const now = Date.now();
  const windowMs = 60_000;

  let timestamps = windows.get(keyId);
  if (!timestamps) {
    timestamps = [];
    windows.set(keyId, timestamps);
  }

  // Remove timestamps outside the sliding window
  const cutoff = now - windowMs;
  while (timestamps.length > 0 && timestamps[0] <= cutoff) {
    timestamps.shift();
  }

  if (timestamps.length >= limit) {
    const oldest = timestamps[0];
    const retryAfterSec = Math.ceil((oldest + windowMs - now) / 1000);
    return { ok: false, retryAfterSec };
  }

  timestamps.push(now);
  return { ok: true };
}

/** Reset rate limiter state (for testing) */
export function resetApiRate(): void {
  windows.clear();
}
