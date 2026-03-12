import { create } from 'zustand'
import { api } from '@enlocal/react-hooks'

export interface CfdiInvoice {
  id: string
  series: string | null
  folio: number | null
  customerId: string | null
  customerName: string | null
  customerRfc: string | null
  customerRazonSocial: string | null
  type: string
  status: string
  useCfdi: string | null
  paymentMethod: string | null
  paymentForm: string | null
  subtotal: string
  tax: string
  total: string
  currency: string
  exchangeRate: string | null
  source: string
  uuidFiscal: string | null
  xmlContent: string | null
  stampedAt: string | null
  cancelledAt: string | null
  cancelMotivo: string | null
  errorMessage: string | null
  createdAt: string
  updatedAt: string
  items?: InvoiceItem[]
  relations?: InvoiceRelation[]
}

export interface InvoiceItem {
  id: string
  description: string
  quantity: string
  unitPrice: string
  discount: string
  amount: string
  satCode: string | null
  satUnit: string | null
  taxRate: string
  taxAmount: string
  retentionRate: string | null
  retentionAmount: string | null
}

export interface InvoiceRelation {
  id: string
  relationType: string
  relatedUuid: string
}

interface Pagination {
  page: number
  pages: number
  total: number
}

interface InvoiceFilters {
  status?: string
  type?: string
  customerId?: string
  source?: string
  from?: string
  to?: string
  q?: string
  page?: number
  limit?: number
}

interface InvoiceState {
  invoices: CfdiInvoice[]
  loading: boolean
  error: string | null
  pagination: Pagination
  currentInvoice: CfdiInvoice | null

  fetchInvoices: (filters?: InvoiceFilters) => Promise<void>
  fetchById: (id: string) => Promise<CfdiInvoice>
  create: (data: any) => Promise<CfdiInvoice>
  update: (id: string, data: any) => Promise<CfdiInvoice>
  deleteInvoice: (id: string) => Promise<void>
  stamp: (id: string) => Promise<any>
  cancel: (id: string, motivo: string, folioSustitucion?: string) => Promise<any>
  checkCancelStatus: (id: string) => Promise<any>
  createFromTicket: (saleIds: string[], customerData: any) => Promise<CfdiInvoice>
  createComplementoPago: (data: any) => Promise<CfdiInvoice>
  downloadXml: (id: string) => void
  downloadPdf: (id: string) => void
  clearCurrent: () => void
}

export const useInvoiceStore = create<InvoiceState>((set) => ({
  invoices: [],
  loading: false,
  error: null,
  pagination: { page: 1, pages: 0, total: 0 },
  currentInvoice: null,

  fetchInvoices: async (filters?: InvoiceFilters) => {
    set({ loading: true, error: null })
    try {
      const { data } = await api.get('/api/invoices', { params: { source: 'cfdi', ...filters } })
      const items = data.data || data.items || []
      set({
        invoices: items,
        pagination: data.pagination || { page: data.page || 1, pages: data.pages || 1, total: data.total || items.length },
        loading: false,
      })
    } catch (err: any) {
      set({ error: err?.response?.data?.error || 'Error al cargar facturas', loading: false })
    }
  },

  fetchById: async (id: string) => {
    set({ loading: true, error: null })
    try {
      const { data } = await api.get(`/api/invoices/${id}`)
      const invoice = data.data || data
      set({ currentInvoice: invoice, loading: false })
      return invoice
    } catch (err: any) {
      set({ error: err?.response?.data?.error || 'Error al cargar factura', loading: false })
      throw err
    }
  },

  create: async (payload: any) => {
    set({ loading: true, error: null })
    try {
      const { data } = await api.post('/api/invoices', payload)
      const created = data.data || data
      set((s) => ({ invoices: [created, ...s.invoices], loading: false }))
      return created
    } catch (err: any) {
      set({ loading: false })
      throw err
    }
  },

  update: async (id: string, payload: any) => {
    set({ loading: true, error: null })
    try {
      const { data } = await api.put(`/api/invoices/${id}`, payload)
      const updated = data.data || data
      set((s) => ({
        invoices: s.invoices.map((inv) => (inv.id === id ? updated : inv)),
        currentInvoice: s.currentInvoice?.id === id ? updated : s.currentInvoice,
        loading: false,
      }))
      return updated
    } catch (err: any) {
      set({ loading: false })
      throw err
    }
  },

  deleteInvoice: async (id: string) => {
    try {
      await api.delete(`/api/invoices/${id}`)
      set((s) => ({
        invoices: s.invoices.filter((inv) => inv.id !== id),
        currentInvoice: s.currentInvoice?.id === id ? null : s.currentInvoice,
      }))
    } catch (err: any) {
      throw err
    }
  },

  stamp: async (id: string) => {
    set({ loading: true })
    try {
      const { data } = await api.post(`/api/invoices/${id}/stamp`)
      const result = data.data || data
      set((s) => ({
        invoices: s.invoices.map((inv) => (inv.id === id ? { ...inv, status: 'stamped', uuidFiscal: result.uuidFiscal, stampedAt: result.stampedAt } : inv)),
        currentInvoice: s.currentInvoice?.id === id ? { ...s.currentInvoice, status: 'stamped', uuidFiscal: result.uuidFiscal, stampedAt: result.stampedAt } : s.currentInvoice,
        loading: false,
      }))
      return result
    } catch (err: any) {
      set({ loading: false })
      throw err
    }
  },

  cancel: async (id: string, motivo: string, folioSustitucion?: string) => {
    set({ loading: true })
    try {
      const payload: any = { motivo }
      if (folioSustitucion) payload.folioSustitucion = folioSustitucion
      const { data } = await api.post(`/api/invoices/${id}/cancel`, payload)
      const result = data.data || data
      const newStatus = result.status || 'cancel_pending'
      set((s) => ({
        invoices: s.invoices.map((inv) => (inv.id === id ? { ...inv, status: newStatus } : inv)),
        currentInvoice: s.currentInvoice?.id === id ? { ...s.currentInvoice, status: newStatus } : s.currentInvoice,
        loading: false,
      }))
      return result
    } catch (err: any) {
      set({ loading: false })
      throw err
    }
  },

  checkCancelStatus: async (id: string) => {
    try {
      const { data } = await api.get(`/api/invoices/${id}/cancel-status`)
      return data.data || data
    } catch (err: any) {
      throw err
    }
  },

  createFromTicket: async (saleIds: string[], customerData: any) => {
    set({ loading: true, error: null })
    try {
      const { data } = await api.post('/api/invoices/from-sales', { saleIds, ...customerData })
      const created = data.data || data
      set((s) => ({ invoices: [created, ...s.invoices], loading: false }))
      return created
    } catch (err: any) {
      set({ loading: false })
      throw err
    }
  },

  createComplementoPago: async (payload: any) => {
    set({ loading: true, error: null })
    try {
      const { data } = await api.post('/api/invoices/complemento-pago', payload)
      const created = data.data || data
      set((s) => ({ invoices: [created, ...s.invoices], loading: false }))
      return created
    } catch (err: any) {
      set({ loading: false })
      throw err
    }
  },

  downloadXml: (id: string) => {
    window.open(`/api/invoices/${id}/xml`, '_blank')
  },

  downloadPdf: (id: string) => {
    window.open(`/api/invoices/${id}/pdf`, '_blank')
  },

  clearCurrent: () => set({ currentInvoice: null }),
}))
