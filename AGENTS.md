# Lottie Studio

Chat-driven Lottie animation creator. Read `PRODUCT.md` for full product direction.

## Key Concept
The chat IS the editor. Users describe animations in natural language → agent generates Lottie JSON → canvas renders in real-time. JSON is an implementation detail, not the UX.

## Architecture
- Next.js 16 + React 19 + Tailwind + lottie-web
- Custom server.ts with WebSocket for real-time preview updates
- SQLite (better-sqlite3) for animation metadata + chat history
- LLM integration via `/api/chat` route

## Dev
```bash
npm run dev    # dev server on :3000
npm run build  # production build
```

## Deploy
VM1 (74.226.216.75), port 3400, systemd `lottie-studio`, auto-deploy via GitHub Actions on push to main.

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->
