import { create } from 'zustand'
import { api } from '@enlocal/react-hooks'

interface Register {
  id: string
  name: string
  isActive?: boolean
}

interface Shift {
  id: string
  openedAt: string
  openingAmount: number
  closedAt?: string
  closingAmount?: number
  notes?: string
  status: 'open' | 'closed'
  registerId?: string | null
  registerName?: string | null
}

interface ShiftPreview {
  shiftId: string
  registerName: string | null
  openingAmount: number
  totalCashPayments: number
  totalCardPayments: number
  totalTransferPayments: number
  totalDeposits: number
  totalWithdrawals: number
  expectedAmount: number
  transactionsCount: number
  totalSales: number
}

interface PosState {
  currentShift: Shift | null
  currentRegister: Register | null
  shiftLoading: boolean
  shiftPreview: ShiftPreview | null
  previewLoading: boolean
  openShift: (amount: number, registerId?: string) => Promise<void>
  closeShift: (amount: number, notes?: string) => Promise<void>
  fetchCurrentShift: () => Promise<void>
  fetchShiftPreview: () => Promise<void>
  setCurrentRegister: (register: Register | null) => void
}

export const usePosStore = create<PosState>((set) => ({
  currentShift: null,
  currentRegister: null,
  shiftLoading: false,
  shiftPreview: null,
  previewLoading: false,

  openShift: async (amount: number, registerId?: string) => {
    set({ shiftLoading: true })
    try {
      const { data } = await api.post('/api/pos/shifts/open', {
        openingAmount: amount,
        registerId,
      })
      const shift = data.data || data
      set({
        currentShift: shift,
        currentRegister: shift.registerId ? { id: shift.registerId, name: shift.registerName || '' } : null,
        shiftLoading: false,
      })
    } catch (err: any) {
      set({ shiftLoading: false })
      const message = err?.response?.data?.error || 'Error al abrir turno'
      throw new Error(message)
    }
  },

  closeShift: async (amount: number, notes?: string) => {
    set({ shiftLoading: true })
    try {
      const { data } = await api.post('/api/pos/shifts/close', {
        closingAmount: amount,
        notes,
      })
      set({ currentShift: data.data || data, currentRegister: null, shiftLoading: false })
    } catch {
      set({ shiftLoading: false })
      throw new Error('Error al cerrar turno')
    }
  },

  fetchCurrentShift: async () => {
    set({ shiftLoading: true })
    try {
      const { data } = await api.get('/api/pos/shifts/current')
      const shift = data.data || data || null
      set({
        currentShift: shift,
        currentRegister: shift?.registerId ? { id: shift.registerId, name: shift.registerName || '' } : null,
        shiftLoading: false,
      })
    } catch {
      set({ currentShift: null, currentRegister: null, shiftLoading: false })
    }
  },

  fetchShiftPreview: async () => {
    set({ previewLoading: true })
    try {
      const { data } = await api.get('/api/pos/shifts/current/preview')
      set({ shiftPreview: data.data || data || null, previewLoading: false })
    } catch {
      set({ shiftPreview: null, previewLoading: false })
    }
  },

  setCurrentRegister: (register) => set({ currentRegister: register }),
}))
