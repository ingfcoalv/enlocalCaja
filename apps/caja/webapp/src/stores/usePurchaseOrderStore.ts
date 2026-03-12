import { create } from 'zustand'
import { api } from '@enlocal/react-hooks'

export interface PurchaseOrderItem {
  id?: string
  productId: string
  productName: string
  productSku?: string
  quantity: number
  unitCost: number
  discount: number
  taxRate: number
  taxAmount: number
  total: number
  quantityReceived?: number
  quantityReturned?: number
  notes?: string
}

export interface PurchaseOrder {
  id: string
  folio: number
  series: string
  supplierId: string
  supplierName: string
  supplierRfc?: string
  paymentTerms: string
  creditDays?: number
  expectedDate?: string
  status: string
  subtotal: string
  discountAmount: string
  taxAmount: string
  total: string
  deliveryAddress?: string
  deliveryNotes?: string
  internalNotes?: string
  createdBy: string
  approvedBy?: string
  approvedAt?: string
  cancelledBy?: string
  cancelledAt?: string
  cancelReason?: string
  closedBy?: string
  closedAt?: string
  closeReason?: string
  createdAt: string
  updatedAt: string
  items?: PurchaseOrderItem[]
  receipts?: any[]
  statusHistory?: any[]
}

interface Pagination {
  page: number
  pages: number
  total: number
}

interface POFilters {
  status?: string
  supplier_id?: string
  payment_terms?: string
  from?: string
  to?: string
  q?: string
  page?: number
  limit?: number
}

interface PurchaseOrderState {
  orders: PurchaseOrder[]
  loading: boolean
  error: string | null
  pagination: Pagination
  filters: POFilters
  currentOrder: PurchaseOrder | null
  warehousePending: PurchaseOrder[]

  fetchOrders: (filters?: POFilters) => Promise<void>
  setFilters: (filters: Partial<POFilters>) => void
  fetchById: (id: string) => Promise<PurchaseOrder>
  create: (data: any) => Promise<PurchaseOrder>
  update: (id: string, data: any) => Promise<PurchaseOrder>
  approve: (id: string) => Promise<any>
  cancel: (id: string, reason: string) => Promise<void>
  closeOrder: (id: string, reason: string) => Promise<any>
  fetchWarehousePending: () => Promise<void>
  receive: (id: string, data: any) => Promise<any>
  clearCurrent: () => void
}

export const usePurchaseOrderStore = create<PurchaseOrderState>((set, get) => ({
  orders: [],
  loading: false,
  error: null,
  pagination: { page: 1, pages: 0, total: 0 },
  filters: {},
  currentOrder: null,
  warehousePending: [],

  fetchOrders: async (filters?: POFilters) => {
    set({ loading: true, error: null })
    try {
      const params = filters || get().filters
      const { data } = await api.get('/api/purchase-orders', { params })
      const items = data.data || data.items || []
      set({
        orders: items,
        pagination: data.pagination || { page: 1, pages: 1, total: items.length },
        loading: false,
      })
    } catch (err: any) {
      set({ error: err?.response?.data?.error || 'Error al cargar ordenes de compra', loading: false })
    }
  },

  setFilters: (filters) => {
    set((s) => ({ filters: { ...s.filters, ...filters } }))
  },

  fetchById: async (id: string) => {
    set({ loading: true, error: null })
    try {
      const { data } = await api.get(`/api/purchase-orders/${id}`)
      const order = data.data || data
      set({ currentOrder: order, loading: false })
      return order
    } catch (err: any) {
      set({ error: err?.response?.data?.error || 'Error al cargar orden', loading: false })
      throw err
    }
  },

  create: async (payload: any) => {
    set({ loading: true, error: null })
    try {
      const { data } = await api.post('/api/purchase-orders', payload)
      const created = data.data || data
      set((s) => ({ orders: [created, ...s.orders], loading: false }))
      return created
    } catch (err: any) {
      set({ loading: false })
      throw err
    }
  },

  update: async (id: string, payload: any) => {
    set({ loading: true, error: null })
    try {
      const { data } = await api.put(`/api/purchase-orders/${id}`, payload)
      const updated = data.data || data
      set((s) => ({
        orders: s.orders.map((o) => (o.id === id ? updated : o)),
        currentOrder: s.currentOrder?.id === id ? updated : s.currentOrder,
        loading: false,
      }))
      return updated
    } catch (err: any) {
      set({ loading: false })
      throw err
    }
  },

  approve: async (id: string) => {
    set({ loading: true })
    try {
      const { data } = await api.post(`/api/purchase-orders/${id}/approve`)
      const result = data.data || data
      set((s) => ({
        orders: s.orders.map((o) => (o.id === id ? { ...o, status: 'approved' } : o)),
        currentOrder: s.currentOrder?.id === id ? { ...s.currentOrder, status: 'approved' } : s.currentOrder,
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
      await api.post(`/api/purchase-orders/${id}/cancel`, { reason })
      set((s) => ({
        orders: s.orders.map((o) => (o.id === id ? { ...o, status: 'cancelled' } : o)),
        currentOrder: s.currentOrder?.id === id ? { ...s.currentOrder, status: 'cancelled' } : s.currentOrder,
        loading: false,
      }))
    } catch (err: any) {
      set({ loading: false })
      throw err
    }
  },

  closeOrder: async (id: string, reason: string) => {
    set({ loading: true })
    try {
      const { data } = await api.post(`/api/purchase-orders/${id}/close`, { reason })
      const result = data.data || data
      set((s) => ({
        orders: s.orders.map((o) => (o.id === id ? { ...o, status: 'closed' } : o)),
        warehousePending: s.warehousePending.filter((o) => o.id !== id),
        currentOrder: s.currentOrder?.id === id ? { ...s.currentOrder, status: 'closed' } : s.currentOrder,
        loading: false,
      }))
      return result
    } catch (err: any) {
      set({ loading: false })
      throw err
    }
  },

  fetchWarehousePending: async () => {
    set({ loading: true, error: null })
    try {
      const { data } = await api.get('/api/purchase-orders/warehouse/pending')
      set({ warehousePending: data.data || [], loading: false })
    } catch (err: any) {
      set({ error: err?.response?.data?.error || 'Error al cargar pendientes', loading: false })
    }
  },

  receive: async (id: string, payload: any) => {
    set({ loading: true })
    try {
      const { data } = await api.post(`/api/purchase-orders/${id}/receive`, payload)
      const result = data.data || data
      set({ loading: false })
      return result
    } catch (err: any) {
      set({ loading: false })
      throw err
    }
  },

  clearCurrent: () => set({ currentOrder: null }),
}))
