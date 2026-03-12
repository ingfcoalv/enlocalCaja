import { create } from 'zustand'
import { api } from '@enlocal/react-hooks'

export interface SatTaxRegime {
  code: string
  description: string
  personType: string | null
}

export interface SatCfdiUse {
  code: string
  description: string
  personType: string | null
}

export interface SatPaymentForm {
  code: string
  description: string
}

export interface SatProductCode {
  code: string
  description: string
}

export interface SatUnitCode {
  code: string
  description: string
}

export interface SatCurrency {
  code: string
  description: string
  decimals: number
}

export interface SatRelationshipType {
  code: string
  description: string
}

interface SatCatalogState {
  taxRegimes: SatTaxRegime[]
  cfdiUses: SatCfdiUse[]
  paymentForms: SatPaymentForm[]
  productCodes: SatProductCode[]
  unitCodes: SatUnitCode[]
  currencies: SatCurrency[]
  relationshipTypes: SatRelationshipType[]
  loading: boolean

  fetchTaxRegimes: (personType?: string) => Promise<void>
  fetchCfdiUses: (personType?: string) => Promise<void>
  fetchPaymentForms: () => Promise<void>
  searchProductCodes: (q: string) => Promise<void>
  searchUnitCodes: (q?: string) => Promise<void>
  fetchCurrencies: () => Promise<void>
  fetchRelationshipTypes: () => Promise<void>
  fetchAll: () => Promise<void>
}

export const useSatCatalogStore = create<SatCatalogState>((set) => ({
  taxRegimes: [],
  cfdiUses: [],
  paymentForms: [],
  productCodes: [],
  unitCodes: [],
  currencies: [],
  relationshipTypes: [],
  loading: false,

  fetchTaxRegimes: async (personType?: string) => {
    try {
      const params: any = {}
      if (personType) params.person_type = personType
      const { data } = await api.get('/api/sat/tax-regimes', { params })
      set({ taxRegimes: data.data || [] })
    } catch { /* ignore */ }
  },

  fetchCfdiUses: async (personType?: string) => {
    try {
      const params: any = {}
      if (personType) params.person_type = personType
      const { data } = await api.get('/api/sat/cfdi-uses', { params })
      set({ cfdiUses: data.data || [] })
    } catch { /* ignore */ }
  },

  fetchPaymentForms: async () => {
    try {
      const { data } = await api.get('/api/sat/payment-forms')
      set({ paymentForms: data.data || [] })
    } catch { /* ignore */ }
  },

  searchProductCodes: async (q: string) => {
    try {
      const { data } = await api.get('/api/sat/product-codes', { params: { q, limit: 50 } })
      set({ productCodes: data.data || [] })
    } catch { /* ignore */ }
  },

  searchUnitCodes: async (q?: string) => {
    try {
      const params: any = { limit: 50 }
      if (q) params.q = q
      const { data } = await api.get('/api/sat/unit-codes', { params })
      set({ unitCodes: data.data || [] })
    } catch { /* ignore */ }
  },

  fetchCurrencies: async () => {
    try {
      const { data } = await api.get('/api/sat/currencies')
      set({ currencies: data.data || [] })
    } catch { /* ignore */ }
  },

  fetchRelationshipTypes: async () => {
    try {
      const { data } = await api.get('/api/sat/relationship-types')
      set({ relationshipTypes: data.data || [] })
    } catch { /* ignore */ }
  },

  fetchAll: async () => {
    set({ loading: true })
    try {
      const [regimes, uses, forms, units, currencies, relTypes] = await Promise.all([
        api.get('/api/sat/tax-regimes'),
        api.get('/api/sat/cfdi-uses'),
        api.get('/api/sat/payment-forms'),
        api.get('/api/sat/unit-codes', { params: { limit: 200 } }),
        api.get('/api/sat/currencies'),
        api.get('/api/sat/relationship-types'),
      ])
      set({
        taxRegimes: regimes.data.data || [],
        cfdiUses: uses.data.data || [],
        paymentForms: forms.data.data || [],
        unitCodes: units.data.data || [],
        currencies: currencies.data.data || [],
        relationshipTypes: relTypes.data.data || [],
        loading: false,
      })
    } catch {
      set({ loading: false })
    }
  },
}))
