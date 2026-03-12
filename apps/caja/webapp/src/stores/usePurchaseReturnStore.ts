import { create } from 'zustand'
import { api } from '@enlocal/react-hooks'

export interface PurchaseReturn {
  id: string
  purchaseOrderId: string
  folio: number
  series: string
  status: string
  returnType: string
  reasonCategory: string
  reason: string
  totalReturned: string
  createdBy: string
  createdAt: string
  sentAt?: string
  completedAt?: string
  rejectedAt?: string
  rejectedReason?: string
  payableAdjusted: boolean
  updatedAt: string
  items?: any[]
  purchaseOrder?: any
}

interface Pagination {
  page: number
  pages: number
  total: number
}

interface ReturnFilters {
  status?: string
  purchase_order_id?: string
  from?: string
  to?: string
  page?: number
  limit?: number
}

interface PurchaseReturnState {
  returns: PurchaseReturn[]
  loading: boolean
  error: string | null
  pagination: Pagination
  currentReturn: PurchaseReturn | null

  fetchReturns: (filters?: ReturnFilters) => Promise<void>
  fetchById: (id: string) => Promise<PurchaseReturn>
  create: (data: any) => Promise<PurchaseReturn>
  send: (id: string) => Promise<any>
  complete: (id: string, notes?: string) => Promise<any>
  reject: (id: string, reason: string) => Promise<any>
  clearCurrent: () => void
}

export const usePurchaseReturnStore = create<PurchaseReturnState>((set) => ({
  returns: [],
  loading: false,
  error: null,
  pagination: { page: 1, pages: 0, total: 0 },
  currentReturn: null,

  fetchReturns: async (filters?: ReturnFilters) => {
    set({ loading: true, error: null })
    try {
      const { data } = await api.get('/api/purchase-returns', { params: filters })
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
      const { data } = await api.get(`/api/purchase-returns/${id}`)
      const item = data.data || data
      set({ currentReturn: item, loading: false })
      return item
    } catch (err: any) {
      set({ error: err?.response?.data?.error || 'Error al cargar devolucion', loading: false })
      throw err
    }
  },

  create: async (payload: any) => {
    set({ loading: true, error: null })
    try {
      const { data } = await api.post('/api/purchase-returns', payload)
      const created = data.data || data
      set((s) => ({ returns: [created, ...s.returns], loading: false }))
      return created
    } catch (err: any) {
      set({ loading: false })
      throw err
    }
  },

  send: async (id: string) => {
    set({ loading: true })
    try {
      const { data } = await api.post(`/api/purchase-returns/${id}/send`)
      const result = data.data || data
      set((s) => ({
        returns: s.returns.map((r) => (r.id === id ? { ...r, status: 'sent' } : r)),
        currentReturn: s.currentReturn?.id === id ? { ...s.currentReturn, status: 'sent' } : s.currentReturn,
        loading: false,
      }))
      return result
    } catch (err: any) {
      set({ loading: false })
      throw err
    }
  },

  complete: async (id: string, notes?: string) => {
    set({ loading: true })
    try {
      const { data } = await api.post(`/api/purchase-returns/${id}/complete`, { notes })
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
      const { data } = await api.post(`/api/purchase-returns/${id}/reject`, { reason })
      const result = data.data || data
      set((s) => ({
        returns: s.returns.map((r) => (r.id === id ? { ...r, status: 'rejected' } : r)),
        currentReturn: s.currentReturn?.id === id ? { ...s.currentReturn, status: 'rejected' } : s.currentReturn,
        loading: false,
      }))
      return result
    } catch (err: any) {
      set({ loading: false })
      throw err
    }
  },

  clearCurrent: () => set({ currentReturn: null }),
}))
