import { create } from 'zustand'
import type { BoardObject, BoardAction, CursorData, UserPresence } from '../../shared/types'
import type { Camera } from '../lib/utils'

interface BoardState {
  // Board objects
  objects: Map<string, BoardObject>

  // Camera / viewport
  camera: Camera
  setCamera: (camera: Partial<Camera>) => void

  // Selection
  selectedIds: Set<string>
  setSelectedIds: (ids: Set<string>) => void
  clearSelection: () => void

  // Presence
  users: Map<string, UserPresence>
  cursors: Map<string, CursorData>
  setUsers: (users: Map<string, UserPresence>) => void
  updateCursor: (cursor: CursorData) => void
  removeCursor: (userId: string) => void
  addUser: (user: UserPresence) => void
  removeUser: (userId: string) => void

  // Local actions (apply + send to server)
  applyLocal: (action: BoardAction) => void
  // Remote actions (apply only, no send)
  applyRemote: (action: BoardAction) => void

  // Bulk load
  loadObjects: (objects: Record<string, BoardObject>) => void

  // Send callback (set by sync layer)
  _sendAction: ((action: BoardAction) => void) | null
  setSendAction: (fn: (action: BoardAction) => void) => void
}

function applyAction(objects: Map<string, BoardObject>, action: BoardAction): Map<string, BoardObject> {
  const next = new Map(objects)

  switch (action.type) {
    case 'object:create':
      next.set(action.object.id, action.object)
      break
    case 'object:update': {
      const obj = next.get(action.id)
      if (obj) {
        next.set(action.id, { ...obj, ...action.props })
      }
      break
    }
    case 'object:delete':
      next.delete(action.id)
      break
    case 'object:batch':
      let current = next
      for (const sub of action.actions) {
        const result = applyAction(current, sub)
        result.forEach((v, k) => current.set(k, v))
        // Handle deletes
        if (sub.type === 'object:delete') {
          current.delete(sub.id)
        }
      }
      return current
  }

  return next
}

export const useBoardStore = create<BoardState>((set, get) => ({
  objects: new Map(),
  camera: { x: 0, y: 0, zoom: 1 },
  selectedIds: new Set(),
  users: new Map(),
  cursors: new Map(),
  _sendAction: null,

  setCamera: (partial) => set((s) => ({ camera: { ...s.camera, ...partial } })),

  setSelectedIds: (ids) => set({ selectedIds: ids }),
  clearSelection: () => set({ selectedIds: new Set() }),

  setUsers: (users) => set({ users }),
  updateCursor: (cursor) => set((s) => {
    const next = new Map(s.cursors)
    next.set(cursor.userId, cursor)
    return { cursors: next }
  }),
  removeCursor: (userId) => set((s) => {
    const next = new Map(s.cursors)
    next.delete(userId)
    return { cursors: next }
  }),
  addUser: (user) => set((s) => {
    const next = new Map(s.users)
    next.set(user.userId, user)
    return { users: next }
  }),
  removeUser: (userId) => set((s) => {
    const next = new Map(s.users)
    next.delete(userId)
    const cursors = new Map(s.cursors)
    cursors.delete(userId)
    return { users: next, cursors }
  }),

  applyLocal: (action) => {
    set((s) => ({ objects: applyAction(s.objects, action) }))
    const send = get()._sendAction
    if (send) send(action)
  },

  applyRemote: (action) => {
    set((s) => ({ objects: applyAction(s.objects, action) }))
  },

  loadObjects: (objects) => {
    const map = new Map<string, BoardObject>()
    for (const [id, obj] of Object.entries(objects)) {
      map.set(id, obj)
    }
    set({ objects: map })
  },

  setSendAction: (fn) => set({ _sendAction: fn }),
}))
