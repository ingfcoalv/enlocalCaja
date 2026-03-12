import { Router } from 'express'
import type { AuthenticatedRequest } from '@enlocal/core-server'
import { requirePermission } from '@enlocal/core-server'
import { eq } from 'drizzle-orm'
import { remissionNotes, invoices } from '@enlocal/core-db'
import * as returnService from '../services/return.service'
import { createReturnSchema, processReturnSchema, rejectReturnSchema } from '../validators/return.validator'
import { getInvoicingModule } from '../utils/invoicingBridge'

const router = Router()

// GET / — list returns
router.get(
  '/',
  requirePermission('returns.read') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const result = await returnService.getAll(db, {
        status: req.query.status as string | undefined,
        remission_note_id: req.query.remission_note_id as string | undefined,
        customer_id: req.query.customer_id as string | undefined,
        from: req.query.from as string | undefined,
        to: req.query.to as string | undefined,
        page: req.query.page ? parseInt(req.query.page as string, 10) : undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
      })
      res.json(result)
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error listing returns' })
    }
  }
)

// GET /warehouse/pending — returns pending warehouse review
router.get(
  '/warehouse/pending',
  requirePermission('returns.receive') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const rows = await returnService.getPendingForWarehouse(db)
      res.json({ data: rows })
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error fetching pending returns' })
    }
  }
)

// GET /:id — get return detail
router.get(
  '/:id',
  requirePermission('returns.read') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const result = await returnService.getById(db, req.params.id)
      if (!result) return res.status(404).json({ error: 'Devolucion no encontrada' })
      res.json(result)
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error fetching return' })
    }
  }
)

// POST / — request return
router.post(
  '/',
  requirePermission('returns.request') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const parsed = createReturnSchema.safeParse(req.body)
      if (!parsed.success) {
        return res.status(400).json({ error: 'Validation error', details: parsed.error.flatten() })
      }
      const result = await returnService.request(db, parsed.data, req.user?.id ?? 'system')
      const io = req.app.get('io')
      if (io) io.emit('return:requested', result)
      res.status(201).json(result)
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Error requesting return' })
    }
  }
)

// POST /:id/review — warehouse starts review
router.post(
  '/:id/review',
  requirePermission('returns.receive') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const result = await returnService.review(db, req.params.id, req.user?.id ?? 'system')
      const io = req.app.get('io')
      if (io) io.emit('return:in_review', result)
      res.json(result)
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Error reviewing return' })
    }
  }
)

// POST /:id/process — warehouse processes return items
router.post(
  '/:id/process',
  requirePermission('returns.receive') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const parsed = processReturnSchema.safeParse(req.body)
      if (!parsed.success) {
        return res.status(400).json({ error: 'Validation error', details: parsed.error.flatten() })
      }
      const result = await returnService.process(db, req.params.id, parsed.data, req.user?.id ?? 'system')

      // Create credit note (CFDI tipo E) if mod-invoicing is available and there's an invoiced ticket
      if (result.ticketAdjustment) {
        try {
          const invoicing = await getInvoicingModule(req.app)
          if (invoicing?.createInvoiceFromSales) {
            // Check if the remission's ticket has an invoice link
            const returnData = result.return_
            const [note] = await db.select().from(remissionNotes).where(eq(remissionNotes.id, returnData.remissionNoteId))
            if (note?.ticketId) {
              const [ticket] = await db.select().from(invoices).where(eq(invoices.id, note.ticketId))
              if (ticket?.relatedInvoiceId || ticket?.source === 'cfdi') {
                // There's an invoice — create credit note as draft
                const pool = req.app.get('pool')
                if (pool) {
                  const totalRefunded = parseFloat(returnData.totalReturned || '0')
                  if (totalRefunded > 0) {
                    await db.insert(invoices).values({
                      type: 'E',
                      status: 'draft',
                      customerId: note.customerId,
                      paymentMethod: 'PUE',
                      paymentForm: '99',
                      total: String(totalRefunded.toFixed(2)),
                      subtotal: String(totalRefunded.toFixed(2)),
                      tax: '0',
                      source: 'credit_note',
                      relatedInvoiceId: ticket.relatedInvoiceId || ticket.id,
                      observations: `Nota de credito por devolucion DEV-${returnData.folio}`,
                    }).returning()
                  }
                }
              }
            }
          }
        } catch {
          // Non-critical: credit note creation failed but return was processed
        }
      }

      const io = req.app.get('io')
      if (io) io.emit('return:processed', result)
      res.json(result)
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Error processing return' })
    }
  }
)

// POST /:id/reject — warehouse rejects return
router.post(
  '/:id/reject',
  requirePermission('returns.reject') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const parsed = rejectReturnSchema.safeParse(req.body)
      if (!parsed.success) {
        return res.status(400).json({ error: 'Validation error', details: parsed.error.flatten() })
      }
      const result = await returnService.reject(db, req.params.id, parsed.data.reason, req.user?.id ?? 'system')
      const io = req.app.get('io')
      if (io) io.emit('return:rejected', result)
      res.json(result)
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Error rejecting return' })
    }
  }
)

export default router
