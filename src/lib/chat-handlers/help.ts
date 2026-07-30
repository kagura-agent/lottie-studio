import { sendDoneEvent } from "./helpers";

const HELP_TEXT = `# Available Commands

## Playback
- \`/play\` — Resume playback
- \`/pause\` — Pause playback
- \`/speed <n>x\` — Set playback speed (e.g. /speed 2x)
- \`/duration <t>\` — Set duration (e.g. /duration 2s)
- \`/goto <frame|time|%>\` — Seek to position
- \`/loop\` — Loop mode
- \`/once\` — Play once
- \`/reverse\` — Reverse playback direction

## Effects & Animation
- \`/fade\` — Fade in/out/pulse opacity transitions
- \`/slide\` — Directional slide in/out
- \`/blur\` — Animated blur/focus effects
- \`/shake\` — Shake/vibration with decay
- \`/wiggle\` — Continuous organic randomness
- \`/spring\` — Spring physics animation
- \`/draw\` — Stroke reveal/path drawing
- \`/morph\` — Morph shapes to target
- \`/particle\` — Particle effects (confetti, snow, sparkle, etc.)
- \`/trail\` — Motion trail/afterimage effect
- \`/camera\` — Camera movement (zoom, pan, shake, ken-burns)
- \`/path\` — Motion path animation
- \`/3d\` — 3D perspective effects (card flip, rotation, parallax depth)
- \`/repeat\` — Array/grid/circle patterns with staggered animation
- \`/text\` — Animated text layers

## Style & Color
- \`/color\` — Palette, shift, warm, cool, mono, invert, saturate
- \`/gradient\` — Animated gradient fill or stroke
- \`/shadow\` — Drop shadow, inner shadow, or glow
- \`/mask\` — Animated mask reveal/wipe effects
- \`/easing\` — Apply easing preset to keyframes
- \`/stagger\` — Stagger layer timing
- \`/style\` — Apply visual style

## Transform
- \`/trim\` — Extract a frame range
- \`/mirror\` — Flip horizontally or vertically
- \`/rotate\` — Rotate by degrees
- \`/scale\` — Scale elements
- \`/retime\` — Change animation duration

## Layers
- \`/layers\` — List all layers
- \`/duplicate-layer\` — Duplicate a layer
- \`/delete-layer\` — Delete a layer
- \`/rename-layer\` — Rename a layer
- \`/compose\` — Import layers from another animation

## Generation
- \`/random\` — Generate a surprise animation
- \`/variations\` — Generate multiple options from one prompt
- \`/import\` — Import animation from URL

## Utility
- \`/undo\` — Undo last change
- \`/redo\` — Redo
- \`/fix\` — Auto-diagnose and repair issues
- \`/critique\` — Get expert feedback
- \`/polish\` — AI-powered animation polish
- \`/a11y\` — Accessibility audit
- \`/presets\` — Manage animation presets
- \`/export\` — Export (gif, video, json, dotlottie)
- \`/resize\` — Resize canvas
- \`/bg\` — Set background color
- \`/help\` — Show this help

Type any command to get started, or just describe what you'd like to create in plain language!`;

export function handleHelp(): Response {
  return sendDoneEvent({ reply: HELP_TEXT });
}
