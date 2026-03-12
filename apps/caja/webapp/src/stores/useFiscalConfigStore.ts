import { create } from 'zustand'
import { api } from '@enlocal/react-hooks'

export interface FiscalConfig {
  id?: string
  rfc: string
  razonSocial: string
  regimenFiscal: string
  codigoPostal: string
  lugarExpedicion: string
  certFile: string | null
  keyFile: string | null
  certPassword: string | null
  certExpiry: string | null
  certStatus: string | null
  seriesIngreso: string
  seriesEgreso: string
  seriesPago: string
  seriesTraslado: string
  folioIngreso: number
  folioEgreso: number
  folioPago: number
  folioTraslado: number
  globalPeriodicity: string
  globalGrouping: string
  retentionsEnabled: boolean
}

interface FiscalConfigState {
  config: FiscalConfig | null
  loading: boolean
  error: string | null

  fetchConfig: () => Promise<void>
  updateConfig: (data: Partial<FiscalConfig>) => Promise<void>
  uploadCert: (formData: FormData) => Promise<any>
  fetchCertStatus: () => Promise<any>
}

const defaultConfig: FiscalConfig = {
  rfc: '',
  razonSocial: '',
  regimenFiscal: '',
  codigoPostal: '',
  lugarExpedicion: '',
  certFile: null,
  keyFile: null,
  certPassword: null,
  certExpiry: null,
  certStatus: null,
  seriesIngreso: 'FA',
  seriesEgreso: 'NC',
  seriesPago: 'CP',
  seriesTraslado: 'CT',
  folioIngreso: 1,
  folioEgreso: 1,
  folioPago: 1,
  folioTraslado: 1,
  globalPeriodicity: '04',
  globalGrouping: 'sat_code',
  retentionsEnabled: false,
}

export const useFiscalConfigStore = create<FiscalConfigState>((set) => ({
  config: null,
  loading: false,
  error: null,

  fetchConfig: async () => {
    set({ loading: true, error: null })
    try {
      const { data } = await api.get('/api/fiscal/config')
      set({ config: data.data || data || defaultConfig, loading: false })
    } catch {
      set({ config: defaultConfig, loading: false })
    }
  },

  updateConfig: async (payload: Partial<FiscalConfig>) => {
    set({ loading: true, error: null })
    try {
      const { data } = await api.put('/api/fiscal/config', payload)
      set({ config: data.data || data, loading: false })
    } catch (err: any) {
      set({ error: err?.response?.data?.error || 'Error al guardar configuracion', loading: false })
      throw err
    }
  },

  uploadCert: async (formData: FormData) => {
    set({ loading: true })
    try {
      const { data } = await api.post('/api/fiscal/upload-cert', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      const result = data.data || data
      set((s) => ({
        config: s.config ? { ...s.config, certStatus: result.certStatus, certExpiry: result.certExpiry } : s.config,
        loading: false,
      }))
      return result
    } catch (err: any) {
      set({ loading: false })
      throw err
    }
  },

  fetchCertStatus: async () => {
    try {
      const { data } = await api.get('/api/fiscal/cert-status')
      return data.data || data
    } catch (err: any) {
      throw err
    }
  },
}))
