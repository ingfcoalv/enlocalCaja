import { Router } from 'express'
import type { Request, Response } from 'express'
import { PERMISSION_REGISTRY } from '@enlocal/core-server/dist/permissions/registry'
import type { PermissionSection } from '@enlocal/core-server/dist/permissions/registry'
import { ROLE_PERMISSION_DEFAULTS } from '@enlocal/core-server/dist/permissions/defaults'

const router = Router()

/**
 * GET /api/permissions?modules=remissions,invoicing,...
 * Returns permission sections filtered by active modules.
 * Sections with no `module` field are always returned.
 */
router.get('/', (req: Request, res: Response) => {
  const modulesParam = (req.query.modules as string) || ''
  const activeModules = modulesParam
    ? modulesParam.split(',').map((m) => m.trim()).filter(Boolean)
    : []

  const sections: PermissionSection[] = PERMISSION_REGISTRY.filter((section) => {
    if (!section.module) return true
    return activeModules.includes(section.module)
  })

  res.json({ sections })
})

/**
 * GET /api/permissions/defaults
 * Returns the default permissions for each predefined role.
 */
router.get('/defaults', (_req: Request, res: Response) => {
  res.json({ defaults: ROLE_PERMISSION_DEFAULTS })
})

export default router
