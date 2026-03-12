import type { Express } from 'express'
import { authMiddleware } from '@enlocal/core-server'
import appointmentsRoutes from './routes/appointments.routes'
import schedulesRoutes from './routes/schedules.routes'

export function mountAppointmentsRoutes(app: Express, db: any): void {
  app.set('db', db)
  app.use('/api/appointments', authMiddleware as any, appointmentsRoutes)
  app.use('/api/schedules', authMiddleware as any, schedulesRoutes)
}
