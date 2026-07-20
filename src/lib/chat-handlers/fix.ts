import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import {
  encodeSSE,
  createStreamingSSEResponse,
  animationExists,
  readAnimationFile,
  writeAnimationFile,
  saveUserMessage,
  saveAssistantMessage,
  saveVersion,
  emitUpdated,
  updateAnimationMetadata,
  sendDoneEvent,
} from "./helpers";

interface Issue {
  severity: "error" | "warning" | "info";
  category: string;
  description: string;
  autoFixed: boolean;
  before?: string;
  after?: string;
}

interface LottieAnimation {
  w: number;
  h: number;
  ip: number;
  op: number;
  fr: number;
  layers?: LottieLayer[];
  [key: string]: unknown;
}

interface LottieLayer {
  nm?: string;
  ty?: number;
  ip?: number;
  op?: number;
  ks?: {
    o?: KeyframeValue;
    p?: KeyframeValue;
    [key: string]: unknown;
  };
  shapes?: ShapeItem[];
  [key: string]: unknown;
}

interface KeyframeValue {
  a?: number;
  k?: unknown;
}

interface ShapeItem {
  ty?: string;
  it?: ShapeItem[];
  nm?: string;
  [key: string]: unknown;
}

interface Keyframe {
  t?: number;
  s?: number[];
  e?: number[];
  [key: string]: unknown;
}

export function diagnoseAndFix(anim: LottieAnimation): { issues: Issue[]; fixed: boolean } {
  const issues: Issue[] = [];
  const { w, h, op: animOp } = anim;
  let modified = false;

  if (!anim.layers) return { issues, fixed: false };

  for (let i = anim.layers.length - 1; i >= 0; i--) {
    const layer = anim.layers[i];
    const layerName = layer.nm || `Layer ${i}`;

    // (f) Zero-duration layers: ip >= op
    if (layer.ip != null && layer.op != null && layer.ip >= layer.op) {
      issues.push({
        severity: "error",
        category: "Zero-duration layer",
        description: `"${layerName}" has ip=${layer.ip} >= op=${layer.op}`,
        autoFixed: true,
        before: `op=${layer.op}`,
        after: `op=${animOp}`,
      });
      layer.op = animOp;
      modified = true;
    }

    // (a) Elements positioned outside viewport
    if (layer.ks?.p && !layer.ks.p.a && Array.isArray(layer.ks.p.k)) {
      const pos = layer.ks.p.k as number[];
      if (pos.length >= 2) {
        const [px, py] = pos;
        if (px < 0 || px > w || py < 0 || py > h) {
          const newX = Math.max(0, Math.min(w, px));
          const newY = Math.max(0, Math.min(h, py));
          issues.push({
            severity: "warning",
            category: "Offscreen element",
            description: `"${layerName}" positioned at (${px}, ${py}), outside ${w}x${h} viewport`,
            autoFixed: true,
            before: `position (${px}, ${py})`,
            after: `position (${newX}, ${newY})`,
          });
          pos[0] = newX;
          pos[1] = newY;
          modified = true;
        }
      }
    }

    // (b) Zero opacity layers (static, unintentional)
    if (layer.ks?.o && !layer.ks.o.a) {
      const opacity = layer.ks.o.k;
      if (opacity === 0) {
        issues.push({
          severity: "warning",
          category: "Zero opacity",
          description: `"${layerName}" has static opacity 0 (invisible)`,
          autoFixed: false,
        });
      }
    }

    // (c) & (g) Keyframe issues - check all animated properties
    if (layer.ks) {
      for (const [propName, propVal] of Object.entries(layer.ks)) {
        const pv = propVal as Record<string, unknown> | null;
        if (pv && typeof pv === "object" && pv.a === 1 && Array.isArray(pv.k)) {
          const keyframes = pv.k as Keyframe[];
          // (g) Duplicate keyframes at same time
          const seen = new Map<number, number>();
          const toRemove: number[] = [];
          for (let ki = 0; ki < keyframes.length; ki++) {
            const kf = keyframes[ki];
            if (kf.t != null) {
              if (seen.has(kf.t)) {
                toRemove.push(ki);
              } else {
                seen.set(kf.t, ki);
              }
            }
          }
          if (toRemove.length > 0) {
            issues.push({
              severity: "warning",
              category: "Duplicate keyframes",
              description: `"${layerName}" property "${propName}" has ${toRemove.length} duplicate keyframe(s)`,
              autoFixed: true,
              before: `${keyframes.length} keyframes`,
              after: `${keyframes.length - toRemove.length} keyframes`,
            });
            for (let ri = toRemove.length - 1; ri >= 0; ri--) {
              keyframes.splice(toRemove[ri], 1);
            }
            modified = true;
          }

          // (c) Zero-duration keyframes
          for (const kf of keyframes) {
            if (kf.s && kf.e && JSON.stringify(kf.s) === JSON.stringify(kf.e)) {
              issues.push({
                severity: "info",
                category: "Zero-duration keyframe",
                description: `"${layerName}" property "${propName}" has a keyframe with identical start/end values at t=${kf.t}`,
                autoFixed: false,
              });
            }
          }
        }
      }
    }

    // Shape layer checks (ty === 4)
    if (layer.ty === 4 && layer.shapes) {
      fixShapes(layer.shapes, layerName, issues, w, h);
      if (issues.some(iss => iss.autoFixed)) modified = true;
    }
  }

  return { issues, fixed: modified };
}

function fixShapes(shapes: ShapeItem[], layerName: string, issues: Issue[], _w: number, _h: number): void {
  for (let i = shapes.length - 1; i >= 0; i--) {
    const shape = shapes[i];

    // (d) Empty shape groups
    if (shape.ty === "gr" && shape.it) {
      const visibleItems = shape.it.filter(
        item => item.ty !== "tr" && item.ty !== "gr"
      );
      if (visibleItems.length === 0) {
        issues.push({
          severity: "warning",
          category: "Empty group",
          description: `"${layerName}" contains empty group "${shape.nm || "unnamed"}"`,
          autoFixed: true,
          before: "empty group",
          after: "removed",
        });
        shapes.splice(i, 1);
        continue;
      }

      // Recurse into groups
      fixShapes(shape.it, layerName, issues, _w, _h);
    }
  }

  // (e) Missing fill AND stroke on shape layers
  const hasPath = shapes.some(s => s.ty === "sh" || s.ty === "rc" || s.ty === "el" || s.ty === "sr");
  const hasFill = shapes.some(s => s.ty === "fl" || s.ty === "gf");
  const hasStroke = shapes.some(s => s.ty === "st" || s.ty === "gs");

  if (hasPath && !hasFill && !hasStroke) {
    issues.push({
      severity: "error",
      category: "Invisible shape",
      description: `"${layerName}" has shapes with no fill or stroke (invisible)`,
      autoFixed: true,
      before: "no fill or stroke",
      after: "added default fill (#000000)",
    });
    shapes.push({
      ty: "fl",
      nm: "Default Fill",
      c: { a: 0, k: [0, 0, 0, 1] },
      o: { a: 0, k: 100 },
      r: 1,
    } as unknown as ShapeItem);
  }
}

export async function handleFix(animationId: string | undefined, message: string): Promise<Response> {
  if (!animationId) {
    return sendDoneEvent({ reply: "Create an animation first, then I can fix issues in it." });
  }

  if (!animationExists(animationId)) {
    return Response.json({ error: "Animation not found" }, { status: 404 });
  }

  const anim = readAnimationFile(animationId) as LottieAnimation | null;
  if (!anim) {
    return sendDoneEvent({ reply: "No animation data found. Create an animation first.", animationId });
  }

  saveUserMessage(animationId, message);

  const { issues, fixed } = diagnoseAndFix(anim);

  const stream = new ReadableStream({
    start(controller) {
      let report = "";

      if (issues.length === 0) {
        report = "✅ **No issues found!** Your animation looks good.";
      } else {
        const errors = issues.filter(i => i.severity === "error");
        const warnings = issues.filter(i => i.severity === "warning");
        const infos = issues.filter(i => i.severity === "info");
        const autoFixed = issues.filter(i => i.autoFixed);
        const manual = issues.filter(i => !i.autoFixed);

        report = `## 🔧 Animation Diagnostics\n\n`;
        report += `Found **${issues.length}** issue(s): ${errors.length} error(s), ${warnings.length} warning(s), ${infos.length} info\n\n`;

        if (autoFixed.length > 0) {
          report += `### ✅ Auto-fixed (${autoFixed.length})\n\n`;
          for (const issue of autoFixed) {
            const icon = issue.severity === "error" ? "🔴" : "🟡";
            report += `${icon} **${issue.category}**: ${issue.description}\n`;
            report += `   - Before: \`${issue.before}\` → After: \`${issue.after}\`\n\n`;
          }
        }

        if (manual.length > 0) {
          report += `### ⚠️ Requires attention (${manual.length})\n\n`;
          for (const issue of manual) {
            const icon = issue.severity === "error" ? "🔴" : issue.severity === "warning" ? "🟡" : "ℹ️";
            report += `${icon} **${issue.category}**: ${issue.description}\n\n`;
          }
        }
      }

      controller.enqueue(encodeSSE(JSON.stringify({ type: "token", text: report })));

      if (fixed) {
        writeAnimationFile(animationId!, anim);
        const lottieJsonStr = JSON.stringify(anim);
        saveVersion(animationId!, lottieJsonStr, "/fix auto-repair");
        updateAnimationMetadata(animationId!, anim);
        emitUpdated(animationId!);

        saveAssistantMessage(animationId!, report, lottieJsonStr);
        controller.enqueue(encodeSSE(JSON.stringify({
          type: "done",
          reply: report,
          animationId,
          lottieJson: anim,
        })));
      } else {
        saveAssistantMessage(animationId!, report);
        controller.enqueue(encodeSSE(JSON.stringify({
          type: "done",
          reply: report,
          animationId,
        })));
      }

      controller.close();
    },
  });

  return createStreamingSSEResponse(stream);
}
