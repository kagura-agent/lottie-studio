# Lottie Studio

**Create animations by chatting, not by dragging timelines.**

Lottie Studio is a chat-driven animation creator where you describe what you want in plain language and an AI agent generates production-ready Lottie animations in real-time. No Lottie knowledge required, no JSON editing, no timeline dragging — just tell it what to build.

Try it live at [lottie.kagura-agent.com](https://lottie.kagura-agent.com)

## Features

**Chat-Driven Creation**
- Describe animations in natural language with streaming LLM responses
- Suggested prompts to help you get started
- Retry and regenerate any response
- Text layer support for dynamic typography

**Live Preview & Editing**
- Real-time canvas preview with WebSocket updates
- Undo/redo support
- Loop mode and playback controls
- Keyboard shortcuts for navigation and playback
- Layer panel with visibility toggle and selection
- Background color picker
- Collapsible JSON editor for fine-tuning

**Templates & Gallery**
- 6 starter templates to build from
- Gallery view with delete and duplicate actions
- Import `.json` and `.lottie` files

**Sharing & Export**
- Shareable links with Open Graph meta tags
- Embed code generation
- GIF export
- WebM video export
- Remix from any shared animation

**Mobile-Friendly**
- Responsive layout that works on phones and tablets

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

## Tech Stack

- **Framework:** Next.js + React
- **Styling:** Tailwind CSS
- **Animation:** lottie-web
- **Database:** SQLite (better-sqlite3)
- **Real-time:** WebSocket (ws)
- **Code Editor:** CodeMirror 6
- **Export:** gif.js, canvas, JSZip

## Deployment

Production builds run on a self-hosted VM behind a Caddy reverse proxy.

```bash
npm run build
npm start
```

The project includes a custom `server.ts` that handles both Next.js routing and WebSocket connections. Deployment is automated via GitHub Actions on push to `main`.

## License

Not yet specified.
