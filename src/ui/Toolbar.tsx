import React from 'react'
import { useToolStore } from '../store/toolStore'
import { useUIStore } from '../store/uiStore'
import type { ToolType } from '../../shared/types'

const tools: { id: ToolType; icon: string; label: string }[] = [
  { id: 'select', icon: '↖', label: 'Select' },
  { id: 'pan', icon: '✋', label: 'Pan' },
  { id: 'sticky', icon: '📝', label: 'Sticky Note' },
  { id: 'rect', icon: '⬜', label: 'Rectangle' },
  { id: 'circle', icon: '⭕', label: 'Circle' },
  { id: 'line', icon: '╱', label: 'Line' },
  { id: 'text', icon: 'T', label: 'Text' },
  { id: 'frame', icon: '⊡', label: 'Frame' },
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
        🤖
      </button>
    </div>
  )
}
