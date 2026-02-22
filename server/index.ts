import index from "../index.html"
import type { BoardObject, BoardAction, WSMessage, UserPresence, CursorData } from "../shared/types"

// ============================================================
// Board state management (in-memory with persistence)
// ============================================================

interface BoardRoom {
  objects: Map<string, BoardObject>
  users: Map<string, UserPresence>
  sockets: Map<string, { ws: any; userId: string; name: string; color: string }>
}

const rooms = new Map<string, BoardRoom>()

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

  // Build board context (limited to prevent token explosion)
  const objectList = Object.values(boardState).slice(0, 100).map(obj => ({
    id: obj.id,
    type: obj.type,
    x: Math.round(obj.x),
    y: Math.round(obj.y),
    width: Math.round(obj.width),
    height: Math.round(obj.height),
    text: obj.text?.slice(0, 50),
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
      description: "Create a geometric shape on the board",
      input_schema: {
        type: "object" as const,
        required: ["shapeType", "x", "y", "width", "height"],
        properties: {
          shapeType: { type: "string" as const, enum: ["rect", "circle"], description: "Type of shape" },
          x: { type: "number" as const },
          y: { type: "number" as const },
          width: { type: "number" as const },
          height: { type: "number" as const },
          color: { type: "string" as const, description: "Fill color" },
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
      name: "getBoardState",
      description: "Get current objects on the board for context",
      input_schema: {
        type: "object" as const,
        properties: {},
      },
    },
  ]

  const systemPrompt = `You are an AI assistant for a collaborative whiteboard app called CollabBoard.
You can create, modify, and organize elements on the board using the available tools.

COORDINATE SYSTEM: Origin is top-left, X increases right, Y increases down. Units are pixels.
The default visible area is roughly 0-1920 x 0-1080 at zoom=1.

AVAILABLE COLORS for sticky notes: #FFF176 (yellow), #80DEEA (cyan), #A5D6A7 (green), #F48FB1 (pink), #FFAB91 (orange), #CE93D8 (purple)

When creating templates (SWOT, retro, etc.), use frames as containers and sticky notes as items.
Space elements with consistent gaps (typically 20-40px between items).

Current board state (${objectList.length} objects):
${JSON.stringify(objectList, null, 2)}

Execute the user's commands by calling the appropriate tools. For complex commands, use multiple tool calls.`

  try {
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
        messages: [{ role: "user", content: body.message }],
      }),
    })

    const result = await response.json()
    let responseText = ""
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

    // If there were tool calls, apply them and broadcast
    if (actions.length > 0) {
      const batchAction: BoardAction = actions.length === 1 ? actions[0] : { type: 'object:batch', actions }
      applyAction(room.objects, batchAction)
      broadcastToRoom(body.boardId, { type: 'action', action: batchAction, userId: 'ai-agent' })
    }

    // If model wants to continue (tool_use stop reason), make another call
    if (result.stop_reason === "tool_use") {
      // Build tool results
      const toolResults = result.content
        .filter((b: any) => b.type === "tool_use")
        .map((b: any) => ({
          type: "tool_result" as const,
          tool_use_id: b.id,
          content: JSON.stringify({ success: true }),
        }))

      const followUp = await fetch("https://api.anthropic.com/v1/messages", {
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
          messages: [
            { role: "user", content: body.message },
            { role: "assistant", content: result.content },
            { role: "user", content: toolResults },
          ],
        }),
      })

      const followUpResult = await followUp.json()
      for (const block of followUpResult.content || []) {
        if (block.type === "text") {
          responseText += block.text
        } else if (block.type === "tool_use") {
          const action = executeToolCall(block.name, block.input, body.boardId)
          if (action) {
            applyAction(room.objects, action)
            broadcastToRoom(body.boardId, { type: 'action', action, userId: 'ai-agent' })
          }
        }
      }
    }

    return { message: responseText || `Done! Created ${actions.length} element(s).` }
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

  fetch(req, server) {
    const url = new URL(req.url)

    // WebSocket upgrade for /ws/:boardId
    if (url.pathname.startsWith("/ws/")) {
      const boardId = url.pathname.split("/ws/")[1]
      const upgraded = server.upgrade(req, { data: { boardId } })
      if (upgraded) return undefined
      return new Response("WebSocket upgrade failed", { status: 400 })
    }

    // Fallback: serve index.html for SPA routing
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
        room.users.delete(sock.userId)
        broadcastToRoom(boardId, { type: 'leave', userId: sock.userId })
        console.log(`[WS] ${sock.name} left board ${boardId} (${room.users.size} users)`)
      }
    },
  },

  development: {
    hmr: true,
    console: true,
  },
})

console.log(`CollabBoard server running on http://localhost:${process.env.PORT || 3000}`)
