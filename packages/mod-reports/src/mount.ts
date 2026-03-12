import type { Express } from 'express'
import { authMiddleware } from '@enlocal/core-server'
import reportsRoutes from './routes/reports.routes'

export function mountReportRoutes(app: Express, db: any): void {
  app.set('db', db)
  app.use('/api/reports', authMiddleware as any, reportsRoutes)
}
