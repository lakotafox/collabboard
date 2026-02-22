import React from 'react'
import { useBoardStore } from '../store/boardStore'
import { boardToScreen } from '../lib/utils'

export function RemoteCursors() {
  const cursors = useBoardStore((s) => s.cursors)
  const camera = useBoardStore((s) => s.camera)

  return (
    <div className="remote-cursors-layer">
      {Array.from(cursors.values()).map((cursor) => {
        const screen = boardToScreen(cursor.x, cursor.y, camera)
        return (
          <div
            key={cursor.userId}
            className="remote-cursor"
            style={{ transform: `translate(${screen.x}px, ${screen.y}px)` }}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path
                d="M3 1L17 10L10 11L7 18L3 1Z"
                fill={cursor.color}
                stroke="white"
                strokeWidth="1"
              />
            </svg>
            <span
              className="cursor-label"
              style={{ background: cursor.color }}
            >
              {cursor.name}
            </span>
          </div>
        )
      })}
    </div>
  )
}
