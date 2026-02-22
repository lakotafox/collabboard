import React from 'react'
import { useToolStore } from '../store/toolStore'
import { useUIStore } from '../store/uiStore'
import type { ToolType } from '../../shared/types'

// SVG icon components
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

function IconSun() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="9" cy="9" r="4" />
      <path d="M9 2v2M9 14v2M2 9h2M14 9h2M4.2 4.2l1.4 1.4M12.4 12.4l1.4 1.4M4.2 13.8l1.4-1.4M12.4 5.6l1.4-1.4" strokeLinecap="round" />
    </svg>
  )
}

function IconMoon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M15 10.5A6.5 6.5 0 017.5 3 6 6 0 1015 10.5z" />
    </svg>
  )
}

function IconGrid() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M2 6h14M2 12h14M6 2v14M12 2v14" strokeLinecap="round" />
    </svg>
  )
}

const tools: { id: ToolType; icon: React.ReactNode; label: string }[] = [
  { id: 'select', icon: <IconSelect />, label: 'Select' },
  { id: 'pan', icon: <IconPan />, label: 'Pan' },
  { id: 'sticky', icon: <IconSticky />, label: 'Note' },
  { id: 'rect', icon: <IconRect />, label: 'Rect' },
  { id: 'circle', icon: <IconCircle />, label: 'Circle' },
  { id: 'line', icon: <IconLine />, label: 'Line' },
  { id: 'text', icon: <IconText />, label: 'Text' },
  { id: 'frame', icon: <IconFrame />, label: 'Frame' },
]

export function Toolbar() {
  const activeTool = useToolStore((s) => s.activeTool)
  const setTool = useToolStore((s) => s.setTool)
  const toggleAIPanel = useUIStore((s) => s.toggleAIPanel)
  const canvasTheme = useUIStore((s) => s.canvasTheme)
  const toggleTheme = useUIStore((s) => s.toggleTheme)
  const showGrid = useUIStore((s) => s.showGrid)
  const toggleGrid = useUIStore((s) => s.toggleGrid)

  return (
    <div className="toolbar">
      {tools.map((t) => (
        <button
          key={t.id}
          className={`toolbar-btn ${activeTool === t.id ? 'active' : ''}`}
          onClick={() => setTool(t.id)}
          title={t.label}
        >
          {t.icon}
          <span className="toolbar-label">{t.label}</span>
        </button>
      ))}
      <div className="toolbar-divider" />
      <button className={`toolbar-btn ${showGrid ? 'active' : ''}`} onClick={toggleGrid} title="Toggle Grid">
        <IconGrid />
        <span className="toolbar-label">Grid</span>
      </button>
      <button className="toolbar-btn" onClick={toggleTheme} title={canvasTheme === 'dark' ? 'Light Mode' : 'Dark Mode'}>
        {canvasTheme === 'dark' ? <IconSun /> : <IconMoon />}
        <span className="toolbar-label">{canvasTheme === 'dark' ? 'Light' : 'Dark'}</span>
      </button>
      <div className="toolbar-divider" />
      <button className="toolbar-btn" onClick={toggleAIPanel} title="AI Assistant">
        <IconAI />
        <span className="toolbar-label">AI</span>
      </button>
    </div>
  )
}
