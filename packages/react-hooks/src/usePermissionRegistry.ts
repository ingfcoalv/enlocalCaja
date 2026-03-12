import { useState, useEffect, useCallback } from 'react'
import { api } from './useAuth'
import { useLicenseStore } from './useLicenseStore'

export interface PermissionDef {
  key: string
  label: string
}

export interface PermissionSection {
  id: string
  label: string
  module?: string
  permissions: PermissionDef[]
}

export interface PermissionRegistryResult {
  sections: PermissionSection[]
  defaults: Record<string, string[]>
  loading: boolean
  error: string | null
}

/**
 * Hook that loads the permission registry and role defaults from the API,
 * filtered by the currently active licensed modules.
 */
export function usePermissionRegistry(): PermissionRegistryResult {
  const [sections, setSections] = useState<PermissionSection[]>([])
  const [defaults, setDefaults] = useState<Record<string, string[]>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const modules = useLicenseStore((s) => s.modules)

  const activeAddonCodes = modules
    .filter((m) => m.active && m.source === 'addon')
    .map((m) => m.code.replace(/^mod-/, ''))

  const modulesKey = activeAddonCodes.sort().join(',')

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = modulesKey ? `?modules=${modulesKey}` : ''
      const [sectionsRes, defaultsRes] = await Promise.all([
        api.get(`/api/permissions${params}`),
        api.get('/api/permissions/defaults'),
      ])
      setSections(sectionsRes.data.sections || [])
      setDefaults(defaultsRes.data.defaults || {})
    } catch {
      setError('Error al cargar permisos')
    } finally {
      setLoading(false)
    }
  }, [modulesKey])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { sections, defaults, loading, error }
}
