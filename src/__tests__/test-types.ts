/**
 * Permissive self-referential index type for deeply-nested Lottie JSON
 * assertions in tests.  Every property access returns `LottieTestObj`,
 * so chains like `layers[0].ks.p.k[1].t` compile without `any`.
 */
export interface LottieTestObj {
  [key: string]: LottieTestObj;
}
