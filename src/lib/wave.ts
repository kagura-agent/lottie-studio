export const VALID_WAVE_TYPES = ["sine", "ocean", "flag", "pulse", "sound"] as const;
export type WaveType = (typeof VALID_WAVE_TYPES)[number];

export const VALID_WAVE_DIRECTIONS = ["horizontal", "vertical"] as const;
export type WaveDirection = (typeof VALID_WAVE_DIRECTIONS)[number];

export interface WaveOptions {
  type?: WaveType;
  amplitude?: number;
  frequency?: number;
  layers?: number;
  direction?: WaveDirection;
  speed?: number;
  color?: string;
}

export interface WaveCommandOptions {
  type?: WaveType;
  amplitude?: number;
  frequency?: number;
  layers?: number;
  direction?: WaveDirection;
  speed?: number;
  color?: string;
}

const CANVAS = 512;
const FPS = 30;
const FRAMES = 60;

function parseHexColor(hex: string | undefined): [number, number, number] {
  if (!hex) return [0.2, 0.6, 1];
  const clean = hex.replace(/^#/, "");
  if (/^[0-9a-f]{6}$/i.test(clean)) {
    return [
      parseInt(clean.slice(0, 2), 16) / 255,
      parseInt(clean.slice(2, 4), 16) / 255,
      parseInt(clean.slice(4, 6), 16) / 255,
    ];
  }
  return [0.2, 0.6, 1];
}

function baseLottie() {
  return {
    v: "5.7.1",
    fr: FPS,
    ip: 0,
    op: FRAMES,
    w: CANVAS,
    h: CANVAS,
    layers: [] as unknown[],
    assets: [],
  };
}

function sineWaveVertices(frame: number, amplitude: number, frequency: number, speed: number, direction: WaveDirection, phaseOffset: number = 0): { v: number[][]; i: number[][]; o: number[][]; c: boolean } {
  const points = 20;
  const vertices: number[][] = [];
  const inTangents: number[][] = [];
  const outTangents: number[][] = [];

  const progress = (frame / FRAMES) * Math.PI * 2 * speed;

  for (let p = 0; p <= points; p++) {
    const t = p / points;
    const wave = Math.sin(t * Math.PI * 2 * frequency + progress + phaseOffset) * amplitude;
    if (direction === "horizontal") {
      vertices.push([t * CANVAS, CANVAS / 2 + wave]);
    } else {
      vertices.push([CANVAS / 2 + wave, t * CANVAS]);
    }
    const tangentLen = CANVAS / points / 3;
    if (direction === "horizontal") {
      inTangents.push([-tangentLen, 0]);
      outTangents.push([tangentLen, 0]);
    } else {
      inTangents.push([0, -tangentLen]);
      outTangents.push([0, tangentLen]);
    }
  }

  return { v: vertices, i: inTangents, o: outTangents, c: false };
}

function generateSine(options: WaveOptions): object {
  const anim = baseLottie();
  const amplitude = options.amplitude ?? 30;
  const frequency = options.frequency ?? 2;
  const speed = options.speed ?? 1;
  const direction = options.direction ?? "horizontal";
  const color = parseHexColor(options.color);

  const keyframes = [];
  for (let f = 0; f < FRAMES; f++) {
    const shape = sineWaveVertices(f, amplitude, frequency, speed, direction);
    keyframes.push({ t: f, s: [shape] });
  }

  anim.layers.push({
    ty: 4,
    nm: "Wave",
    ip: 0,
    op: FRAMES,
    st: 0,
    ks: { o: { a: 0, k: 100 }, r: { a: 0, k: 0 }, p: { a: 0, k: [0, 0, 0] }, a: { a: 0, k: [0, 0, 0] }, s: { a: 0, k: [100, 100, 100] } },
    shapes: [
      {
        ty: "gr",
        it: [
          { ty: "sh", ks: { a: 1, k: keyframes } },
          { ty: "st", c: { a: 0, k: [...color, 1] }, o: { a: 0, k: 100 }, w: { a: 0, k: 4 } },
          { ty: "tr", p: { a: 0, k: [0, 0] }, a: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 } },
        ],
        nm: "Wave Group",
      },
    ],
  });

  return anim;
}

function generateOcean(options: WaveOptions): object {
  const anim = baseLottie();
  const amplitude = options.amplitude ?? 30;
  const frequency = options.frequency ?? 2;
  const speed = options.speed ?? 1;
  const direction = options.direction ?? "horizontal";
  const numLayers = options.layers ?? 3;
  const baseColor = parseHexColor(options.color);

  for (let l = 0; l < numLayers; l++) {
    const layerAmplitude = amplitude * (1 - l * 0.2);
    const layerFrequency = frequency + l * 0.5;
    const phaseOffset = (l * Math.PI * 2) / numLayers;
    const opacity = 80 - l * 15;
    const layerColor: [number, number, number] = [
      Math.min(1, baseColor[0] + l * 0.1),
      Math.min(1, baseColor[1] + l * 0.05),
      Math.min(1, baseColor[2] - l * 0.1),
    ];

    const keyframes = [];
    for (let f = 0; f < FRAMES; f++) {
      const fillVerts: number[][] = [];
      const fillIn: number[][] = [];
      const fillOut: number[][] = [];
      for (let p = 0; p <= 20; p++) {
        const t = p / 20;
        const wave = Math.sin(t * Math.PI * 2 * layerFrequency + (f / FRAMES) * Math.PI * 2 * speed + phaseOffset) * layerAmplitude;
        if (direction === "horizontal") {
          fillVerts.push([t * CANVAS, CANVAS / 2 + wave + l * 30]);
        } else {
          fillVerts.push([CANVAS / 2 + wave + l * 30, t * CANVAS]);
        }
        fillIn.push([0, 0]);
        fillOut.push([0, 0]);
      }
      if (direction === "horizontal") {
        fillVerts.push([CANVAS, CANVAS]);
        fillVerts.push([0, CANVAS]);
      } else {
        fillVerts.push([CANVAS, CANVAS]);
        fillVerts.push([CANVAS, 0]);
      }
      fillIn.push([0, 0], [0, 0]);
      fillOut.push([0, 0], [0, 0]);

      keyframes.push({ t: f, s: [{ v: fillVerts, i: fillIn, o: fillOut, c: true }] });
    }

    anim.layers.push({
      ty: 4,
      nm: `Wave ${l + 1}`,
      ip: 0,
      op: FRAMES,
      st: 0,
      ks: { o: { a: 0, k: opacity }, r: { a: 0, k: 0 }, p: { a: 0, k: [0, 0, 0] }, a: { a: 0, k: [0, 0, 0] }, s: { a: 0, k: [100, 100, 100] } },
      shapes: [
        {
          ty: "gr",
          it: [
            { ty: "sh", ks: { a: 1, k: keyframes } },
            { ty: "fl", c: { a: 0, k: [...layerColor, 1] }, o: { a: 0, k: 100 } },
            { ty: "tr", p: { a: 0, k: [0, 0] }, a: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 } },
          ],
          nm: `Ocean Layer ${l + 1}`,
        },
      ],
    });
  }

  return anim;
}

function generateFlag(options: WaveOptions): object {
  const anim = baseLottie();
  const amplitude = options.amplitude ?? 30;
  const frequency = options.frequency ?? 2;
  const speed = options.speed ?? 1;
  const color = parseHexColor(options.color);

  const cols = 10;
  const rows = 6;
  const flagW = CANVAS * 0.7;
  const flagH = CANVAS * 0.4;
  const offsetX = (CANVAS - flagW) / 2;
  const offsetY = (CANVAS - flagH) / 2;

  const keyframes = [];
  for (let f = 0; f < FRAMES; f++) {
    const progress = (f / FRAMES) * Math.PI * 2 * speed;
    const vertices: number[][] = [];
    const inT: number[][] = [];
    const outT: number[][] = [];

    for (let r = 0; r <= rows; r++) {
      for (let c = 0; c <= cols; c++) {
        const baseX = offsetX + (c / cols) * flagW;
        const baseY = offsetY + (r / rows) * flagH;
        const waveOffset = Math.sin((c / cols) * Math.PI * 2 * frequency + progress) * amplitude * (c / cols);
        vertices.push([baseX + waveOffset * 0.3, baseY + waveOffset]);
        inT.push([0, 0]);
        outT.push([0, 0]);
      }
    }

    const rectVerts: number[][] = [];
    const rectIn: number[][] = [];
    const rectOut: number[][] = [];

    // Top edge
    for (let c = 0; c <= cols; c++) {
      const idx = c;
      rectVerts.push(vertices[idx]);
      rectIn.push([0, 0]);
      rectOut.push([0, 0]);
    }
    // Right edge
    for (let r = 1; r <= rows; r++) {
      const idx = r * (cols + 1) + cols;
      rectVerts.push(vertices[idx]);
      rectIn.push([0, 0]);
      rectOut.push([0, 0]);
    }
    // Bottom edge (reversed)
    for (let c = cols - 1; c >= 0; c--) {
      const idx = rows * (cols + 1) + c;
      rectVerts.push(vertices[idx]);
      rectIn.push([0, 0]);
      rectOut.push([0, 0]);
    }
    // Left edge (reversed)
    for (let r = rows - 1; r >= 1; r--) {
      const idx = r * (cols + 1);
      rectVerts.push(vertices[idx]);
      rectIn.push([0, 0]);
      rectOut.push([0, 0]);
    }

    keyframes.push({ t: f, s: [{ v: rectVerts, i: rectIn, o: rectOut, c: true }] });
  }

  // Pole
  anim.layers.push({
    ty: 4,
    nm: "Pole",
    ip: 0,
    op: FRAMES,
    st: 0,
    ks: { o: { a: 0, k: 100 }, r: { a: 0, k: 0 }, p: { a: 0, k: [0, 0, 0] }, a: { a: 0, k: [0, 0, 0] }, s: { a: 0, k: [100, 100, 100] } },
    shapes: [
      {
        ty: "gr",
        it: [
          { ty: "rc", p: { a: 0, k: [offsetX - 4, CANVAS / 2] }, s: { a: 0, k: [6, CANVAS * 0.7] } },
          { ty: "fl", c: { a: 0, k: [0.4, 0.4, 0.4, 1] }, o: { a: 0, k: 100 } },
          { ty: "tr", p: { a: 0, k: [0, 0] }, a: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 } },
        ],
        nm: "Pole Group",
      },
    ],
  });

  anim.layers.push({
    ty: 4,
    nm: "Flag",
    ip: 0,
    op: FRAMES,
    st: 0,
    ks: { o: { a: 0, k: 100 }, r: { a: 0, k: 0 }, p: { a: 0, k: [0, 0, 0] }, a: { a: 0, k: [0, 0, 0] }, s: { a: 0, k: [100, 100, 100] } },
    shapes: [
      {
        ty: "gr",
        it: [
          { ty: "sh", ks: { a: 1, k: keyframes } },
          { ty: "fl", c: { a: 0, k: [...color, 1] }, o: { a: 0, k: 100 } },
          { ty: "tr", p: { a: 0, k: [0, 0] }, a: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 } },
        ],
        nm: "Flag Group",
      },
    ],
  });

  return anim;
}

function generatePulse(options: WaveOptions): object {
  const anim = baseLottie();
  const amplitude = options.amplitude ?? 30;
  const numLayers = options.layers ?? 3;
  const speed = options.speed ?? 1;
  const color = parseHexColor(options.color);

  for (let l = 0; l < numLayers; l++) {
    const delay = (l / numLayers) * FRAMES;
    const scaleKeyframes = [];
    const opacityKeyframes = [];

    for (let f = 0; f < FRAMES; f++) {
      const adjustedFrame = (f - delay + FRAMES) % FRAMES;
      const progress = adjustedFrame / FRAMES;
      const scale = 20 + progress * (amplitude * 3) * speed;
      const opacity = 100 * (1 - progress);
      scaleKeyframes.push({ t: f, s: [scale, scale, 100] });
      opacityKeyframes.push({ t: f, s: [opacity] });
    }

    anim.layers.push({
      ty: 4,
      nm: `Pulse ${l + 1}`,
      ip: 0,
      op: FRAMES,
      st: 0,
      ks: {
        o: { a: 1, k: opacityKeyframes },
        r: { a: 0, k: 0 },
        p: { a: 0, k: [CANVAS / 2, CANVAS / 2, 0] },
        a: { a: 0, k: [0, 0, 0] },
        s: { a: 1, k: scaleKeyframes },
      },
      shapes: [
        {
          ty: "gr",
          it: [
            { ty: "el", p: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] } },
            { ty: "st", c: { a: 0, k: [...color, 1] }, o: { a: 0, k: 100 }, w: { a: 0, k: 3 } },
            { ty: "tr", p: { a: 0, k: [0, 0] }, a: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 } },
          ],
          nm: `Ring ${l + 1}`,
        },
      ],
    });
  }

  return anim;
}

function generateSound(options: WaveOptions): object {
  const anim = baseLottie();
  const amplitude = options.amplitude ?? 30;
  const frequency = options.frequency ?? 2;
  const numBars = options.layers ?? 3;
  const speed = options.speed ?? 1;
  const direction = options.direction ?? "horizontal";
  const color = parseHexColor(options.color);

  const barWidth = (CANVAS * 0.6) / numBars;
  const gap = (CANVAS * 0.4) / (numBars + 1);
  const startX = gap;

  for (let b = 0; b < numBars; b++) {
    const phaseOffset = (b / numBars) * Math.PI * 2 * frequency;
    const sizeKeyframes = [];

    for (let f = 0; f < FRAMES; f++) {
      const progress = (f / FRAMES) * Math.PI * 2 * speed;
      const height = 20 + Math.abs(Math.sin(progress + phaseOffset)) * amplitude * 2;
      if (direction === "horizontal") {
        sizeKeyframes.push({ t: f, s: [barWidth * 0.8, height] });
      } else {
        sizeKeyframes.push({ t: f, s: [height, barWidth * 0.8] });
      }
    }

    const posX = direction === "horizontal" ? startX + b * (barWidth + gap) + barWidth / 2 : CANVAS / 2;
    const posY = direction === "horizontal" ? CANVAS / 2 : startX + b * (barWidth + gap) + barWidth / 2;

    anim.layers.push({
      ty: 4,
      nm: `Bar ${b + 1}`,
      ip: 0,
      op: FRAMES,
      st: 0,
      ks: {
        o: { a: 0, k: 100 },
        r: { a: 0, k: 0 },
        p: { a: 0, k: [posX, posY, 0] },
        a: { a: 0, k: [0, 0, 0] },
        s: { a: 0, k: [100, 100, 100] },
      },
      shapes: [
        {
          ty: "gr",
          it: [
            { ty: "rc", p: { a: 0, k: [0, 0] }, s: { a: 1, k: sizeKeyframes }, r: { a: 0, k: 4 } },
            { ty: "fl", c: { a: 0, k: [...color, 1] }, o: { a: 0, k: 100 } },
            { ty: "tr", p: { a: 0, k: [0, 0] }, a: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 } },
          ],
          nm: `Bar Group ${b + 1}`,
        },
      ],
    });
  }

  return anim;
}

export function generateWaveAnimation(options: WaveOptions = {}): object {
  const type = options.type ?? "sine";
  switch (type) {
    case "sine":
      return generateSine(options);
    case "ocean":
      return generateOcean(options);
    case "flag":
      return generateFlag(options);
    case "pulse":
      return generatePulse(options);
    case "sound":
      return generateSound(options);
    default:
      return generateSine(options);
  }
}
