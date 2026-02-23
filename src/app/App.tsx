import React, { useState, useEffect, useCallback } from 'react'
import { Canvas } from '../canvas/Canvas'
import { Toolbar } from '../ui/Toolbar'
import { PresenceBar } from '../ui/PresenceBar'
import { RemoteCursors } from '../ui/RemoteCursors'
import { ColorPicker } from '../ui/ColorPicker'
import { AIPanel } from '../ui/AIPanel'
import { AuthScreen } from '../auth/AuthScreen'
import { BoardsHub } from '../hub/BoardsHub'
import { connectToBoard, disconnect } from '../sync/socket'
import { useUIStore, themeConfig } from '../store/uiStore'
import { useBoardStore } from '../store/boardStore'
import { useToolStore } from '../store/toolStore'

type AppView = 'auth' | 'hub' | 'board'

export function App() {
  const [view, setView] = useState<AppView>('auth')
  const setUser = useUIStore((s) => s.setUser)
  const setBoardId = useUIStore((s) => s.setBoardId)
  const userId = useUIStore((s) => s.userId)
  const userName = useUIStore((s) => s.userName)
  const userColor = useUIStore((s) => s.userColor)

  // Check for existing session
  useEffect(() => {
    const storedUserId = sessionStorage.getItem('cb_userId')
    const storedUserName = sessionStorage.getItem('cb_userName')
    const storedUserColor = sessionStorage.getItem('cb_userColor')
    const storedBoardId = sessionStorage.getItem('cb_boardId')

    if (storedUserId && storedUserName && storedUserColor) {
      setUser(storedUserId, storedUserName, storedUserColor)
      if (storedBoardId) {
        setBoardId(storedBoardId)
        connectToBoard(storedBoardId, storedUserId, storedUserName, storedUserColor)
        setView('board')
      } else {
        setView('hub')
      }
    }
  }, [])

  const handleLogin = useCallback((newUserId: string, name: string, color: string) => {
    setUser(newUserId, name, color)
    setView('hub')
  }, [setUser])

  const handleSelectBoard = useCallback((boardId: string) => {
    sessionStorage.setItem('cb_boardId', boardId)
    setBoardId(boardId)
    connectToBoard(boardId, userId, userName, userColor)
    setView('board')
  }, [userId, userName, userColor, setBoardId])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const active = document.activeElement
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (active instanceof HTMLTextAreaElement || active instanceof HTMLInputElement) return
      if ((e.target as HTMLElement)?.isContentEditable) return

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

  // Sync theme to CSS custom properties
  const canvasTheme = useUIStore((s) => s.canvasTheme)
  useEffect(() => {
    const colors = themeConfig[canvasTheme]
    const root = document.documentElement
    root.style.setProperty('--bg', colors.bg)
    root.style.setProperty('--ui-bg', colors.uiBg)
    root.style.setProperty('--ui-border', colors.uiBorder)
    root.style.setProperty('--text', colors.text)
    root.style.setProperty('--text-muted', colors.textMuted)
    root.style.setProperty('--accent', colors.accent)
    document.body.style.background = colors.bg
  }, [canvasTheme])

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      setView((prev) => prev)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Leave board → back to hub
  const handleLeave = useCallback(() => {
    disconnect()
    sessionStorage.removeItem('cb_boardId')
    useBoardStore.getState().clearAll()
    setView('hub')
  }, [])

  // Full logout → back to auth
  const handleLogout = useCallback(() => {
    disconnect()
    sessionStorage.removeItem('cb_userId')
    sessionStorage.removeItem('cb_userName')
    sessionStorage.removeItem('cb_userColor')
    sessionStorage.removeItem('cb_boardId')
    useBoardStore.getState().clearAll()
    setView('auth')
  }, [])

  if (view === 'auth') {
    return <AuthScreen onLogin={handleLogin} />
  }

  if (view === 'hub') {
    return (
      <BoardsHub
        userId={userId}
        userName={userName}
        userColor={userColor}
        onSelectBoard={handleSelectBoard}
        onLogout={handleLogout}
      />
    )
  }

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <Canvas />
      <Toolbar />
      <PresenceBar onLeave={handleLeave} />
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
