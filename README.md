# Lottie Studio

**Create animations by chatting, not by dragging timelines.**

Lottie Studio is a chat-driven animation creator where you describe what you want in plain language and an AI agent generates production-ready Lottie animations in real-time. No Lottie knowledge required, no JSON editing, no timeline dragging — just tell it what to build.

Try it live at [lottie.kagura-agent.com](https://lottie.kagura-agent.com)

## Features

### Chat-Driven Creation
- Describe animations in natural language — the AI generates Lottie JSON
- Streaming responses for real-time feedback
- Suggested prompts help you get started on a blank canvas
- Retry and regenerate any response
- Attach reference images for vision-based generation
- Auto-repair: if the AI generates invalid JSON, it automatically retries with error context
- Smart context: conversation history is compacted to stay within token limits while preserving meaning
- Selective Lottie spec injection based on detected user intent

### Live Preview & Editing
- Real-time canvas preview with WebSocket updates
- Undo/redo history
- Playback controls: play/pause, speed (0.5×/1×/2×), loop modes (loop/once/bounce), frame scrubbing
- Fullscreen preview mode
- Inline animation previews in chat messages
- Layer panel with visibility toggle, opacity slider, and drag-and-drop reorder
- Easing curve editor with visual Bézier controls
- Animation duration and speed editor
- Color palette editor for quick color changes
- Artboard size picker (common presets + custom)
- Background picker (checkered, white, black, custom)
- Keyboard shortcuts for all major actions
- Collapsible JSON editor (CodeMirror 6) for fine-tuning

### Templates & Import
- 10 starter templates across categories (motion, rotation, scale, looping, opacity, multi-layer, UI)
- Import `.json` and `.lottie` files via drag-and-drop or file picker
- Import animations from URL (LottieFiles links, direct JSON URLs)
- Remix any shared animation into your own

### Sharing & Export
- Shareable links with Open Graph meta tags
- Embed code generation (iframe snippet)
- Export as `.json`, `.lottie` (dotLottie), GIF, or WebM video
- Duplicate animations
- Version history with one-click restore

### Mobile-Friendly
- Responsive layout with tab switching (Canvas / Chat / Layers)
- Touch-friendly controls and overflow menu

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### Setup

```bash
git clone https://github.com/kagura-agent/lottie-studio.git
cd lottie-studio
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `LLM_API_URL` | LLM API base URL (OpenAI-compatible) | `http://localhost:8000/v1` |
| `LLM_API_KEY` | API key for the LLM provider | — |
| `LLM_MODEL` | Model name | `claude-sonnet-4-6` |

## Tech Stack

- **Framework:** Next.js 16 + React 19
- **Styling:** Tailwind CSS 4
- **Animation:** lottie-web
- **Database:** SQLite (better-sqlite3)
- **Real-time:** WebSocket (ws)
- **Code Editor:** CodeMirror 6
- **Export:** gif.js, canvas, JSZip
- **Testing:** Vitest

## Deployment

Production builds run on a self-hosted VM behind a Caddy reverse proxy.

```bash
npm run build
npm start
```

The project includes a custom `server.ts` that handles both Next.js routing and WebSocket connections. Deployment is automated via GitHub Actions on push to `main`.

## License

MIT
