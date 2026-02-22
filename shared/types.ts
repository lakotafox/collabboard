// Board object types
export type ObjectType = 'sticky' | 'rect' | 'circle' | 'line' | 'text' | 'frame' | 'connector'

export interface BoardObject {
  id: string
  type: ObjectType
  x: number
  y: number
  width: number
  height: number
  rotation: number
  zIndex: number
  fill: string
  stroke: string
  strokeWidth: number
  opacity: number
  text: string
  fontSize: number
  // Connector-specific
  points?: number[]
  sourceId?: string
  targetId?: string
  // Frame-specific
  parentFrameId?: string
}

// Sync message types
export type BoardAction =
  | { type: 'object:create'; object: BoardObject }
  | { type: 'object:update'; id: string; props: Partial<BoardObject> }
  | { type: 'object:delete'; id: string }
  | { type: 'object:batch'; actions: BoardAction[] }

// Cursor data
export interface CursorData {
  userId: string
  name: string
  color: string
  x: number
  y: number
}

// Presence data
export interface UserPresence {
  userId: string
  name: string
  color: string
  online: boolean
}

// WebSocket message types
export type WSMessage =
  | { type: 'join'; userId: string; name: string; color: string }
  | { type: 'leave'; userId: string }
  | { type: 'welcome'; users: UserPresence[]; objects: Record<string, BoardObject> }
  | { type: 'cursor'; cursor: CursorData }
  | { type: 'action'; action: BoardAction; userId: string }
  | { type: 'sync'; objects: Record<string, BoardObject> }

// Tool types
export type ToolType = 'select' | 'sticky' | 'rect' | 'circle' | 'line' | 'text' | 'pan' | 'frame' | 'connector'

// Color palette for sticky notes
export const STICKY_COLORS = ['#FFF176', '#80DEEA', '#A5D6A7', '#F48FB1', '#FFAB91', '#CE93D8'] as const
export const CURSOR_COLORS = ['#E57373', '#64B5F6', '#81C784', '#FFB74D', '#BA68C8', '#4DD0E1', '#FF8A65', '#AED581', '#F06292', '#7986CB', '#A1887F', '#90A4AE'] as const
