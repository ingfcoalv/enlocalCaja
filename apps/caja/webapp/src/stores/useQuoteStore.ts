import { create } from 'zustand'
import { api } from '@enlocal/react-hooks'

export interface QuoteItem {
  id?: string
  itemType: string
  productId?: string
  serviceId?: string
  itemName: string
  itemDescription?: string
  itemSku?: string
  quantity: number
  unitPrice: number
  discount: number
  taxRate: number
  taxAmount: number
  total: number
  groupName?: string
  isOptional: boolean
  satCode?: string
  satUnit?: string
  notes?: string
  sortOrder?: number
}

export interface QuoteEmail {
  id: string
  sentTo: string
  sentCc?: string
  subject: string
  body?: string
  attachedPdf: boolean
  status: string
  errorMessage?: string
  sentBy: string
  sentAt: string
}

export interface QuoteActivity {
  id: string
  activityType: string
  description: string
  metadata?: string
  createdBy: string
  createdAt: string
}

export interface Quote {
  id: string
  folio: number
  series: string
  version: number
  parentQuoteId?: string
  customerId?: string
  customerName: string
  customerEmail?: string
  customerPhone?: string
  customerRfc?: string
  customerAddress?: string
  subtotal: string
  discountAmount: string
  taxAmount: string
  total: string
  status: string
  validDays: number
  validUntil?: string
  conditions?: string
  notes?: string
  termsAndConditions?: string
  salesPersonName?: string
  isTemplate: boolean
  templateName?: string
  followUpDate?: string
  followUpNotes?: string
  convertedToTicketId?: string
  convertedToRemissionId?: string
  convertedAt?: string
  createdBy: string
  acceptedAt?: string
  rejectedAt?: string
  rejectedReason?: string
  cancelledBy?: string
  cancelledAt?: string
  cancelReason?: string
  createdAt: string
  updatedAt: string
  items?: QuoteItem[]
  emails?: QuoteEmail[]
  activities?: QuoteActivity[]
  versions?: Quote[]
}

interface PipelineItem {
  status: string
  count: number
  total: number
}

interface Pagination {
  page: number
  pages: number
  total: number
}

interface QuoteFilters {
  status?: string
  customer_id?: string
  created_by?: string
  from?: string
  to?: string
  q?: string
  is_template?: string
  needs_followup?: string
  page?: number
  limit?: number
}

interface QuoteState {
  quotes: Quote[]
  loading: boolean
  error: string | null
  pagination: Pagination
  filters: QuoteFilters
  currentQuote: Quote | null
  pipeline: PipelineItem[]
  templates: Quote[]
  needsFollowUp: Quote[]
  expiringSoon: Quote[]
  conversionRate: { total: number; converted: number; rate: number }

  // CRUD
  fetchQuotes: (filters?: QuoteFilters) => Promise<void>
  setFilters: (filters: Partial<QuoteFilters>) => void
  fetchById: (id: string) => Promise<Quote>
  create: (data: any) => Promise<Quote>
  update: (id: string, data: any) => Promise<Quote>
  clearCurrent: () => void

  // Actions
  newVersion: (id: string) => Promise<Quote>
  send: (id: string, emailData: any) => Promise<void>
  accept: (id: string) => Promise<void>
  reject: (id: string, reason: string) => Promise<void>
  cancel: (id: string, reason: string) => Promise<void>
  convert: (id: string, target: string, paymentType?: string) => Promise<any>
  addActivity: (id: string, data: any) => Promise<void>
  fromTemplate: (templateId: string, customerData: any) => Promise<Quote>

  // Pipeline & Stats
  fetchPipeline: () => Promise<void>
  fetchConversionRate: () => Promise<void>
  fetchNeedsFollowUp: () => Promise<void>
  fetchExpiringSoon: () => Promise<void>
  fetchTemplates: () => Promise<void>

  // PDF
  downloadPdf: (id: string) => Promise<void>
}

export const useQuoteStore = create<QuoteState>((set, get) => ({
  quotes: [],
  loading: false,
  error: null,
  pagination: { page: 1, pages: 0, total: 0 },
  filters: {},
  currentQuote: null,
  pipeline: [],
  templates: [],
  needsFollowUp: [],
  expiringSoon: [],
  conversionRate: { total: 0, converted: 0, rate: 0 },

  fetchQuotes: async (filters?: QuoteFilters) => {
    set({ loading: true, error: null })
    try {
      const params = filters || get().filters
      const { data } = await api.get('/api/quotes', { params })
      set({
        quotes: data.data || [],
        pagination: { page: data.page || 1, pages: data.pages || 1, total: data.total || 0 },
        loading: false,
      })
    } catch (err: any) {
      set({ error: err?.response?.data?.error || 'Error al cargar cotizaciones', loading: false })
    }
  },

  setFilters: (filters) => {
    set((s) => ({ filters: { ...s.filters, ...filters } }))
  },

  fetchById: async (id: string) => {
    set({ loading: true, error: null })
    try {
      const { data } = await api.get(`/api/quotes/${id}`)
      const quote = data.data || data
      set({ currentQuote: quote, loading: false })
      return quote
    } catch (err: any) {
      set({ error: err?.response?.data?.error || 'Error al cargar cotizacion', loading: false })
      throw err
    }
  },

  create: async (payload: any) => {
    set({ loading: true, error: null })
    try {
      const { data } = await api.post('/api/quotes', payload)
      const created = data.data || data
      set((s) => ({ quotes: [created, ...s.quotes], loading: false }))
      return created
    } catch (err: any) {
      set({ loading: false })
      throw err
    }
  },

  update: async (id: string, payload: any) => {
    set({ loading: true, error: null })
    try {
      const { data } = await api.put(`/api/quotes/${id}`, payload)
      const updated = data.data || data
      set((s) => ({
        quotes: s.quotes.map((q) => (q.id === id ? updated : q)),
        currentQuote: s.currentQuote?.id === id ? updated : s.currentQuote,
        loading: false,
      }))
      return updated
    } catch (err: any) {
      set({ loading: false })
      throw err
    }
  },

  clearCurrent: () => set({ currentQuote: null }),

  newVersion: async (id: string) => {
    set({ loading: true })
    try {
      const { data } = await api.post(`/api/quotes/${id}/new-version`)
      const newVer = data.data || data
      set((s) => ({
        quotes: [newVer, ...s.quotes.map((q) => q.id === id ? { ...q, status: 'superseded' } : q)],
        currentQuote: newVer,
        loading: false,
      }))
      return newVer
    } catch (err: any) {
      set({ loading: false })
      throw err
    }
  },

  send: async (id: string, emailData: any) => {
    set({ loading: true })
    try {
      await api.post(`/api/quotes/${id}/send`, emailData)
      set((s) => ({
        quotes: s.quotes.map((q) => (q.id === id ? { ...q, status: 'sent' } : q)),
        currentQuote: s.currentQuote?.id === id ? { ...s.currentQuote, status: 'sent' } : s.currentQuote,
        loading: false,
      }))
    } catch (err: any) {
      set({ loading: false })
      throw err
    }
  },

  accept: async (id: string) => {
    set({ loading: true })
    try {
      await api.post(`/api/quotes/${id}/accept`)
      set((s) => ({
        quotes: s.quotes.map((q) => (q.id === id ? { ...q, status: 'accepted' } : q)),
        currentQuote: s.currentQuote?.id === id ? { ...s.currentQuote, status: 'accepted' } : s.currentQuote,
        loading: false,
      }))
    } catch (err: any) {
      set({ loading: false })
      throw err
    }
  },

  reject: async (id: string, reason: string) => {
    set({ loading: true })
    try {
      await api.post(`/api/quotes/${id}/reject`, { reason })
      set((s) => ({
        quotes: s.quotes.map((q) => (q.id === id ? { ...q, status: 'rejected' } : q)),
        currentQuote: s.currentQuote?.id === id ? { ...s.currentQuote, status: 'rejected' } : s.currentQuote,
        loading: false,
      }))
    } catch (err: any) {
      set({ loading: false })
      throw err
    }
  },

  cancel: async (id: string, reason: string) => {
    set({ loading: true })
    try {
      await api.post(`/api/quotes/${id}/cancel`, { reason })
      set((s) => ({
        quotes: s.quotes.map((q) => (q.id === id ? { ...q, status: 'cancelled' } : q)),
        currentQuote: s.currentQuote?.id === id ? { ...s.currentQuote, status: 'cancelled' } : s.currentQuote,
        loading: false,
      }))
    } catch (err: any) {
      set({ loading: false })
      throw err
    }
  },

  convert: async (id: string, target: string, paymentType?: string) => {
    set({ loading: true })
    try {
      const { data } = await api.post(`/api/quotes/${id}/convert`, { target, payment_type: paymentType })
      const result = data.data || data
      set((s) => ({
        quotes: s.quotes.map((q) => (q.id === id ? { ...q, status: 'converted' } : q)),
        currentQuote: s.currentQuote?.id === id ? { ...s.currentQuote, status: 'converted' } : s.currentQuote,
        loading: false,
      }))
      return result
    } catch (err: any) {
      set({ loading: false })
      throw err
    }
  },

  addActivity: async (id: string, data: any) => {
    try {
      await api.post(`/api/quotes/${id}/activity`, data)
      // Refresh quote to get updated activities
      const store = get()
      if (store.currentQuote?.id === id) {
        store.fetchById(id)
      }
    } catch (err: any) {
      throw err
    }
  },

  fromTemplate: async (templateId: string, customerData: any) => {
    set({ loading: true })
    try {
      const { data } = await api.post(`/api/quotes/from-template/${templateId}`, customerData)
      const created = data.data || data
      set((s) => ({ quotes: [created, ...s.quotes], loading: false }))
      return created
    } catch (err: any) {
      set({ loading: false })
      throw err
    }
  },

  fetchPipeline: async () => {
    try {
      const { data } = await api.get('/api/quotes/pipeline')
      const arr = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : []
      set({ pipeline: arr })
    } catch {
      // Ignore
    }
  },

  fetchConversionRate: async () => {
    try {
      const { data } = await api.get('/api/quotes/conversion-rate')
      set({ conversionRate: data.data || data })
    } catch {
      // Ignore
    }
  },

  fetchNeedsFollowUp: async () => {
    try {
      const { data } = await api.get('/api/quotes/needs-followup')
      set({ needsFollowUp: data.data || data })
    } catch {
      // Ignore
    }
  },

  fetchExpiringSoon: async () => {
    try {
      const { data } = await api.get('/api/quotes/expiring-soon')
      set({ expiringSoon: data.data || data })
    } catch {
      // Ignore
    }
  },

  fetchTemplates: async () => {
    try {
      const { data } = await api.get('/api/quotes/templates')
      set({ templates: data.data || [] })
    } catch {
      // Ignore
    }
  },

  downloadPdf: async (id: string) => {
    try {
      const { data } = await api.get(`/api/quotes/${id}/pdf`, { responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([data], { type: 'application/pdf' }))
      window.open(url, '_blank')
    } catch (err: any) {
      throw err
    }
  },
}))
