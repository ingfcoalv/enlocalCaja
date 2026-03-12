import type { Express } from 'express'
import { authMiddleware } from '@enlocal/core-server'
import remissionsRoutes from './routes/remissions.routes'
import warehouseRoutes from './routes/warehouse.routes'
import returnsRoutes from './routes/returns.routes'
import receivablesRoutes from './routes/receivables.routes'
import creditRoutes from './routes/credit.routes'
import folioConfigRoutes from './routes/folioConfig.routes'
import consolidationRoutes from './routes/consolidation.routes'

export function mountRemissionRoutes(app: Express, db: any): void {
  app.set('db', db)

  app.use('/api/remissions', authMiddleware as any, remissionsRoutes)
  app.use('/api/remissions', authMiddleware as any, warehouseRoutes)
  app.use('/api/returns', authMiddleware as any, returnsRoutes)
  app.use('/api/receivables', authMiddleware as any, receivablesRoutes)
  app.use('/api/credit', authMiddleware as any, creditRoutes)
  app.use('/api/folio-config', authMiddleware as any, folioConfigRoutes)
  app.use('/api/invoices', authMiddleware as any, consolidationRoutes)
}
