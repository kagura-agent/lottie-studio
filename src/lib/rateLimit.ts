// ponytail: add hourly bucket if abuse observed

const BURST = parseInt(process.env.CHAT_RATE_BURST ?? "10", 10);
const WINDOW_SEC = parseInt(process.env.CHAT_RATE_WINDOW_SEC ?? "60", 10);
const IS_PROD = process.env.NODE_ENV === "production";

interface Bucket {
  count: number;
  windowStart: number;
}

const globalForRateLimit = globalThis as unknown as { __lottieRateBuckets?: Map<string, Bucket> };
const buckets = globalForRateLimit.__lottieRateBuckets ?? (globalForRateLimit.__lottieRateBuckets = new Map<string, Bucket>());

const LOCALHOST_IPS = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);

export function extractIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0].trim();
    if (first) return first;
  }
  const real = request.headers.get("x-real-ip");
  if (real) return real.trim();
  // Next.js App Router Request doesn't expose socket.remoteAddress, so when
  // no proxy header is present we tag the caller as "unknown". Caller policy
  // (in checkRate) decides whether that bypasses or shares one bucket.
  return "unknown";
}

export function checkRate(ip: string): { ok: true } | { ok: false; retryAfterSec: number } {
  // Localhost always bypasses — on-VM health checks and `npm run dev` need
  // to work without limits regardless of environment.
  if (LOCALHOST_IPS.has(ip)) {
    return { ok: true };
  }

  // TEMP DIAGNOSTIC — remove after #169 verified in prod
  console.log('[ratelimit]', ip, buckets.size, buckets.get(ip)?.count);

  // In dev, "unknown" (no x-forwarded-for) bypasses so local tools work.
  // In prod, Caddy ALWAYS sets x-forwarded-for. If it's missing, that's a
  // direct-to-Node hit (proxy bypass / misconfig) — share one bucket so a
  // direct attack can't drain the LLM quota.
  if (ip === "unknown" && !IS_PROD) {
    return { ok: true };
  }

  const now = Date.now();
  const windowMs = WINDOW_SEC * 1000;
  const bucket = buckets.get(ip);

  if (!bucket || now - bucket.windowStart >= windowMs) {
    buckets.set(ip, { count: 1, windowStart: now });
    return { ok: true };
  }

  if (bucket.count >= BURST) {
    const retryAfterSec = Math.ceil((bucket.windowStart + windowMs - now) / 1000);
    return { ok: false, retryAfterSec };
  }

  bucket.count++;
  return { ok: true };
}
