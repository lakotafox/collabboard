import React, { useState } from 'react'

interface Props {
  userId: string
  userName: string
  onCreated: (boardId: string) => void
  onClose: () => void
}

export function CreateBoardModal({ userId, userName, onCreated, onClose }: Props) {
  const [name, setName] = useState('')
  const [visibility, setVisibility] = useState<'public' | 'private'>('public')
  const [loading, setLoading] = useState(false)

  const handleCreate = async () => {
    if (!name.trim() || loading) return
    setLoading(true)
    try {
      const res = await fetch('/api/boards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), visibility, userId, userName }),
      })
      const data = await res.json()
      if (data.board) {
        onCreated(data.board.id)
      }
    } catch (e) {
      console.error('Failed to create board:', e)
    }
    setLoading(false)
  }

  return (
    <div className="create-modal-overlay" onClick={onClose}>
      <div className="create-modal" onClick={(e) => e.stopPropagation()}>
        <h3>Create Board</h3>
        <input
          type="text"
          placeholder="Board name..."
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          autoFocus
          maxLength={50}
        />
        <div className="visibility-toggle">
          <button
            className={visibility === 'public' ? 'active' : ''}
            onClick={() => setVisibility('public')}
          >
            <GlobeIcon /> Public
          </button>
          <button
            className={visibility === 'private' ? 'active' : ''}
            onClick={() => setVisibility('private')}
          >
            <LockIcon /> Private
          </button>
        </div>
        <p className="visibility-hint">
          {visibility === 'public'
            ? 'Anyone can find and join this board'
            : 'Only people with the invite code can join'}
        </p>
        <div className="create-modal-actions">
          <button className="cancel-btn" onClick={onClose}>Cancel</button>
          <button className="create-btn" onClick={handleCreate} disabled={!name.trim() || loading}>
            {loading ? 'Creating...' : 'Create Board'}
          </button>
        </div>
      </div>
    </div>
  )
}

function LockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="2" y="5" width="8" height="6" rx="1" />
      <path d="M4 5V3.5a2 2 0 014 0V5" />
    </svg>
  )
}

function GlobeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="6" cy="6" r="4.5" />
      <path d="M1.5 6h9M6 1.5c1.5 1.5 2 3 2 4.5s-.5 3-2 4.5M6 1.5c-1.5 1.5-2 3-2 4.5s.5 3 2 4.5" />
    </svg>
  )
}
