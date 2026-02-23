import type { WSMessage, BoardAction, CursorData } from '../../shared/types'
import { useBoardStore } from '../store/boardStore'
import { useUIStore } from '../store/uiStore'
import { throttle } from '../lib/utils'
import { playUserJoined } from '../lib/sounds'

let ws: WebSocket | null = null
let reconnectTimer: ReturnType<typeof setTimeout> | null = null
let currentBoardId: string | null = null

export function connectToBoard(boardId: string, userId: string, userName: string, userColor: string) {
  // Clean up any existing connection
  if (ws) {
    // Mark the old WS so its onclose won't interfere
    const oldWs = ws
    ;(oldWs as any)._stale = true
    if (oldWs.readyState === WebSocket.OPEN || oldWs.readyState === WebSocket.CONNECTING) {
      oldWs.close()
    }
    ws = null
  }
  if (reconnectTimer) {
    clearTimeout(reconnectTimer)
    reconnectTimer = null
  }

  currentBoardId = boardId

  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
  const url = `${protocol}//${location.host}/ws/${boardId}`

  const socket = new WebSocket(url)
  ws = socket

  socket.onopen = () => {
    // If this socket was marked stale while connecting, ignore
    if ((socket as any)._stale) return
    console.log('[WS] Connected to board:', boardId)
    useUIStore.getState().setConnected(true)

    // Send join message
    send({
      type: 'join',
      userId,
      name: userName,
      color: userColor,
    })

    // Wire up the send callback for the board store
    useBoardStore.getState().setSendAction((action: BoardAction) => {
      send({ type: 'action', action, userId })
    })
  }

  socket.onmessage = (event) => {
    // Ignore messages from stale sockets
    if ((socket as any)._stale) return
    try {
      const msg: WSMessage = JSON.parse(event.data)
      handleMessage(msg, userId)
    } catch (e) {
      console.error('[WS] Parse error:', e)
    }
  }

  socket.onclose = () => {
    // If this socket has been replaced by a newer one, don't touch state
    if ((socket as any)._stale || ws !== socket) {
      console.log('[WS] Stale socket closed, ignoring')
      return
    }

    console.log('[WS] Disconnected')
    useUIStore.getState().setConnected(false)
    useBoardStore.getState().setSendAction(null as any)

    // Only auto-reconnect if this is still the active board
    if (currentBoardId === boardId) {
      if (reconnectTimer) clearTimeout(reconnectTimer)
      reconnectTimer = setTimeout(() => {
        // Double-check the board hasn't changed before reconnecting
        if (currentBoardId === boardId) {
          console.log('[WS] Reconnecting...')
          connectToBoard(boardId, userId, userName, userColor)
        }
      }, 2000)
    }
  }

  socket.onerror = (err) => {
    console.error('[WS] Error:', err)
  }
}

function send(msg: WSMessage) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg))
  }
}

function handleMessage(msg: WSMessage, myUserId: string) {
  const store = useBoardStore.getState()

  switch (msg.type) {
    case 'welcome':
      // Load initial board state
      store.loadObjects(msg.objects)
      // Load users
      const users = new Map()
      for (const u of msg.users) {
        users.set(u.userId, u)
      }
      store.setUsers(users)
      break

    case 'cursor':
      if (msg.cursor.userId !== myUserId) {
        store.updateCursor(msg.cursor)
      }
      break

    case 'action':
      if (msg.userId !== myUserId) {
        store.applyRemote(msg.action)
      }
      break

    case 'join':
      store.addUser({ userId: msg.userId, name: msg.name, color: msg.color, online: true })
      if (msg.userId !== myUserId) playUserJoined()
      break

    case 'leave':
      store.removeUser(msg.userId)
      break

    case 'sync':
      store.loadObjects(msg.objects)
      break
  }
}

// Throttled cursor broadcast (30fps)
export const sendCursor = throttle((cursor: CursorData) => {
  send({ type: 'cursor', cursor })
}, 33)

export function disconnect() {
  currentBoardId = null
  if (reconnectTimer) clearTimeout(reconnectTimer)
  reconnectTimer = null
  if (ws) {
    ;(ws as any)._stale = true
    ws.close()
    ws = null
  }
}
