import { create } from 'zustand'
import { api } from '@enlocal/react-hooks'

export interface RemissionItem {
  id?: string
  productId: string
  productName: string
  productSku?: string
  quantity: number
  unitPrice: number
  discount: number
  taxRate: number
  taxAmount: number
  total: number
  satCode?: string
  satUnit?: string
  quantityPrepared?: number
  quantityDelivered?: number
  quantityReturned?: number
  notes?: string
}

export interface RemissionNote {
  id: string
  folio: number
  series: string
  customerId: string
  customerName: string
  customerRfc?: string
  paymentType: string
  creditDays?: number
  dueDate?: string
  status: string
  subtotal: string
  discountAmount: string
  discountPercent: string
  taxAmount: string
  total: string
  ticketId?: string
  deliveredBy?: string
  deliveredAt?: string
  receivedBy?: string
  receivedIdDoc?: string
  preparedBy?: string
  preparedAt?: string
  deliveryAddress?: string
  deliveryNotes?: string
  internalNotes?: string
  createdBy: string
  confirmedBy?: string
  confirmedAt?: string
  cancelledBy?: string
  cancelledAt?: string
  cancelReason?: string
  createdAt: string
  updatedAt: string
  items?: RemissionItem[]
  history?: any[]
}

interface Pagination {
  page: number
  pages: number
  total: number
}

interface RemissionFilters {
  status?: string
  customer_id?: string
  payment_type?: string
  from?: string
  to?: string
  q?: string
  page?: number
  limit?: number
}

interface RemissionState {
  remissions: RemissionNote[]
  loading: boolean
  error: string | null
  pagination: Pagination
  filters: RemissionFilters
  currentRemission: RemissionNote | null

  fetchRemissions: (filters?: RemissionFilters) => Promise<void>
  setFilters: (filters: Partial<RemissionFilters>) => void
  fetchById: (id: string) => Promise<RemissionNote>
  create: (data: any) => Promise<RemissionNote>
  update: (id: string, data: any) => Promise<RemissionNote>
  confirm: (id: string) => Promise<any>
  cancel: (id: string, reason: string) => Promise<void>
  prepare: (id: string, items: any[]) => Promise<void>
  deliver: (id: string, data: any) => Promise<any>
  getPrintData: (id: string) => Promise<any>
  clearCurrent: () => void
}

export const useRemissionStore = create<RemissionState>((set, get) => ({
  remissions: [],
  loading: false,
  error: null,
  pagination: { page: 1, pages: 0, total: 0 },
  filters: {},
  currentRemission: null,

  fetchRemissions: async (filters?: RemissionFilters) => {
    set({ loading: true, error: null })
    try {
      const params = filters || get().filters
      const { data } = await api.get('/api/remissions', { params })
      const items = data.data || data.items || []
      set({
        remissions: items,
        pagination: data.pagination || { page: 1, pages: 1, total: items.length },
        loading: false,
      })
    } catch (err: any) {
      set({ error: err?.response?.data?.error || 'Error al cargar remisiones', loading: false })
    }
  },

  setFilters: (filters) => {
    set((s) => ({ filters: { ...s.filters, ...filters } }))
  },

  fetchById: async (id: string) => {
    set({ loading: true, error: null })
    try {
      const { data } = await api.get(`/api/remissions/${id}`)
      const note = data.data || data
      set({ currentRemission: note, loading: false })
      return note
    } catch (err: any) {
      set({ error: err?.response?.data?.error || 'Error al cargar nota', loading: false })
      throw err
    }
  },

  create: async (payload: any) => {
    set({ loading: true, error: null })
    try {
      const { data } = await api.post('/api/remissions', payload)
      const created = data.data || data
      set((s) => ({ remissions: [created, ...s.remissions], loading: false }))
      return created
    } catch (err: any) {
      set({ loading: false })
      throw err
    }
  },

  update: async (id: string, payload: any) => {
    set({ loading: true, error: null })
    try {
      const { data } = await api.put(`/api/remissions/${id}`, payload)
      const updated = data.data || data
      set((s) => ({
        remissions: s.remissions.map((r) => (r.id === id ? updated : r)),
        currentRemission: s.currentRemission?.id === id ? updated : s.currentRemission,
        loading: false,
      }))
      return updated
    } catch (err: any) {
      set({ loading: false })
      throw err
    }
  },

  confirm: async (id: string) => {
    set({ loading: true })
    try {
      const { data } = await api.post(`/api/remissions/${id}/confirm`)
      const result = data.data || data
      set((s) => ({
        remissions: s.remissions.map((r) => (r.id === id ? { ...r, status: 'confirmed' } : r)),
        currentRemission: s.currentRemission?.id === id ? { ...s.currentRemission, status: 'confirmed' } : s.currentRemission,
        loading: false,
      }))
      return result
    } catch (err: any) {
      set({ loading: false })
      throw err
    }
  },

  cancel: async (id: string, reason: string) => {
    set({ loading: true })
    try {
      await api.post(`/api/remissions/${id}/cancel`, { reason })
      set((s) => ({
        remissions: s.remissions.map((r) => (r.id === id ? { ...r, status: 'cancelled' } : r)),
        currentRemission: s.currentRemission?.id === id ? { ...s.currentRemission, status: 'cancelled' } : s.currentRemission,
        loading: false,
      }))
    } catch (err: any) {
      set({ loading: false })
      throw err
    }
  },

  prepare: async (id: string, items: any[]) => {
    set({ loading: true })
    try {
      await api.post(`/api/remissions/${id}/prepare`, { items })
      set((s) => ({
        remissions: s.remissions.map((r) => (r.id === id ? { ...r, status: 'prepared' } : r)),
        loading: false,
      }))
    } catch (err: any) {
      set({ loading: false })
      throw err
    }
  },

  deliver: async (id: string, data: any) => {
    set({ loading: true })
    try {
      const { data: resp } = await api.post(`/api/remissions/${id}/deliver`, data)
      const result = resp.data || resp
      set((s) => ({
        remissions: s.remissions.map((r) => (r.id === id ? { ...r, status: 'delivered' } : r)),
        loading: false,
      }))
      return result
    } catch (err: any) {
      set({ loading: false })
      throw err
    }
  },

  getPrintData: async (id: string) => {
    const { data } = await api.get(`/api/remissions/${id}/print`)
    return data.data || data
  },

  clearCurrent: () => set({ currentRemission: null }),
}))
