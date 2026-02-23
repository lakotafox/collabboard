import React, { useState } from 'react'
import type { BoardListItem } from '../../shared/types'

function timeAgo(ts: number): string {
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

export function BoardCard({ board, onClick }: { board: BoardListItem; onClick: () => void }) {
  const [copied, setCopied] = useState(false)

  const copyCode = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (board.inviteCode) {
      navigator.clipboard.writeText(board.inviteCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="board-card" onClick={onClick}>
      <div className="board-card-header">
        <h3 className="board-card-name">{board.name}</h3>
        <span className={`board-card-badge ${board.visibility}`}>
          {board.visibility === 'private' ? (
            <><LockIcon /> Private</>
          ) : (
            <><GlobeIcon /> Public</>
          )}
        </span>
      </div>

      <div className="board-card-info">
        <div className="board-card-users">
          <span className={`pulse-dot ${board.userCount > 0 ? 'active' : ''}`} />
          {board.userCount} {board.userCount === 1 ? 'user' : 'users'}
        </div>
        <span className="board-card-meta">
          {board.createdByName} &middot; {timeAgo(board.createdAt)}
        </span>
      </div>

      {board.isOwner && board.inviteCode && (
        <div className="board-card-code" onClick={copyCode}>
          <span className="code-label">Invite:</span>
          <code>{board.inviteCode}</code>
          <span className="copy-hint">{copied ? 'Copied!' : 'Click to copy'}</span>
        </div>
      )}
    </div>
  )
}

function LockIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="2" y="5" width="8" height="6" rx="1" />
      <path d="M4 5V3.5a2 2 0 014 0V5" />
    </svg>
  )
}

function GlobeIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="6" cy="6" r="4.5" />
      <path d="M1.5 6h9M6 1.5c1.5 1.5 2 3 2 4.5s-.5 3-2 4.5M6 1.5c-1.5 1.5-2 3-2 4.5s.5 3 2 4.5" />
    </svg>
  )
}
