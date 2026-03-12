import { create } from 'zustand'

export interface ModuleStatus {
  code: string
  active: boolean
  source: 'default' | 'addon'
}

export interface StampsInfo {
  available: number
  totalPurchased: number
  totalUsed: number
  updatedAt: string | null
}

export interface TrialInfo {
  trialStartedAt: string | null
  trialEndsAt: string | null
  trialRegistered: boolean
  daysRemaining: number
}

export interface LicenseStoreState {
  // Data
  serial: string | null
  valid: boolean
  plan: string | null
  expiresAt: string | null
  licenseState: string | null
  modules: ModuleStatus[]
  stamps: StampsInfo
  loading: boolean
  newModulesAvailable: string[]
  isTrial: boolean
  trial: TrialInfo | null
  maxRegisters: number

  // Actions
  fetchFullInfo: () => Promise<void>
  fetchStamps: () => Promise<void>
  isModuleActive: (code: string) => boolean
  hasStamps: () => boolean
  updateStampsAfterUse: (newBalance: number) => void
  setNewModulesAvailable: (modules: string[]) => void
}

/** Hook to access the license store. Use with selector: useLicenseStore(s => s.field) */
export type UseLicenseStore = {
  (): LicenseStoreState
  <T>(selector: (state: LicenseStoreState) => T): T
  getState: () => LicenseStoreState
  setState: (partial: Partial<LicenseStoreState> | ((state: LicenseStoreState) => Partial<LicenseStoreState>)) => void
  subscribe: (listener: (state: LicenseStoreState, prevState: LicenseStoreState) => void) => () => void
}

// Normalize module names: accept both 'invoicing' and 'mod-invoicing'
function normalizeModuleCode(code: string): string {
  return code.startsWith('mod-') ? code : `mod-${code}`
}

// Get base URL from current origin
function getBaseUrl(): string {
  if (typeof window !== 'undefined') {
    return window.location.origin
  }
  return 'http://localhost:9005'
}

export const useLicenseStore: UseLicenseStore = create<LicenseStoreState>((set, get) => ({
  serial: null,
  valid: false,
  plan: null,
  expiresAt: null,
  licenseState: null,
  modules: [],
  stamps: { available: 0, totalPurchased: 0, totalUsed: 0, updatedAt: null },
  loading: false,
  newModulesAvailable: [],
  isTrial: false,
  trial: null,
  maxRegisters: 1,

  fetchFullInfo: async () => {
    set({ loading: true })
    try {
      const response = await fetch(`${getBaseUrl()}/api/license/full-info`)
      if (!response.ok) throw new Error('Failed to fetch license info')

      const data = await response.json()
      set({
        plan: data.plan,
        licenseState: data.licenseState,
        expiresAt: data.expiresAt,
        modules: data.modules ?? [],
        stamps: data.stamps ?? { available: 0, totalPurchased: 0, totalUsed: 0, updatedAt: null },
        valid: data.licenseState === 'linked' || data.licenseState === 'activated' || data.licenseState === 'trial',
        loading: false,
        isTrial: data.isTrial ?? false,
        trial: data.trial ?? null,
        maxRegisters: data.maxRegisters ?? 1,
      })
    } catch {
      // In web dev mode, enable all modules
      if (typeof window !== 'undefined' && !window.electronAPI) {
        set({
          valid: true,
          plan: 'web',
          modules: [
            { code: 'mod-config', active: true, source: 'default' },
            { code: 'mod-catalogs', active: true, source: 'default' },
            { code: 'mod-pos', active: true, source: 'default' },
            { code: 'mod-reports', active: true, source: 'default' },
            { code: 'mod-invoicing', active: true, source: 'addon' },
            { code: 'mod-inventory', active: true, source: 'default' },
            { code: 'mod-remissions', active: true, source: 'addon' },
            { code: 'mod-quotes', active: true, source: 'addon' },
            { code: 'mod-payables', active: true, source: 'addon' },
            { code: 'mod-multicaja', active: true, source: 'addon' },
          ],
          stamps: { available: 999, totalPurchased: 999, totalUsed: 0, updatedAt: null },
          maxRegisters: 99,
          loading: false,
        })
      } else {
        set({ loading: false })
      }
    }
  },

  fetchStamps: async () => {
    try {
      const response = await fetch(`${getBaseUrl()}/api/license/stamps`)
      if (!response.ok) return

      const data = await response.json()
      set({ stamps: data })
    } catch {
      // Ignore
    }
  },

  isModuleActive: (code: string) => {
    const { modules } = get()
    const normalized = normalizeModuleCode(code)
    return modules.some(
      (m) => m.active && (m.code === normalized || m.code === code)
    )
  },

  hasStamps: () => {
    return get().stamps.available > 0
  },

  updateStampsAfterUse: (newBalance: number) => {
    set((state) => ({
      stamps: {
        ...state.stamps,
        available: newBalance,
        totalUsed: state.stamps.totalPurchased - newBalance,
        updatedAt: new Date().toISOString(),
      },
    }))
  },

  setNewModulesAvailable: (modules: string[]) => {
    set({ newModulesAvailable: modules })
  },
}))

// Declare electronAPI on window
declare global {
  interface Window {
    electronAPI?: {
      invoke: (channel: string, ...args: unknown[]) => Promise<unknown>
    }
  }
}
