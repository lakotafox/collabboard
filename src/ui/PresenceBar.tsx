import React from 'react'
import { useBoardStore } from '../store/boardStore'
import { useUIStore } from '../store/uiStore'

export function PresenceBar() {
  const users = useBoardStore((s) => s.users)
  const isConnected = useUIStore((s) => s.isConnected)

  return (
    <div className="presence-bar">
      <div style={{
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: isConnected ? '#a6e3a1' : '#f38ba8',
        marginRight: 4,
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
    </div>
  )
}
