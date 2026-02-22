import React from 'react'
import { useToolStore } from '../store/toolStore'
import { useUIStore } from '../store/uiStore'
import type { ToolType } from '../../shared/types'

// SVG icon components — no emojis
function IconSelect() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M3 2l8 14 2-6 6-2L3 2z" />
    </svg>
  )
}

function IconPan() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M9 2v14M2 9h14M5 5l4-3 4 3M5 13l4 3 4-3M2 5l3 4-3 4M16 5l-3 4 3 4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconSticky() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="2" y="2" width="14" height="14" rx="1" />
      <path d="M5 6h8M5 9h6M5 12h4" strokeLinecap="round" />
    </svg>
  )
}

function IconRect() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="2" y="3" width="14" height="12" rx="1" />
    </svg>
  )
}

function IconCircle() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="9" cy="9" r="7" />
    </svg>
  )
}

function IconLine() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
      <line x1="3" y1="15" x2="15" y2="3" strokeLinecap="round" />
    </svg>
  )
}

function IconText() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M4 4h10M9 4v11M6 4v2M12 4v2" strokeLinecap="round" />
    </svg>
  )
}

function IconFrame() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="2" y="2" width="14" height="14" rx="2" strokeDasharray="4 2" />
    </svg>
  )
}

function IconAI() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M9 2l2 4 4 1-3 3 1 4-4-2-4 2 1-4-3-3 4-1z" strokeLinejoin="round" />
    </svg>
  )
}

const tools: { id: ToolType; icon: React.ReactNode; label: string }[] = [
  { id: 'select', icon: <IconSelect />, label: 'Select (V)' },
  { id: 'pan', icon: <IconPan />, label: 'Pan (H)' },
  { id: 'sticky', icon: <IconSticky />, label: 'Sticky Note (S)' },
  { id: 'rect', icon: <IconRect />, label: 'Rectangle (R)' },
  { id: 'circle', icon: <IconCircle />, label: 'Circle (C)' },
  { id: 'line', icon: <IconLine />, label: 'Line (L)' },
  { id: 'text', icon: <IconText />, label: 'Text (T)' },
  { id: 'frame', icon: <IconFrame />, label: 'Frame (F)' },
]

export function Toolbar() {
  const activeTool = useToolStore((s) => s.activeTool)
  const setTool = useToolStore((s) => s.setTool)
  const toggleAIPanel = useUIStore((s) => s.toggleAIPanel)

  return (
    <div className="toolbar">
      {tools.map((t) => (
        <button
          key={t.id}
          className={activeTool === t.id ? 'active' : ''}
          onClick={() => setTool(t.id)}
          title={t.label}
        >
          {t.icon}
        </button>
      ))}
      <div style={{ width: 1, background: '#45475a', margin: '4px 2px' }} />
      <button onClick={toggleAIPanel} title="AI Assistant">
        <IconAI />
      </button>
    </div>
  )
}
