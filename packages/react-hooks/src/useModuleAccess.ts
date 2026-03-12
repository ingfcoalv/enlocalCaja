import { useMemo } from 'react'
import { useLicenseStore } from './useLicenseStore'

// Duplicated from core-license/moduleAccess.ts to avoid pulling Node.js deps into the frontend bundle
const MODULE_DEPENDENCIES: Record<string, string[]> = {
  'mod-remissions': ['mod-inventory', 'mod-invoicing'],
  'mod-payables': ['mod-catalogs'],
  'mod-quotes': ['mod-catalogs'],
  'mod-invoicing': ['mod-catalogs'],
  'mod-inventory': ['mod-catalogs'],
  'mod-pos': ['mod-catalogs'],
  'mod-multicaja': ['mod-pos'],
}

interface ModuleAccess {
  hasAccess: boolean
  isAddon: boolean
  missingDependencies: string[]
}

/**
 * useModuleAccess — checks if a module is active.
 * Accepts both short names ('invoicing') and full names ('mod-invoicing').
 */
export function useModuleAccess(moduleName: string): ModuleAccess {
  const { modules, loading } = useLicenseStore()

  return useMemo(() => {
    if (loading) {
      return { hasAccess: false, isAddon: false, missingDependencies: [] }
    }

    // Normalize: accept both 'invoicing' and 'mod-invoicing'
    const normalized = moduleName.startsWith('mod-') ? moduleName : `mod-${moduleName}`

    const found = modules.find(
      (m) => m.active && (m.code === normalized || m.code === moduleName)
    )

    // Check dependencies
    const deps = MODULE_DEPENDENCIES[normalized] || []
    const activeCodes = modules.filter(m => m.active).map(m => m.code)
    const missing = deps.filter(d => !activeCodes.includes(d))

    return {
      hasAccess: !!found,
      isAddon: found?.source === 'addon' || false,
      missingDependencies: missing,
    }
  }, [moduleName, modules, loading])
}
