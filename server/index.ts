import index from "../index.html"
import type { BoardObject, BoardAction, WSMessage, UserPresence, CursorData, BoardMeta, BoardListItem } from "../shared/types"

// ============================================================
// Board state management (in-memory with persistence)
// ============================================================

interface BoardRoom {
  objects: Map<string, BoardObject>
  users: Map<string, UserPresence>
  sockets: Map<string, { ws: any; userId: string; name: string; color: string }>
}

const rooms = new Map<string, BoardRoom>()

// Per-board conversation history for AI context
const chatHistories = new Map<string, Array<{ role: string; content: any }>>()

// Board metadata for the hub
const boardMetas = new Map<string, BoardMeta>()

function ensureBoardMeta(boardId: string, creatorId?: string, creatorName?: string): BoardMeta {
  if (!boardMetas.has(boardId)) {
    boardMetas.set(boardId, {
      id: boardId,
      name: boardId,
      createdBy: creatorId || 'unknown',
      createdByName: creatorName || 'Unknown',
      visibility: 'public',
      inviteCode: null,
      createdAt: Date.now(),
      userCount: 0,
    })
  }
  return boardMetas.get(boardId)!
}

function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  for (const meta of boardMetas.values()) {
    if (meta.inviteCode === code) return generateInviteCode()
  }
  return code
}

function getBoardList(requestingUserId: string): BoardListItem[] {
  const list: BoardListItem[] = []
  boardMetas.forEach((meta) => {
    const room = rooms.get(meta.id)
    const userCount = room?.users.size ?? 0
    const isOwner = meta.createdBy === requestingUserId
    if (meta.visibility === 'public' || isOwner) {
      list.push({ ...meta, userCount, isOwner })
    }
  })
  return list.sort((a, b) => b.createdAt - a.createdAt)
}

function getRoom(boardId: string): BoardRoom {
  if (!rooms.has(boardId)) {
    rooms.set(boardId, {
      objects: new Map(),
      users: new Map(),
      sockets: new Map(),
    })
  }
  return rooms.get(boardId)!
}

function applyAction(objects: Map<string, BoardObject>, action: BoardAction): void {
  switch (action.type) {
    case 'object:create':
      objects.set(action.object.id, action.object)
      break
    case 'object:update': {
      const obj = objects.get(action.id)
      if (obj) objects.set(action.id, { ...obj, ...action.props })
      break
    }
    case 'object:delete':
      objects.delete(action.id)
      break
    case 'object:batch':
      for (const sub of action.actions) {
        applyAction(objects, sub)
      }
      break
  }
}

function broadcastToRoom(boardId: string, msg: WSMessage, excludeSocketId?: string) {
  const room = rooms.get(boardId)
  if (!room) return
  const data = JSON.stringify(msg)
  room.sockets.forEach((sock, socketId) => {
    if (socketId !== excludeSocketId) {
      try { sock.ws.send(data) } catch {}
    }
  })
}

function objectsToRecord(objects: Map<string, BoardObject>): Record<string, BoardObject> {
  const record: Record<string, BoardObject> = {}
  objects.forEach((obj, id) => { record[id] = obj })
  return record
}

// ============================================================
// AI Agent handler
// ============================================================

async function handleAIRequest(body: { message: string; boardId: string; userId: string }) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return { message: "AI not configured. Set ANTHROPIC_API_KEY in .env" }
  }

  const room = getRoom(body.boardId)
  const boardState = objectsToRecord(room.objects)

  // Build board context
  const objectList = Object.values(boardState).slice(0, 100).map(obj => ({
    id: obj.id,
    type: obj.type,
    x: Math.round(obj.x),
    y: Math.round(obj.y),
    width: Math.round(obj.width),
    height: Math.round(obj.height),
    text: obj.text?.slice(0, 200),
    fill: obj.fill,
  }))

  const tools = [
    {
      name: "createStickyNote",
      description: "Create a sticky note on the board",
      input_schema: {
        type: "object" as const,
        required: ["text", "x", "y"],
        properties: {
          text: { type: "string" as const, description: "Text content of the sticky note" },
          x: { type: "number" as const, description: "X position on the board" },
          y: { type: "number" as const, description: "Y position on the board" },
          color: { type: "string" as const, description: "Background color (default: #FFF176)", enum: ["#FFF176", "#80DEEA", "#A5D6A7", "#F48FB1", "#FFAB91", "#CE93D8"] },
        },
      },
    },
    {
      name: "createShape",
      description: "Create a rectangle or circle on the board. For flowcharts, use rect with 180-220px width and 70-90px height. Remember the x,y,width,height values — you'll need them to connect lines to the shape edges later.",
      input_schema: {
        type: "object" as const,
        required: ["shapeType", "x", "y", "width", "height"],
        properties: {
          shapeType: { type: "string" as const, enum: ["rect", "circle"], description: "Type of shape" },
          x: { type: "number" as const, description: "Left edge X position" },
          y: { type: "number" as const, description: "Top edge Y position" },
          width: { type: "number" as const, description: "Width in pixels" },
          height: { type: "number" as const, description: "Height in pixels" },
          color: { type: "string" as const, description: "Fill color. Good options: #89b4fa (blue), #f38ba8 (pink), #a6e3a1 (green), #f9e2af (yellow), #cba6f7 (purple), #fab387 (orange), #94e2d5 (teal), #45475a (gray)" },
          text: { type: "string" as const, description: "Optional text label inside the shape" },
        },
      },
    },
    {
      name: "createFrame",
      description: "Create a frame (grouping container) on the board",
      input_schema: {
        type: "object" as const,
        required: ["title", "x", "y", "width", "height"],
        properties: {
          title: { type: "string" as const },
          x: { type: "number" as const },
          y: { type: "number" as const },
          width: { type: "number" as const },
          height: { type: "number" as const },
        },
      },
    },
    {
      name: "moveObject",
      description: "Move an existing object to a new position",
      input_schema: {
        type: "object" as const,
        required: ["objectId", "x", "y"],
        properties: {
          objectId: { type: "string" as const },
          x: { type: "number" as const },
          y: { type: "number" as const },
        },
      },
    },
    {
      name: "updateText",
      description: "Update the text content of a sticky note or text element",
      input_schema: {
        type: "object" as const,
        required: ["objectId", "newText"],
        properties: {
          objectId: { type: "string" as const },
          newText: { type: "string" as const },
        },
      },
    },
    {
      name: "changeColor",
      description: "Change the color of an existing object",
      input_schema: {
        type: "object" as const,
        required: ["objectId", "color"],
        properties: {
          objectId: { type: "string" as const },
          color: { type: "string" as const },
        },
      },
    },
    {
      name: "deleteObject",
      description: "Delete an object from the board",
      input_schema: {
        type: "object" as const,
        required: ["objectId"],
        properties: {
          objectId: { type: "string" as const },
        },
      },
    },
    {
      name: "resizeObject",
      description: "Resize an existing object",
      input_schema: {
        type: "object" as const,
        required: ["objectId", "width", "height"],
        properties: {
          objectId: { type: "string" as const },
          width: { type: "number" as const },
          height: { type: "number" as const },
        },
      },
    },
    {
      name: "createLine",
      description: "Draw a line/connector between two points. To connect shapes, calculate edge coordinates: bottom of shape A = (A.x + A.width/2, A.y + A.height), top of shape B = (B.x + B.width/2, B.y).",
      input_schema: {
        type: "object" as const,
        required: ["x1", "y1", "x2", "y2"],
        properties: {
          x1: { type: "number" as const, description: "Start X (e.g. shape's bottom-center: shape.x + shape.width/2)" },
          y1: { type: "number" as const, description: "Start Y (e.g. shape's bottom edge: shape.y + shape.height)" },
          x2: { type: "number" as const, description: "End X (e.g. target shape's top-center: target.x + target.width/2)" },
          y2: { type: "number" as const, description: "End Y (e.g. target shape's top edge: target.y)" },
          color: { type: "string" as const, description: "Line color (default: #cdd6f4)" },
        },
      },
    },
    {
      name: "createText",
      description: "Create a text label on the board (not inside a shape)",
      input_schema: {
        type: "object" as const,
        required: ["text", "x", "y"],
        properties: {
          text: { type: "string" as const, description: "Text content" },
          x: { type: "number" as const },
          y: { type: "number" as const },
          fontSize: { type: "number" as const, description: "Font size in px (default: 16)" },
          color: { type: "string" as const, description: "Text color (default: #cdd6f4)" },
        },
      },
    },
    {
      name: "getBoardState",
      description: "Get current objects on the board for context",
      input_schema: {
        type: "object" as const,
        properties: {},
      },
    },
  ]

  const systemPrompt = `You are an AI assistant for Masterboard, a collaborative whiteboard app.
You create diagrams, charts, layouts, and visual content using the available tools.

COORDINATE SYSTEM:
- Origin (0,0) is top-left. X increases right, Y increases down. Units are pixels.
- Visible area is roughly 0–1920 x 0–1080 at zoom=1.
- Center of the visible area is approximately (960, 540).

STICKY NOTE COLORS: #FFF176 (yellow), #80DEEA (cyan), #A5D6A7 (green), #F48FB1 (pink), #FFAB91 (orange), #CE93D8 (purple)
SHAPE COLORS: #89b4fa (blue), #f38ba8 (red/pink), #a6e3a1 (green), #f9e2af (yellow), #cba6f7 (purple), #fab387 (orange), #94e2d5 (teal), #45475a (dark gray)

CONNECTING LINES TO SHAPES — THIS IS CRITICAL:
When drawing a line to connect two shapes, you MUST calculate the exact edge coordinates.
- The CENTER of a shape at (x, y) with width w and height h is: (x + w/2, y + h/2)
- To connect from the BOTTOM edge of shape A to the TOP edge of shape B:
  Line from (A.x + A.w/2, A.y + A.h) to (B.x + B.w/2, B.y)
- To connect from the RIGHT edge of shape A to the LEFT edge of shape B:
  Line from (A.x + A.w, A.y + A.h/2) to (B.x, B.y + B.h/2)
- NEVER guess coordinates. Always calculate from the actual x, y, width, height you used for the shapes.

LAYOUT RULES FOR CHARTS AND DIAGRAMS:
1. HIERARCHY (org charts, flowcharts): Use TOP-DOWN layout.
   - Root node centered near top (x=~760, y=100), typically 200x80.
   - Each level 150–180px below the previous.
   - Siblings spread horizontally with 40–60px gaps, centered under their parent.
   - Connect parent bottom-center → child top-center with lines.

2. GRID LAYOUTS (SWOT, comparison, matrices): Use a 2x2 or NxM grid.
   - Start around (200, 100). Each cell 350–400px wide, 300–350px tall, 30px gap.
   - Use frames as section containers, sticky notes inside.

3. PROCESS FLOWS (timelines, pipelines): Use LEFT-TO-RIGHT layout.
   - Start around (100, 300). Each step 180x80, spaced 60px apart.
   - Connect right-center of one step → left-center of the next.

4. MIND MAPS: Center topic at (760, 400). Branches radiate outward.
   - Main branches 250px from center, sub-branches another 200px out.

SIZING GUIDELINES:
- Flowchart boxes: 180–220px wide, 70–90px tall
- Sticky notes: 150x150 default (good for short text)
- Frames/containers: 350–500px wide, 250–400px tall
- Text labels: use createText for standalone labels, or put text inside shapes

STYLE RULES:
- Use distinct colors for different categories/sections.
- Lines should be #cdd6f4 (light) or match the source shape's color for emphasis.
- For titled sections, use createFrame with a title, then place items inside.
- Keep 20–40px padding between frame edges and inner content.

Current board state (${objectList.length} objects):
${objectList.length > 0 ? JSON.stringify(objectList, null, 2) : '(empty board)'}

Execute the user's request using the tools. Plan your layout mentally first, then create all shapes, THEN connect them with lines using the exact coordinates you placed them at.`

  // Get or create conversation history for this board
  if (!chatHistories.has(body.boardId)) chatHistories.set(body.boardId, [])
  const history = chatHistories.get(body.boardId)!

  // Keep history manageable (last 20 messages)
  while (history.length > 20) { history.shift() }

  // Add user message to history
  history.push({ role: "user", content: body.message })

  try {
    let messages = history.map(m => ({ role: m.role, content: m.content }))
    let responseText = ""
    let totalActions = 0

    // Agentic loop: up to 5 rounds of tool use
    for (let round = 0; round < 5; round++) {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 4096,
          system: systemPrompt,
          tools,
          messages,
        }),
      })

      const result = await response.json()

      // Handle API errors
      if (result.error) {
        console.error("[AI] API error:", result.error)
        return { message: `AI error: ${result.error.message || JSON.stringify(result.error)}` }
      }

      const actions: BoardAction[] = []

      // Process response blocks
      for (const block of result.content || []) {
        if (block.type === "text") {
          responseText += block.text
        } else if (block.type === "tool_use") {
          const action = executeToolCall(block.name, block.input, body.boardId)
          if (action) actions.push(action)
        }
      }

      // Apply and broadcast any actions
      if (actions.length > 0) {
        const batchAction: BoardAction = actions.length === 1 ? actions[0] : { type: 'object:batch', actions }
        applyAction(room.objects, batchAction)
        broadcastToRoom(body.boardId, { type: 'action', action: batchAction, userId: 'ai-agent' })
        totalActions += actions.length
      }

      // If model is done (end_turn or no more tool calls), break
      if (result.stop_reason !== "tool_use") break

      // Build tool results for next round
      const toolResults = result.content
        .filter((b: any) => b.type === "tool_use")
        .map((b: any) => {
          // Return actual board state for getBoardState
          if (b.name === "getBoardState") {
            const freshState = Object.values(objectsToRecord(room.objects)).slice(0, 100).map(obj => ({
              id: obj.id, type: obj.type, x: Math.round(obj.x), y: Math.round(obj.y),
              width: Math.round(obj.width), height: Math.round(obj.height),
              text: obj.text?.slice(0, 200), fill: obj.fill,
            }))
            return { type: "tool_result" as const, tool_use_id: b.id, content: JSON.stringify(freshState) }
          }
          return { type: "tool_result" as const, tool_use_id: b.id, content: JSON.stringify({ success: true }) }
        })

      // Add assistant response + tool results to messages for next round
      messages = [...messages, { role: "assistant", content: result.content }, { role: "user", content: toolResults }]
    }

    // Save assistant response to history
    const reply = responseText || `Done! Modified ${totalActions} element(s).`
    history.push({ role: "assistant", content: reply })

    return { message: reply }
  } catch (err: any) {
    console.error("[AI] Error:", err)
    return { message: `AI error: ${err.message}` }
  }
}

function executeToolCall(name: string, input: any, boardId: string): BoardAction | null {
  const id = crypto.randomUUID()
  const baseObj = {
    rotation: 0,
    stroke: '#000000',
    strokeWidth: 0,
    opacity: 1,
    text: '',
    fontSize: 14,
  }

  switch (name) {
    case "createStickyNote":
      return {
        type: 'object:create',
        object: {
          ...baseObj,
          id,
          type: 'sticky',
          x: input.x,
          y: input.y,
          width: 150,
          height: 150,
          fill: input.color || '#FFF176',
          text: input.text,
          zIndex: getRoom(boardId).objects.size,
        },
      }

    case "createShape":
      return {
        type: 'object:create',
        object: {
          ...baseObj,
          id,
          type: input.shapeType === 'circle' ? 'circle' : 'rect',
          x: input.x,
          y: input.y,
          width: input.width,
          height: input.height,
          fill: input.color || '#45475a',
          text: input.text || '',
          strokeWidth: 2,
          stroke: '#585b70',
          zIndex: getRoom(boardId).objects.size,
        },
      }

    case "createFrame":
      return {
        type: 'object:create',
        object: {
          ...baseObj,
          id,
          type: 'frame',
          x: input.x,
          y: input.y,
          width: input.width,
          height: input.height,
          fill: 'rgba(255,255,255,0.03)',
          stroke: '#585b70',
          strokeWidth: 2,
          text: input.title,
          zIndex: getRoom(boardId).objects.size,
        },
      }

    case "moveObject":
      return { type: 'object:update', id: input.objectId, props: { x: input.x, y: input.y } }

    case "updateText":
      return { type: 'object:update', id: input.objectId, props: { text: input.newText } }

    case "changeColor":
      return { type: 'object:update', id: input.objectId, props: { fill: input.color } }

    case "deleteObject":
      return { type: 'object:delete', id: input.objectId }

    case "resizeObject":
      return { type: 'object:update', id: input.objectId, props: { width: input.width, height: input.height } }

    case "createText":
      return {
        type: 'object:create',
        object: {
          ...baseObj,
          id,
          type: 'text',
          x: input.x,
          y: input.y,
          width: 200,
          height: 30,
          fill: 'transparent',
          text: input.text,
          fontSize: input.fontSize || 16,
          stroke: input.color || '#cdd6f4',
          strokeWidth: 0,
          zIndex: getRoom(boardId).objects.size,
        },
      }

    case "createLine":
      return {
        type: 'object:create',
        object: {
          ...baseObj,
          id,
          type: 'line',
          x: input.x1,
          y: input.y1,
          width: Math.abs(input.x2 - input.x1) || 1,
          height: Math.abs(input.y2 - input.y1) || 1,
          fill: 'transparent',
          stroke: input.color || '#cdd6f4',
          strokeWidth: 2,
          points: [0, 0, input.x2 - input.x1, input.y2 - input.y1],
          zIndex: getRoom(boardId).objects.size,
        },
      }

    case "getBoardState":
      // This is a read-only tool, no action needed
      return null

    default:
      return null
  }
}

// ============================================================
// Bun.serve — HTTP routes + WebSocket
// ============================================================

Bun.serve({
  port: process.env.PORT || 3000,

  routes: {
    "/": index,

    "/api/ai": {
      POST: async (req) => {
        const body = await req.json()
        const result = await handleAIRequest(body)
        return Response.json(result)
      },
    },

    "/api/health": {
      GET: () => Response.json({ status: "ok", rooms: rooms.size }),
    },
  },

  async fetch(req, server) {
    const url = new URL(req.url)

    // WebSocket upgrade for /ws/:boardId
    if (url.pathname.startsWith("/ws/")) {
      const boardId = url.pathname.split("/ws/")[1]
      const upgraded = server.upgrade(req, { data: { boardId } })
      if (upgraded) return undefined
      return new Response("WebSocket upgrade failed", { status: 400 })
    }

    // ---- Board Hub REST API ----

    // GET /api/boards?userId=X — list boards visible to this user
    if (url.pathname === "/api/boards" && req.method === "GET") {
      const userId = url.searchParams.get("userId") || ""
      return Response.json({ boards: getBoardList(userId) })
    }

    // POST /api/boards — create a new board
    if (url.pathname === "/api/boards" && req.method === "POST") {
      const body = await req.json()
      const { name, visibility, userId, userName } = body
      if (!name?.trim()) return Response.json({ error: "Board name required" }, { status: 400 })

      const id = crypto.randomUUID()
      const meta: BoardMeta = {
        id,
        name: name.trim().slice(0, 50),
        createdBy: userId || 'unknown',
        createdByName: userName || 'Unknown',
        visibility: visibility === 'private' ? 'private' : 'public',
        inviteCode: visibility === 'private' ? generateInviteCode() : null,
        createdAt: Date.now(),
        userCount: 0,
      }
      boardMetas.set(id, meta)
      getRoom(id) // pre-create room
      return Response.json({ board: meta })
    }

    // POST /api/boards/join — join a private board by invite code
    if (url.pathname === "/api/boards/join" && req.method === "POST") {
      const body = await req.json()
      const code = (body.inviteCode || "").trim().toUpperCase()
      if (!code) return Response.json({ error: "Invite code required" }, { status: 400 })

      for (const meta of boardMetas.values()) {
        if (meta.inviteCode === code) {
          const room = rooms.get(meta.id)
          return Response.json({
            board: { ...meta, userCount: room?.users.size ?? 0, isOwner: meta.createdBy === body.userId }
          })
        }
      }
      return Response.json({ error: "Invalid invite code" }, { status: 404 })
    }

    // DELETE /api/boards/:id — delete a board (owner only)
    if (url.pathname.startsWith("/api/boards/") && req.method === "DELETE") {
      const boardId = url.pathname.split("/").pop()!
      const body = await req.json().catch(() => ({}))
      const meta = boardMetas.get(boardId)
      if (!meta) return Response.json({ error: "Board not found" }, { status: 404 })
      if (meta.createdBy !== body.userId) return Response.json({ error: "Not authorized" }, { status: 403 })
      boardMetas.delete(boardId)
      chatHistories.delete(boardId)
      const room = rooms.get(boardId)
      if (room) {
        room.sockets.forEach((s) => s.ws.close())
        rooms.delete(boardId)
      }
      return Response.json({ ok: true })
    }

    // ---- End Board Hub API ----

    // Serve static files from public/ directory
    if (url.pathname.startsWith('/sounds/') || url.pathname.startsWith('/public/')) {
      const filePath = `public${url.pathname}`
      const file = Bun.file(filePath)
      if (await file.exists()) return new Response(file)
    }

    // SPA routes (no file extension) → serve index.html
    // Static assets with extensions → 404 (Bun serves known chunks before fetch)
    if (url.pathname.includes('.')) {
      return new Response("Not found", { status: 404 })
    }
    return new Response(Bun.file("index.html"))
  },

  websocket: {
    open(ws) {
      const { boardId } = ws.data as { boardId: string }
      console.log(`[WS] Connection opened for board: ${boardId}`)
    },

    message(ws, message) {
      try {
        const msg: WSMessage = JSON.parse(message as string)
        const { boardId } = ws.data as { boardId: string }
        const room = getRoom(boardId)
        const socketId = (ws as any)._id || crypto.randomUUID()
        if (!(ws as any)._id) (ws as any)._id = socketId

        switch (msg.type) {
          case 'join': {
            // Ensure board metadata exists
            ensureBoardMeta(boardId, msg.userId, msg.name)

            // Register socket
            room.sockets.set(socketId, { ws, userId: msg.userId, name: msg.name, color: msg.color })
            room.users.set(msg.userId, { userId: msg.userId, name: msg.name, color: msg.color, online: true })

            // Send welcome with current state
            const welcome: WSMessage = {
              type: 'welcome',
              users: Array.from(room.users.values()),
              objects: objectsToRecord(room.objects),
            }
            ws.send(JSON.stringify(welcome))

            // Broadcast join to others
            broadcastToRoom(boardId, { type: 'join', userId: msg.userId, name: msg.name, color: msg.color }, socketId)
            console.log(`[WS] ${msg.name} joined board ${boardId} (${room.users.size} users)`)
            break
          }

          case 'cursor': {
            // Relay cursor to all others
            broadcastToRoom(boardId, msg, socketId)
            break
          }

          case 'action': {
            // Apply action to server state
            applyAction(room.objects, msg.action)
            // Broadcast to all others
            broadcastToRoom(boardId, msg, socketId)
            break
          }
        }
      } catch (e) {
        console.error("[WS] Message error:", e)
      }
    },

    close(ws) {
      const { boardId } = ws.data as { boardId: string }
      const room = rooms.get(boardId)
      if (!room) return

      const socketId = (ws as any)._id
      const sock = room.sockets.get(socketId)
      if (sock) {
        room.sockets.delete(socketId)

        // Only remove user presence if no other sockets remain for this userId
        let hasOtherSocket = false
        for (const s of room.sockets.values()) {
          if (s.userId === sock.userId) {
            hasOtherSocket = true
            break
          }
        }
        if (!hasOtherSocket) {
          room.users.delete(sock.userId)
          broadcastToRoom(boardId, { type: 'leave', userId: sock.userId })
        }

        console.log(`[WS] ${sock.name} left board ${boardId} (${room.users.size} users, ${room.sockets.size} sockets)`)
      }
    },
  },

  development: process.env.NODE_ENV !== 'production',
})

console.log(`Masterboard server running on http://localhost:${process.env.PORT || 3000}`)
