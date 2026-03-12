import { create } from 'zustand'
import axios from 'axios'

// Configured axios instance for all API calls
export const api = axios.create({
  baseURL: 'http://localhost:3000',
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
})

interface User {
  id: string
  name: string
  role: string
  permissions: string[]
  maxDiscountPercent?: number
}

interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  loading: boolean
  login: (pin: string, userId?: string) => Promise<void>
  logout: () => void
  refresh: () => Promise<void>
  setBaseUrl: (url: string) => void
}

const useAuthStore = create<AuthState>((set, get) => {
  // On init: check localStorage for existing token and restore session
  const storedToken = typeof window !== 'undefined' ? localStorage.getItem('enlocal_token') : null
  const storedUser = typeof window !== 'undefined' ? localStorage.getItem('enlocal_user') : null

  if (storedToken) {
    api.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`
  }

  return {
    user: storedUser ? JSON.parse(storedUser) : null,
    token: storedToken,
    isAuthenticated: !!storedToken,
    loading: false,

    login: async (pin: string, userId?: string) => {
      set({ loading: true })
      try {
        const payload: Record<string, string> = { pin }
        if (userId) {
          payload.user_id = userId
        }
        const { data } = await api.post('/api/auth/login', payload)

        const token: string = data.token
        const user: User = data.user

        // Persist to localStorage
        localStorage.setItem('enlocal_token', token)
        localStorage.setItem('enlocal_user', JSON.stringify(user))

        // Set default Authorization header for all future requests
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`

        set({
          user,
          token,
          isAuthenticated: true,
          loading: false,
        })
      } catch (error) {
        set({ loading: false })
        throw error
      }
    },

    logout: () => {
      // Clear localStorage
      localStorage.removeItem('enlocal_token')
      localStorage.removeItem('enlocal_user')

      // Remove Authorization header
      delete api.defaults.headers.common['Authorization']

      set({
        user: null,
        token: null,
        isAuthenticated: false,
        loading: false,
      })
    },

    refresh: async () => {
      const { token } = get()
      if (!token) return

      set({ loading: true })
      try {
        const { data } = await api.post('/api/auth/refresh')

        const newToken: string = data.token
        const user: User = data.user

        localStorage.setItem('enlocal_token', newToken)
        localStorage.setItem('enlocal_user', JSON.stringify(user))

        api.defaults.headers.common['Authorization'] = `Bearer ${newToken}`

        set({
          user,
          token: newToken,
          isAuthenticated: true,
          loading: false,
        })
      } catch (error) {
        // If refresh fails, logout
        get().logout()
        throw error
      }
    },

    setBaseUrl: (url: string) => {
      api.defaults.baseURL = url
    },
  }
})

// Axios interceptor: on 401 response, auto-logout
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const state = useAuthStore.getState()
      if (state.isAuthenticated) {
        state.logout()
      }
    }
    return Promise.reject(error)
  }
)

export const useAuth = useAuthStore
