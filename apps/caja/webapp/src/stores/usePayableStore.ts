import { create } from 'zustand'
import { api } from '@enlocal/react-hooks'

export interface Payable {
  id: string
  supplierId: string
  supplierInvoiceId?: string
  purchaseOrderId?: string
  originalAmount: string
  adjustments: string
  amountPaid: string
  balance: string
  issuedDate: string
  dueDate: string
  status: string
  priority: number
  paymentMethod?: string
  lastPaymentDate?: string
  daysOverdue: number
  createdAt: string
  updatedAt: string
  supplierName?: string
  supplierPhone?: string
  payments?: PayablePayment[]
}

export interface PayablePayment {
  id: string
  payableId: string
  amount: string
  paymentMethod: string
  reference?: string
  paidBy: string
  notes?: string
  createdAt: string
}

export interface AgingRow {
  supplierId: string
  supplierName: string
  current: number
  days1to30: number
  days31to60: number
  days61to90: number
  days90plus: number
  total: number
}

export interface AgingReport {
  rows: AgingRow[]
  totals: {
    current: number
    days1to30: number
    days31to60: number
    days61to90: number
    days90plus: number
    total: number
  }
  asOfDate: string
}

export interface SupplierStatement {
  supplier: any
  payables: any[]
  totalOwed: number
  totalOverdue: number
}

interface Pagination {
  page: number
  pages: number
  total: number
}

interface PayableFilters {
  supplier_id?: string
  status?: string
  overdue_only?: string
  from?: string
  to?: string
  q?: string
  page?: number
  limit?: number
}

interface PayableState {
  payables: Payable[]
  loading: boolean
  error: string | null
  pagination: Pagination
  currentPayable: Payable | null
  agingReport: AgingReport | null
  paymentSchedule: any[]
  cashFlowProjection: any
  supplierStatement: SupplierStatement | null

  fetchPayables: (filters?: PayableFilters) => Promise<void>
  fetchById: (id: string) => Promise<Payable>
  pay: (id: string, data: any) => Promise<any>
  batchPay: (data: any) => Promise<any>
  updatePriority: (id: string, priority: number) => Promise<any>
  fetchAgingReport: (asOfDate?: string) => Promise<void>
  fetchPaymentSchedule: (from?: string, to?: string) => Promise<void>
  fetchCashFlowProjection: (weeks?: number) => Promise<void>
  fetchSupplierStatement: (supplierId: string) => Promise<void>
  clearCurrent: () => void
}

export const usePayableStore = create<PayableState>((set) => ({
  payables: [],
  loading: false,
  error: null,
  pagination: { page: 1, pages: 0, total: 0 },
  currentPayable: null,
  agingReport: null,
  paymentSchedule: [],
  cashFlowProjection: null,
  supplierStatement: null,

  fetchPayables: async (filters?: PayableFilters) => {
    set({ loading: true, error: null })
    try {
      const { data } = await api.get('/api/payables', { params: filters })
      const items = data.data || data.items || []
      set({
        payables: items,
        pagination: data.pagination || { page: 1, pages: 1, total: items.length },
        loading: false,
      })
    } catch (err: any) {
      set({ error: err?.response?.data?.error || 'Error al cargar CxP', loading: false })
    }
  },

  fetchById: async (id: string) => {
    set({ loading: true, error: null })
    try {
      const { data } = await api.get(`/api/payables/${id}`)
      const item = data.data || data
      set({ currentPayable: item, loading: false })
      return item
    } catch (err: any) {
      set({ error: err?.response?.data?.error || 'Error al cargar CxP', loading: false })
      throw err
    }
  },

  pay: async (id: string, payload: any) => {
    set({ loading: true })
    try {
      const { data } = await api.post(`/api/payables/${id}/pay`, payload)
      const result = data.data || data
      set((s) => ({
        payables: s.payables.map((p) =>
          p.id === id ? { ...p, ...result.payable } : p
        ),
        loading: false,
      }))
      return result
    } catch (err: any) {
      set({ loading: false })
      throw err
    }
  },

  batchPay: async (payload: any) => {
    set({ loading: true })
    try {
      const { data } = await api.post('/api/payables/batch-pay', payload)
      set({ loading: false })
      return data.data || data
    } catch (err: any) {
      set({ loading: false })
      throw err
    }
  },

  updatePriority: async (id: string, priority: number) => {
    try {
      const { data } = await api.put(`/api/payables/${id}/priority`, { priority })
      const updated = data.data || data
      set((s) => ({
        payables: s.payables.map((p) => (p.id === id ? { ...p, priority: updated.priority } : p)),
      }))
      return updated
    } catch (err: any) {
      throw err
    }
  },

  fetchAgingReport: async (asOfDate?: string) => {
    set({ loading: true, error: null })
    try {
      const params: any = {}
      if (asOfDate) params.as_of_date = asOfDate
      const { data } = await api.get('/api/payables/aging-report', { params })
      const raw = data.data || data
      const rows: AgingRow[] = (raw.suppliers || raw.rows || []).map((r: any) => ({
        supplierId: r.supplier_id || r.supplierId || '',
        supplierName: r.supplier_name || r.supplierName || '',
        current: Number(r.current_amount ?? r.current) || 0,
        days1to30: Number(r.days_1_30 ?? r.days1to30) || 0,
        days31to60: Number(r.days_31_60 ?? r.days31to60) || 0,
        days61to90: Number(r.days_61_90 ?? r.days61to90) || 0,
        days90plus: Number(r.days_90_plus ?? r.days90plus) || 0,
        total: Number(r.total) || 0,
      }))
      const t = raw.totals || {}
      const totals = {
        current: Number(t.current_amount ?? t.current) || 0,
        days1to30: Number(t.days_1_30 ?? t.days1to30) || 0,
        days31to60: Number(t.days_31_60 ?? t.days31to60) || 0,
        days61to90: Number(t.days_61_90 ?? t.days61to90) || 0,
        days90plus: Number(t.days_90_plus ?? t.days90plus) || 0,
        total: Number(t.total) || 0,
      }
      set({ agingReport: { rows, totals, asOfDate: raw.asOfDate || asOfDate || '' }, loading: false })
    } catch (err: any) {
      set({ error: err?.response?.data?.error || 'Error al cargar reporte', loading: false })
    }
  },

  fetchPaymentSchedule: async (from?: string, to?: string) => {
    set({ loading: true, error: null })
    try {
      const params: any = {}
      if (from) params.from = from
      if (to) params.to = to
      const { data } = await api.get('/api/payables/payment-schedule', { params })
      const raw = data.data || data || []
      const items = raw.map((r: any) => {
        if (r.payable) {
          return { ...r.payable, supplierName: r.supplierName, supplierPhone: r.supplierPhone }
        }
        return r
      })
      set({ paymentSchedule: items, loading: false })
    } catch (err: any) {
      set({ error: err?.response?.data?.error || 'Error al cargar calendario', loading: false })
    }
  },

  fetchCashFlowProjection: async (weeks?: number) => {
    set({ loading: true, error: null })
    try {
      const params: any = {}
      if (weeks) params.weeks = weeks
      const { data } = await api.get('/api/payables/cash-flow-projection', { params })
      set({ cashFlowProjection: data.data || data, loading: false })
    } catch (err: any) {
      set({ error: err?.response?.data?.error || 'Error al cargar proyeccion', loading: false })
    }
  },

  fetchSupplierStatement: async (supplierId: string) => {
    set({ loading: true, error: null })
    try {
      const { data } = await api.get(`/api/payables/supplier/${supplierId}/statement`)
      const raw = data.data || data
      set({ supplierStatement: raw, loading: false })
    } catch (err: any) {
      set({ error: err?.response?.data?.error || 'Error al cargar estado de cuenta', loading: false })
    }
  },

  clearCurrent: () => set({ currentPayable: null, supplierStatement: null }),
}))
