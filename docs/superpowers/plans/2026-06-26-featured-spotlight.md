# Featured Animation Spotlight Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Featured Animation" spotlight card at the top of the Explore page that deterministically highlights one popular animation per day.

**Architecture:** Extract a pure scoring/selection function, expose it via a new API route `/api/animations/featured`, and render a self-contained `FeaturedSpotlight` client component at the top of the Explore grid (hidden during search/filter).

**Tech Stack:** Next.js 16 API route, better-sqlite3, lottie-web, React 19, Tailwind, vitest, next-intl

---

### Task 1: Pure selection logic + tests

**Files:**
- Create: `src/lib/featured-selection.ts`
- Create: `src/__tests__/featured-api.test.ts`

- [ ] **Step 1: Create the pure selection module**

```ts
// src/lib/featured-selection.ts

/**
 * Score an animation for featuring.
 */
export function featureScore(likeCount: number, viewCount: number): number {
  return likeCount * 3 + viewCount;
}

/**
 * Given a date string (YYYY-MM-DD), deterministically pick an index
 * into a candidates array of length `count`.
 * Uses a simple string hash of the date.
 */
export function pickFeaturedIndex(dateStr: string, count: number): number {
  if (count <= 0) return 0;
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) {
    hash = (hash * 31 + dateStr.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % count;
}
```

- [ ] **Step 2: Write the test file**

```ts
// src/__tests__/featured-api.test.ts
import { describe, it, expect } from "vitest";
import { featureScore, pickFeaturedIndex } from "@/lib/featured-selection";

describe("featureScore", () => {
  it("scores with like_count * 3 + view_count", () => {
    expect(featureScore(10, 50)).toBe(80);
    expect(featureScore(0, 100)).toBe(100);
    expect(featureScore(5, 0)).toBe(15);
  });

  it("handles zero values", () => {
    expect(featureScore(0, 0)).toBe(0);
  });
});

describe("pickFeaturedIndex", () => {
  it("returns 0 for empty candidates", () => {
    expect(pickFeaturedIndex("2026-06-26", 0)).toBe(0);
  });

  it("returns 0 for single candidate", () => {
    expect(pickFeaturedIndex("2026-06-26", 1)).toBe(0);
  });

  it("returns a valid index within range", () => {
    const idx = pickFeaturedIndex("2026-06-26", 10);
    expect(idx).toBeGreaterThanOrEqual(0);
    expect(idx).toBeLessThan(10);
  });

  it("is deterministic — same date always returns same index", () => {
    const a = pickFeaturedIndex("2026-06-26", 10);
    const b = pickFeaturedIndex("2026-06-26", 10);
    expect(a).toBe(b);
  });

  it("different dates produce different selections (at least some)", () => {
    const results = new Set<number>();
    for (let d = 1; d <= 30; d++) {
      const date = `2026-06-${String(d).padStart(2, "0")}`;
      results.add(pickFeaturedIndex(date, 10));
    }
    // With 30 days and 10 slots, we expect at least 3 distinct values
    expect(results.size).toBeGreaterThanOrEqual(3);
  });
});
```

- [ ] **Step 3: Run the tests to verify they pass**

Run: `cd /home/kagura/.openclaw/workspace/lottie-studio && npx vitest run src/__tests__/featured-api.test.ts`
Expected: All tests PASS

- [ ] **Step 4: Commit**

```bash
git add src/lib/featured-selection.ts src/__tests__/featured-api.test.ts
git commit -m "feat(featured): add pure scoring/selection functions with tests"
```

---

### Task 2: API route GET /api/animations/featured

**Files:**
- Create: `src/app/api/animations/featured/route.ts`

- [ ] **Step 1: Create the featured API route**

```ts
// src/app/api/animations/featured/route.ts
import { db } from "@/lib/db";
import { featureScore, pickFeaturedIndex } from "@/lib/featured-selection";

export const dynamic = "force-dynamic";

export async function GET() {
  // Query public animations with engagement
  const rows = db
    .prepare(
      `SELECT id, name, description, created_at, frame_count, tags,
              COALESCE(view_count, 0) as view_count,
              COALESCE(like_count, 0) as like_count
       FROM animations
       WHERE share_chat = 1
         AND (COALESCE(view_count, 0) > 0 OR COALESCE(like_count, 0) > 0)
       ORDER BY (COALESCE(like_count, 0) * 3 + COALESCE(view_count, 0)) DESC
       LIMIT 10`
    )
    .all() as {
    id: string;
    name: string;
    description: string | null;
    created_at: string;
    frame_count: number | null;
    tags: string | null;
    view_count: number;
    like_count: number;
  }[];

  if (rows.length === 0) {
    return new Response(null, { status: 204 });
  }

  // Deterministically pick one based on today's date
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const idx = pickFeaturedIndex(today, rows.length);
  const featured = rows[idx];

  return Response.json(featured);
}
```

- [ ] **Step 2: Verify the route works**

Run: `cd /home/kagura/.openclaw/workspace/lottie-studio && npx next build 2>&1 | tail -20` (or start dev server and curl)
Expected: No TypeScript/build errors for the new route

- [ ] **Step 3: Commit**

```bash
git add src/app/api/animations/featured/route.ts
git commit -m "feat(featured): add GET /api/animations/featured endpoint"
```

---

### Task 3: i18n keys

**Files:**
- Modify: `messages/en.json` (add keys to `explore` section)
- Modify: `messages/zh.json` (add keys to `explore` section)

- [ ] **Step 1: Add English keys**

Add to the `explore` object in `messages/en.json`:
```json
"featured": "Featured",
"featuredView": "View",
"featuredRemix": "Remix"
```

- [ ] **Step 2: Add Chinese keys**

Add to the `explore` object in `messages/zh.json`:
```json
"featured": "今日推荐",
"featuredView": "查看",
"featuredRemix": "混音"
```

- [ ] **Step 3: Commit**

```bash
git add messages/en.json messages/zh.json
git commit -m "feat(featured): add i18n keys for featured spotlight"
```

---

### Task 4: FeaturedSpotlight component

**Files:**
- Create: `src/components/FeaturedSpotlight.tsx`

- [ ] **Step 1: Create the component**

```tsx
// src/components/FeaturedSpotlight.tsx
"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import lottie, { AnimationItem } from "lottie-web";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

interface FeaturedAnimation {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  frame_count: number | null;
  tags: string | null;
  view_count: number;
  like_count: number;
}

export default function FeaturedSpotlight() {
  const t = useTranslations();
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<AnimationItem | null>(null);
  const [featured, setFeatured] = useState<FeaturedAnimation | null>(null);
  const [loading, setLoading] = useState(true);
  const [remixing, setRemixing] = useState(false);

  // Fetch featured animation
  useEffect(() => {
    let cancelled = false;
    fetch("/api/animations/featured")
      .then((res) => {
        if (res.status === 204 || !res.ok) return null;
        return res.json();
      })
      .then((data) => {
        if (!cancelled && data) setFeatured(data);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  // Load Lottie preview once we have the featured animation
  useEffect(() => {
    if (!featured || !containerRef.current) return;
    let cancelled = false;

    fetch(`/api/animations/${featured.id}`)
      .then((res) => res.json())
      .then((json) => {
        if (cancelled || !containerRef.current || !json.data) return;
        animRef.current = lottie.loadAnimation({
          container: containerRef.current,
          renderer: "svg",
          loop: true,
          autoplay: true,
          animationData: json.data,
        });
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      if (animRef.current) {
        animRef.current.destroy();
        animRef.current = null;
      }
    };
  }, [featured]);

  const handleRemix = useCallback(async () => {
    if (!featured || remixing) return;
    setRemixing(true);
    try {
      const res = await fetch(`/api/animations/${featured.id}/remix`, { method: "POST" });
      if (!res.ok) throw new Error("Remix failed");
      const data = await res.json();
      router.push(`/editor/${data.id}`);
    } catch {
      setRemixing(false);
    }
  }, [featured, remixing, router]);

  // Loading skeleton
  if (loading) {
    return (
      <div className="mb-8 rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden animate-pulse">
        <div className="flex flex-col md:flex-row">
          <div className="w-full md:w-80 h-64 md:h-auto bg-zinc-800" />
          <div className="flex-1 p-6">
            <div className="h-4 w-20 bg-zinc-800 rounded mb-3" />
            <div className="h-6 w-48 bg-zinc-800 rounded mb-2" />
            <div className="h-4 w-full bg-zinc-800 rounded mb-4" />
            <div className="flex gap-3">
              <div className="h-9 w-20 bg-zinc-800 rounded" />
              <div className="h-9 w-20 bg-zinc-800 rounded" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // No featured animation — render nothing
  if (!featured) return null;

  return (
    <div className="mb-8 rounded-xl border border-indigo-500/30 bg-zinc-900 overflow-hidden shadow-lg shadow-indigo-500/5">
      {/* Gradient top border accent */}
      <div className="h-0.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />
      <div className="flex flex-col md:flex-row">
        {/* Lottie preview */}
        <div
          ref={containerRef}
          className="w-full md:w-80 h-64 md:h-auto bg-zinc-950 flex items-center justify-center p-4"
          style={{
            backgroundImage:
              "linear-gradient(45deg, #18181b 25%, transparent 25%), linear-gradient(-45deg, #18181b 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #18181b 75%), linear-gradient(-45deg, transparent 75%, #18181b 75%)",
            backgroundSize: "16px 16px",
            backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0px",
          }}
        />
        {/* Details */}
        <div className="flex-1 p-6 flex flex-col justify-center">
          <span className="inline-block text-xs font-semibold uppercase tracking-wider text-indigo-400 mb-2">
            {t("explore.featured")}
          </span>
          <h2 className="text-lg font-semibold text-zinc-100 mb-1 truncate">
            {featured.name}
          </h2>
          {featured.description && (
            <p className="text-sm text-zinc-400 mb-4 line-clamp-2">
              {featured.description}
            </p>
          )}
          {/* Stats */}
          <div className="flex items-center gap-4 text-xs text-zinc-500 mb-4">
            {featured.view_count > 0 && (
              <span>{t("explore.views", { count: String(featured.view_count) })}</span>
            )}
            {featured.like_count > 0 && (
              <span>{t("explore.likes", { count: String(featured.like_count) })}</span>
            )}
          </div>
          {/* Actions */}
          <div className="flex gap-3">
            <Link
              href={`/share/${featured.id}`}
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors"
            >
              {t("explore.featuredView")}
            </Link>
            <button
              onClick={handleRemix}
              disabled={remixing}
              className="px-4 py-2 rounded-lg border border-zinc-700 text-zinc-300 text-sm font-medium hover:bg-zinc-800 transition-colors disabled:opacity-50"
            >
              {remixing ? t("explore.remixing") : t("explore.featuredRemix")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/FeaturedSpotlight.tsx
git commit -m "feat(featured): add FeaturedSpotlight component with live Lottie preview"
```

---

### Task 5: Integrate into ExplorePage

**Files:**
- Modify: `src/components/ExplorePage.tsx`

- [ ] **Step 1: Add import at top of file (after other imports)**

Add after the `useFavorites` import:
```ts
import FeaturedSpotlight from "@/components/FeaturedSpotlight";
```

- [ ] **Step 2: Render FeaturedSpotlight above the grid**

Insert immediately before the `{/* Total count */}` comment (around line 360), after the tag filter chips section:

```tsx
{/* Featured Spotlight — only when not searching/filtering */}
{!searchQuery && !activeTag && <FeaturedSpotlight />}
```

- [ ] **Step 3: Verify build passes**

Run: `cd /home/kagura/.openclaw/workspace/lottie-studio && npx next build 2>&1 | tail -20`
Expected: Build succeeds with no errors

- [ ] **Step 4: Run all tests**

Run: `cd /home/kagura/.openclaw/workspace/lottie-studio && npx vitest run`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add src/components/ExplorePage.tsx
git commit -m "feat(featured): integrate spotlight into explore page"
```
