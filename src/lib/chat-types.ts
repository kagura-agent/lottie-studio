import type { Variation } from "@/components/VariationGrid";

export interface QualityHint {
  id: string;
  label: string;
  status: "warn" | "fail";
  detail: string;
  suggestion: string;
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  warning?: string;
  isRepair?: boolean;
  suggestions?: string[];
  imageUrl?: string;
  lottieJson?: object;
  previousLottieJson?: object;
  variations?: Variation[];
  variationsLoading?: boolean;
  sequenceId?: string;
  qualityHints?: QualityHint[];
  versionNum?: number;
}

export interface ChatPanelProps {
  animationId?: string;
  insertText?: string;
  onAnimationCreated?: (id: string, data?: object) => void;
  onAnimationUpdated?: (id: string, data: object) => void;
  onCommand?: (command: import("@/lib/commands").Command) => void;
  initialPrompt?: string;
  selectedLayerIndex?: number | null;
  animationData?: object | null;
  onLayerContextConsumed?: () => void;
  onProgressivePreview?: (data: object | null) => void;
}

export const MAX_IMAGE_SIZE = 4 * 1024 * 1024;
export const MAX_ANIMATION_FILE_SIZE = 5 * 1024 * 1024;
export const SUPPORTED_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];
export const ANIMATION_EXTENSIONS = [".json", ".svg", ".lottie"];
export const LOTTIE_REQUIRED_FIELDS = ["v", "fr", "ip", "op", "w", "h", "layers"] as const;

export function extractLayerContext(animationData: object | null | undefined, layerIndex: number | null | undefined): object | null {
  if (layerIndex == null || !animationData) return null;
  const layers = (animationData as Record<string, unknown>).layers as Array<Record<string, unknown>> | undefined;
  if (!layers || !layers[layerIndex]) return null;
  const layer = layers[layerIndex];
  const typeNames: Record<number, string> = { 0: "Precomp", 1: "Solid", 2: "Image", 3: "Null", 4: "Shape", 5: "Text" };
  const ks = layer.ks as Record<string, unknown> | undefined;
  const pos = ks?.p as { k?: unknown } | undefined;
  const opacity = ks?.o as { a?: number; k?: unknown } | undefined;
  const scale = ks?.s as { k?: unknown } | undefined;
  const rotation = ks?.r as { a?: number; k?: unknown } | undefined;

  return {
    name: layer.nm || `Layer ${layerIndex}`,
    type: typeNames[(layer.ty as number)] || "Unknown",
    index: layerIndex,
    inPoint: layer.ip,
    outPoint: layer.op,
    position: pos?.k,
    opacity: opacity?.a === 1 ? "animated" : opacity?.k,
    scale: scale?.k,
    rotation: rotation?.a === 1 ? "animated" : rotation?.k,
  };
}

export type { Variation };
