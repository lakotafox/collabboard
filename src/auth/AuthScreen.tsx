import React, { useState } from 'react'
import { generateId, assignColor } from '../lib/utils'
import { playButtonClick, playJoinBoard } from '../lib/sounds'
import { NetworkCanvas } from './NetworkCanvas'

interface AuthScreenProps {
  onLogin: (userId: string, name: string, color: string) => void
}

export function AuthScreen({ onLogin }: AuthScreenProps) {
  const [name, setName] = useState('')

  const handleJoin = () => {
    if (!name.trim()) return
    playJoinBoard()
    const userId = generateId()
    const color = assignColor(userId)
    sessionStorage.setItem('cb_userId', userId)
    sessionStorage.setItem('cb_userName', name.trim())
    sessionStorage.setItem('cb_userColor', color)
    onLogin(userId, name.trim(), color)
  }

  return (
    <div className="auth-screen">
      <NetworkCanvas />
      <div className="auth-content">
        <div className="auth-logo">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
            <rect x="4" y="4" width="40" height="40" rx="8" stroke="#89b4fa" strokeWidth="2.5" />
            <rect x="12" y="12" width="10" height="10" rx="2" fill="#89b4fa" opacity="0.6" />
            <rect x="26" y="12" width="10" height="10" rx="2" fill="#89b4fa" opacity="0.4" />
            <rect x="12" y="26" width="10" height="10" rx="2" fill="#89b4fa" opacity="0.4" />
            <rect x="26" y="26" width="10" height="10" rx="2" fill="#89b4fa" opacity="0.8" />
            <line x1="22" y1="17" x2="26" y2="17" stroke="#89b4fa" strokeWidth="1.5" opacity="0.5" />
            <line x1="17" y1="22" x2="17" y2="26" stroke="#89b4fa" strokeWidth="1.5" opacity="0.5" />
            <line x1="31" y1="22" x2="31" y2="26" stroke="#89b4fa" strokeWidth="1.5" opacity="0.5" />
            <line x1="22" y1="31" x2="26" y2="31" stroke="#89b4fa" strokeWidth="1.5" opacity="0.5" />
          </svg>
        </div>
        <h1>Masterboard</h1>
        <p>Real-time collaborative whiteboard</p>
        <div className="auth-form">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
            onFocus={playButtonClick}
            autoFocus
          />
          <button onClick={handleJoin}>Get Started</button>
        </div>
        <div className="auth-footer">
          Collaborate in real-time with AI assistance
        </div>
      </div>
    </div>
  )
}
