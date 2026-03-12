declare module '@enlocal/react-hooks' {
  export function useAuth(): {
    user: { id: string; name: string; role: string; permissions: string[]; maxDiscountPercent?: number } | null
    token: string | null
    isAuthenticated: boolean
    loading: boolean
    login: (pin: string, userId?: string) => Promise<void>
    logout: () => void
    refresh: () => Promise<void>
    setBaseUrl: (url: string) => void
  }

  export function useLicense(): {
    plan: string
    expiresAt: string
    daysRemaining: number
    modules: string[]
    addons: string[]
    loading: boolean
  }

  export function useModuleAccess(moduleName: string): { hasAccess: boolean; isAddon: boolean; missingDependencies: string[] }

  export function useToast(): {
    toasts: Array<{ id: string; type: string; message: string }>
    success: (msg: string) => void
    error: (msg: string) => void
    warning: (msg: string) => void
    info: (msg: string) => void
    removeToast: (id: string) => void
  }

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

  export interface LicenseStoreState {
    serial: string | null
    valid: boolean
    plan: string | null
    expiresAt: string | null
    licenseState: string | null
    modules: ModuleStatus[]
    stamps: StampsInfo
    loading: boolean
    newModulesAvailable: string[]
    fetchFullInfo: () => Promise<void>
    fetchStamps: () => Promise<void>
    isModuleActive: (code: string) => boolean
    hasStamps: () => boolean
    updateStampsAfterUse: (newBalance: number) => void
    setNewModulesAvailable: (modules: string[]) => void
  }

  export const useLicenseStore: {
    (): LicenseStoreState
    <T>(selector: (state: LicenseStoreState) => T): T
    getState: () => LicenseStoreState
    setState: (partial: Partial<LicenseStoreState> | ((state: LicenseStoreState) => Partial<LicenseStoreState>)) => void
    subscribe: (listener: (state: LicenseStoreState, prevState: LicenseStoreState) => void) => () => void
  }

  export function useSyncStatus(pollIntervalMs?: number): {
    status: 'idle' | 'syncing' | 'error' | 'offline'
    lastSyncAt: string | null
    lastError: string | null
    isCloudReachable: boolean
    queueStats: { pending: number; synced: number; failed: number }
    loading: boolean
    triggerSync: () => Promise<void>
    refetch: () => Promise<void>
  }

  export function connectSocket(token: string, baseUrl: string): void
  export function disconnectSocket(): void
  export function getSocket(): unknown

  export const api: {
    get: (url: string) => Promise<unknown>
    post: (url: string, data?: unknown) => Promise<unknown>
    put: (url: string, data?: unknown) => Promise<unknown>
    delete: (url: string) => Promise<unknown>
    interceptors: { request: { use: Function }; response: { use: Function } }
  }
}
