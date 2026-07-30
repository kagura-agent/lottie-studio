export const VALID_BLUR_MODES = ['in', 'out', 'pulse', 'static'] as const;
export type BlurMode = typeof VALID_BLUR_MODES[number];

export interface BlurCommandOptions {
  mode?: BlurMode;
  intensity?: number;
  duration?: number;
  layer?: string;
  from?: number;
  to?: number;
}

export interface LottieLayerWithEffects {
  nm?: string;
  ef?: object[];
  [key: string]: unknown;
}

interface AnimatedKeyframe {
  s: number[];
  e: number[];
  t: number;
  i: { x: number[]; y: number[] };
  o: { x: number[]; y: number[] };
}

function makeKeyframes(startFrame: number, endFrame: number, fromVal: number, toVal: number): AnimatedKeyframe[] {
  return [
    { s: [fromVal], e: [toVal], t: startFrame, i: { x: [0.42], y: [1] }, o: { x: [0.58], y: [0] } },
    { s: [toVal], e: [toVal], t: endFrame, i: { x: [0.42], y: [1] }, o: { x: [0.58], y: [0] } },
  ];
}

export function createBlurEffect(options: BlurCommandOptions, startFrame?: number, endFrame?: number): object {
  const mode = options.mode ?? 'in';
  const intensity = options.intensity ?? 10;
  const sf = startFrame ?? 0;
  const ef = endFrame ?? sf + 30;

  let blurriness: { a: number; k: number | AnimatedKeyframe[] };

  switch (mode) {
    case 'in':
      blurriness = { a: 1, k: makeKeyframes(sf, ef, intensity, 0) };
      break;
    case 'out':
      blurriness = { a: 1, k: makeKeyframes(sf, ef, 0, intensity) };
      break;
    case 'pulse': {
      const mid = Math.round((sf + ef) / 2);
      blurriness = {
        a: 1,
        k: [
          { s: [0], e: [intensity], t: sf, i: { x: [0.42], y: [1] }, o: { x: [0.58], y: [0] } },
          { s: [intensity], e: [0], t: mid, i: { x: [0.42], y: [1] }, o: { x: [0.58], y: [0] } },
          { s: [0], e: [0], t: ef, i: { x: [0.42], y: [1] }, o: { x: [0.58], y: [0] } },
        ],
      };
      break;
    }
    case 'static':
      blurriness = { a: 0, k: intensity };
      break;
  }

  return {
    ty: 29,
    nm: 'Gaussian Blur',
    ef: [
      { ty: 0, nm: 'Blurriness', v: blurriness },
      { ty: 7, nm: 'Blur Dimensions', v: { a: 0, k: 1 } },
      { ty: 7, nm: 'Repeat Edge Pixels', v: { a: 0, k: 1 } },
    ],
  };
}

export function applyBlurToLayers(
  layers: LottieLayerWithEffects[],
  options: BlurCommandOptions,
  startFrame?: number,
  endFrame?: number
): string[] {
  const modifiedLayers: string[] = [];

  for (const layer of layers) {
    if (options.layer && layer.nm !== options.layer) continue;

    const effect = createBlurEffect(options, startFrame, endFrame);

    if (!layer.ef) {
      layer.ef = [];
    }
    layer.ef.push(effect);

    const name = layer.nm || 'unnamed';
    if (!modifiedLayers.includes(name)) {
      modifiedLayers.push(name);
    }
  }

  return modifiedLayers;
}
