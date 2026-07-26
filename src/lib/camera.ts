export const VALID_CAMERA_MOVEMENTS = [
  "zoom-in",
  "zoom-out",
  "pan-left",
  "pan-right",
  "pan-up",
  "pan-down",
  "shake",
  "ken-burns",
] as const;

export type CameraMovement = (typeof VALID_CAMERA_MOVEMENTS)[number];

export interface CameraOptions {
  duration?: number;
  easing?: string;
  intensity?: number; // 0.1-2.0, default 1.0
  from?: number;
  to?: number;
  point?: [number, number];
}

interface BezierHandle {
  x: number[];
  y: number[];
}

interface EasingCurve {
  o: BezierHandle;
  i: BezierHandle;
}

const EASING_CURVES: Record<string, EasingCurve> = {
  linear: { o: { x: [0], y: [0] }, i: { x: [1], y: [1] } },
  "ease-in": { o: { x: [0.42], y: [0] }, i: { x: [1], y: [1] } },
  "ease-out": { o: { x: [0], y: [0] }, i: { x: [0.58], y: [1] } },
  "ease-in-out": { o: { x: [0.42], y: [0] }, i: { x: [0.58], y: [1] } },
  bounce: { o: { x: [0.34], y: [1.56] }, i: { x: [0.64], y: [1] } },
  elastic: { o: { x: [0.68], y: [-0.55] }, i: { x: [0.27], y: [1.55] } },
  spring: { o: { x: [0.43], y: [0.33] }, i: { x: [0.23], y: [1] } },
  sharp: { o: { x: [0.4], y: [0] }, i: { x: [0.6], y: [1] } },
};

/**
 * Deterministic pseudo-random number generator (mulberry32).
 * Used for shake effect to avoid Math.random().
 */
function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildScaleKeyframes(
  startFrame: number,
  endFrame: number,
  fromScale: [number, number],
  toScale: [number, number],
  curve: EasingCurve
): unknown[] {
  return [
    { t: startFrame, s: [fromScale[0], fromScale[1], 100], o: curve.o, i: curve.i },
    { t: endFrame, s: [toScale[0], toScale[1], 100] },
  ];
}

function buildPositionKeyframes(
  startFrame: number,
  endFrame: number,
  fromPos: [number, number],
  toPos: [number, number],
  curve: EasingCurve
): unknown[] {
  return [
    { t: startFrame, s: [fromPos[0], fromPos[1], 0], o: curve.o, i: curve.i },
    { t: endFrame, s: [toPos[0], toPos[1], 0] },
  ];
}

function buildShakeKeyframes(
  startFrame: number,
  endFrame: number,
  intensity: number,
  seed: number
): unknown[] {
  const rng = mulberry32(seed);
  const totalFrames = endFrame - startFrame;
  const steps = Math.max(8, Math.min(16, Math.round(totalFrames / 2)));
  const framesPerStep = totalFrames / steps;
  const amplitude = 8 * intensity;

  const linearCurve: EasingCurve = { o: { x: [0], y: [0] }, i: { x: [1], y: [1] } };
  const keyframes: unknown[] = [];

  for (let i = 0; i <= steps; i++) {
    const frame = Math.round(startFrame + i * framesPerStep);
    // First and last keyframes return to center
    const isEdge = i === 0 || i === steps;
    const offsetX = isEdge ? 0 : (rng() - 0.5) * 2 * amplitude;
    const offsetY = isEdge ? 0 : (rng() - 0.5) * 2 * amplitude;

    if (i < steps) {
      keyframes.push({
        t: frame,
        s: [offsetX, offsetY, 0],
        o: linearCurve.o,
        i: linearCurve.i,
      });
    } else {
      keyframes.push({ t: frame, s: [offsetX, offsetY, 0] });
    }
  }

  return keyframes;
}

function buildKenBurnsKeyframes(
  startFrame: number,
  endFrame: number,
  intensity: number,
  curve: EasingCurve
): { scale: unknown[]; position: unknown[] } {
  const scaleEnd = 100 + 15 * intensity;
  const driftX = 20 * intensity;
  const driftY = 10 * intensity;

  const scale = [
    { t: startFrame, s: [100, 100, 100], o: curve.o, i: curve.i },
    { t: endFrame, s: [scaleEnd, scaleEnd, 100] },
  ];

  const position = [
    { t: startFrame, s: [0, 0, 0], o: curve.o, i: curve.i },
    { t: endFrame, s: [-driftX, -driftY, 0] },
  ];

  return { scale, position };
}

export function applyCamera(
  animationJson: object,
  movement: CameraMovement,
  options: CameraOptions
): object {
  const result = JSON.parse(JSON.stringify(animationJson)) as Record<string, unknown>;
  const fr = (result.fr as number) || 30;
  const ip = (result.ip as number) || 0;
  const op = (result.op as number) || 60;
  const w = (result.w as number) || 512;
  const h = (result.h as number) || 512;

  const intensity = Math.max(0.1, Math.min(2.0, options.intensity ?? 1.0));
  const duration = options.duration ?? ((op - ip) / fr); // default: full animation
  const easing = options.easing ?? "ease-in-out";
  const curve = EASING_CURVES[easing] || EASING_CURVES["ease-in-out"];

  const durationFrames = Math.round(duration * fr);
  const startFrame = options.from ?? ip;
  const endFrame = options.to ?? Math.min(startFrame + durationFrames, op);

  const anchorX = options.point ? options.point[0] : w / 2;
  const anchorY = options.point ? options.point[1] : h / 2;

  const layers = result.layers as Array<Record<string, unknown>> | undefined;
  if (!layers || !Array.isArray(layers)) {
    result.layers = [];
  }

  const existingLayers = (result.layers as Array<Record<string, unknown>>);

  // Shift all existing layer indices up by 1
  for (const layer of existingLayers) {
    if (typeof layer.ind === "number") {
      layer.ind = (layer.ind as number) + 1;
    }
    // Update parent references to account for shifted indices
    if (typeof layer.parent === "number") {
      layer.parent = (layer.parent as number) + 1;
    }
  }

  // Set parent of all top-level layers (those without existing parent) to wrapper's index (0)
  for (const layer of existingLayers) {
    if (layer.parent === undefined || layer.parent === null) {
      layer.parent = 0;
    }
  }

  // Build wrapper null layer transform
  const wrapperTransform: Record<string, unknown> = {
    a: { a: 0, k: [anchorX, anchorY, 0] }, // anchor point at center
    p: { a: 0, k: [anchorX, anchorY, 0] }, // position at anchor (so it doesn't offset)
    s: { a: 0, k: [100, 100, 100] },
    r: { a: 0, k: 0 },
    o: { a: 0, k: 100 },
  };

  // Apply movement-specific keyframes
  switch (movement) {
    case "zoom-in": {
      const fromScale: [number, number] = [100, 100];
      const toScale: [number, number] = [100 + 30 * intensity, 100 + 30 * intensity];
      wrapperTransform.s = {
        a: 1,
        k: buildScaleKeyframes(startFrame, endFrame, fromScale, toScale, curve),
      };
      break;
    }
    case "zoom-out": {
      const fromScale: [number, number] = [100 + 30 * intensity, 100 + 30 * intensity];
      const toScale: [number, number] = [100, 100];
      wrapperTransform.s = {
        a: 1,
        k: buildScaleKeyframes(startFrame, endFrame, fromScale, toScale, curve),
      };
      break;
    }
    case "pan-left": {
      const fromPos: [number, number] = [0, 0];
      const toPos: [number, number] = [-100 * intensity, 0];
      wrapperTransform.p = {
        a: 1,
        k: buildPositionKeyframes(startFrame, endFrame, fromPos, toPos, curve),
      };
      break;
    }
    case "pan-right": {
      const fromPos: [number, number] = [0, 0];
      const toPos: [number, number] = [100 * intensity, 0];
      wrapperTransform.p = {
        a: 1,
        k: buildPositionKeyframes(startFrame, endFrame, fromPos, toPos, curve),
      };
      break;
    }
    case "pan-up": {
      const fromPos: [number, number] = [0, 0];
      const toPos: [number, number] = [0, -80 * intensity];
      wrapperTransform.p = {
        a: 1,
        k: buildPositionKeyframes(startFrame, endFrame, fromPos, toPos, curve),
      };
      break;
    }
    case "pan-down": {
      const fromPos: [number, number] = [0, 0];
      const toPos: [number, number] = [0, 80 * intensity];
      wrapperTransform.p = {
        a: 1,
        k: buildPositionKeyframes(startFrame, endFrame, fromPos, toPos, curve),
      };
      break;
    }
    case "shake": {
      // Use layer count as deterministic seed
      const seed = existingLayers.length * 7919 + (op - ip);
      wrapperTransform.p = {
        a: 1,
        k: buildShakeKeyframes(startFrame, endFrame, intensity, seed),
      };
      break;
    }
    case "ken-burns": {
      const kb = buildKenBurnsKeyframes(startFrame, endFrame, intensity, curve);
      wrapperTransform.s = { a: 1, k: kb.scale };
      wrapperTransform.p = { a: 1, k: kb.position };
      break;
    }
  }

  // For pan movements, keep position at anchor point base
  if (movement.startsWith("pan-")) {
    // Position keyframes are offsets from anchor — adjust to be relative to center
    const posData = wrapperTransform.p as Record<string, unknown>;
    if (posData.a === 1) {
      const keyframes = posData.k as Array<Record<string, unknown>>;
      for (const kf of keyframes) {
        const s = kf.s as number[];
        if (s) {
          s[0] = anchorX + s[0];
          s[1] = anchorY + s[1];
        }
      }
    }
  }

  // For shake, also offset from anchor
  if (movement === "shake") {
    const posData = wrapperTransform.p as Record<string, unknown>;
    if (posData.a === 1) {
      const keyframes = posData.k as Array<Record<string, unknown>>;
      for (const kf of keyframes) {
        const s = kf.s as number[];
        if (s) {
          s[0] = anchorX + s[0];
          s[1] = anchorY + s[1];
        }
      }
    }
  }

  // For ken-burns, offset position from anchor
  if (movement === "ken-burns") {
    const posData = wrapperTransform.p as Record<string, unknown>;
    if (posData.a === 1) {
      const keyframes = posData.k as Array<Record<string, unknown>>;
      for (const kf of keyframes) {
        const s = kf.s as number[];
        if (s) {
          s[0] = anchorX + s[0];
          s[1] = anchorY + s[1];
        }
      }
    }
  }

  // Create the null wrapper layer
  const wrapperLayer: Record<string, unknown> = {
    ty: 3, // null layer
    nm: "Camera Wrapper",
    ind: 0,
    ip: ip,
    op: op,
    st: 0,
    sr: 1,
    ks: wrapperTransform,
  };

  // Insert wrapper at the beginning of the layers array
  existingLayers.unshift(wrapperLayer);

  return result;
}
