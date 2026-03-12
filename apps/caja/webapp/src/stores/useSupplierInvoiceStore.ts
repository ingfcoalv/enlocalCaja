import { create } from 'zustand'
import { api } from '@enlocal/react-hooks'

export interface SupplierInvoice {
  id: string
  supplierId: string
  supplierName?: string
  purchaseOrderId?: string
  invoiceNumber: string
  invoiceUuid?: string
  type: string
  issueDate: string
  subtotal: string
  taxAmount: string
  total: string
  currency: string
  paymentMethod?: string
  paymentForm?: string
  status: string
  notes?: string
  createdBy: string
  createdAt: string
  updatedAt: string
  items?: any[]
  supplier?: any
  parentInvoiceId?: string
  amountComplemented?: string
  complements?: SupplierInvoice[]
}

interface Pagination {
  page: number
  pages: number
  total: number
}

interface InvoiceFilters {
  supplier_id?: string
  status?: string
  type?: string
  payment_method?: string
  from?: string
  to?: string
  q?: string
  page?: number
  limit?: number
}

interface SupplierInvoiceState {
  invoices: SupplierInvoice[]
  loading: boolean
  error: string | null
  pagination: Pagination
  currentInvoice: SupplierInvoice | null

  fetchInvoices: (filters?: InvoiceFilters) => Promise<void>
  fetchById: (id: string) => Promise<SupplierInvoice>
  create: (data: any) => Promise<SupplierInvoice>
  update: (id: string, data: any) => Promise<SupplierInvoice>
  uploadXml: (xmlContent: string) => Promise<any>
  fetchComplements: (parentId: string) => Promise<SupplierInvoice[]>
  clearCurrent: () => void
}

export const useSupplierInvoiceStore = create<SupplierInvoiceState>((set) => ({
  invoices: [],
  loading: false,
  error: null,
  pagination: { page: 1, pages: 0, total: 0 },
  currentInvoice: null,

  fetchInvoices: async (filters?: InvoiceFilters) => {
    set({ loading: true, error: null })
    try {
      const { data } = await api.get('/api/supplier-invoices', { params: filters })
      const items = data.data || data.items || []
      set({
        invoices: items,
        pagination: data.pagination || { page: 1, pages: 1, total: items.length },
        loading: false,
      })
    } catch (err: any) {
      set({ error: err?.response?.data?.error || 'Error al cargar facturas', loading: false })
    }
  },

  fetchById: async (id: string) => {
    set({ loading: true, error: null })
    try {
      const { data } = await api.get(`/api/supplier-invoices/${id}`)
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
      const { data } = await api.post('/api/supplier-invoices', payload)
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
      const { data } = await api.put(`/api/supplier-invoices/${id}`, payload)
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

  uploadXml: async (xmlContent: string) => {
    set({ loading: true })
    try {
      const { data } = await api.post('/api/supplier-invoices/upload-xml', { xml_content: xmlContent })
      set({ loading: false })
      return data.data || data
    } catch (err: any) {
      set({ loading: false })
      throw err
    }
  },

  fetchComplements: async (parentId: string) => {
    try {
      const { data } = await api.get(`/api/supplier-invoices/${parentId}/complements`)
      return data.data || []
    } catch {
      return []
    }
  },

  clearCurrent: () => set({ currentInvoice: null }),
}))
