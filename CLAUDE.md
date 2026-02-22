# CollabBoard

Real-time collaborative whiteboard with AI agent. Gauntlet AI project.

## Stack
- **Runtime**: Bun.serve() — single process serves HTTP, WebSocket, and bundled frontend
- **Frontend**: React + Konva.js (canvas rendering) + Zustand (state)
- **Sync**: WebSocket on `/ws/:boardId` with in-memory rooms, last-write-wins
- **AI Agent**: Anthropic Claude Haiku 4.5 with tool use, POST `/api/ai`
- **Entry point**: `server/index.ts` — imports `index.html` for Bun's HTML bundler

## Running
```sh
bun --hot server/index.ts     # Dev with HMR
bun server/index.ts           # Production
```

## Bun Rules
- Use `bun` not `node`, `npm`, or `vite`
- `Bun.serve()` for HTTP + WebSocket — no express, no ws
- Bun auto-loads `.env` — no dotenv
- HTML imports for frontend bundling — no Vite needed
- `bun test` for testing

## Architecture
```
server/index.ts   → Bun.serve: routes + WebSocket + AI handler
src/app/          → React App shell, main.tsx entry
src/canvas/       → Konva canvas, object rendering
src/store/        → Zustand stores (board, tool, ui)
src/sync/         → WebSocket client, cursor broadcast
src/ui/           → Toolbar, presence, AI panel, color picker, cursors
src/auth/         → Auth screen (simple name-based for now)
src/lib/          → Utilities (throttle, coords, ids)
shared/types.ts   → Shared types between client and server
```

## Key Patterns
- `applyLocal(action)` → update Zustand store + send via WebSocket
- `applyRemote(action)` → update Zustand store only (no re-send)
- BoardAction union type flows through: UI → store → sync → server → other clients
- AI agent produces BoardActions server-side, broadcasts to all clients
- Cursor sync throttled to 30fps, board coords (not screen coords)

## Environment
```
ANTHROPIC_API_KEY=   # Required for AI agent
PORT=3000            # Default server port
```
