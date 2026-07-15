/**
 * Structured diff summary for Lottie animation changes.
 * Pure function — no dependencies beyond standard lib.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LottieObj = Record<string, any>;

interface Change {
  priority: number;
  text: string;
}

export function summarizeChanges(prev: LottieObj, next: LottieObj): string | null {
  const changes: Change[] = [];

  detectLayerChanges(prev, next, changes);
  detectTimingChanges(prev, next, changes);
  detectColorChanges(prev, next, changes);
  detectTransformChanges(prev, next, changes);
  detectEffectChanges(prev, next, changes);
  detectShapeChanges(prev, next, changes);

  if (changes.length === 0) return null;

  changes.sort((a, b) => a.priority - b.priority);

  const MAX = 3;
  const shown = changes.slice(0, MAX).map((c) => c.text);
  const remaining = changes.length - MAX;
  if (remaining > 0) shown.push(`+${remaining} more`);

  return shown.join(" · ");
}

function detectLayerChanges(prev: LottieObj, next: LottieObj, changes: Change[]) {
  const prevLayers: unknown[] = prev.layers ?? [];
  const nextLayers: unknown[] = next.layers ?? [];

  // Detect renames first (same index, same layer count, different name)
  const renamed: Set<string> = new Set();
  const renamedTo: Set<string> = new Set();
  if (prevLayers.length === nextLayers.length) {
    for (let i = 0; i < prevLayers.length; i++) {
      const pName = (prevLayers[i] as LottieObj).nm;
      const nName = (nextLayers[i] as LottieObj).nm;
      if (pName && nName && pName !== nName) {
        changes.push({ priority: 2, text: `renamed "${pName}" → "${nName}"` });
        renamed.add(pName);
        renamedTo.add(nName);
      }
    }
  }

  const prevNames = new Set(prevLayers.map((l: unknown) => (l as LottieObj).nm ?? ""));
  const nextNames = new Set(nextLayers.map((l: unknown) => (l as LottieObj).nm ?? ""));

  const added: string[] = [];
  const removed: string[] = [];

  Array.from(nextNames).forEach((n) => {
    if (n && !prevNames.has(n) && !renamedTo.has(n as string)) added.push(n as string);
  });
  Array.from(prevNames).forEach((n) => {
    if (n && !nextNames.has(n) && !renamed.has(n as string)) removed.push(n as string);
  });

  if (added.length > 0) {
    const label = added.length === 1 ? `+1 layer "${added[0]}"` : `+${added.length} layers`;
    changes.push({ priority: 1, text: label });
  }
  if (removed.length > 0) {
    const label = removed.length === 1 ? `-1 layer "${removed[0]}"` : `-${removed.length} layers`;
    changes.push({ priority: 1, text: label });
  }
}

function detectTimingChanges(prev: LottieObj, next: LottieObj, changes: Change[]) {
  const prevDuration = (prev.op ?? 0) - (prev.ip ?? 0);
  const nextDuration = (next.op ?? 0) - (next.ip ?? 0);

  if (prevDuration !== nextDuration && prevDuration > 0 && nextDuration > 0) {
    changes.push({ priority: 2, text: `duration ${prevDuration}→${nextDuration}f` });
  }

  if (prev.fr && next.fr && prev.fr !== next.fr) {
    changes.push({ priority: 3, text: `${prev.fr}→${next.fr} fps` });
  }
}

function toHex(arr: number[]): string | null {
  if (!arr || arr.length < 3) return null;
  const r = Math.round((arr[0] ?? 0) * 255);
  const g = Math.round((arr[1] ?? 0) * 255);
  const b = Math.round((arr[2] ?? 0) * 255);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

function collectColors(obj: unknown, out: string[]) {
  if (!obj || typeof obj !== "object") return;
  const o = obj as LottieObj;

  // Fill/stroke color property
  if ((o.ty === "fl" || o.ty === "st") && o.c) {
    const k = o.c.k;
    if (Array.isArray(k) && k.length >= 3 && typeof k[0] === "number") {
      const hex = toHex(k as number[]);
      if (hex) out.push(hex);
    }
  }

  for (const key of Object.keys(o)) {
    const val = o[key];
    if (Array.isArray(val)) {
      for (const item of val) collectColors(item, out);
    } else if (val && typeof val === "object") {
      collectColors(val, out);
    }
  }
}

function detectColorChanges(prev: LottieObj, next: LottieObj, changes: Change[]) {
  const prevColors: string[] = [];
  const nextColors: string[] = [];
  collectColors(prev, prevColors);
  collectColors(next, nextColors);

  // Find first meaningful color diff
  const prevSet = new Set(prevColors);
  const nextSet = new Set(nextColors);

  const removed = prevColors.filter((c) => !nextSet.has(c));
  const added = nextColors.filter((c) => !prevSet.has(c));

  if (removed.length > 0 && added.length > 0) {
    changes.push({ priority: 2, text: `fill ${removed[0]}→${added[0]}` });
  } else if (added.length > 0) {
    changes.push({ priority: 3, text: `fill ${added[0]}` });
  }
}

function detectTransformChanges(prev: LottieObj, next: LottieObj, changes: Change[]) {
  const prevLayers: LottieObj[] = prev.layers ?? [];
  const nextLayers: LottieObj[] = next.layers ?? [];

  for (let i = 0; i < Math.min(prevLayers.length, nextLayers.length); i++) {
    const pKs = prevLayers[i]?.ks;
    const nKs = nextLayers[i]?.ks;
    if (!pKs || !nKs) continue;

    // Position
    if (pKs.p && nKs.p) {
      const pVal = getStaticValue(pKs.p);
      const nVal = getStaticValue(nKs.p);
      if (pVal && nVal && distance(pVal, nVal) > 10) {
        changes.push({ priority: 3, text: "position changed" });
        return;
      }
    }

    // Scale
    if (pKs.s && nKs.s) {
      const pVal = getStaticValue(pKs.s);
      const nVal = getStaticValue(nKs.s);
      if (pVal && nVal && distance(pVal, nVal) > 5) {
        changes.push({ priority: 3, text: "scale changed" });
        return;
      }
    }

    // Rotation
    if (pKs.r && nKs.r) {
      const pVal = getStaticValue(pKs.r);
      const nVal = getStaticValue(nKs.r);
      if (pVal && nVal && Math.abs(pVal[0] - nVal[0]) > 5) {
        changes.push({ priority: 3, text: "rotation changed" });
        return;
      }
    }
  }
}

function getStaticValue(prop: LottieObj): number[] | null {
  if (!prop) return null;
  if (prop.a === 0 || prop.a === undefined) {
    const k = prop.k;
    if (typeof k === "number") return [k];
    if (Array.isArray(k) && typeof k[0] === "number") return k;
  }
  return null;
}

function distance(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    sum += (a[i] - b[i]) ** 2;
  }
  return Math.sqrt(sum);
}

function detectEffectChanges(prev: LottieObj, next: LottieObj, changes: Change[]) {
  const prevEffects = countEffects(prev);
  const nextEffects = countEffects(next);

  if (nextEffects > prevEffects) {
    changes.push({ priority: 3, text: `+${nextEffects - prevEffects} effect${nextEffects - prevEffects > 1 ? "s" : ""}` });
  } else if (nextEffects < prevEffects) {
    changes.push({ priority: 3, text: `-${prevEffects - nextEffects} effect${prevEffects - nextEffects > 1 ? "s" : ""}` });
  }
}

function countEffects(obj: LottieObj): number {
  let count = 0;
  const layers: LottieObj[] = obj.layers ?? [];
  for (const layer of layers) {
    if (Array.isArray(layer.ef)) count += layer.ef.length;
  }
  return count;
}

function detectShapeChanges(prev: LottieObj, next: LottieObj, changes: Change[]) {
  const prevCount = countShapes(prev);
  const nextCount = countShapes(next);

  if (nextCount > prevCount) {
    changes.push({ priority: 3, text: `+${nextCount - prevCount} shape${nextCount - prevCount > 1 ? "s" : ""}` });
  } else if (nextCount < prevCount) {
    changes.push({ priority: 4, text: `-${prevCount - nextCount} shape${prevCount - nextCount > 1 ? "s" : ""}` });
  }
}

function countShapes(obj: LottieObj): number {
  let count = 0;
  const layers: LottieObj[] = obj.layers ?? [];
  for (const layer of layers) {
    if (Array.isArray(layer.shapes)) count += layer.shapes.length;
  }
  return count;
}
