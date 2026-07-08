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
- 732K — lottie-web + codemirror bundle (statically imported by editor)
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

### 3. Server-Only Packages
Added `serverExternalPackages` to `next.config.ts` for packages that should never appear in client bundles:
- `puppeteer-core` — used only in `thumbnail-renderer.ts` (server API route)
- `canvas` — used only in `thumbnail/route.ts` (server API route)
- `archiver` — used in collection export API routes
- `better-sqlite3` — database driver (server-only)

### 4. Tree-Shaking
- Added `"sideEffects": false` to `package.json` to enable aggressive tree-shaking.
- Verified lodash is already using specific imports (`lodash/has`, `lodash/set`) in a server-only API route — no client bundle impact.

## After Optimization

| Metric | Value |
|---|---|
| `.next/` directory | 109 MB |
| Total client JS | 2,430 KB |
| Largest chunk | 384 KB |
| Client JS chunks | 40 |

Top 5 chunks (after):
- 384K — split from the former 732K monolith
- 352K — lottie-web (now a separate lazy chunk)
- 300K — shared framework/page chunk (unchanged)
- 228K — shared framework/page chunk (unchanged)
- 176K — component chunk (unchanged)

## Impact Summary

| Metric | Before | After | Change |
|---|---|---|---|
| `.next/` size | 111 MB | 109 MB | -2 MB (-1.8%) |
| Total client JS | 2,560 KB | 2,430 KB | -130 KB (-5.1%) |
| Largest chunk | 732 KB | 384 KB | -348 KB (-47.5%) |
| Initial page load JS | ~732KB+ | ~384KB | Significantly reduced |

The most important win: the **initial page load** no longer includes CodeMirror or lottie-web for pages that don't immediately need them. The 732KB monolith chunk was split into lazy-loaded pieces, cutting the largest chunk nearly in half.

## Recommendations for Future Work

1. **Lazy-load lottie-web in remaining components**: `LottiePreview`, `AnimationCard`, `ExploreCard`, `TemplateCard`, etc. still import lottie-web statically. These are used on the gallery/explore pages and could benefit from dynamic imports, though they render above the fold.

2. **Consider lottie-light**: The full `lottie-web` renderer is ~300KB. If only SVG rendering is needed, `lottie-web/build/player/lottie_light` is significantly smaller (~150KB) and excludes expression support.

3. **Code-split the gallery page**: `GalleryPage` statically imports `QuickGenerate` which now lazy-loads its heavy deps, but the component itself could be dynamically imported since it's below the fold.

4. **Move `@types/lodash` to devDependencies**: Currently in `dependencies` but only needed at build time.

5. **Evaluate `codemirror` base package**: The `codemirror` package (line 29 in package.json) re-exports all codemirror sub-packages. Since `JsonEditor` already imports from specific `@codemirror/*` packages, the base `codemirror` package may be removable.
