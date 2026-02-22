import React, { useState, useEffect, useCallback } from 'react'
import { Canvas } from '../canvas/Canvas'
import { Toolbar } from '../ui/Toolbar'
import { PresenceBar } from '../ui/PresenceBar'
import { RemoteCursors } from '../ui/RemoteCursors'
import { ColorPicker } from '../ui/ColorPicker'
import { AIPanel } from '../ui/AIPanel'
import { AuthScreen } from '../auth/AuthScreen'
import { connectToBoard, disconnect } from '../sync/socket'
import { useUIStore } from '../store/uiStore'
import { useBoardStore } from '../store/boardStore'
import { useToolStore } from '../store/toolStore'

export function App() {
  const [authed, setAuthed] = useState(false)
  const setUser = useUIStore((s) => s.setUser)
  const setBoardId = useUIStore((s) => s.setBoardId)

  // Check for existing session
  useEffect(() => {
    const userId = sessionStorage.getItem('cb_userId')
    const userName = sessionStorage.getItem('cb_userName')
    const userColor = sessionStorage.getItem('cb_userColor')
    const boardId = sessionStorage.getItem('cb_boardId')

    if (userId && userName && userColor) {
      setUser(userId, userName, userColor)
      setBoardId(boardId || 'default')
      connectToBoard(boardId || 'default', userId, userName, userColor)
      setAuthed(true)
    }
  }, [])

  const handleLogin = useCallback((userId: string, name: string, color: string) => {
    const boardId = sessionStorage.getItem('cb_boardId') || 'default'
    setUser(userId, name, color)
    setBoardId(boardId)
    connectToBoard(boardId, userId, name, color)
    setAuthed(true)
  }, [setUser, setBoardId])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      const store = useBoardStore.getState()
      const toolStore = useToolStore.getState()
      switch (e.key) {
        case 'Delete':
        case 'Backspace':
          store.selectedIds.forEach((id) => {
            store.applyLocal({ type: 'object:delete', id })
          })
          store.clearSelection()
          break
        case 'Escape':
          store.clearSelection()
          toolStore.setTool('select')
          break
        case 'v': toolStore.setTool('select'); break
        case 'h': toolStore.setTool('pan'); break
        case 's': toolStore.setTool('sticky'); break
        case 'r': toolStore.setTool('rect'); break
        case 'c': toolStore.setTool('circle'); break
        case 'l': toolStore.setTool('line'); break
        case 't': toolStore.setTool('text'); break
        case 'f': toolStore.setTool('frame'); break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      // Force re-render by updating a dummy state
      setAuthed((prev) => prev)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  if (!authed) {
    return <AuthScreen onLogin={handleLogin} />
  }

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <Canvas />
      <Toolbar />
      <PresenceBar />
      <RemoteCursors />
      <ColorPicker />
      <AIPanel />
      <BoardInfo />
    </div>
  )
}

function BoardInfo() {
  const camera = useBoardStore((s) => s.camera)
  const objects = useBoardStore((s) => s.objects)
  return (
    <div className="board-info">
      Zoom: {Math.round(camera.zoom * 100)}% | Objects: {objects.size}
    </div>
  )
}
