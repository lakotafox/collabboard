import React from 'react'
import { useToolStore } from '../store/toolStore'
import { useBoardStore } from '../store/boardStore'
import { STICKY_COLORS } from '../../shared/types'

const ALL_COLORS = [
  ...STICKY_COLORS,
  '#EF5350', '#42A5F5', '#66BB6A', '#FF7043',
  '#AB47BC', '#26C6DA', '#FFEE58', '#BDBDBD',
  '#FFFFFF', '#1e1e2e',
]

export function ColorPicker() {
  const fillColor = useToolStore((s) => s.fillColor)
  const setFillColor = useToolStore((s) => s.setFillColor)
  const selectedIds = useBoardStore((s) => s.selectedIds)
  const applyLocal = useBoardStore((s) => s.applyLocal)

  const handleColorClick = (color: string) => {
    setFillColor(color)
    // Also update selected objects
    selectedIds.forEach((id) => {
      applyLocal({ type: 'object:update', id, props: { fill: color } })
    })
  }

  return (
    <div style={{
      position: 'fixed',
      bottom: 12,
      left: '50%',
      transform: 'translateX(-50%)',
      display: 'flex',
      gap: 4,
      background: '#313244',
      borderRadius: 12,
      padding: 6,
      boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
      zIndex: 100,
    }}>
      {ALL_COLORS.map((color) => (
        <div
          key={color}
          className={`color-swatch ${fillColor === color ? 'active' : ''}`}
          style={{ background: color }}
          onClick={() => handleColorClick(color)}
        />
      ))}
    </div>
  )
}
