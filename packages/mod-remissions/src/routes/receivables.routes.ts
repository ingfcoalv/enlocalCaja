import { Router } from 'express'
import type { AuthenticatedRequest } from '@enlocal/core-server'
import { requirePermission } from '@enlocal/core-server'
import { inArray } from 'drizzle-orm'
import { settings } from '@enlocal/core-db'
import * as receivableService from '../services/receivable.service'
import { getCreditDashboard } from '../services/receivableDashboard.service'
import { generateStatementPDF } from '../services/statementPdfGenerator'
import { generateAgingPDF } from '../services/agingPdfGenerator'
import { collectPaymentSchema } from '../validators/receivable.validator'
import { getInvoicingModule } from '../utils/invoicingBridge'

const router = Router()

// GET /dashboard — CxC dashboard by customer
router.get(
  '/dashboard',
  requirePermission('receivables.read') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const result = await getCreditDashboard(db, {
        credit_status: req.query.credit_status as string | undefined,
        q: req.query.q as string | undefined,
        has_balance: req.query.has_balance === 'true',
        overdue_only: req.query.overdue_only === 'true',
      })
      res.json(result)
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error fetching CxC dashboard' })
    }
  }
)

// GET / — list receivables
router.get(
  '/',
  requirePermission('receivables.read') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const result = await receivableService.getAll(db, {
        customer_id: req.query.customer_id as string | undefined,
        status: req.query.status as string | undefined,
        overdue_only: req.query.overdue_only === 'true',
        from: req.query.from as string | undefined,
        to: req.query.to as string | undefined,
        q: req.query.q as string | undefined,
        page: req.query.page ? parseInt(req.query.page as string, 10) : undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
      })
      res.json(result)
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error listing receivables' })
    }
  }
)

// GET /aging-report — aging report
router.get(
  '/aging-report',
  requirePermission('reports.read') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const result = await receivableService.getAgingReport(db, req.query.as_of_date as string | undefined)
      res.json(result)
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error generating aging report' })
    }
  }
)

// GET /aging-report/pdf — aging report PDF
router.get(
  '/aging-report/pdf',
  requirePermission('reports.read') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const result = await receivableService.getAgingReport(db, req.query.as_of_date as string | undefined)

      const settingsRows = await db.select().from(settings)
        .where(inArray(settings.key, ['business_name']))
      const cfg: Record<string, string> = {}
      for (const row of settingsRows) cfg[row.key] = row.value

      const pdfData = {
        rows: (result.rows || []).map((r: any) => ({
          customerName: r.customerName || r.customer_name || '',
          current: Number(r.current) || 0,
          days1to30: Number(r.days1to30 || r.days_1_to_30) || 0,
          days31to60: Number(r.days31to60 || r.days_31_to_60) || 0,
          days61to90: Number(r.days61to90 || r.days_61_to_90) || 0,
          days90plus: Number(r.days90plus || r.days_90_plus) || 0,
          total: Number(r.total) || 0,
        })),
        totals: {
          current: Number(result.totals?.current) || 0,
          days1to30: Number(result.totals?.days1to30) || 0,
          days31to60: Number(result.totals?.days31to60) || 0,
          days61to90: Number(result.totals?.days61to90) || 0,
          days90plus: Number(result.totals?.days90plus) || 0,
          total: Number(result.totals?.total) || 0,
        },
        asOfDate: result.asOfDate || new Date().toISOString().slice(0, 10),
        businessInfo: { name: cfg.business_name },
      }

      const buffer = await generateAgingPDF(pdfData)
      res.setHeader('Content-Type', 'application/pdf')
      res.setHeader('Content-Disposition', `inline; filename="Antiguedad-Saldos.pdf"`)
      res.send(buffer)
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error generating aging report PDF' })
    }
  }
)

// GET /collection-schedule — upcoming collections
router.get(
  '/collection-schedule',
  requirePermission('receivables.read') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const result = await receivableService.getCollectionSchedule(
        db, req.query.from as string | undefined, req.query.to as string | undefined
      )
      res.json({ data: result })
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error fetching collection schedule' })
    }
  }
)

// GET /pending-complements — payments without complement
router.get(
  '/pending-complements',
  requirePermission('receivables.read') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const result = await receivableService.getPendingComplements(db)
      res.json({ data: result })
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error fetching pending complements' })
    }
  }
)

// GET /customer/:id/statement/pdf — customer statement PDF
router.get(
  '/customer/:id/statement/pdf',
  requirePermission('receivables.read') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const result = await receivableService.getCustomerStatement(db, req.params.id)

      const settingsRows = await db.select().from(settings)
        .where(inArray(settings.key, ['business_name', 'business_rfc', 'business_phone']))
      const cfg: Record<string, string> = {}
      for (const row of settingsRows) cfg[row.key] = row.value

      const pdfData = {
        customer: {
          name: result.customer?.name || '',
          rfc: result.customer?.rfc || '',
          phone: result.customer?.phone || result.customer?.cellphone || '',
          email: result.customer?.email || '',
        },
        entries: (result.entries || []).map((e: any) => ({
          date: e.date,
          concept: e.concept,
          charge: Number(e.charge) || 0,
          credit: Number(e.credit) || 0,
          balance: Number(e.balance) || 0,
        })),
        currentBalance: Number(result.currentBalance) || 0,
        generatedAt: new Date().toISOString(),
        businessInfo: {
          name: cfg.business_name,
          rfc: cfg.business_rfc,
          phone: cfg.business_phone,
        },
      }

      const buffer = await generateStatementPDF(pdfData)
      const custName = (result.customer?.name || 'Cliente').replace(/\s+/g, '-')
      res.setHeader('Content-Type', 'application/pdf')
      res.setHeader('Content-Disposition', `inline; filename="Estado-${custName}.pdf"`)
      res.send(buffer)
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error generating statement PDF' })
    }
  }
)

// GET /customer/:id/statement — customer statement
router.get(
  '/customer/:id/statement',
  requirePermission('receivables.read') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const result = await receivableService.getCustomerStatement(db, req.params.id)
      res.json(result)
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Error fetching customer statement' })
    }
  }
)

// GET /:id — get receivable detail
router.get(
  '/:id',
  requirePermission('receivables.read') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const result = await receivableService.getById(db, req.params.id)
      if (!result) return res.status(404).json({ error: 'Cuenta por cobrar no encontrada' })
      res.json(result)
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error fetching receivable' })
    }
  }
)

// POST /:id/payment — collect payment
router.post(
  '/:id/payment',
  requirePermission('receivables.collect') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const parsed = collectPaymentSchema.safeParse(req.body)
      if (!parsed.success) {
        return res.status(400).json({ error: 'Validation error', details: parsed.error.flatten() })
      }
      const result = await receivableService.collectPayment(db, req.params.id, parsed.data, req.user?.id ?? 'system')

      // If complement was emitted and mod-invoicing is available, attempt CFDI stamping
      if (parsed.data.emit_complement) {
        try {
          const invoicing = await getInvoicingModule(req.app)
          if (invoicing?.createComplementoPago && result.receivable?.invoiceId) {
            // mod-invoicing available — stamp complement via CFDI pipeline
            const pool = req.app.get('pool')
            if (pool) {
              await invoicing.createComplementoPago(db, pool, {
                invoiceId: result.receivable.invoiceId,
                paymentIds: [result.payment.id],
              }, req.user?.id ?? 'system')
            }
          }
        } catch {
          // Non-critical: complement already created as draft via direct insert
        }
      }

      const io = req.app.get('io')
      if (io) {
        io.emit('receivable:payment', result)
        if (result.receivable && Number(result.receivable.balance) <= 0) {
          io.emit('receivable:paid', result.receivable)
        }
      }
      res.status(201).json(result)
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Error collecting payment' })
    }
  }
)

export default router
