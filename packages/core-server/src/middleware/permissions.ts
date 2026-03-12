import type { Response, NextFunction } from 'express'
import type { AuthenticatedRequest } from '../types'
import { ROLE_PERMISSION_DEFAULTS } from '../permissions/defaults'

/** Normalize permission strings: colon → dot for backwards compat */
function normalize(perm: string): string {
  return perm.replace(/:/g, '.')
}

function matchPermission(granted: string, required: string): boolean {
  const g = normalize(granted)
  const r = normalize(required)
  if (g === '*') return true
  if (g === r) return true
  // Wildcard: 'orders.*' matches 'orders.create'
  if (g.endsWith('.*')) {
    const prefix = g.slice(0, -2)
    return r.startsWith(prefix + '.')
  }
  return false
}

export function requirePermission(permission: string) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'UNAUTHORIZED', message: 'Autenticación requerida' })
      return
    }

    const userRole = req.user.role
    const rolePerms = ROLE_PERMISSION_DEFAULTS[userRole] || []
    const userPerms = [...rolePerms, ...(req.user.permissions || [])]

    const hasPermission = userPerms.some((p) => matchPermission(p, permission))

    if (!hasPermission) {
      res.status(403).json({ error: 'FORBIDDEN', message: `Permiso requerido: ${permission}` })
      return
    }

    next()
  }
}

/** Backwards-compatible alias */
export const ROLE_PERMISSIONS: Record<string, string[]> = ROLE_PERMISSION_DEFAULTS
