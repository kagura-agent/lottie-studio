/**
 * Pure functions for the featured animation spotlight selection algorithm.
 */

/**
 * Score an animation for featuring.
 * like_count * 3 + view_count
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
