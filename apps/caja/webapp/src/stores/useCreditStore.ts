import { create } from 'zustand'
import { api } from '@enlocal/react-hooks'

export interface CreditCheckResult {
  status: 'approved' | 'warning' | 'blocked'
  creditEnabled: boolean
  creditLimit: number
  creditBalance: number
  available: number
  creditDays: number
  overdueCount: number
  message?: string
}

interface CreditState {
  creditCheck: CreditCheckResult | null
  loading: boolean

  checkCredit: (customerId: string, amount?: number) => Promise<CreditCheckResult>
  updateCreditProfile: (customerId: string, data: any) => Promise<void>
  clearCheck: () => void
}

export const useCreditStore = create<CreditState>((set) => ({
  creditCheck: null,
  loading: false,

  checkCredit: async (customerId: string, amount?: number) => {
    set({ loading: true })
    try {
      const params: any = {}
      if (amount) params.amount = amount
      const { data } = await api.get(`/api/credit/check/${customerId}`, { params })
      const raw = data.data || data
      const result: CreditCheckResult = {
        status: raw.status,
        creditEnabled: raw.creditEnabled,
        creditLimit: raw.creditLimit,
        creditBalance: raw.creditBalance,
        available: raw.availableCredit ?? raw.available ?? 0,
        creditDays: raw.creditDays,
        overdueCount: raw.overdueCount ?? 0,
        message: raw.warnings?.join('. ') || raw.message,
      }
      set({ creditCheck: result, loading: false })
      return result
    } catch (err: any) {
      set({ loading: false })
      throw err
    }
  },

  updateCreditProfile: async (customerId: string, payload: any) => {
    set({ loading: true })
    try {
      await api.put(`/api/credit/customer/${customerId}`, payload)
      set({ loading: false })
    } catch (err: any) {
      set({ loading: false })
      throw err
    }
  },

  clearCheck: () => set({ creditCheck: null }),
}))
