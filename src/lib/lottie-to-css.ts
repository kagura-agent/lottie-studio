/**
 * Lottie JSON to CSS Animation converter.
 * Single-pass: checks for unsupported features, then converts supported layers
 * to pure CSS @keyframes and HTML structure.
 */

export interface CssExportSuccess {
  success: true;
  css: string;
  html: string;
}

export interface CssExportFailure {
  success: false;
  reasons: string[];
}

export type CssExportResult = CssExportSuccess | CssExportFailure;

interface LottieKeyframe {
  t: number; // time
  s: number[]; // start value
  e?: number[]; // end value
  i?: { x: number | number[]; y: number | number[] }; // in tangent
  o?: { x: number | number[]; y: number | number[] }; // out tangent
}

interface LottieProperty {
  a: number; // animated flag
  k: number | number[] | LottieKeyframe[];
}

interface LottieTransform {
  p?: LottieProperty; // position
  s?: LottieProperty; // scale
  r?: LottieProperty; // rotation
  o?: LottieProperty; // opacity
}

interface LottieLayer {
  ty: number; // type: 0=precomp, 1=solid, 2=image, 3=null, 4=shape, 5=text
  nm?: string;
  ks?: LottieTransform;
  hasMask?: boolean;
  tt?: number; // matte type
  ef?: unknown[]; // effects
  shapes?: LottieShape[];
}

interface LottieShape {
  ty: string;
  it?: LottieShape[];
}

interface LottieAnimation {
  w: number;
  h: number;
  ip: number; // in point
  op: number; // out point
  fr: number; // frame rate
  layers: LottieLayer[];
}

function getUnsupportedReasons(anim: LottieAnimation): string[] {
  const reasons: string[] = [];

  for (const layer of anim.layers) {
    if (layer.hasMask) {
      reasons.push("Layer masks are not supported in CSS animations");
    }
    if (layer.tt) {
      reasons.push("Matte/track matte effects are not supported in CSS animations");
    }
    if (layer.ef && layer.ef.length > 0) {
      reasons.push("Layer effects are not supported in CSS animations");
    }
    if (layer.ty === 0) {
      reasons.push("Precomposition layers are not supported in CSS animations");
    }
    if (layer.ty === 2) {
      reasons.push("Image layers are not supported in CSS animations");
    }
    if (layer.shapes) {
      if (hasPathMorphing(layer.shapes)) {
        reasons.push("Path morphing is not supported in CSS animations");
      }
      if (hasTrimPath(layer.shapes)) {
        reasons.push("Trim paths are not supported in CSS animations");
      }
    }
  }

  // Deduplicate
  return [...new Set(reasons)];
}

function hasTrimPath(shapes: LottieShape[]): boolean {
  for (const shape of shapes) {
    if (shape.ty === "tm") return true;
    if (shape.it && hasTrimPath(shape.it)) return true;
  }
  return false;
}

function hasPathMorphing(shapes: LottieShape[]): boolean {
  for (const shape of shapes) {
    if (shape.ty === "sh") {
      const shapeAny = shape as unknown as Record<string, unknown>;
      const ks = shapeAny.ks as LottieProperty | undefined;
      if (ks && ks.a === 1) return true;
    }
    if (shape.it && hasPathMorphing(shape.it)) return true;
  }
  return false;
}

function isAnimated(prop: LottieProperty | undefined): boolean {
  return prop !== undefined && prop.a === 1;
}

function getStaticValue(prop: LottieProperty | undefined, defaultVal: number[]): number[] {
  if (!prop) return defaultVal;
  if (prop.a === 1) return defaultVal;
  if (Array.isArray(prop.k)) return prop.k as number[];
  return [prop.k as number];
}

function getKeyframes(prop: LottieProperty): LottieKeyframe[] {
  if (prop.a !== 1 || !Array.isArray(prop.k)) return [];
  return prop.k as LottieKeyframe[];
}

function tangentValue(v: number | number[]): number {
  return Array.isArray(v) ? v[0] : v;
}

function formatEasing(
  currentKf: LottieKeyframe,
  nextKf: LottieKeyframe | undefined
): string {
  if (!currentKf.o || !nextKf?.i) return "linear";

  const ox = tangentValue(currentKf.o.x);
  const oy = tangentValue(currentKf.o.y);
  const ix = tangentValue(nextKf.i.x);
  const iy = tangentValue(nextKf.i.y);

  // Check if linear (0,0,1,1)
  if (ox === 0 && oy === 0 && ix === 1 && iy === 1) return "linear";

  return `cubic-bezier(${ox}, ${oy}, ${ix}, ${iy})`;
}

function generateKeyframesCss(
  keyframes: LottieKeyframe[],
  totalFrames: number,
  propertyFn: (value: number[]) => string
): { percentages: { pct: number; value: string; easing: string }[] } {
  const percentages: { pct: number; value: string; easing: string }[] = [];

  for (let i = 0; i < keyframes.length; i++) {
    const kf = keyframes[i];
    const nextKf = i < keyframes.length - 1 ? keyframes[i + 1] : undefined;
    const pct = totalFrames > 0 ? (kf.t / totalFrames) * 100 : 0;
    const value = propertyFn(kf.s);
    const easing = formatEasing(kf, nextKf);
    percentages.push({ pct, value, easing });
  }

  return { percentages };
}

export function convertLottieToCss(animationData: object): CssExportResult {
  const anim = animationData as LottieAnimation;

  if (!anim.layers || !anim.fr || anim.op === undefined || anim.ip === undefined) {
    return { success: false, reasons: ["Invalid Lottie animation format"] };
  }

  const reasons = getUnsupportedReasons(anim);
  if (reasons.length > 0) {
    return { success: false, reasons };
  }

  const totalFrames = anim.op - anim.ip;
  const duration = totalFrames / anim.fr;
  const width = anim.w || 400;
  const height = anim.h || 400;

  // Filter visible layers (exclude null layers, type 3)
  const visibleLayers = anim.layers.filter((l) => l.ty !== 3);

  const cssRules: string[] = [];
  const htmlElements: string[] = [];

  // Container styles
  cssRules.push(`.lottie-animation {
  position: relative;
  width: ${width}px;
  height: ${height}px;
  overflow: hidden;
}`);

  for (let layerIdx = 0; layerIdx < visibleLayers.length; layerIdx++) {
    const layer = visibleLayers[layerIdx];
    const ks = layer.ks;
    if (!ks) continue;

    const layerName = `layer-${layerIdx}`;
    const hasAnyAnimation =
      isAnimated(ks.p) || isAnimated(ks.s) || isAnimated(ks.r) || isAnimated(ks.o);

    // Static transform values
    const staticPos = getStaticValue(ks.p, [0, 0]);
    const staticScale = getStaticValue(ks.s, [100, 100]);
    const staticRotation = getStaticValue(ks.r, [0]);
    const staticOpacity = getStaticValue(ks.o, [100]);

    // Build the layer style
    const layerStyles: string[] = [
      "position: absolute",
      "width: 100%",
      "height: 100%",
    ];

    if (!hasAnyAnimation) {
      // Static-only layer
      const transforms: string[] = [];
      if (staticPos[0] !== 0 || staticPos[1] !== 0) {
        transforms.push(`translateX(${staticPos[0]}px)`, `translateY(${staticPos[1]}px)`);
      }
      if (staticScale[0] !== 100 || staticScale[1] !== 100) {
        transforms.push(`scale(${staticScale[0] / 100}, ${staticScale[1] / 100})`);
      }
      if (staticRotation[0] !== 0) {
        transforms.push(`rotate(${staticRotation[0]}deg)`);
      }
      if (transforms.length > 0) {
        layerStyles.push(`transform: ${transforms.join(" ")}`);
      }
      if (staticOpacity[0] !== 100) {
        layerStyles.push(`opacity: ${staticOpacity[0] / 100}`);
      }
    } else {
      // Animated layer
      layerStyles.push(`animation: ${layerName} ${duration}s infinite`);

      // Build @keyframes
      const keyframeBlocks: Map<number, Map<string, string>> = new Map();
      const easings: Map<number, string> = new Map();

      if (isAnimated(ks.p)) {
        const kfs = getKeyframes(ks.p!);
        const result = generateKeyframesCss(kfs, totalFrames, (v) => {
          const parts: string[] = [];
          parts.push(`translateX(${v[0]}px)`);
          parts.push(`translateY(${v[1] ?? 0}px)`);
          return parts.join(" ");
        });
        for (const { pct, value, easing } of result.percentages) {
          if (!keyframeBlocks.has(pct)) keyframeBlocks.set(pct, new Map());
          const block = keyframeBlocks.get(pct)!;
          const existing = block.get("transform") || "";
          block.set("transform", existing ? `${existing} ${value}` : value);
          if (!easings.has(pct)) easings.set(pct, easing);
        }
      }

      if (isAnimated(ks.s)) {
        const kfs = getKeyframes(ks.s!);
        const result = generateKeyframesCss(kfs, totalFrames, (v) => {
          return `scale(${(v[0] ?? 100) / 100}, ${(v[1] ?? 100) / 100})`;
        });
        for (const { pct, value, easing } of result.percentages) {
          if (!keyframeBlocks.has(pct)) keyframeBlocks.set(pct, new Map());
          const block = keyframeBlocks.get(pct)!;
          const existing = block.get("transform") || "";
          block.set("transform", existing ? `${existing} ${value}` : value);
          if (!easings.has(pct)) easings.set(pct, easing);
        }
      }

      if (isAnimated(ks.r)) {
        const kfs = getKeyframes(ks.r!);
        const result = generateKeyframesCss(kfs, totalFrames, (v) => {
          return `rotate(${v[0]}deg)`;
        });
        for (const { pct, value, easing } of result.percentages) {
          if (!keyframeBlocks.has(pct)) keyframeBlocks.set(pct, new Map());
          const block = keyframeBlocks.get(pct)!;
          const existing = block.get("transform") || "";
          block.set("transform", existing ? `${existing} ${value}` : value);
          if (!easings.has(pct)) easings.set(pct, easing);
        }
      }

      if (isAnimated(ks.o)) {
        const kfs = getKeyframes(ks.o!);
        const result = generateKeyframesCss(kfs, totalFrames, (v) => {
          return `${(v[0] ?? 100) / 100}`;
        });
        for (const { pct, value, easing } of result.percentages) {
          if (!keyframeBlocks.has(pct)) keyframeBlocks.set(pct, new Map());
          const block = keyframeBlocks.get(pct)!;
          block.set("opacity", value);
          if (!easings.has(pct)) easings.set(pct, easing);
        }
      }

      // Build @keyframes rule
      const sortedPcts = [...keyframeBlocks.keys()].sort((a, b) => a - b);
      const keyframeLines: string[] = [];
      for (const pct of sortedPcts) {
        const block = keyframeBlocks.get(pct)!;
        const easing = easings.get(pct) || "linear";
        const props: string[] = [];
        const transform = block.get("transform");
        if (transform) props.push(`    transform: ${transform}`);
        const opacity = block.get("opacity");
        if (opacity) props.push(`    opacity: ${opacity}`);
        if (easing !== "linear") {
          props.push(`    animation-timing-function: ${easing}`);
        }
        const pctStr = pct === 0 ? "0%" : pct === 100 ? "100%" : `${Math.round(pct * 100) / 100}%`;
        keyframeLines.push(`  ${pctStr} {\n${props.join(";\n")};\n  }`);
      }

      cssRules.push(`@keyframes ${layerName} {\n${keyframeLines.join("\n")}\n}`);
    }

    cssRules.push(`.${layerName} {\n  ${layerStyles.join(";\n  ")};\n}`);

    const layerLabel = layer.nm || `Layer ${layerIdx}`;
    htmlElements.push(`  <div class="${layerName}"><!-- ${layerLabel} --></div>`);
  }

  const css = cssRules.join("\n\n");
  const html = `<div class="lottie-animation">\n${htmlElements.join("\n")}\n</div>`;

  return { success: true, css, html };
}
