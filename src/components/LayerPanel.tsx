"use client";

interface LottieLayer {
  nm?: string;
  ty: number;
  hd?: boolean;
  ind?: number;
}

interface LayerPanelProps {
  animationData: object | null;
  onSelectLayer: (layerName: string) => void;
  onToggleVisibility: (layerIndex: number, hidden: boolean) => void;
}

function getTypeIcon(ty: number): string {
  switch (ty) {
    case 4: return "◆";  // shape
    case 1: return "■";  // solid
    case 5: return "T";  // text
    case 2: return "🖼"; // image
    case 0:              // precomp
    case 3: return "📁"; // null
    default: return "○";
  }
}

function getTypeName(ty: number): string {
  switch (ty) {
    case 0: return "Precomp";
    case 1: return "Solid";
    case 2: return "Image";
    case 3: return "Null";
    case 4: return "Shape";
    case 5: return "Text";
    default: return "Layer";
  }
}

export default function LayerPanel({ animationData, onSelectLayer, onToggleVisibility }: LayerPanelProps) {
  const layers: LottieLayer[] = (animationData as Record<string, unknown>)?.layers as LottieLayer[] ?? [];

  // Reverse for render order: last in array = bottom layer visually
  const displayLayers = [...layers].reverse();

  if (!animationData || layers.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-zinc-500 text-sm">
        No layers found
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-zinc-900">
      <div className="px-3 py-2 border-b border-zinc-800 shrink-0">
        <span className="text-xs text-zinc-400 font-medium">{layers.length} layers</span>
      </div>
      <div className="flex-1 overflow-y-auto">
        {displayLayers.map((layer, displayIdx) => {
          // Original index in the layers array
          const originalIndex = layers.length - 1 - displayIdx;
          const name = layer.nm || `${getTypeName(layer.ty)} ${originalIndex}`;
          const icon = getTypeIcon(layer.ty);
          const isHidden = !!layer.hd;

          return (
            <div
              key={originalIndex}
              className={`flex items-center gap-2 px-3 py-2 border-b border-zinc-800/50 hover:bg-zinc-800 transition-colors group ${
                isHidden ? "opacity-50" : ""
              }`}
            >
              <span className="text-sm w-5 text-center shrink-0" title={getTypeName(layer.ty)}>
                {icon}
              </span>
              <button
                onClick={() => onSelectLayer(`[${name}]`)}
                className="flex-1 text-left text-sm text-zinc-200 truncate hover:text-zinc-100 transition-colors"
                title={name}
              >
                {name}
              </button>
              <button
                onClick={() => onToggleVisibility(originalIndex, !isHidden)}
                className={`shrink-0 w-7 h-7 flex items-center justify-center rounded text-xs transition-colors ${
                  isHidden
                    ? "text-zinc-600 hover:text-zinc-400 hover:bg-zinc-700"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700"
                }`}
                title={isHidden ? "Show layer" : "Hide layer"}
              >
                {isHidden ? "🚫" : "👁"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
