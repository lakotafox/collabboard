# AI Development Log

CollabBoard -- Real-Time Collaborative Whiteboard

---

## Tools and Workflow

### Primary: Claude Code (Opus)
- Used as the primary development tool throughout the entire sprint
- Responsibilities: architecture planning, code generation, debugging, deployment configuration
- Ran in the terminal alongside the project, with full file system access
- CLAUDE.md file maintained to guide Bun-specific conventions and project context

### Browser Testing: Claude in Chrome (MCP)
- Chrome MCP extension used for live browser testing of the running application
- Verified UI rendering, WebSocket connection lifecycle, and real-time sync between tabs

### Parallel Research: 10 Agents
- Pre-Search phase used 10 parallel research agents to explore the decision space simultaneously
- Each agent focused on a specific domain (canvas libs, sync, auth, AI, deployment, etc.)
- Results synthesized into the architecture decision record

---

## MCP Usage

Claude in Chrome was used to:
- Open the running dev server and visually verify the canvas renders correctly
- Test WebSocket connections by observing real-time cursor and shape updates
- Confirm UI elements (toolbar, color picker, AI command input) are functional
- Verify deployment on Fly.io by navigating to the production URL

---

## Effective Prompts

### 1. Parallel Agent Research Launch
```
"deploy 10 agents to look at different parts of the whole have them make mini plans"
```
This launched 10 parallel research agents covering: canvas libraries, sync architecture, authentication, AI agent design, deployment, persistence, performance optimization, cursor sharing, project structure, and existing codebase analysis. Each agent produced a focused mini-plan that fed into the Pre-Search document.

### 2. Live Browser Verification
```
"open it in the browser and test it"
```
Triggered Claude in Chrome MCP to navigate to the running dev server, take screenshots, and verify that the application was rendering and functioning as expected. Used iteratively after major changes.

### 3. Full Stack Scaffolding
```
"scaffold the full project - bun.serve monolith with websocket, react+konva frontend,
zustand store, shared types, dockerfile, fly.toml. use the architecture from pre-search."
```
Generated the complete project skeleton in a single pass: server entry point, WebSocket handler, React app with Konva canvas, Zustand store with sync middleware, shared type definitions, Docker and Fly.io configuration.

### 4. AI Agent Tool Definitions
```
"add an AI agent using claude haiku 4.5 with tool use. define 9 tools for canvas
manipulation - create shapes, add text, change colors, move, resize, delete, arrange
layers, clear board, add sticky notes. server-side execution, broadcast results."
```
Produced the complete AI integration: Anthropic API client, tool schemas, execution handler, and WebSocket broadcast of AI-generated mutations.

### 5. Deployment Debugging
```
"deploy to fly.io, watch the logs, and fix whatever breaks"
```
Iterative deployment loop: push to Fly.io, monitor logs for errors, fix issues (port binding, health check path, environment variables), redeploy. Resolved all deployment issues within a few cycles.

---

## Code Analysis

### AI vs Human Contribution
- **~90% AI-generated code:** Project scaffolding, WebSocket server, Konva canvas components, Zustand store, AI agent tools, Dockerfile, fly.toml, type definitions, utility functions
- **~10% hand-guided adjustments:** Bun-specific API corrections, HMR reconnection fix, design polish, prompt refinement, CLAUDE.md maintenance

### Where AI Excelled
- **Project scaffolding:** Generated the full directory structure and boilerplate in one pass
- **WebSocket server:** Bun.serve() websocket handler with room-based broadcast and message validation
- **Konva canvas setup:** React-Konva component hierarchy with drag, resize, and selection
- **Zustand store architecture:** Store with WebSocket sync middleware and optimistic updates
- **AI agent tool definitions:** 9 tool schemas with parameter validation and execution handlers
- **Dockerfile and fly.toml:** Production-ready container and deployment configuration

### Where AI Struggled
- **Bun-specific APIs:** Initially generated Vite-based dev server code; needed CLAUDE.md guidance to use Bun.serve() HTML imports instead. Bun's bundler API differs from webpack/esbuild conventions and the model's training data lagged behind Bun's release cycle.
- **Design discipline:** Generated content with emojis by default; required explicit correction and CLAUDE.md rules to maintain a clean, professional style.
- **HMR WebSocket reconnection:** The dev server's hot-reload created a WebSocket reconnection loop. The model's fixes were circular; manual debugging and a targeted fix were needed.

---

## Key Learnings

1. **Parallel agent research is highly effective for Pre-Search.** 10 agents produced comprehensive, domain-specific analysis in approximately 3 minutes. This is dramatically faster than serial research and surfaces tradeoffs that a single pass would miss.

2. **Bun.serve() HTML imports eliminate the bundler layer.** No Vite, no webpack, no esbuild config. The server imports and serves the frontend directly. This simplification removed an entire class of build tooling problems.

3. **Prior multiplayer experience accelerates architecture decisions.** Having built the world-builder project with PartyKit meant the real-time sync patterns (room broadcast, state reconciliation, cursor sharing) were already internalized. The Pre-Search validated rather than discovered.

4. **AI-first development can scaffold a full-stack collaborative app in hours.** The combination of Claude Code for generation and Chrome MCP for verification creates a tight feedback loop. The bottleneck shifts from writing code to reviewing and correcting AI output.

5. **CLAUDE.md as persistent context is essential.** Without the project-specific instruction file, the model repeatedly fell back to defaults (Vite, npm, emoji-heavy output). Maintaining CLAUDE.md throughout the sprint kept generation aligned with project conventions.
