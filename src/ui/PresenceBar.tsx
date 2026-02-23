import React from 'react'
import { useBoardStore } from '../store/boardStore'
import { useUIStore } from '../store/uiStore'

export function PresenceBar({ onLeave }: { onLeave: () => void }) {
  const users = useBoardStore((s) => s.users)
  const isConnected = useUIStore((s) => s.isConnected)
  const boardId = useUIStore((s) => s.boardId)

  return (
    <div className="presence-bar">
      <div className="presence-board-id" title={`Board: ${boardId}`}>
        {boardId.length > 12 ? boardId.slice(0, 12) + '...' : boardId}
      </div>
      <div style={{
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: isConnected ? '#a6e3a1' : '#f38ba8',
        flexShrink: 0,
      }} />
      {Array.from(users.values()).map((user) => (
        <div
          key={user.userId}
          className="presence-avatar"
          style={{ background: user.color }}
          title={user.name}
        >
          {user.name.charAt(0).toUpperCase()}
        </div>
      ))}
      <button className="leave-btn" onClick={onLeave} title="Back to Hub">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <path d="M5 1H2.5A1.5 1.5 0 001 2.5v9A1.5 1.5 0 002.5 13H5M9.5 10l3-3-3-3M12.5 7H5" />
        </svg>
      </button>
    </div>
  )
}
