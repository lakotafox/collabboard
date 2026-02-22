import { create } from 'zustand'

export type CanvasTheme = 'dark' | 'white'

export const themeConfig = {
  dark: {
    bg: '#1e1e2e',
    grid: '#313244',
    uiBg: '#313244',
    uiBorder: '#45475a',
    text: '#cdd6f4',
    textMuted: '#a6adc8',
    accent: '#89b4fa',
  },
  white: {
    bg: '#ffffff',
    grid: '#e0e0e0',
    uiBg: '#f5f5f5',
    uiBorder: '#d0d0d0',
    text: '#1e1e2e',
    textMuted: '#666666',
    accent: '#4a90d9',
  },
} as const

interface UIState {
  showAIPanel: boolean
  toggleAIPanel: () => void
  canvasTheme: CanvasTheme
  toggleTheme: () => void
  showGrid: boolean
  toggleGrid: () => void
  userId: string
  userName: string
  userColor: string
  setUser: (userId: string, userName: string, userColor: string) => void
  boardId: string
  setBoardId: (id: string) => void
  isConnected: boolean
  setConnected: (connected: boolean) => void
}

export const useUIStore = create<UIState>((set) => ({
  showAIPanel: false,
  toggleAIPanel: () => set((s) => ({ showAIPanel: !s.showAIPanel })),
  canvasTheme: 'dark',
  toggleTheme: () => set((s) => ({ canvasTheme: s.canvasTheme === 'dark' ? 'white' : 'dark' })),
  showGrid: true,
  toggleGrid: () => set((s) => ({ showGrid: !s.showGrid })),
  userId: '',
  userName: '',
  userColor: '',
  setUser: (userId, userName, userColor) => set({ userId, userName, userColor }),
  boardId: 'default',
  setBoardId: (id) => set({ boardId: id }),
  isConnected: false,
  setConnected: (connected) => set({ isConnected: connected }),
}))
