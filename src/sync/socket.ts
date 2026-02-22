import type { WSMessage, BoardAction, CursorData } from '../../shared/types'
import { useBoardStore } from '../store/boardStore'
import { useUIStore } from '../store/uiStore'
import { throttle } from '../lib/utils'

let ws: WebSocket | null = null
let reconnectTimer: ReturnType<typeof setTimeout> | null = null
let intentionalClose = false

export function connectToBoard(boardId: string, userId: string, userName: string, userColor: string) {
  // Clean up any existing connection
  if (ws) {
    intentionalClose = true
    if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
      ws.close()
    }
    ws = null
  }
  if (reconnectTimer) {
    clearTimeout(reconnectTimer)
    reconnectTimer = null
  }
  intentionalClose = false

  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
  const url = `${protocol}//${location.host}/ws/${boardId}`

  ws = new WebSocket(url)

  ws.onopen = () => {
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

  ws.onmessage = (event) => {
    try {
      const msg: WSMessage = JSON.parse(event.data)
      handleMessage(msg, userId)
    } catch (e) {
      console.error('[WS] Parse error:', e)
    }
  }

  ws.onclose = () => {
    console.log('[WS] Disconnected')
    useUIStore.getState().setConnected(false)
    useBoardStore.getState().setSendAction(null as any)

    // Only auto-reconnect if not intentionally closed
    if (!intentionalClose) {
      if (reconnectTimer) clearTimeout(reconnectTimer)
      reconnectTimer = setTimeout(() => {
        console.log('[WS] Reconnecting...')
        connectToBoard(boardId, userId, userName, userColor)
      }, 2000)
    }
  }

  ws.onerror = (err) => {
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
  intentionalClose = true
  if (reconnectTimer) clearTimeout(reconnectTimer)
  reconnectTimer = null
  if (ws) {
    ws.close()
    ws = null
  }
}
