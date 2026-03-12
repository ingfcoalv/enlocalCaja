import { create } from 'zustand'
import { api } from '@enlocal/react-hooks'

export interface Receivable {
  id: string
  customerId: string
  ticketId: string
  remissionNoteId?: string
  invoiceId?: string
  originalAmount: string
  adjustments: string
  amountPaid: string
  balance: string
  issuedDate: string
  dueDate: string
  status: string
  lastPaymentDate?: string
  daysOverdue: number
  createdAt: string
  updatedAt: string
  customerName?: string
  customerPhone?: string
  customerEmail?: string
  remissionFolio?: number
  remissionSeries?: string
  payments?: ReceivablePayment[]
}

export interface ReceivablePayment {
  id: string
  receivableId: string
  amount: string
  paymentMethod: string
  reference?: string
  complementEmitted: boolean
  receivedBy: string
  notes?: string
  createdAt: string
}

export interface AgingRow {
  customerId: string
  customerName: string
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

export interface StatementEntry {
  date: string
  concept: string
  charge: number
  credit: number
  balance: number
}

export interface CustomerStatement {
  customer: any
  entries: StatementEntry[]
  currentBalance: number
}

interface Pagination {
  page: number
  pages: number
  total: number
}

interface ReceivableFilters {
  customer_id?: string
  status?: string
  overdue_only?: string
  from?: string
  to?: string
  q?: string
  page?: number
  limit?: number
}

interface ReceivableState {
  receivables: Receivable[]
  loading: boolean
  error: string | null
  pagination: Pagination
  currentReceivable: Receivable | null
  agingReport: AgingReport | null
  customerStatement: CustomerStatement | null
  collectionSchedule: Receivable[]
  pendingComplements: ReceivablePayment[]

  fetchReceivables: (filters?: ReceivableFilters) => Promise<void>
  fetchById: (id: string) => Promise<Receivable>
  fetchAgingReport: (asOfDate?: string) => Promise<void>
  fetchCustomerStatement: (customerId: string) => Promise<void>
  fetchCollectionSchedule: (from?: string, to?: string) => Promise<void>
  fetchPendingComplements: () => Promise<void>
  collectPayment: (id: string, data: any) => Promise<any>
  clearCurrent: () => void
}

export const useReceivableStore = create<ReceivableState>((set) => ({
  receivables: [],
  loading: false,
  error: null,
  pagination: { page: 1, pages: 0, total: 0 },
  currentReceivable: null,
  agingReport: null,
  customerStatement: null,
  collectionSchedule: [],
  pendingComplements: [],

  fetchReceivables: async (filters?: ReceivableFilters) => {
    set({ loading: true, error: null })
    try {
      const { data } = await api.get('/api/receivables', { params: filters })
      const items = data.data || data.items || []
      set({
        receivables: items,
        pagination: data.pagination || { page: 1, pages: 1, total: items.length },
        loading: false,
      })
    } catch (err: any) {
      set({ error: err?.response?.data?.error || 'Error al cargar CxC', loading: false })
    }
  },

  fetchById: async (id: string) => {
    set({ loading: true, error: null })
    try {
      const { data } = await api.get(`/api/receivables/${id}`)
      const item = data.data || data
      set({ currentReceivable: item, loading: false })
      return item
    } catch (err: any) {
      set({ error: err?.response?.data?.error || 'Error al cargar CxC', loading: false })
      throw err
    }
  },

  fetchAgingReport: async (asOfDate?: string) => {
    set({ loading: true, error: null })
    try {
      const params: any = {}
      if (asOfDate) params.as_of_date = asOfDate
      const { data } = await api.get('/api/receivables/aging-report', { params })
      const raw = data.data || data
      // Map API snake_case response to frontend camelCase
      const rows: AgingRow[] = (raw.customers || raw.rows || []).map((r: any) => ({
        customerId: r.customer_id || r.customerId || '',
        customerName: r.customer_name || r.customerName || '',
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

  fetchCustomerStatement: async (customerId: string) => {
    set({ loading: true, error: null })
    try {
      const { data } = await api.get(`/api/receivables/customer/${customerId}/statement`)
      const raw = data.data || data

      // If API already returns entries array, use it directly
      if (raw.entries && Array.isArray(raw.entries)) {
        set({ customerStatement: raw, loading: false })
        return
      }

      // Build entries from receivables + paid amounts
      const entries: StatementEntry[] = []
      let runningBalance = 0
      const recs = raw.receivables || []

      // Collect all movements and sort by date
      const movements: { date: string; concept: string; charge: number; credit: number }[] = []
      for (const rec of recs) {
        // Charge: original amount when receivable was created
        movements.push({
          date: rec.issuedDate || rec.createdAt,
          concept: `Remision ${rec.remissionNoteId ? '#' + (rec.remissionNoteId as string).slice(0, 8) : rec.id.slice(0, 8)}`,
          charge: Number(rec.originalAmount) || 0,
          credit: 0,
        })
        // Credit: total paid amount (single entry per receivable)
        const paid = Number(rec.amountPaid) || 0
        if (paid > 0) {
          movements.push({
            date: rec.lastPaymentDate || rec.updatedAt,
            concept: 'Pago(s) registrado(s)',
            charge: 0,
            credit: paid,
          })
        }
        // Credit: adjustments (returns, etc.)
        const adj = Number(rec.adjustments) || 0
        if (adj > 0) {
          movements.push({
            date: rec.updatedAt || rec.createdAt,
            concept: 'Ajuste / Devolucion',
            charge: 0,
            credit: adj,
          })
        }
      }

      movements.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

      for (const m of movements) {
        runningBalance += m.charge - m.credit
        entries.push({ ...m, balance: runningBalance })
      }

      set({
        customerStatement: {
          customer: raw.customer,
          entries,
          currentBalance: raw.totalOwed ?? runningBalance,
        },
        loading: false,
      })
    } catch (err: any) {
      set({ error: err?.response?.data?.error || 'Error al cargar estado de cuenta', loading: false })
    }
  },

  fetchCollectionSchedule: async (from?: string, to?: string) => {
    set({ loading: true, error: null })
    try {
      const params: any = {}
      if (from) params.from = from
      if (to) params.to = to
      const { data } = await api.get('/api/receivables/collection-schedule', { params })
      // API returns {receivable: {...}, customerName, customerPhone} — flatten
      const raw = data.data || data || []
      const items: Receivable[] = raw.map((r: any) => {
        if (r.receivable) {
          return { ...r.receivable, customerName: r.customerName, customerPhone: r.customerPhone, customerEmail: r.customerEmail }
        }
        return r
      })
      set({ collectionSchedule: items, loading: false })
    } catch (err: any) {
      set({ error: err?.response?.data?.error || 'Error al cargar cobranza', loading: false })
    }
  },

  fetchPendingComplements: async () => {
    set({ loading: true, error: null })
    try {
      const { data } = await api.get('/api/receivables/pending-complements')
      set({ pendingComplements: data.data || [], loading: false })
    } catch (err: any) {
      set({ error: err?.response?.data?.error || 'Error al cargar complementos', loading: false })
    }
  },

  collectPayment: async (id: string, payload: any) => {
    set({ loading: true })
    try {
      const { data } = await api.post(`/api/receivables/${id}/payment`, payload)
      const result = data.data || data
      set((s) => ({
        receivables: s.receivables.map((r) =>
          r.id === id ? { ...r, amountPaid: result.amountPaid || r.amountPaid, balance: result.balance || r.balance, status: result.status || r.status } : r
        ),
        loading: false,
      }))
      return result
    } catch (err: any) {
      set({ loading: false })
      throw err
    }
  },

  clearCurrent: () => set({ currentReceivable: null, customerStatement: null }),
}))
