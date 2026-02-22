import React, { useState } from 'react'
import { generateId, assignColor } from '../lib/utils'

interface AuthScreenProps {
  onLogin: (userId: string, name: string, color: string) => void
}

export function AuthScreen({ onLogin }: AuthScreenProps) {
  const [name, setName] = useState('')
  const [boardId, setBoardId] = useState('')

  const handleJoin = () => {
    if (!name.trim()) return
    const userId = generateId()
    const color = assignColor(userId)
    const board = boardId.trim() || 'default'
    // Store in sessionStorage for persistence across refresh
    sessionStorage.setItem('cb_userId', userId)
    sessionStorage.setItem('cb_userName', name.trim())
    sessionStorage.setItem('cb_userColor', color)
    sessionStorage.setItem('cb_boardId', board)
    onLogin(userId, name.trim(), color)
  }

  return (
    <div className="auth-screen">
      <h1>CollabBoard</h1>
      <p>Real-time collaborative whiteboard</p>
      <div className="auth-form">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
          autoFocus
        />
        <input
          value={boardId}
          onChange={(e) => setBoardId(e.target.value)}
          placeholder="Board ID (leave blank for default)"
          onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
        />
        <button onClick={handleJoin}>Join Board</button>
      </div>
    </div>
  )
}
