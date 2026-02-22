import { create } from 'zustand'
import type { ToolType } from '../../shared/types'

interface ToolState {
  activeTool: ToolType
  fillColor: string
  strokeColor: string
  strokeWidth: number
  fontSize: number
  setTool: (tool: ToolType) => void
  setFillColor: (color: string) => void
  setStrokeColor: (color: string) => void
  setStrokeWidth: (width: number) => void
  setFontSize: (size: number) => void
}

export const useToolStore = create<ToolState>((set) => ({
  activeTool: 'select',
  fillColor: '#FFF176',
  strokeColor: '#000000',
  strokeWidth: 2,
  fontSize: 16,
  setTool: (tool) => set({ activeTool: tool }),
  setFillColor: (color) => set({ fillColor: color }),
  setStrokeColor: (color) => set({ strokeColor: color }),
  setStrokeWidth: (width) => set({ strokeWidth: width }),
  setFontSize: (size) => set({ fontSize: size }),
}))
