import { create } from 'zustand'
import { api } from '@enlocal/react-hooks'

export interface CashMovement {
  id: string
  shiftId: string
  registerId: string
  userId: string
  userName: string | null
  type: 'deposit' | 'withdrawal'
  amount: string
  reason: string
  notes: string | null
  authorizedBy: string | null
  authorizedByName: string | null
  relatedMovementId: string | null
  createdAt: string
}

interface MovementFilters {
  shiftId?: string
  registerId?: string
  type?: string
  from?: string
  to?: string
  page?: number
  limit?: number
}

interface CashMovementsState {
  movements: CashMovement[]
  loading: boolean
  total: number
  page: number
  pages: number

  fetchMovements: (filters?: MovementFilters) => Promise<void>
  createMovement: (data: {
    type: 'deposit' | 'withdrawal'
    amount: number
    reason: string
    notes?: string
  }) => Promise<CashMovement>
  createTransfer: (data: {
    toRegisterId: string
    amount: number
    notes?: string
  }) => Promise<void>
}

export const useCashMovementsStore = create<CashMovementsState>((set) => ({
  movements: [],
  loading: false,
  total: 0,
  page: 1,
  pages: 0,

  fetchMovements: async (filters) => {
    set({ loading: true })
    try {
      const { data } = await api.get('/api/pos/movements', { params: filters })
      set({
        movements: data.data ?? [],
        total: data.total ?? 0,
        page: data.page ?? 1,
        pages: data.pages ?? 0,
        loading: false,
      })
    } catch {
      set({ loading: false })
    }
  },

  createMovement: async (data) => {
    const { data: res } = await api.post('/api/pos/movements', data)
    const movement = res.data ?? res
    set((state) => ({ movements: [movement, ...state.movements] }))
    return movement
  },

  createTransfer: async (data) => {
    await api.post('/api/pos/movements/transfer', data)
  },
}))
