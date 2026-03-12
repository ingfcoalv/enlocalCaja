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
  export function useCRUD<T>(basePath: string): {
    items: T[]
    loading: boolean
    error: string | null
    pagination: { page: number; limit: number; total: number; pages: number }
    fetchAll: (filters?: Record<string, any>) => Promise<void>
    getById: (id: string) => Promise<T>
    create: (data: Partial<T>) => Promise<T>
    update: (id: string, data: Partial<T>) => Promise<T>
    remove: (id: string) => Promise<void>
  }
  export function useToast(): {
    toasts: Array<{ id: string; type: string; message: string }>
    success: (msg: string) => void
    error: (msg: string) => void
    warning: (msg: string) => void
    info: (msg: string) => void
    removeToast: (id: string) => void
  }
  export function useConnection(): { online: boolean; serverReachable: boolean }
  export function useLicense(): { plan: string; expiresAt: string; daysRemaining: number; modules: string[]; addons: string[]; loading: boolean }
  export function useModuleAccess(moduleName: string): { hasAccess: boolean; isAddon: boolean }
  export const api: any
}

declare module '@enlocal/react-components' {
  export function LicenseAlert(): JSX.Element | null
  export function UpdatePrompt(): JSX.Element | null
  export function QRAccessPanel(props: { multiuser: boolean }): JSX.Element | null
  export function ModuleGate(props: { module: string; children: React.ReactNode; fallback?: React.ReactNode }): JSX.Element | null
  export function LoginScreen(props: { className?: string; onLogin?: () => void }): JSX.Element
  export function ActivationScreen(): JSX.Element
}
