# Lottie Studio — Product Direction

## Vision

**Chat-driven animation creation.** Users don't write JSON or drag timeline keyframes — they describe what they want in natural language, and an embedded AI agent generates and iterates Lottie animations in real-time.

The chat IS the editor. The canvas IS the feedback loop.

## Core Experience

```
User: "make a pink sakura petal falling and spinning"
→ Agent generates Lottie JSON
→ Preview renders instantly
→ User: "slower, and add 3 more petals scattering"
→ Agent modifies JSON
→ Preview updates in real-time
```

### Key Principles

1. **Zero learning curve** — No Lottie knowledge required. No JSON editing. Talk to it like you'd talk to a designer.
2. **Real-time feedback** — Every change appears instantly on the canvas. The conversation is iterative: describe → see → refine.
3. **Agent as creative tool** — The LLM understands Lottie spec and translates intent into animation. It maintains conversation context so "make it bigger" knows what "it" is.
4. **JSON is an implementation detail** — Users never need to see or touch JSON. Power users CAN toggle a JSON view, but it's not the primary interface.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                 Lottie Studio (Web)                  │
│                                                      │
│  ┌──────────────────┐    ┌────────────────────────┐  │
│  │                  │    │                        │  │
│  │   Canvas         │    │   Chat Panel           │  │
│  │  (lottie-web)    │    │  + Prompt Suggestions  │  │
│  │                  │    │  + Voice Input          │  │
│  │  ┌───────────┐   │    │  + Command Palette     │  │
│  │  │ Preview   │   │    │  + Before/After Toggle │  │
│  │  │ + Controls│   │    │                        │  │
│  │  └───────────┘   │    │  User: "bouncing ball" │  │
│  │                  │    │  Agent: "Done! ..."    │  │
│  │  Layer Panel     │    │  [Inline Preview]       │  │
│  │  Timeline        │    │  Suggestions: [...]     │  │
│  │  Quality Panel   │    │                        │  │
│  └──────────────────┘    └─────────┬──────────────┘  │
│                                    │                  │
│  Toolbar: Export | Import | Share | Embed | Theme     │
│  Cmd+K: Command Palette                              │
└────────────────────────────────────┼──────────────────┘
                                     │
                      ┌──────────────▼──────────────┐
                      │   Backend (Next.js 16)       │
                      │                              │
                      │  /api/chat → LLM (streaming) │
                      │  /api/animations → CRUD       │
                      │  /api/templates → presets      │
                      │  /api/collections → organize   │
                      │  /api/generate → quick gen     │
                      │  /api/import-svg → SVG→Lottie  │
                      │  WebSocket → live update       │
                      │  SQLite → persistence          │
                      └────────────────────────────────┘
```

## UI Layout

### Editor Page (`/editor/[id]` or `/editor/new`)

- **Left: Canvas** — Live Lottie preview with playback controls (play/pause/speed/scrub)
- **Right: Chat Panel** — Conversation with the agent, primary interaction surface
- **Toggle Panels** — JSON editor, layer panel, keyframe timeline, quality panel, easing editor
- **Header** — Animation name, save, export dropdown, import, embed, share, theme
- **Onboarding Tour** — First-time guided walkthrough

### Gallery Page (`/`)

- Hero welcome section with animated chat bubbles
- Grid of saved animations with live previews and Quick Generate widget
- "New Animation" button → opens editor with empty canvas + chat

### Explore Page (`/explore`)

- Community animations with search, sort, tag filtering
- Featured spotlight (daily rotation)
- Infinite scroll, remix counts, lineage display

### Share Page (`/share/[id]`)

- Public read-only animation preview with OG/Twitter metadata
- JSON-LD structured data, related animations
- Code snippets (HTML, React, Vue, React Native, dotLottie, CSS)

### Docs Page (`/docs`)

- Interactive API documentation with live Lottie previews

## Implementation Phases

### Phase 1: Chat Panel + LLM Integration ✅
- [x] Chat UI component (message list + input + prompt suggestions)
- [x] Backend `/api/chat` route with LLM streaming
- [x] LLM generates/modifies Lottie JSON, auto-saves
- [x] WebSocket pushes updates to canvas in real-time
- [x] Conversation history per animation (SQLite)
- [x] Voice input for chat messages
- [x] Command detection (play/pause/speed/export via natural language)

### Phase 2: Agent Quality ✅
- [x] Comprehensive system prompt with Lottie spec (2100+ lines, selective injection)
- [x] Context-aware edits (current animation JSON sent as context)
- [x] Undo/redo with version history
- [x] Error handling: invalid JSON recovery with auto-repair stream
- [x] Streaming responses with inline animation previews
- [x] Before/after toggle for modification messages
- [x] Design tokens (brand colors) integration
- [x] Animation quality guidelines (anticipation, overshoot, secondary motion)
- [x] Layer manipulation commands (/layers, /duplicate, /delete, /rename)
- [x] Animation style presets (save/load/delete/rename motion patterns)
- [x] Variation mode (generate multiple options from one prompt)

### Phase 3: Polish ✅
- [x] Collapsible JSON editor with syntax highlighting
- [x] Export: JSON, dotLottie, GIF, MP4 (H.264), WebM, APNG, CSS, TGS (Telegram sticker)
- [x] Template library (21 starter animations across 8 categories)
- [x] Share links with OG/Twitter cards and dynamic thumbnails
- [x] Mobile-responsive layout
- [x] i18n (English + Chinese) with language switcher
- [x] Accessibility (ARIA labels, keyboard navigation, screen reader support)
- [x] Custom 404 and error pages with Lottie illustrations
- [x] Command palette (Ctrl+K / Cmd+K)
- [x] Keyboard shortcuts help panel
- [x] Import: JSON, SVG (with AI-suggested auto-animation), dotLottie
- [x] Collections (organize animations into groups)
- [x] Explore page with search, sort, tags, featured spotlight
- [x] Embed dialog with iframe code
- [x] Code snippets (HTML, React, Vue, React Native, dotLottie, CSS)
- [x] Theme panel (editor appearance)
- [x] Onboarding tour for first-time users
- [x] Layer panel for animation structure visualization
- [x] Keyframe timeline
- [x] Color palette and easing editor
- [x] Quality panel (animation optimization)
- [x] Artboard/canvas size picker
- [x] Background picker
- [x] Fullscreen preview mode
- [x] Quick Generate widget on landing page
- [x] Remix lineage and remix count display
- [x] /random command (curated surprise prompts)
- [x] Comprehensive README with hero screenshot
- [x] CI/CD with GitHub Actions (test + deploy)
- [x] PWA with service worker
- [x] SEO: sitemap, robots.txt, OG metadata, JSON-LD

### Phase 4: Growth & Depth (planned)
- [x] User accounts (save personal galleries, attribution, preferences)
- [x] Social features (comments, likes, follows, activity feed)
- [x] Animation sequences/storyboards (data model, API, /sequence chat commands)
- [x] Collaborative editing (real-time multi-user sessions)
- [x] Public API with keys (generate animations programmatically)
- [x] Server-side animation thumbnails (render actual animation frames for OG cards)
- [x] Advanced LLM features (/critique, /polish, /style with free-form descriptions)
- [ ] Plugin system (community-contributed animation effects)
- [x] Analytics dashboard (views, popular animations, usage patterns)
- [ ] Monetization foundation (premium templates, API tiers)

## LLM Integration Design

### Backend Route: `/api/chat`

```
POST /api/chat
{
  "animationId": "uuid",        // optional — creates new if omitted
  "message": "make a bouncing red ball",
  "image": "data:image/png;base64,...",  // optional image attachment
  "regenerate": false,           // regenerate last response
  "designTokens": {...}          // optional brand colors
}

→ SSE stream:
  data: {"type": "chunk", "text": "I created..."}
  data: {"type": "done", "reply": "...", "lottieJson": {...}, "animationId": "uuid", "suggestions": [...]}
```

### System Prompt Strategy

The agent uses a 2100+ line prompt system with:
1. **Selective spec injection** — Only relevant Lottie spec sections are included based on user intent analysis
2. **Example registry** — Curated animation examples matched to user request type
3. **Current animation context** — Full JSON of existing animation for modifications
4. **Conversation history** — Compacted message history for continuity
5. **Quality guidelines** — Automatic polish (anticipation, overshoot, secondary motion) for vague prompts; exact execution for specific prompts
6. **Command detection** — Natural language → UI commands (play, pause, speed, export, resize, markers)
7. **Design tokens** — Brand color injection when set
8. **Auto-repair** — Invalid JSON responses trigger a repair stream with error description

### LLM Backend

Configurable via `LLM_API_URL` and `LLM_API_KEY` environment variables. Currently uses Floway proxy (LLM gateway). Supports any OpenAI-compatible API.

## Tech Stack

- **Frontend**: Next.js 16 + React 19 + Tailwind CSS 4 + lottie-web
- **Backend**: Next.js API routes + custom WebSocket server (tsx)
- **Database**: SQLite (better-sqlite3) — animations, messages, versions, collections, presets
- **LLM**: Configurable OpenAI-compatible provider (Floway proxy / direct API)
- **Export**: GIF (gif.js), MP4 (mp4-muxer + WebCodecs), WebM (MediaRecorder), APNG, TGS, dotLottie, CSS
- **Import**: JSON, SVG→Lottie conversion, dotLottie extraction
- **i18n**: next-intl (en/zh)
- **Testing**: Vitest (948 tests, 49 test files)
- **Deploy**: VM1 (lottie.kagura-agent.com), port 3400, Caddy reverse proxy, GitHub Actions CI/CD

## What This Is NOT

- Not a traditional motion design tool (no timeline dragging, no manual keyframe placement)
- Not a Lottie file converter/optimizer (though optimization is built-in)
- Not a code editor with syntax highlighting as the main UX
- The JSON editor is a power-user debug tool, not the product
