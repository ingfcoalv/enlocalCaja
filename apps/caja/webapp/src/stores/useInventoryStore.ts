import { create } from 'zustand'
import { api } from '@enlocal/react-hooks'

export interface Article {
  id: string
  name: string
  unit: string
  current_stock: number | string
  min_stock: number | string
  cost: number | string
  supplier_id?: string | null
  active: boolean
  created_at: string
  updated_at: string
}

export interface Movement {
  id: string
  ingredient_id: string
  ingredient_name?: string
  type: 'in' | 'out' | 'adjustment'
  quantity: number | string
  reference?: string
  notes?: string
  user_id?: string
  created_at: string
}

export interface KardexEntry extends Movement {
  running_balance: number
}

export interface ValuationItem {
  id: string
  name: string
  unit: string
  current_stock: number | string
  cost: number | string
  value: number
}

export interface InventoryCountItem {
  id: string
  count_id: string
  ingredient_id: string
  ingredient_name?: string
  expected_qty: number | string
  counted_qty: number | string
  difference: number | string
  notes?: string
}

export interface InventoryCount {
  id: string
  count_date: string
  status: string
  notes?: string
  created_by?: string
  created_at: string
  item_count?: number
  items?: InventoryCountItem[]
}

interface Pagination {
  page: number
  pages: number
  total: number
}

interface InventoryState {
  // Articles (ingredients)
  articles: Article[]
  loading: boolean
  error: string | null
  pagination: Pagination

  // Dashboard
  alerts: Article[]
  valuation: { total: number; items: ValuationItem[] } | null

  // Movements
  movements: Movement[]
  movementsPagination: Pagination

  // Kardex
  kardex: KardexEntry[]

  // Counts
  counts: InventoryCount[]
  countsPagination: Pagination
  currentCount: InventoryCount | null

  // Actions
  fetchArticles: (filters?: { active?: boolean; q?: string; page?: number; limit?: number }) => Promise<void>
  createArticle: (data: Partial<Article>) => Promise<any>
  updateArticle: (id: string, data: Partial<Article>) => Promise<any>
  deleteArticle: (id: string) => Promise<any>
  fetchAlerts: () => Promise<void>
  fetchValuation: () => Promise<void>
  fetchMovements: (filters?: { ingredient_id?: string; type?: string; from?: string; to?: string; page?: number; limit?: number }) => Promise<void>
  createMovement: (data: { ingredient_id: string; type: string; quantity: number; reference?: string; notes?: string }) => Promise<any>
  createBulkMovements: (movements: { ingredient_id: string; type: string; quantity: number; reference?: string; notes?: string }[]) => Promise<any>
  fetchKardex: (ingredientId: string, from?: string, to?: string) => Promise<void>
  fetchCounts: (filters?: { page?: number; limit?: number }) => Promise<void>
  fetchCountById: (id: string) => Promise<void>
  saveCount: (data: { notes?: string; items: { ingredient_id: string; expected_qty: number; counted_qty: number; difference: number; notes?: string }[] }) => Promise<any>
}

const defaultPagination: Pagination = { page: 1, pages: 1, total: 0 }

export const useInventoryStore = create<InventoryState>((set) => ({
  articles: [],
  loading: false,
  error: null,
  pagination: { ...defaultPagination },

  alerts: [],
  valuation: null,

  movements: [],
  movementsPagination: { ...defaultPagination },

  kardex: [],

  counts: [],
  countsPagination: { ...defaultPagination },
  currentCount: null,

  fetchArticles: async (filters) => {
    set({ loading: true, error: null })
    try {
      const params = new URLSearchParams()
      if (filters?.active !== undefined) params.set('active', String(filters.active))
      if (filters?.q) params.set('q', filters.q)
      if (filters?.page) params.set('page', String(filters.page))
      if (filters?.limit) params.set('limit', String(filters.limit))
      const { data } = await api.get(`/api/ingredients?${params.toString()}`)
      const result = data
      set({
        articles: result.data || [],
        pagination: { page: result.page || 1, pages: result.pages || 1, total: result.total || 0 },
        loading: false,
      })
    } catch (err: any) {
      set({ error: err.message || 'Error cargando articulos', loading: false })
    }
  },

  createArticle: async (data) => {
    const { data: result } = await api.post('/api/ingredients', data)
    return result.data || result
  },

  updateArticle: async (id, data) => {
    const { data: result } = await api.put(`/api/ingredients/${id}`, data)
    return result.data || result
  },

  deleteArticle: async (id) => {
    const { data: result } = await api.delete(`/api/ingredients/${id}`)
    return result.data || result
  },

  fetchAlerts: async () => {
    try {
      const { data } = await api.get('/api/ingredients/alerts')
      set({ alerts: data.data || [] })
    } catch {
      set({ alerts: [] })
    }
  },

  fetchValuation: async () => {
    try {
      const { data } = await api.get('/api/ingredients/valuation')
      set({ valuation: data.data || data })
    } catch {
      set({ valuation: null })
    }
  },

  fetchMovements: async (filters) => {
    try {
      const params = new URLSearchParams()
      if (filters?.ingredient_id) params.set('ingredient_id', filters.ingredient_id)
      if (filters?.type) params.set('type', filters.type)
      if (filters?.from) params.set('from', filters.from)
      if (filters?.to) params.set('to', filters.to)
      if (filters?.page) params.set('page', String(filters.page))
      if (filters?.limit) params.set('limit', String(filters.limit))
      const { data } = await api.get(`/api/movements?${params.toString()}`)
      const result = data
      set({
        movements: result.data || [],
        movementsPagination: { page: result.page || 1, pages: result.pages || 1, total: result.total || 0 },
      })
    } catch {
      set({ movements: [], movementsPagination: { ...defaultPagination } })
    }
  },

  createMovement: async (data) => {
    const { data: result } = await api.post('/api/movements', data)
    return result.data || result
  },

  createBulkMovements: async (movements) => {
    const { data: result } = await api.post('/api/movements/bulk', { movements })
    return result.data || result
  },

  fetchKardex: async (ingredientId, from, to) => {
    try {
      const params = new URLSearchParams()
      params.set('ingredient_id', ingredientId)
      if (from) params.set('from', from)
      if (to) params.set('to', to)
      const { data } = await api.get(`/api/movements/kardex?${params.toString()}`)
      set({ kardex: data.data || [] })
    } catch {
      set({ kardex: [] })
    }
  },

  fetchCounts: async (filters) => {
    try {
      const params = new URLSearchParams()
      if (filters?.page) params.set('page', String(filters.page))
      if (filters?.limit) params.set('limit', String(filters.limit))
      const { data } = await api.get(`/api/inventory/counts?${params.toString()}`)
      const result = data
      set({
        counts: result.data || [],
        countsPagination: { page: result.page || 1, pages: result.pages || 1, total: result.total || 0 },
      })
    } catch {
      set({ counts: [], countsPagination: { ...defaultPagination } })
    }
  },

  fetchCountById: async (id) => {
    try {
      const { data } = await api.get(`/api/inventory/counts/${id}`)
      set({ currentCount: data.data || data })
    } catch {
      set({ currentCount: null })
    }
  },

  saveCount: async (data) => {
    const { data: result } = await api.post('/api/inventory/counts', data)
    return result.data || result
  },
}))
