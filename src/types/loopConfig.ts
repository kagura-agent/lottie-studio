export type LoopMode = 'loop' | 'once' | 'bounce' | 'count';

export interface LoopConfig {
  mode: LoopMode;
  count?: number; // only used when mode === 'count'
}
