'use client'

import { useState, useRef, useEffect, useCallback } from 'react'

interface EasingEditorProps {
  animationData: unknown
  onChange: (updatedData: unknown) => void
}

interface EasingPreset {
  name: string
  values: [number, number, number, number] // [cp1x, cp1y, cp2x, cp2y]
}

const EASING_PRESETS: EasingPreset[] = [
  { name: 'Linear', values: [0, 0, 1, 1] },
  { name: 'Ease In', values: [0.42, 0, 1, 1] },
  { name: 'Ease Out', values: [0, 0, 0.58, 1] },
  { name: 'Ease In-Out', values: [0.42, 0, 0.58, 1] },
  { name: 'Spring', values: [0.175, 0.885, 0.32, 1.275] },
  { name: 'Snappy', values: [0.55, 0.085, 0.68, 0.53] },
]

// Generate SVG path for cubic bezier curve preview
function generateBezierPath(cp1x: number, cp1y: number, cp2x: number, cp2y: number): string {
  // Map from normalized [0,1] coordinates to 32x32 viewBox
  // Start at bottom-left (2, 30), end at top-right (30, 2)
  const startX = 2
  const startY = 30
  const endX = 30
  const endY = 2

  const c1x = startX + cp1x * (endX - startX)
  const c1y = startY - cp1y * (startY - endY)
  const c2x = startX + cp2x * (endX - startX)
  const c2y = startY - cp2y * (startY - endY)

  return `M ${startX} ${startY} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${endX} ${endY}`
}

function EasingCurvePreview({ values }: { values: [number, number, number, number] }) {
  const [cp1x, cp1y, cp2x, cp2y] = values
  const path = generateBezierPath(cp1x, cp1y, cp2x, cp2y)

  return (
    <svg
      viewBox="0 0 32 32"
      className="w-8 h-8"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      {/* Axes */}
      <line x1="2" y1="30" x2="30" y2="30" stroke="currentColor" strokeWidth="0.5" opacity="0.3" />
      <line x1="2" y1="2" x2="2" y2="30" stroke="currentColor" strokeWidth="0.5" opacity="0.3" />
      {/* Curve */}
      <path d={path} />
    </svg>
  )
}

export default function EasingEditor({ animationData, onChange }: EasingEditorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [modifiedCount, setModifiedCount] = useState<number | null>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  // Close popover on outside click
  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (event: MouseEvent) => {
      if (
        popoverRef.current &&
        buttonRef.current &&
        !popoverRef.current.contains(event.target as Node) &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  const applyEasing = useCallback(
    (cp1x: number, cp1y: number, cp2x: number, cp2y: number) => {
      if (!animationData || typeof animationData !== 'object') return

      let keyframeCount = 0
      const data = JSON.parse(JSON.stringify(animationData))

      // Traverse and modify keyframes with tangents
      function traverseKeyframes(obj: unknown): void {
        if (!obj || typeof obj !== 'object') return

        // Check if this is a keyframe array
        if (Array.isArray(obj)) {
          for (const item of obj) {
            const kf = item as Record<string, Record<string, unknown>>
            // Check if this is a keyframe with tangents
            if (
              kf &&
              typeof kf === 'object' &&
              kf.o &&
              kf.i &&
              typeof kf.o === 'object' &&
              typeof kf.i === 'object'
            ) {
              // Apply easing to this keyframe
              if (kf.o.x !== undefined && kf.o.y !== undefined) {
                kf.o.x = Array.isArray(kf.o.x) ? [cp1x] : cp1x
                kf.o.y = Array.isArray(kf.o.y) ? [cp1y] : cp1y
              }
              if (kf.i.x !== undefined && kf.i.y !== undefined) {
                kf.i.x = Array.isArray(kf.i.x) ? [cp2x] : cp2x
                kf.i.y = Array.isArray(kf.i.y) ? [cp2y] : cp2y
              }
              keyframeCount++
            }
            traverseKeyframes(item)
          }
        } else {
          // Recursively traverse object properties
          const record = obj as Record<string, unknown>
          for (const key in record) {
            if (Object.prototype.hasOwnProperty.call(record, key)) {
              traverseKeyframes(record[key])
            }
          }
        }
      }

      // Start traversal from layers
      if (data.layers && Array.isArray(data.layers)) {
        for (const layer of data.layers) {
          // Layer transform properties
          if (layer.ks) {
            traverseKeyframes(layer.ks)
          }

          // Shape layer properties
          if (layer.shapes && Array.isArray(layer.shapes)) {
            traverseKeyframes(layer.shapes)
          }

          // Text animator properties
          if (layer.t && layer.t.d && layer.t.d.k) {
            traverseKeyframes(layer.t.d.k)
          }
          if (layer.t && layer.t.a && Array.isArray(layer.t.a)) {
            traverseKeyframes(layer.t.a)
          }

          // Effect properties
          if (layer.ef && Array.isArray(layer.ef)) {
            traverseKeyframes(layer.ef)
          }

          // Masks
          if (layer.masksProperties && Array.isArray(layer.masksProperties)) {
            traverseKeyframes(layer.masksProperties)
          }
        }
      }

      // Traverse precomp assets
      if (data.assets && Array.isArray(data.assets)) {
        for (const asset of data.assets) {
          if (asset.layers && Array.isArray(asset.layers)) {
            for (const layer of asset.layers) {
              traverseKeyframes(layer)
            }
          }
        }
      }

      setModifiedCount(keyframeCount)
      onChange(data)

      // Clear count after 2 seconds
      setTimeout(() => setModifiedCount(null), 2000)
    },
    [animationData, onChange]
  )

  const handlePresetClick = useCallback(
    (preset: EasingPreset) => {
      const [cp1x, cp1y, cp2x, cp2y] = preset.values
      applyEasing(cp1x, cp1y, cp2x, cp2y)
    },
    [applyEasing]
  )

  return (
    <div className="relative">
      {/* Toolbar button */}
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        disabled={!animationData}
        className="min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0 px-2 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm transition-colors flex items-center justify-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
        title="Easing curves"
        aria-label="Easing curves"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="shrink-0"
          aria-hidden="true"
        >
          <path d="M2 14 C5 14, 11 2, 14 2" />
        </svg>
        <span className="text-xs">Easing</span>
      </button>

      {/* Popover */}
      {isOpen && (
        <div
          ref={popoverRef}
          className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-50 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl p-3 min-w-[280px]"
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-zinc-200">Easing Curves</h3>
              {modifiedCount !== null && (
                <span className="text-xs text-emerald-400">
                  {modifiedCount} keyframe{modifiedCount !== 1 ? 's' : ''} modified
                </span>
              )}
            </div>

            {/* Preset grid */}
            <div className="grid grid-cols-2 gap-2">
              {EASING_PRESETS.map((preset) => (
                <button
                  key={preset.name}
                  onClick={() => handlePresetClick(preset)}
                  className="flex flex-col items-center gap-2 p-3 bg-zinc-900 border border-zinc-700 rounded-lg hover:bg-zinc-700 hover:border-zinc-600 transition-colors text-zinc-300 min-h-[80px]"
                >
                  <EasingCurvePreview values={preset.values} />
                  <span className="text-xs font-medium">{preset.name}</span>
                </button>
              ))}
            </div>

            <p className="text-xs text-zinc-500 mt-2">
              Applies easing curve to all keyframes with tangent controls
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
