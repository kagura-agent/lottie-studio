export const VALID_PATH_SHAPES = [
  "circle",
  "wave",
  "spiral",
  "figure-8",
  "arc",
  "zigzag",
  "pendulum",
  "custom",
] as const;

export type PathShape = (typeof VALID_PATH_SHAPES)[number];

export interface PathMotionOptions {
  duration?: number;
  easing?: string;
  loops?: number;
  radius?: number;
  amplitude?: number;
  frequency?: number;
  clockwise?: boolean;
  layer?: string | number;
  from?: number;
  to?: number;
  center?: [number, number];
  orient?: boolean;
  svgPath?: string;
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

interface PositionKeyframe {
  t: number;
  s: number[];
  ti?: number[];
  to?: number[];
  o?: BezierHandle;
  i?: BezierHandle;
}

interface RotationKeyframe {
  t: number;
  s: number[];
  o?: BezierHandle;
  i?: BezierHandle;
}

const KAPPA = 0.5522847498;

function generateCircleKeyframes(
  startFrame: number,
  endFrame: number,
  cx: number,
  cy: number,
  radius: number,
  clockwise: boolean,
  curve: EasingCurve
): PositionKeyframe[] {
  const dir = clockwise ? 1 : -1;
  const k = KAPPA * radius;
  const points: [number, number][] = [
    [cx + radius, cy],
    [cx, cy + dir * radius],
    [cx - radius, cy],
    [cx, cy - dir * radius],
  ];
  const tangentsOut: [number, number][] = [
    [0, dir * k],
    [-k, 0],
    [0, -dir * k],
    [k, 0],
  ];
  const tangentsIn: [number, number][] = [
    [k, 0],
    [0, dir * k],
    [-k, 0],
    [0, -dir * k],
  ];

  const totalFrames = endFrame - startFrame;
  const keyframes: PositionKeyframe[] = [];

  for (let i = 0; i < 4; i++) {
    const t = startFrame + Math.round((i / 4) * totalFrames);
    const kf: PositionKeyframe = {
      t,
      s: [points[i][0], points[i][1], 0],
      to: [tangentsOut[i][0] / 3, tangentsOut[i][1] / 3, 0],
      ti: [-tangentsIn[(i + 1) % 4][0] / 3, -tangentsIn[(i + 1) % 4][1] / 3, 0],
      o: curve.o,
      i: curve.i,
    };
    keyframes.push(kf);
  }

  keyframes.push({ t: endFrame, s: [points[0][0], points[0][1], 0] });
  return keyframes;
}

function generateWaveKeyframes(
  startFrame: number,
  endFrame: number,
  cx: number,
  cy: number,
  amplitude: number,
  frequency: number,
  radius: number,
  curve: EasingCurve
): PositionKeyframe[] {
  const totalFrames = endFrame - startFrame;
  const numPoints = frequency * 4 + 1;
  const keyframes: PositionKeyframe[] = [];
  const xSpan = radius * 2;

  for (let i = 0; i < numPoints; i++) {
    const frac = i / (numPoints - 1);
    const t = startFrame + Math.round(frac * totalFrames);
    const x = cx - radius + frac * xSpan;
    const y = cy + Math.sin(frac * frequency * 2 * Math.PI) * amplitude;

    const tangentScale = xSpan / (numPoints - 1) / 3;
    const dydt = Math.cos(frac * frequency * 2 * Math.PI) * amplitude * frequency * 2 * Math.PI / (numPoints - 1);

    const kf: PositionKeyframe = {
      t,
      s: [x, y, 0],
    };

    if (i < numPoints - 1) {
      kf.to = [tangentScale, dydt / 3, 0];
      kf.ti = [-tangentScale, -dydt / 3, 0];
      kf.o = curve.o;
      kf.i = curve.i;
    }

    keyframes.push(kf);
  }

  return keyframes;
}

function generateSpiralKeyframes(
  startFrame: number,
  endFrame: number,
  cx: number,
  cy: number,
  radius: number,
  clockwise: boolean,
  frequency: number,
  curve: EasingCurve
): PositionKeyframe[] {
  const totalFrames = endFrame - startFrame;
  const totalRotations = frequency;
  const numPoints = totalRotations * 8 + 1;
  const dir = clockwise ? 1 : -1;
  const keyframes: PositionKeyframe[] = [];

  for (let i = 0; i < numPoints; i++) {
    const frac = i / (numPoints - 1);
    const angle = frac * totalRotations * 2 * Math.PI * dir;
    const r = radius * frac;
    const t = startFrame + Math.round(frac * totalFrames);
    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * r;

    const kf: PositionKeyframe = { t, s: [x, y, 0] };

    if (i < numPoints - 1) {
      const nextFrac = (i + 1) / (numPoints - 1);
      const nextAngle = nextFrac * totalRotations * 2 * Math.PI * dir;
      const nextR = radius * nextFrac;
      const nx = cx + Math.cos(nextAngle) * nextR;
      const ny = cy + Math.sin(nextAngle) * nextR;
      kf.to = [(nx - x) / 3, (ny - y) / 3, 0];
      kf.ti = [-(nx - x) / 3, -(ny - y) / 3, 0];
      kf.o = curve.o;
      kf.i = curve.i;
    }

    keyframes.push(kf);
  }

  return keyframes;
}

function generateFigure8Keyframes(
  startFrame: number,
  endFrame: number,
  cx: number,
  cy: number,
  radius: number,
  clockwise: boolean,
  curve: EasingCurve
): PositionKeyframe[] {
  const totalFrames = endFrame - startFrame;
  const numPoints = 16;
  const dir = clockwise ? 1 : -1;
  const keyframes: PositionKeyframe[] = [];

  for (let i = 0; i <= numPoints; i++) {
    const frac = i / numPoints;
    const t = startFrame + Math.round(frac * totalFrames);
    const angle = frac * 2 * Math.PI * dir;
    const x = cx + radius * Math.sin(angle);
    const y = cy + (radius / 2) * Math.sin(2 * angle);

    const kf: PositionKeyframe = { t, s: [x, y, 0] };

    if (i < numPoints) {
      const nextFrac = (i + 1) / numPoints;
      const nextAngle = nextFrac * 2 * Math.PI * dir;
      const nx = cx + radius * Math.sin(nextAngle);
      const ny = cy + (radius / 2) * Math.sin(2 * nextAngle);
      kf.to = [(nx - x) / 3, (ny - y) / 3, 0];
      kf.ti = [-(nx - x) / 3, -(ny - y) / 3, 0];
      kf.o = curve.o;
      kf.i = curve.i;
    }

    keyframes.push(kf);
  }

  return keyframes;
}

function generateArcKeyframes(
  startFrame: number,
  endFrame: number,
  cx: number,
  cy: number,
  radius: number,
  clockwise: boolean,
  curve: EasingCurve
): PositionKeyframe[] {
  const startAngle = -Math.PI / 2;
  const endAngle = clockwise ? Math.PI / 2 : -Math.PI * 1.5;
  const totalFrames = endFrame - startFrame;
  const numPoints = 8;
  const keyframes: PositionKeyframe[] = [];

  for (let i = 0; i <= numPoints; i++) {
    const frac = i / numPoints;
    const angle = startAngle + frac * (endAngle - startAngle);
    const t = startFrame + Math.round(frac * totalFrames);
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;

    const kf: PositionKeyframe = { t, s: [x, y, 0] };

    if (i < numPoints) {
      const nextFrac = (i + 1) / numPoints;
      const nextAngle = startAngle + nextFrac * (endAngle - startAngle);
      const nx = cx + Math.cos(nextAngle) * radius;
      const ny = cy + Math.sin(nextAngle) * radius;
      kf.to = [(nx - x) / 3, (ny - y) / 3, 0];
      kf.ti = [-(nx - x) / 3, -(ny - y) / 3, 0];
      kf.o = curve.o;
      kf.i = curve.i;
    }

    keyframes.push(kf);
  }

  return keyframes;
}

function generateZigzagKeyframes(
  startFrame: number,
  endFrame: number,
  cx: number,
  cy: number,
  amplitude: number,
  frequency: number,
  radius: number,
  curve: EasingCurve
): PositionKeyframe[] {
  const totalFrames = endFrame - startFrame;
  const numPoints = frequency * 2 + 1;
  const xSpan = radius * 2;
  const keyframes: PositionKeyframe[] = [];

  for (let i = 0; i < numPoints; i++) {
    const frac = i / (numPoints - 1);
    const t = startFrame + Math.round(frac * totalFrames);
    const x = cx - radius + frac * xSpan;
    const y = cy + (i % 2 === 0 ? -amplitude : amplitude);

    const kf: PositionKeyframe = { t, s: [x, y, 0] };

    if (i < numPoints - 1) {
      kf.to = [0, 0, 0];
      kf.ti = [0, 0, 0];
      kf.o = curve.o;
      kf.i = curve.i;
    }

    keyframes.push(kf);
  }

  return keyframes;
}

function generatePendulumKeyframes(
  startFrame: number,
  endFrame: number,
  cx: number,
  cy: number,
  radius: number,
  frequency: number,
  curve: EasingCurve
): PositionKeyframe[] {
  const totalFrames = endFrame - startFrame;
  const numPoints = frequency * 4 + 1;
  const keyframes: PositionKeyframe[] = [];
  const maxAngle = Math.PI / 3;

  for (let i = 0; i < numPoints; i++) {
    const frac = i / (numPoints - 1);
    const t = startFrame + Math.round(frac * totalFrames);
    const angle = Math.cos(frac * frequency * 2 * Math.PI) * maxAngle;
    const x = cx + Math.sin(angle) * radius;
    const y = cy - Math.cos(angle) * radius + radius;

    const kf: PositionKeyframe = { t, s: [x, y, 0] };

    if (i < numPoints - 1) {
      const nextFrac = (i + 1) / (numPoints - 1);
      const nextAngle = Math.cos(nextFrac * frequency * 2 * Math.PI) * maxAngle;
      const nx = cx + Math.sin(nextAngle) * radius;
      const ny = cy - Math.cos(nextAngle) * radius + radius;
      kf.to = [(nx - x) / 3, (ny - y) / 3, 0];
      kf.ti = [-(nx - x) / 3, -(ny - y) / 3, 0];
      kf.o = curve.o;
      kf.i = curve.i;
    }

    keyframes.push(kf);
  }

  return keyframes;
}

interface SvgPoint {
  x: number;
  y: number;
  cpOut?: { x: number; y: number };
  cpIn?: { x: number; y: number };
}

export function parseSvgPath(d: string): SvgPoint[] {
  const points: SvgPoint[] = [];
  const commands = d.match(/[MLCQZmlcqz][^MLCQZmlcqz]*/gi) || [];
  let curX = 0;
  let curY = 0;

  for (const segment of commands) {
    const cmd = segment[0];
    const nums = (segment.slice(1).match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
    const isRelative = cmd === cmd.toLowerCase();

    switch (cmd.toUpperCase()) {
      case "M": {
        curX = isRelative ? curX + nums[0] : nums[0];
        curY = isRelative ? curY + nums[1] : nums[1];
        points.push({ x: curX, y: curY });
        break;
      }
      case "L": {
        curX = isRelative ? curX + nums[0] : nums[0];
        curY = isRelative ? curY + nums[1] : nums[1];
        points.push({ x: curX, y: curY });
        break;
      }
      case "C": {
        const cp1x = isRelative ? curX + nums[0] : nums[0];
        const cp1y = isRelative ? curY + nums[1] : nums[1];
        const cp2x = isRelative ? curX + nums[2] : nums[2];
        const cp2y = isRelative ? curY + nums[3] : nums[3];
        const ex = isRelative ? curX + nums[4] : nums[4];
        const ey = isRelative ? curY + nums[5] : nums[5];

        if (points.length > 0) {
          points[points.length - 1].cpOut = { x: cp1x - curX, y: cp1y - curY };
        }

        curX = ex;
        curY = ey;
        points.push({ x: curX, y: curY, cpIn: { x: cp2x - ex, y: cp2y - ey } });
        break;
      }
      case "Q": {
        const qcpx = isRelative ? curX + nums[0] : nums[0];
        const qcpy = isRelative ? curY + nums[1] : nums[1];
        const qex = isRelative ? curX + nums[2] : nums[2];
        const qey = isRelative ? curY + nums[3] : nums[3];

        const cp1xQ = curX + (2 / 3) * (qcpx - curX);
        const cp1yQ = curY + (2 / 3) * (qcpy - curY);
        const cp2xQ = qex + (2 / 3) * (qcpx - qex);
        const cp2yQ = qey + (2 / 3) * (qcpy - qey);

        if (points.length > 0) {
          points[points.length - 1].cpOut = { x: cp1xQ - curX, y: cp1yQ - curY };
        }

        curX = qex;
        curY = qey;
        points.push({ x: curX, y: curY, cpIn: { x: cp2xQ - qex, y: cp2yQ - qey } });
        break;
      }
      case "Z": {
        if (points.length > 0) {
          curX = points[0].x;
          curY = points[0].y;
        }
        break;
      }
    }
  }

  return points;
}

function generateCustomKeyframes(
  startFrame: number,
  endFrame: number,
  svgPath: string,
  cx: number,
  cy: number,
  curve: EasingCurve
): PositionKeyframe[] {
  const points = parseSvgPath(svgPath);
  if (points.length < 2) return [{ t: startFrame, s: [cx, cy, 0] }];

  const totalFrames = endFrame - startFrame;
  const keyframes: PositionKeyframe[] = [];

  for (let i = 0; i < points.length; i++) {
    const frac = i / (points.length - 1);
    const t = startFrame + Math.round(frac * totalFrames);
    const p = points[i];
    const kf: PositionKeyframe = { t, s: [p.x, p.y, 0] };

    if (i < points.length - 1) {
      const toX = p.cpOut ? p.cpOut.x / 3 : 0;
      const toY = p.cpOut ? p.cpOut.y / 3 : 0;
      const nextP = points[i + 1];
      const tiX = nextP.cpIn ? nextP.cpIn.x / 3 : 0;
      const tiY = nextP.cpIn ? nextP.cpIn.y / 3 : 0;
      kf.to = [toX, toY, 0];
      kf.ti = [tiX, tiY, 0];
      kf.o = curve.o;
      kf.i = curve.i;
    }

    keyframes.push(kf);
  }

  return keyframes;
}

function calculateRotationKeyframes(
  positionKeyframes: PositionKeyframe[],
  curve: EasingCurve
): RotationKeyframe[] {
  const rotKeyframes: RotationKeyframe[] = [];

  for (let i = 0; i < positionKeyframes.length; i++) {
    const kf = positionKeyframes[i];
    let angle = 0;

    if (i < positionKeyframes.length - 1) {
      const next = positionKeyframes[i + 1];
      const dx = next.s[0] - kf.s[0];
      const dy = next.s[1] - kf.s[1];
      angle = (Math.atan2(dy, dx) * 180) / Math.PI;
    } else if (i > 0) {
      const prev = positionKeyframes[i - 1];
      const dx = kf.s[0] - prev.s[0];
      const dy = kf.s[1] - prev.s[1];
      angle = (Math.atan2(dy, dx) * 180) / Math.PI;
    }

    const rkf: RotationKeyframe = { t: kf.t, s: [angle] };
    if (i < positionKeyframes.length - 1) {
      rkf.o = curve.o;
      rkf.i = curve.i;
    }
    rotKeyframes.push(rkf);
  }

  return rotKeyframes;
}

function applyLoops(
  keyframes: PositionKeyframe[],
  loops: number,
  startFrame: number,
  endFrame: number
): PositionKeyframe[] {
  if (loops <= 1) return keyframes;

  const totalFrames = endFrame - startFrame;
  const loopFrames = Math.round(totalFrames / loops);
  const result: PositionKeyframe[] = [];

  for (let loop = 0; loop < loops; loop++) {
    const loopStart = startFrame + loop * loopFrames;
    const loopEnd = loopStart + loopFrames;

    for (let i = 0; i < keyframes.length; i++) {
      const kf = keyframes[i];
      const origFrac = (kf.t - startFrame) / totalFrames;
      const newT = loopStart + Math.round(origFrac * (loopEnd - loopStart));

      if (loop > 0 && i === 0) continue;

      const newKf: PositionKeyframe = { ...kf, t: newT };
      result.push(newKf);
    }
  }

  return result;
}

function findLayerByNameOrIndex(
  layers: Array<Record<string, unknown>>,
  target: string | number
): Record<string, unknown> | null {
  if (typeof target === "number") {
    return layers.find((l) => l.ind === target) || null;
  }
  const lower = target.toLowerCase();
  return layers.find((l) => (l.nm as string || "").toLowerCase() === lower) || null;
}

export function applyPathMotion(
  animationJson: object,
  shape: PathShape,
  options: PathMotionOptions
): object {
  const result = JSON.parse(JSON.stringify(animationJson)) as Record<string, unknown>;
  const fr = (result.fr as number) || 30;
  const ip = (result.ip as number) || 0;
  const op = (result.op as number) || 60;
  const w = (result.w as number) || 512;
  const h = (result.h as number) || 512;

  const duration = options.duration ?? (op - ip) / fr;
  const easing = options.easing ?? "linear";
  const curve = EASING_CURVES[easing] || EASING_CURVES["linear"];
  const loops = options.loops ?? 1;
  const radius = options.radius ?? Math.min(w, h) * 0.25;
  const amplitude = options.amplitude ?? 50;
  const frequency = options.frequency ?? 3;
  const clockwise = options.clockwise ?? true;
  const cx = options.center ? options.center[0] : w / 2;
  const cy = options.center ? options.center[1] : h / 2;

  const durationFrames = Math.round(duration * fr);
  const startFrame = options.from ?? ip;
  const endFrame = options.to ?? Math.min(startFrame + durationFrames, op);

  let keyframes: PositionKeyframe[];

  switch (shape) {
    case "circle":
      keyframes = generateCircleKeyframes(startFrame, endFrame, cx, cy, radius, clockwise, curve);
      break;
    case "wave":
      keyframes = generateWaveKeyframes(startFrame, endFrame, cx, cy, amplitude, frequency, radius, curve);
      break;
    case "spiral":
      keyframes = generateSpiralKeyframes(startFrame, endFrame, cx, cy, radius, clockwise, frequency, curve);
      break;
    case "figure-8":
      keyframes = generateFigure8Keyframes(startFrame, endFrame, cx, cy, radius, clockwise, curve);
      break;
    case "arc":
      keyframes = generateArcKeyframes(startFrame, endFrame, cx, cy, radius, clockwise, curve);
      break;
    case "zigzag":
      keyframes = generateZigzagKeyframes(startFrame, endFrame, cx, cy, amplitude, frequency, radius, curve);
      break;
    case "pendulum":
      keyframes = generatePendulumKeyframes(startFrame, endFrame, cx, cy, radius, frequency, curve);
      break;
    case "custom":
      keyframes = generateCustomKeyframes(startFrame, endFrame, options.svgPath || "M0,0 L100,100", cx, cy, curve);
      break;
    default:
      keyframes = [{ t: startFrame, s: [cx, cy, 0] }];
  }

  if (loops > 1) {
    keyframes = applyLoops(keyframes, loops, startFrame, endFrame);
  }

  const layers = result.layers as Array<Record<string, unknown>> | undefined;
  if (!layers || !Array.isArray(layers)) {
    result.layers = [];
  }

  const existingLayers = result.layers as Array<Record<string, unknown>>;

  const positionProp = { a: 1, k: keyframes };

  let rotationProp: unknown = undefined;
  if (options.orient) {
    rotationProp = { a: 1, k: calculateRotationKeyframes(keyframes, curve) };
  }

  if (options.layer !== undefined) {
    const targetLayer = findLayerByNameOrIndex(existingLayers, options.layer);
    if (targetLayer) {
      const ks = (targetLayer.ks || {}) as Record<string, unknown>;
      ks.p = positionProp;
      if (rotationProp) ks.r = rotationProp;
      targetLayer.ks = ks;
    }
  } else {
    for (const layer of existingLayers) {
      if (typeof layer.ind === "number") {
        layer.ind = (layer.ind as number) + 1;
      }
      if (typeof layer.parent === "number") {
        layer.parent = (layer.parent as number) + 1;
      }
    }

    for (const layer of existingLayers) {
      if (layer.parent === undefined || layer.parent === null) {
        layer.parent = 0;
      }
    }

    const wrapperTransform: Record<string, unknown> = {
      a: { a: 0, k: [cx, cy, 0] },
      p: positionProp,
      s: { a: 0, k: [100, 100, 100] },
      r: rotationProp || { a: 0, k: 0 },
      o: { a: 0, k: 100 },
    };

    const wrapperLayer: Record<string, unknown> = {
      ty: 3,
      nm: "Path Motion Wrapper",
      ind: 0,
      ip: ip,
      op: op,
      st: 0,
      sr: 1,
      ks: wrapperTransform,
    };

    existingLayers.unshift(wrapperLayer);
  }

  return result;
}
