import type { Express } from 'express'
import { authMiddleware } from '@enlocal/core-server'
import employeesRoutes from './routes/employees.routes'
import payrollRoutes from './routes/payroll.routes'

export function mountPayrollRoutes(app: Express, db: any): void {
  app.set('db', db)
  app.use('/api/employees', authMiddleware as any, employeesRoutes)
  app.use('/api/payroll', authMiddleware as any, payrollRoutes)
}
