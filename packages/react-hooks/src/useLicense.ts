import { useEffect } from 'react'
import { useLicenseStore } from './useLicenseStore'

// Declare the electronAPI type on window
declare global {
  interface Window {
    electronAPI?: {
      invoke: (channel: string, ...args: unknown[]) => Promise<unknown>
    }
  }
}

interface LicenseState {
  plan: string
  expiresAt: string | null
  daysRemaining: number | null
  modules: string[]
  addons: string[]
  loading: boolean
}

/**
 * useLicense — backward-compatible hook.
 * Delegates to useLicenseStore internally.
 */
export function useLicense(): LicenseState {
  const store = useLicenseStore()

  useEffect(() => {
    if (!store.loading && !store.plan) {
      store.fetchFullInfo()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Map store data to legacy interface
  const modules = store.modules
    .filter((m) => m.active && m.source === 'default')
    .map((m) => m.code.replace('mod-', ''))

  const addons = store.modules
    .filter((m) => m.active && m.source === 'addon')
    .map((m) => m.code.replace('mod-', ''))

  // Calculate days remaining
  let daysRemaining: number | null = null
  if (store.expiresAt) {
    const expiry = new Date(store.expiresAt)
    const now = new Date()
    daysRemaining = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  }

  return {
    plan: store.plan || 'free',
    expiresAt: store.expiresAt,
    daysRemaining,
    modules,
    addons,
    loading: store.loading,
  }
}
