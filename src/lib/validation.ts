export interface ValidationIssue {
  severity: "error" | "warning";
  code: string;
  message: string;
  layerIndex?: number;
  layerName?: string;
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyObj = Record<string, any>;

export function validateStructure(animation: AnyObj): ValidationResult {
  const issues: ValidationIssue[] = [];
  const layers: AnyObj[] = animation.layers ?? [];
  const animIp = animation.ip ?? 0;
  const animOp = animation.op ?? 0;
  const assets: AnyObj[] = animation.assets ?? [];

  const layerIndices = new Map<number, number>();

  for (let i = 0; i < layers.length; i++) {
    const layer = layers[i];
    const name = layer.nm || `Layer ${i}`;

    // 6. Missing required properties — layers missing ty
    if (layer.ty === undefined || layer.ty === null) {
      issues.push({
        severity: "error",
        code: "missing_layer_type",
        message: `Layer "${name}" is missing required property "ty" (type)`,
        layerIndex: i,
        layerName: name,
      });
    }

    // 3. Duplicate layer indices
    if (layer.ind !== undefined && layer.ind !== null) {
      const existing = layerIndices.get(layer.ind);
      if (existing !== undefined) {
        issues.push({
          severity: "error",
          code: "duplicate_layer_index",
          message: `Layer "${name}" shares index ${layer.ind} with layer at position ${existing}`,
          layerIndex: i,
          layerName: name,
        });
      } else {
        layerIndices.set(layer.ind, i);
      }
    }

    // 1. Invalid parent references
    if (layer.parent !== undefined && layer.parent !== null) {
      if (!layerIndices.has(layer.parent) && !layers.some((l: AnyObj) => l.ind === layer.parent)) {
        issues.push({
          severity: "error",
          code: "invalid_parent_reference",
          message: `Layer "${name}" references parent index ${layer.parent} which does not exist`,
          layerIndex: i,
          layerName: name,
        });
      }
    }

    // 2. Out-of-bounds timing
    if (layer.ip !== undefined && layer.op !== undefined) {
      if (layer.ip < animIp || layer.op > animOp) {
        issues.push({
          severity: "warning",
          code: "out_of_bounds_timing",
          message: `Layer "${name}" timing (${layer.ip}-${layer.op}) exceeds animation bounds (${animIp}-${animOp})`,
          layerIndex: i,
          layerName: name,
        });
      }
    }

    // 5. Empty shape groups — shape layers (ty=4) with no fill or stroke
    if (layer.ty === 4 && Array.isArray(layer.shapes)) {
      if (!hasVisibleShapes(layer.shapes)) {
        issues.push({
          severity: "warning",
          code: "empty_shape_group",
          message: `Shape layer "${name}" has no fill or stroke — it will be invisible`,
          layerIndex: i,
          layerName: name,
        });
      }
    }

    // 6b. Shape items missing ty
    if (layer.ty === 4 && Array.isArray(layer.shapes)) {
      checkShapeTypes(layer.shapes, i, name, issues);
    }

    // 7. Orphan precomp references
    if (layer.ty === 0 && layer.refId) {
      if (!assets.some((a: AnyObj) => a.id === layer.refId)) {
        issues.push({
          severity: "error",
          code: "orphan_precomp_reference",
          message: `Precomp layer "${name}" references asset "${layer.refId}" which does not exist`,
          layerIndex: i,
          layerName: name,
        });
      }
    }

    // 4. Invalid easing values
    checkEasingValues(layer, i, name, issues);
  }

  return {
    valid: issues.every((issue) => issue.severity !== "error"),
    issues,
  };
}

function hasVisibleShapes(shapes: AnyObj[]): boolean {
  for (const shape of shapes) {
    // fl = fill, st = stroke, gf = gradient fill, gs = gradient stroke
    if (shape.ty === "fl" || shape.ty === "st" || shape.ty === "gf" || shape.ty === "gs") {
      return true;
    }
    if (shape.ty === "gr" && Array.isArray(shape.it)) {
      if (hasVisibleShapes(shape.it)) return true;
    }
  }
  return false;
}

function checkShapeTypes(shapes: AnyObj[], layerIndex: number, layerName: string, issues: ValidationIssue[]) {
  for (const shape of shapes) {
    if (shape.ty === undefined || shape.ty === null) {
      issues.push({
        severity: "error",
        code: "missing_shape_type",
        message: `A shape in layer "${layerName}" is missing required property "ty" (type)`,
        layerIndex,
        layerName,
      });
    }
    if (shape.ty === "gr" && Array.isArray(shape.it)) {
      checkShapeTypes(shape.it, layerIndex, layerName, issues);
    }
  }
}

function checkEasingValues(layer: AnyObj, layerIndex: number, layerName: string, issues: ValidationIssue[]) {
  const ks = layer.ks;
  if (!ks) return;

  for (const propKey of Object.keys(ks)) {
    const prop = ks[propKey];
    if (prop && prop.a === 1 && Array.isArray(prop.k)) {
      for (const kf of prop.k) {
        if (kf && kf.o && kf.i) {
          checkBezierPoints(kf.o, kf.i, layerIndex, layerName, issues);
        }
      }
    }
  }
}

function checkBezierPoints(
  out: AnyObj,
  inp: AnyObj,
  layerIndex: number,
  layerName: string,
  issues: ValidationIssue[],
) {
  const checkX = (arr: unknown[], label: string) => {
    for (const x of arr) {
      if (typeof x === "number" && (x < 0 || x > 1)) {
        issues.push({
          severity: "warning",
          code: "invalid_easing_value",
          message: `Layer "${layerName}" has easing ${label} x value ${x} outside valid range [0, 1]`,
          layerIndex,
          layerName,
        });
        return;
      }
    }
  };

  if (Array.isArray(out.x)) checkX(out.x, "out");
  else if (typeof out.x === "number" && (out.x < 0 || out.x > 1)) {
    issues.push({
      severity: "warning",
      code: "invalid_easing_value",
      message: `Layer "${layerName}" has easing out x value ${out.x} outside valid range [0, 1]`,
      layerIndex,
      layerName,
    });
  }

  if (Array.isArray(inp.x)) checkX(inp.x, "in");
  else if (typeof inp.x === "number" && (inp.x < 0 || inp.x > 1)) {
    issues.push({
      severity: "warning",
      code: "invalid_easing_value",
      message: `Layer "${layerName}" has easing in x value ${inp.x} outside valid range [0, 1]`,
      layerIndex,
      layerName,
    });
  }
}
