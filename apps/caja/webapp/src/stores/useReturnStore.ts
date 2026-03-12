import { create } from 'zustand'
import { api } from '@enlocal/react-hooks'

export interface RemissionReturn {
  id: string
  remissionNoteId: string
  folio: number
  series: string
  status: string
  returnType: string
  reasonCategory: string
  reason: string
  totalReturned: string
  requestedBy: string
  requestedAt: string
  reviewedBy?: string
  reviewedAt?: string
  reviewNotes?: string
  completedAt?: string
  ticketAdjusted: boolean
  receivableAdjusted: boolean
  createdAt: string
  updatedAt: string
  items?: any[]
  remissionNote?: any
}

interface Pagination {
  page: number
  pages: number
  total: number
}

interface ReturnFilters {
  status?: string
  remission_note_id?: string
  customer_id?: string
  from?: string
  to?: string
  page?: number
  limit?: number
}

interface ReturnState {
  returns: RemissionReturn[]
  loading: boolean
  error: string | null
  pagination: Pagination
  currentReturn: RemissionReturn | null
  warehousePending: RemissionReturn[]

  fetchReturns: (filters?: ReturnFilters) => Promise<void>
  fetchById: (id: string) => Promise<RemissionReturn>
  fetchWarehousePending: () => Promise<void>
  request: (data: any) => Promise<RemissionReturn>
  review: (id: string) => Promise<void>
  process: (id: string, data: any) => Promise<any>
  reject: (id: string, reason: string) => Promise<void>
  clearCurrent: () => void
}

export const useReturnStore = create<ReturnState>((set) => ({
  returns: [],
  loading: false,
  error: null,
  pagination: { page: 1, pages: 0, total: 0 },
  currentReturn: null,
  warehousePending: [],

  fetchReturns: async (filters?: ReturnFilters) => {
    set({ loading: true, error: null })
    try {
      const { data } = await api.get('/api/returns', { params: filters })
      const items = data.data || data.items || []
      set({
        returns: items,
        pagination: data.pagination || { page: 1, pages: 1, total: items.length },
        loading: false,
      })
    } catch (err: any) {
      set({ error: err?.response?.data?.error || 'Error al cargar devoluciones', loading: false })
    }
  },

  fetchById: async (id: string) => {
    set({ loading: true, error: null })
    try {
      const { data } = await api.get(`/api/returns/${id}`)
      const item = data.data || data
      set({ currentReturn: item, loading: false })
      return item
    } catch (err: any) {
      set({ error: err?.response?.data?.error || 'Error al cargar devolucion', loading: false })
      throw err
    }
  },

  fetchWarehousePending: async () => {
    set({ loading: true })
    try {
      const { data } = await api.get('/api/returns/warehouse/pending')
      set({ warehousePending: data.data || [], loading: false })
    } catch {
      set({ warehousePending: [], loading: false })
    }
  },

  request: async (payload: any) => {
    set({ loading: true })
    try {
      const { data } = await api.post('/api/returns', payload)
      const created = data.data || data
      set((s) => ({ returns: [created, ...s.returns], loading: false }))
      return created
    } catch (err: any) {
      set({ loading: false })
      throw err
    }
  },

  review: async (id: string) => {
    set({ loading: true })
    try {
      await api.post(`/api/returns/${id}/review`)
      set((s) => ({
        returns: s.returns.map((r) => (r.id === id ? { ...r, status: 'reviewing' } : r)),
        currentReturn: s.currentReturn?.id === id ? { ...s.currentReturn, status: 'reviewing' } : s.currentReturn,
        loading: false,
      }))
    } catch (err: any) {
      set({ loading: false })
      throw err
    }
  },

  process: async (id: string, payload: any) => {
    set({ loading: true })
    try {
      const { data } = await api.post(`/api/returns/${id}/process`, payload)
      const result = data.data || data
      set((s) => ({
        returns: s.returns.map((r) => (r.id === id ? { ...r, status: 'completed' } : r)),
        currentReturn: s.currentReturn?.id === id ? { ...s.currentReturn, status: 'completed' } : s.currentReturn,
        loading: false,
      }))
      return result
    } catch (err: any) {
      set({ loading: false })
      throw err
    }
  },

  reject: async (id: string, reason: string) => {
    set({ loading: true })
    try {
      await api.post(`/api/returns/${id}/reject`, { reason })
      set((s) => ({
        returns: s.returns.map((r) => (r.id === id ? { ...r, status: 'rejected' } : r)),
        currentReturn: s.currentReturn?.id === id ? { ...s.currentReturn, status: 'rejected' } : s.currentReturn,
        loading: false,
      }))
    } catch (err: any) {
      set({ loading: false })
      throw err
    }
  },

  clearCurrent: () => set({ currentReturn: null }),
}))
