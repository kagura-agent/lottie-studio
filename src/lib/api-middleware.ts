import { NextResponse } from "next/server";
import { validateApiKey, updateLastUsed, type ApiKey } from "./api-keys";

interface Bucket {
  count: number;
  windowStart: number;
}

const globalForApiRate = globalThis as unknown as { __lottieApiRateBuckets?: Map<string, Bucket> };
const buckets = globalForApiRate.__lottieApiRateBuckets ?? (globalForApiRate.__lottieApiRateBuckets = new Map<string, Bucket>());

function checkKeyRate(keyId: string, limit: number): { ok: true } | { ok: false; retryAfterSec: number } {
  const now = Date.now();
  const windowMs = 60_000;
  const bucket = buckets.get(keyId);

  if (!bucket || now - bucket.windowStart >= windowMs) {
    buckets.set(keyId, { count: 1, windowStart: now });
    return { ok: true };
  }

  if (bucket.count >= limit) {
    const retryAfterSec = Math.ceil((bucket.windowStart + windowMs - now) / 1000);
    return { ok: false, retryAfterSec };
  }

  bucket.count++;
  return { ok: true };
}

export interface AuthenticatedRequest {
  request: Request;
  apiKey: ApiKey;
}

type ApiHandler = (ctx: AuthenticatedRequest) => Promise<NextResponse> | NextResponse;

export function withApiKey(handler: ApiHandler) {
  return async (request: Request, routeCtx?: unknown): Promise<NextResponse> => {
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Missing or invalid Authorization header. Use: Bearer <api_key>" },
        { status: 401 }
      );
    }

    const key = authHeader.slice(7);
    const apiKey = validateApiKey(key);

    if (!apiKey) {
      return NextResponse.json(
        { error: "Invalid API key" },
        { status: 401 }
      );
    }

    if (!apiKey.enabled) {
      return NextResponse.json(
        { error: "API key is disabled" },
        { status: 401 }
      );
    }

    const rateResult = checkKeyRate(apiKey.id, apiKey.rate_limit);
    if (!rateResult.ok) {
      return NextResponse.json(
        { error: "Rate limit exceeded", retryAfterSec: rateResult.retryAfterSec },
        { status: 429, headers: { "Retry-After": String(rateResult.retryAfterSec) } }
      );
    }

    updateLastUsed(apiKey.id);

    // Suppress unused variable warning — routeCtx is consumed by Next.js route resolution
    void routeCtx;

    return handler({ request, apiKey });
  };
}
