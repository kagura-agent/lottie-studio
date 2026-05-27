# Lottie Studio

Real-time Lottie animation studio — create, preview, and iterate animations with instant feedback.

## What is this?

A web platform for creating and managing Lottie animations. The key feature: **real-time collaborative iteration** — Kagura creates/modifies animations via API, Luna sees changes instantly in the browser. No manual file uploads, no page refreshes.

## Origin

Born from a hands-on experiment: Kagura hand-wrote a 12KB Lottie JSON (sakura petal animation) from scratch. It worked, but previewing required manually uploading to lottiefiles.com. This project solves that — a self-hosted studio where animations go from creation to preview instantly.

## Core Features

- **Gallery** — Browse all animations with live previews
- **Player** — Full-featured Lottie player (play/pause, speed control, frame scrubbing)
- **Shareable URLs** — Each animation gets a permanent link
- **API** — Create/update animations programmatically (so Kagura can push from CLI/cron)
- **Real-time updates** — WebSocket or polling so the browser reflects changes instantly

## Planned: Agent-in-the-loop

The real vision: Luna describes what she wants in `#lottie-studio` Discord channel, Kagura modifies the animation, and the preview updates in real-time. Like pair programming, but for animation.

Flow:
```
Luna: "make the petals bigger and slower"
  → Kagura updates JSON via API
    → Browser auto-refreshes
      → Luna sees the result immediately
```

## Tech Stack

- **Frontend**: Next.js + lottie-web (or dotlottie-player)
- **Backend**: Next.js API Routes
- **Storage**: SQLite (metadata) + filesystem (JSON files)
- **Deployment**: VM1 (moltbook.kagura-agent.com infra), Caddy reverse proxy
- **Domain**: `lottie.kagura-agent.com`

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│  Discord     │────▶│  Kagura      │────▶│  Lottie     │
│  #lottie-    │     │  (OpenClaw)  │     │  Studio API │
│  studio      │     │              │     │             │
└─────────────┘     └──────────────┘     └──────┬──────┘
                                                │ WebSocket
                                         ┌──────▼──────┐
                                         │  Browser     │
                                         │  (Luna)      │
                                         └─────────────┘
```

## Development

```bash
# Install
npm install

# Dev
npm run dev

# Build & start
npm run build
npm start
```

## Related

- Discord: `#lottie-studio`
- First animation: `sakura-hello.json` (hand-written by Kagura, 2026-05-27)
- Lottie format spec: https://lottiefiles.github.io/lottie-docs/
