import type { Express } from 'express'
import { authMiddleware } from '@enlocal/core-server'
import salesRoutes from './routes/sales.routes'
import cashShiftsRoutes from './routes/cashShifts.routes'
import paymentsRoutes from './routes/payments.routes'
import receiptsRoutes from './routes/receipts.routes'
import creditRoutes from './routes/credit.routes'
import registersRoutes from './routes/registers.routes'
import cashMovementsRoutes from './routes/cashMovements.routes'
import { ensureSchemaMigrations } from './services/sales.service'
import { ensureRegistersTable } from './services/registers.service'

export function mountPosRoutes(app: Express, db: any): void {
  app.set('db', db)

  // Run schema migrations for new columns
  ensureSchemaMigrations(db).catch((err: any) =>
    console.error('[mod-pos] Schema migration error:', err.message)
  )

  // Ensure registers tables exist
  ensureRegistersTable(db).catch((err: any) =>
    console.error('[mod-pos] Registers table error:', err.message)
  )

  app.use('/api/sales', authMiddleware as any, salesRoutes)
  app.use('/api/pos/shifts', authMiddleware as any, cashShiftsRoutes)
  app.use('/api/pos/registers', authMiddleware as any, registersRoutes)
  app.use('/api/pos/movements', authMiddleware as any, cashMovementsRoutes)
  app.use('/api/payments', authMiddleware as any, paymentsRoutes)
  app.use('/api/receipts', authMiddleware as any, receiptsRoutes)
  app.use('/api/credit', authMiddleware as any, creditRoutes)
}
