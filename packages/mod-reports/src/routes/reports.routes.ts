import { Router, type Router as RouterType } from 'express'
import type { AuthenticatedRequest } from '@enlocal/core-server'
import { requirePermission } from '@enlocal/core-server'
import {
  getDashboard,
  getSalesReport,
  getProductsReport,
  getCustomersReport,
  getAuditLog,
  getTaxReport,
  getLowStockReport,
  getCashierPerformance,
  getRegisterComparison,
  getCashMovementsReport,
  getHourlySalesReport,
} from '../services/reports.service'

const router: RouterType = Router()

// ---------------------------------------------------------------------------
// Helper: parse date query params with defaults
// ---------------------------------------------------------------------------
function parseDateRange(query: any): { from: Date; to: Date } {
  const to = query.to ? new Date(query.to as string) : new Date()

  if (query.from) {
    return { from: new Date(query.from as string), to }
  }

  // Support period shorthand: today, week, month, year
  const period = query.period as string
  const now = new Date()
  let from: Date

  switch (period) {
    case 'today': {
      from = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      break
    }
    case 'week': {
      from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      break
    }
    case 'month': {
      from = new Date(now.getFullYear(), now.getMonth(), 1)
      break
    }
    case 'year': {
      from = new Date(now.getFullYear(), 0, 1)
      break
    }
    default:
      from = new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000)
  }

  return { from, to }
}

// ---------------------------------------------------------------------------
// GET /dashboard
// ---------------------------------------------------------------------------
router.get(
  '/dashboard',
  requirePermission('reports.read') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const { from, to } = parseDateRange(req.query)
      const result = await getDashboard(db, from, to)
      res.json(result)
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error fetching dashboard' })
    }
  }
)

// ---------------------------------------------------------------------------
// GET /sales?from=&to=&group_by=
// ---------------------------------------------------------------------------
router.get(
  '/sales',
  requirePermission('reports.read') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const { from, to } = parseDateRange(req.query)

      const groupBy = req.query.group_by as string | undefined
      const validGroups = ['day', 'week', 'month'] as const
      const group = validGroups.includes(groupBy as any)
        ? (groupBy as 'day' | 'week' | 'month')
        : 'day'

      const result = await getSalesReport(db, from, to, group)
      res.json(result)
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error fetching sales report' })
    }
  }
)

// ---------------------------------------------------------------------------
// GET /products?from=&to=
// ---------------------------------------------------------------------------
router.get(
  '/products',
  requirePermission('reports.read') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const { from, to } = parseDateRange(req.query)

      const result = await getProductsReport(db, from, to)
      res.json(result)
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error fetching products report' })
    }
  }
)

// ---------------------------------------------------------------------------
// GET /customers?from=&to=
// ---------------------------------------------------------------------------
router.get(
  '/customers',
  requirePermission('reports.read') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const { from, to } = parseDateRange(req.query)

      const result = await getCustomersReport(db, from, to)
      res.json(result)
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error fetching customers report' })
    }
  }
)

// ---------------------------------------------------------------------------
// GET /audit?from=&to=&table=&action=&page=&limit=
// ---------------------------------------------------------------------------
router.get(
  '/audit',
  requirePermission('reports.read') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')

      const filters: {
        from?: Date
        to?: Date
        table?: string
        action?: string
        page?: number
        limit?: number
      } = {}

      if (req.query.from) {
        filters.from = new Date(req.query.from as string)
      }

      if (req.query.to) {
        filters.to = new Date(req.query.to as string)
      }

      if (req.query.table) {
        filters.table = req.query.table as string
      }

      if (req.query.action) {
        filters.action = req.query.action as string
      }

      if (req.query.page) {
        filters.page = parseInt(req.query.page as string, 10)
      }

      if (req.query.limit) {
        filters.limit = parseInt(req.query.limit as string, 10)
      }

      const result = await getAuditLog(db, filters)
      res.json(result)
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error fetching audit log' })
    }
  }
)

// ---------------------------------------------------------------------------
// GET /taxes?from=&to=
// ---------------------------------------------------------------------------
router.get(
  '/taxes',
  requirePermission('reports.read') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const { from, to } = parseDateRange(req.query)

      const result = await getTaxReport(db, from, to)
      res.json(result)
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error fetching tax report' })
    }
  }
)

// ---------------------------------------------------------------------------
// GET /low-stock?categoryId=
// ---------------------------------------------------------------------------
router.get(
  '/low-stock',
  requirePermission('reports.read') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const filters: { categoryId?: string } = {}

      if (req.query.categoryId) {
        filters.categoryId = req.query.categoryId as string
      }

      const result = await getLowStockReport(db, filters)
      res.json(result)
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error fetching low stock report' })
    }
  }
)

// ---------------------------------------------------------------------------
// GET /cashier-performance?from=&to=&userId=&registerId=
// ---------------------------------------------------------------------------
router.get(
  '/cashier-performance',
  requirePermission('reports.read') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const { from, to } = parseDateRange(req.query)
      const userId = req.query.userId as string | undefined
      const registerId = req.query.registerId as string | undefined
      const result = await getCashierPerformance(db, from, to, userId, registerId)
      res.json(result)
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error fetching cashier performance' })
    }
  }
)

// ---------------------------------------------------------------------------
// GET /register-comparison?from=&to=
// ---------------------------------------------------------------------------
router.get(
  '/register-comparison',
  requirePermission('reports.read') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const { from, to } = parseDateRange(req.query)
      const result = await getRegisterComparison(db, from, to)
      res.json(result)
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error fetching register comparison' })
    }
  }
)

// ---------------------------------------------------------------------------
// GET /cash-movements?from=&to=&registerId=
// ---------------------------------------------------------------------------
router.get(
  '/cash-movements',
  requirePermission('reports.read') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const { from, to } = parseDateRange(req.query)
      const registerId = req.query.registerId as string | undefined
      const result = await getCashMovementsReport(db, from, to, registerId)
      res.json(result)
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error fetching cash movements report' })
    }
  }
)

// ---------------------------------------------------------------------------
// GET /hourly-sales?from=&to=&registerId=
// ---------------------------------------------------------------------------
router.get(
  '/hourly-sales',
  requirePermission('reports.read') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const { from, to } = parseDateRange(req.query)
      const registerId = req.query.registerId as string | undefined
      const result = await getHourlySalesReport(db, from, to, registerId)
      res.json(result)
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error fetching hourly sales' })
    }
  }
)

export default router
