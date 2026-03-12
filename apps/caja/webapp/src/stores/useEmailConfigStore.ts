import { create } from 'zustand'
import { api } from '@enlocal/react-hooks'

interface EmailConfig {
  host: string
  port: number
  secure: boolean
  user: string
  hasPassword: boolean
  fromName: string
  fromAddress: string
}

interface QuoteDefaults {
  validDays: number
  emailSubjectTemplate: string
  emailBodyTemplate: string
  termsAndConditions: string
}

interface EmailConfigState {
  config: EmailConfig | null
  defaults: QuoteDefaults | null
  loading: boolean
  error: string | null

  fetchConfig: () => Promise<void>
  updateConfig: (data: any) => Promise<void>
  testEmail: (to: string) => Promise<void>
  fetchDefaults: () => Promise<void>
  updateDefaults: (data: any) => Promise<void>
}

export const useEmailConfigStore = create<EmailConfigState>((set) => ({
  config: null,
  defaults: null,
  loading: false,
  error: null,

  fetchConfig: async () => {
    set({ loading: true, error: null })
    try {
      const { data } = await api.get('/api/settings/email')
      set({ config: data.data || data, loading: false })
    } catch (err: any) {
      set({ error: err?.response?.data?.error || 'Error al cargar configuracion', loading: false })
    }
  },

  updateConfig: async (payload: any) => {
    set({ loading: true, error: null })
    try {
      const { data } = await api.put('/api/settings/email', payload)
      set({ config: data.data || data, loading: false })
    } catch (err: any) {
      set({ loading: false })
      throw err
    }
  },

  testEmail: async (to: string) => {
    set({ loading: true })
    try {
      await api.post('/api/settings/email/test', { to })
      set({ loading: false })
    } catch (err: any) {
      set({ loading: false })
      throw err
    }
  },

  fetchDefaults: async () => {
    try {
      const { data } = await api.get('/api/settings/quote-defaults')
      set({ defaults: data.data || data })
    } catch {
      // Ignore
    }
  },

  updateDefaults: async (payload: any) => {
    set({ loading: true })
    try {
      await api.put('/api/settings/quote-defaults', payload)
      // Re-fetch defaults
      const { data } = await api.get('/api/settings/quote-defaults')
      set({ defaults: data.data || data, loading: false })
    } catch (err: any) {
      set({ loading: false })
      throw err
    }
  },
}))
