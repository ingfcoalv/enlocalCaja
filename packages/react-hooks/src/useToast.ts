import { create } from 'zustand'

interface Toast {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  message: string
  createdAt: number
}

interface ToastState {
  toasts: Toast[]
  success: (message: string) => void
  error: (message: string) => void
  warning: (message: string) => void
  info: (message: string) => void
  removeToast: (id: string) => void
}

const AUTO_REMOVE_MS = 5000
const MAX_TOASTS = 5

let toastCounter = 0

function generateId(): string {
  toastCounter += 1
  return `toast-${Date.now()}-${toastCounter}`
}

export const useToast = create<ToastState>((set, get) => {
  const addToast = (type: Toast['type'], message: string) => {
    const id = generateId()
    const toast: Toast = {
      id,
      type,
      message,
      createdAt: Date.now(),
    }

    set((state) => {
      // Keep only the most recent (MAX_TOASTS - 1) to make room for the new one
      const existing = state.toasts.length >= MAX_TOASTS
        ? state.toasts.slice(-(MAX_TOASTS - 1))
        : state.toasts

      return { toasts: [...existing, toast] }
    })

    // Auto-remove after 5 seconds
    setTimeout(() => {
      get().removeToast(id)
    }, AUTO_REMOVE_MS)
  }

  return {
    toasts: [],

    success: (message: string) => addToast('success', message),
    error: (message: string) => addToast('error', message),
    warning: (message: string) => addToast('warning', message),
    info: (message: string) => addToast('info', message),

    removeToast: (id: string) => {
      set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id),
      }))
    },
  }
})
