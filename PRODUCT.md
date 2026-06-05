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
┌─────────────────────────────────────────────┐
│              Lottie Studio (Web)             │
│                                              │
│  ┌──────────────┐    ┌────────────────────┐  │
│  │              │    │                    │  │
│  │   Canvas     │    │   Chat Panel       │  │
│  │  (lottie-web │    │                    │  │
│  │   preview)   │    │  User: "bouncing   │  │
│  │              │    │   red ball"        │  │
│  │   ┌──────┐   │    │                    │  │
│  │   │  ●   │   │    │  Agent: "Done!     │  │
│  │   │      │   │    │   I created..."   │  │
│  │   └──────┘   │    │                    │  │
│  │              │    │  User: "add shadow"│  │
│  │  [controls]  │    │  ...               │  │
│  └──────────────┘    └─────────┬──────────┘  │
│                                │              │
└────────────────────────────────┼──────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │   Backend (Next.js)      │
                    │                          │
                    │  /api/chat → LLM call    │
                    │  /api/animations → CRUD  │
                    │  WebSocket → live update │
                    │  SQLite → persistence    │
                    └──────────────────────────┘
```

## UI Layout

### Editor Page (`/editor/[id]` or `/editor/new`)

- **Left: Canvas** — Live Lottie preview with playback controls (play/pause/speed/scrub)
- **Right: Chat Panel** — Conversation with the agent, replaces the JSON editor as the primary interaction
- **Optional: JSON toggle** — Collapsible panel for power users to inspect/edit raw JSON
- **Header** — Animation name, save, gallery link, export

### Gallery Page (`/`)

- Grid of saved animations with live previews (already done)
- "New Animation" button → opens editor with empty canvas + chat

## Implementation Phases

### Phase 1: Chat Panel + LLM Integration
- [ ] Add chat UI component (message list + input)
- [ ] Backend `/api/chat` route that calls LLM with Lottie-generation system prompt
- [ ] LLM generates/modifies Lottie JSON, auto-saves via existing API
- [ ] WebSocket pushes update to canvas (already working)
- [ ] Conversation history maintained per animation (SQLite)

### Phase 2: Agent Quality
- [ ] System prompt with Lottie spec knowledge + examples
- [ ] Context-aware edits ("make it bigger" understands current state)
- [ ] Agent sends current JSON as context for modification requests
- [ ] Error handling: invalid JSON recovery, explain what went wrong
- [ ] Streaming responses for better UX

### Phase 3: Polish
- [ ] Collapsible JSON editor (power user toggle)
- [ ] Animation export (download .json, render to GIF/video)
- [ ] Template library (starter animations to remix via chat)
- [ ] Share links (public read-only preview)
- [ ] Mobile-friendly chat layout

## LLM Integration Design

### Backend Route: `/api/chat`

```
POST /api/chat
{
  "animationId": "uuid",
  "message": "make a bouncing red ball"
}
→ {
  "reply": "I created a bouncing red ball animation...",
  "animationData": { ...lottie json... }  // auto-saved
}
```

### System Prompt Strategy

The agent needs:
1. Lottie JSON spec knowledge (layers, shapes, keyframes, transforms, expressions)
2. Current animation JSON as context (for modifications)
3. Conversation history (for "make it faster", "change the color")
4. Examples of common animations (bouncing, rotating, fading, path following)

### LLM Backend

Use Floway (LLM proxy on VM1, port 3201) or direct provider API. Config via environment variable so it's swappable.

## Tech Stack

- **Frontend**: Next.js 16 + React 19 + Tailwind CSS + lottie-web
- **Backend**: Next.js API routes + custom server (WebSocket)
- **Database**: SQLite (better-sqlite3) — animations + chat history
- **LLM**: Configurable provider (Floway proxy / direct API)
- **Deploy**: VM1, port 3400, Caddy reverse proxy, CI/CD via GitHub Actions

## What This Is NOT

- Not a traditional motion design tool (no timeline, no keyframe dragging)
- Not a Lottie file converter/optimizer
- Not a code editor with syntax highlighting as the main UX
- The JSON editor is a debug tool, not the product
