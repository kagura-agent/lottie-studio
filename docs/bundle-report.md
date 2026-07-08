# Bundle Optimization Report

**Date:** 2026-07-08
**Issue:** #446
**Branch:** perf/bundle-optimization

## Baseline (Before Optimization)

| Metric | Value |
|---|---|
| `.next/` directory | 111 MB |
| Total client JS | 2,560 KB |
| Largest chunk | 732 KB |
| Client JS chunks | 38 |

Top 5 chunks (baseline):
- 732K — lottie-web + codemirror bundle (statically imported by editor and all preview components)
- 300K — shared framework/page chunk
- 228K — shared framework/page chunk
- 176K — component chunk
- 148K — component chunk

## Changes Made

### 1. Bundle Analyzer Setup
- Installed `@next/bundle-analyzer` as devDependency
- Configured in `next.config.ts` — run `ANALYZE=true npm run build` to generate reports

### 2. Dynamic Imports for Heavy Editor Components
- **JsonEditor** (CodeMirror): Changed from static to `next/dynamic` with `ssr: false` in `EditorLayout.tsx`. CodeMirror's 7 packages (~300KB) are now lazy-loaded only when the JSON editor tab is opened.
- **captureThumbnail** (lottie-web): Changed from static import to `import()` in the `handleAnimationUpdated` callback. lottie-web is no longer pulled into the initial editor bundle.
- **QuickGenerate exporters**: Converted static imports of `gifExporter`, `videoExporter`, and `mp4Exporter` to `import()` — these are only loaded when the user clicks an export button.
- **QuickGenerate lottie-web**: Converted from static `import lottie from "lottie-web"` to dynamic `import("lottie-web")` inside the render effect.
- **CodeSnippets lottie-web**: Converted from static import to dynamic `import("lottie-web")` inside the CSS preview effect.

### 3. Dynamic lottie-web Across All Components
Created a shared dynamic loader (`src/lib/lottie.ts`) that caches the lottie-web module after first import. Converted all 14 remaining components from static `import lottie from "lottie-web"` to async `loadAnimation()` calls:

- **LottiePreview** — main editor preview canvas
- **AnimationCard** — gallery animation cards
- **ExploreCard** — explore page cards
- **InlineLottiePreview** — chat inline previews
- **RelatedAnimations** — related animations sidebar
- **VersionHistory** — version preview thumbnails
- **TemplateGallery** — template preview cards
- **FeaturedSpotlight** — featured animation spotlight
- **VariationGrid** — style variation previews
- **TemplateCard** — template starter cards
- **SequencePlayer** — animation sequence player
- **DocsPage** — API docs "Try it" panel
- **ProfilePage** — profile animation cards
- **EmbedPlayer** — embeddable animation player

All components preserve their cancellation/cleanup patterns with `cancelled` flags.

### 4. Server-Only Packages
Added `serverExternalPackages` to `next.config.ts` for packages that should never appear in client bundles:
- `puppeteer-core` — used only in `thumbnail-renderer.ts` (server API route)
- `canvas` — used only in `thumbnail/route.ts` (server API route)
- `archiver` — used in collection export API routes
- `better-sqlite3` — database driver (server-only)

### 5. Tree-Shaking & Dependency Cleanup
- Added `"sideEffects": false` to `package.json` to enable aggressive tree-shaking.
- Verified lodash uses specific imports (`lodash/has`, `lodash/set`) in a server-only API route — no client bundle impact.
- Removed unused `codemirror` base package — `JsonEditor` imports from specific `@codemirror/*` sub-packages directly.
- Moved `@types/lodash` from `dependencies` to `devDependencies`.

## After Optimization

| Metric | Value |
|---|---|
| `.next/` directory | 109 MB |
| Total client JS (incl. lazy) | 2,434 KB |
| Largest chunk | 384 KB |
| Client JS chunks | 40 |
| lottie-web chunk (lazy) | 300 KB |

Top 5 chunks (after):
- 384K — editor/page components (codemirror removed, lottie-web extracted)
- 352K — lazy-loaded module chunk
- 300K — lottie-web (lazy, loads on demand when animation renders)
- 228K — shared framework/page chunk (unchanged)
- 176K — component chunk (unchanged)

## Impact Summary

| Metric | Before | After | Change |
|---|---|---|---|
| `.next/` size | 111 MB | 109 MB | -2 MB (-1.8%) |
| Total client JS | 2,560 KB | 2,434 KB | -126 KB (-4.9%) |
| Largest chunk | 732 KB | 384 KB | -348 KB (-47.5%) |
| Initial page load JS | ~1,260 KB | ~912 KB | ~-348 KB (-27.6%) |

The critical win: **initial page load no longer includes lottie-web (300KB) or CodeMirror**. The 732KB monolith chunk was split into lazy-loaded pieces, cutting the largest chunk nearly in half and reducing initial page load by ~28%.

lottie-web is now a single 300KB lazy chunk that loads on demand when a component first renders an animation. Pages like the landing page, explore page (before hover), and docs page load without any lottie-web JS.
