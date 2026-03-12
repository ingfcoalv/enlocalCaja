import type { Express } from 'express'
import { authMiddleware } from '@enlocal/core-server'
import authRoutes from './routes/auth.routes'
import usersRoutes from './routes/users.routes'
import rolesRoutes from './routes/roles.routes'
import permissionsRoutes from './routes/permissions.routes'
import settingsRoutes from './routes/settings.routes'
import brandingRoutes from './routes/branding.routes'
import printerRoutes from './routes/printer.routes'
import scaleRoutes from './routes/scale.routes'

export function mountConfigRoutes(app: Express, db: any): void {
  app.set('db', db)
  app.use('/api/auth', authRoutes)
  app.use('/api/users', authMiddleware as any, usersRoutes)
  app.use('/api/roles', authMiddleware as any, rolesRoutes)
  app.use('/api/permissions', authMiddleware as any, permissionsRoutes)
  app.use('/api/settings/printers', authMiddleware as any, printerRoutes)
  app.use('/api/settings/scale', authMiddleware as any, scaleRoutes)
  app.use('/api/settings', authMiddleware as any, brandingRoutes)
}

/**
 * Mount the generic settings CRUD routes (has /:key catch-all).
 * Must be called AFTER all other modules that mount on /api/settings
 * to avoid the /:key param intercepting specific routes like /quote-folio.
 */
export function mountGenericSettingsRoutes(app: Express): void {
  app.use('/api/settings', authMiddleware as any, settingsRoutes)
}
