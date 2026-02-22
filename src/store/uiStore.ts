import { create } from 'zustand'

interface UIState {
  showAIPanel: boolean
  toggleAIPanel: () => void
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
  userId: '',
  userName: '',
  userColor: '',
  setUser: (userId, userName, userColor) => set({ userId, userName, userColor }),
  boardId: 'default',
  setBoardId: (id) => set({ boardId: id }),
  isConnected: false,
  setConnected: (connected) => set({ isConnected: connected }),
}))
