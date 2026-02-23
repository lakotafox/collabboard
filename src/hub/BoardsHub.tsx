import React, { useState, useEffect, useCallback } from 'react'
import { deleteUser } from 'firebase/auth'
import { auth } from '../lib/firebase'
import type { BoardListItem } from '../../shared/types'
import { BoardCard } from './BoardCard'
import { CreateBoardModal } from './CreateBoardModal'
import { NetworkCanvas } from '../auth/NetworkCanvas'
import { playButtonClick, playJoinBoard } from '../lib/sounds'

interface Props {
  userId: string
  userName: string
  userColor: string
  onSelectBoard: (boardId: string) => void
  onLogout: () => void
}

export function BoardsHub({ userId, userName, userColor, onSelectBoard, onLogout }: Props) {
  const [boards, setBoards] = useState<BoardListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [joinCode, setJoinCode] = useState('')
  const [joinError, setJoinError] = useState('')

  const fetchBoards = useCallback(async () => {
    try {
      const res = await fetch(`/api/boards?userId=${encodeURIComponent(userId)}`)
      const data = await res.json()
      setBoards(data.boards || [])
    } catch (e) {
      console.error('Failed to fetch boards:', e)
    }
    setLoading(false)
  }, [userId])

  useEffect(() => {
    fetchBoards()
    const interval = setInterval(fetchBoards, 5000)
    return () => clearInterval(interval)
  }, [fetchBoards])

  const handleJoinByCode = async () => {
    const code = joinCode.trim().toUpperCase()
    if (!code) return
    setJoinError('')
    try {
      const res = await fetch('/api/boards/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteCode: code, userId }),
      })
      const data = await res.json()
      if (data.board) {
        onSelectBoard(data.board.id)
      } else {
        setJoinError(data.error || 'Invalid code')
      }
    } catch {
      setJoinError('Connection error')
    }
  }

  const myBoards = boards.filter((b) => b.isOwner)
  const publicBoards = boards.filter((b) => !b.isOwner)

  return (
    <div className="hub-screen">
      <NetworkCanvas />
      <div className="hub-header">
        <div className="hub-logo">
          <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
            <rect x="2" y="2" width="28" height="28" rx="6" stroke="#89b4fa" strokeWidth="2" />
            <rect x="6" y="6" width="8" height="8" rx="2" fill="#89b4fa" opacity="0.6" />
            <rect x="18" y="6" width="8" height="8" rx="2" fill="#f38ba8" opacity="0.6" />
            <rect x="6" y="18" width="8" height="8" rx="2" fill="#a6e3a1" opacity="0.6" />
            <rect x="18" y="18" width="8" height="8" rx="2" fill="#f9e2af" opacity="0.6" />
          </svg>
          <span>Masterboard</span>
        </div>
        <div className="hub-user">
          <div className="hub-avatar" style={{ background: userColor }}>
            {userName[0]?.toUpperCase()}
          </div>
          <span className="hub-username">{userName}</span>
          <button className="hub-logout" onClick={() => { playButtonClick(); onLogout() }}>Log out</button>
          <button className="hub-delete-account" onClick={async () => {
            playButtonClick()
            if (!confirm('Delete your account? This cannot be undone.')) return
            try {
              const user = auth.currentUser
              if (user) await deleteUser(user)
              onLogout()
            } catch (err: any) {
              if (err?.code === 'auth/requires-recent-login') {
                alert('Please log out and log back in, then try again.')
              }
            }
          }}>Delete Account</button>
        </div>
      </div>

      <div className="hub-content">
        <div className="hub-top-row">
          <h2>Your Workspace</h2>
          <button className="create-board-btn" onClick={() => { playButtonClick(); setShowCreate(true) }}>
            + Create Board
          </button>
        </div>

        {/* Join by code */}
        <div className="join-code-section">
          <input
            type="text"
            placeholder="Enter invite code..."
            value={joinCode}
            onChange={(e) => { setJoinCode(e.target.value.toUpperCase()); setJoinError('') }}
            onKeyDown={(e) => e.key === 'Enter' && handleJoinByCode()}
            maxLength={6}
            className="join-code-input"
          />
          <button className="join-code-btn" onClick={() => { playButtonClick(); handleJoinByCode() }} disabled={!joinCode.trim()}>
            Join
          </button>
          {joinError && <span className="join-error">{joinError}</span>}
        </div>

        {loading ? (
          <div className="hub-loading">Loading boards...</div>
        ) : (
          <>
            {myBoards.length > 0 && (
              <div className="hub-section">
                <h3 className="hub-section-title">Your Boards</h3>
                <div className="board-grid">
                  {myBoards.map((b) => (
                    <BoardCard key={b.id} board={b} onClick={() => { playJoinBoard(); onSelectBoard(b.id) }} onDelete={async () => {
                      await fetch(`/api/boards/${b.id}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId }) })
                      fetchBoards()
                    }} />
                  ))}
                </div>
              </div>
            )}

            {publicBoards.length > 0 && (
              <div className="hub-section">
                <h3 className="hub-section-title">Public Boards</h3>
                <div className="board-grid">
                  {publicBoards.map((b) => (
                    <BoardCard key={b.id} board={b} onClick={() => { playJoinBoard(); onSelectBoard(b.id) }} />
                  ))}
                </div>
              </div>
            )}

            {boards.length === 0 && (
              <div className="hub-empty">
                <p>No boards yet. Create one to get started!</p>
              </div>
            )}
          </>
        )}
      </div>

      {showCreate && (
        <CreateBoardModal
          userId={userId}
          userName={userName}
          onCreated={(boardId) => {
            setShowCreate(false)
            onSelectBoard(boardId)
          }}
          onClose={() => setShowCreate(false)}
        />
      )}
    </div>
  )
}
