import { v4 as uuidv4 } from 'uuid'
import { CURSOR_COLORS } from '../../shared/types'

export function generateId(): string {
  return uuidv4()
}

export function assignColor(userId: string): string {
  let hash = 0
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) - hash + userId.charCodeAt(i)) | 0
  }
  return CURSOR_COLORS[Math.abs(hash) % CURSOR_COLORS.length]
}

export function throttle<T extends (...args: any[]) => void>(fn: T, ms: number): T {
  let last = 0
  let timer: ReturnType<typeof setTimeout> | null = null
  return ((...args: any[]) => {
    const now = Date.now()
    if (now - last >= ms) {
      last = now
      fn(...args)
    } else if (!timer) {
      timer = setTimeout(() => {
        last = Date.now()
        timer = null
        fn(...args)
      }, ms - (now - last))
    }
  }) as T
}

export interface Camera {
  x: number
  y: number
  zoom: number
}

export function screenToBoard(screenX: number, screenY: number, camera: Camera) {
  return {
    x: (screenX - camera.x) / camera.zoom,
    y: (screenY - camera.y) / camera.zoom,
  }
}

export function boardToScreen(boardX: number, boardY: number, camera: Camera) {
  return {
    x: boardX * camera.zoom + camera.x,
    y: boardY * camera.zoom + camera.y,
  }
}
