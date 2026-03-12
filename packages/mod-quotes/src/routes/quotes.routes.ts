import { Router } from 'express'
import type { AuthenticatedRequest } from '@enlocal/core-server'
import { requirePermission } from '@enlocal/core-server'
import { inArray } from 'drizzle-orm'
import { settings } from '@enlocal/core-db'
import * as quoteService from '../services/quote.service'
import * as conversionService from '../services/conversion.service'
import { logActivity } from '../services/activity.service'
import { generateQuotePDF } from '../services/quotePdf.service'
import { sendQuoteEmail, renderTemplate } from '../services/mailer.service'
import {
  createQuoteSchema, updateQuoteSchema, convertQuoteSchema,
  addActivitySchema, rejectQuoteSchema, cancelQuoteSchema,
} from '../validators/quote.validator'
import { sendQuoteEmailSchema } from '../validators/email.validator'

const router = Router()

// GET / — list quotes
router.get(
  '/',
  requirePermission('quotes.read') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const result = await quoteService.getAll(db, {
        status: req.query.status as string | undefined,
        customer_id: req.query.customer_id as string | undefined,
        created_by: req.query.created_by as string | undefined,
        from: req.query.from as string | undefined,
        to: req.query.to as string | undefined,
        q: req.query.q as string | undefined,
        is_template: req.query.is_template as string | undefined,
        needs_followup: req.query.needs_followup as string | undefined,
        page: req.query.page ? parseInt(req.query.page as string, 10) : undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
      })
      res.json(result)
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error listing quotes' })
    }
  }
)

// GET /templates — list templates
router.get(
  '/templates',
  requirePermission('quotes.read') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const result = await quoteService.getAll(db, { is_template: 'true', limit: 100 })
      res.json(result)
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error listing templates' })
    }
  }
)

// GET /:id — get quote detail
router.get(
  '/:id',
  requirePermission('quotes.read') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const result = await quoteService.getById(db, req.params.id)
      if (!result) return res.status(404).json({ error: 'Cotizacion no encontrada' })
      res.json(result)
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error fetching quote' })
    }
  }
)

// POST / — create quote
router.post(
  '/',
  requirePermission('quotes.create') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const parsed = createQuoteSchema.safeParse(req.body)
      if (!parsed.success) {
        return res.status(400).json({ error: 'Validation error', details: parsed.error.flatten() })
      }
      const result = await quoteService.create(
        db, parsed.data, req.user?.id ?? 'system',
        req.user?.name ?? 'Sistema'
      )
      const io = req.app.get('io')
      if (io) io.emit('quote:created', result)
      res.status(201).json(result)
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Error creating quote' })
    }
  }
)

// PUT /:id — update quote
router.put(
  '/:id',
  requirePermission('quotes.update') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const parsed = updateQuoteSchema.safeParse(req.body)
      if (!parsed.success) {
        return res.status(400).json({ error: 'Validation error', details: parsed.error.flatten() })
      }
      const result = await quoteService.update(db, req.params.id, parsed.data, req.user?.id ?? 'system')
      res.json(result)
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Error updating quote' })
    }
  }
)

// POST /:id/new-version — create new version
router.post(
  '/:id/new-version',
  requirePermission('quotes.update') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const result = await quoteService.newVersion(
        db, req.params.id, req.user?.id ?? 'system',
        req.user?.name ?? 'Sistema'
      )
      const io = req.app.get('io')
      if (io) io.emit('quote:new_version', result)
      res.status(201).json(result)
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Error creating new version' })
    }
  }
)

// POST /:id/send — send quote by email
router.post(
  '/:id/send',
  requirePermission('quotes.send') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const parsed = sendQuoteEmailSchema.safeParse(req.body)
      if (!parsed.success) {
        return res.status(400).json({ error: 'Validation error', details: parsed.error.flatten() })
      }

      // Generate PDF
      const quote = await quoteService.getById(db, req.params.id)
      if (!quote) return res.status(404).json({ error: 'Cotizacion no encontrada' })

      const settingsRows = await db.select().from(settings)
        .where(inArray(settings.key, ['business_name', 'business_rfc', 'business_address', 'business_phone', 'business_email', 'business_logo_path']))
      const cfg: Record<string, string> = {}
      for (const row of settingsRows) cfg[row.key] = row.value

      let pdfBuffer: Buffer | undefined
      const folio = `${quote.series}-${String(quote.folio).padStart(4, '0')}`

      if (parsed.data.attach_pdf) {
        pdfBuffer = await generateQuotePDF({
          folio: quote.folio,
          series: quote.series,
          version: quote.version,
          createdAt: quote.createdAt,
          validUntil: quote.validUntil,
          status: quote.status,
          customer: {
            name: quote.customerName,
            rfc: quote.customerRfc,
            phone: quote.customerPhone,
            email: quote.customerEmail,
            address: quote.customerAddress,
          },
          items: (quote.items || []).map((it: any) => ({
            itemName: it.itemName,
            itemDescription: it.itemDescription,
            itemSku: it.itemSku,
            itemType: it.itemType,
            quantity: parseFloat(it.quantity),
            unitPrice: parseFloat(it.unitPrice),
            discount: parseFloat(it.discount || 0),
            taxRate: parseFloat(it.taxRate || 0),
            taxAmount: parseFloat(it.taxAmount || 0),
            total: parseFloat(it.total),
            groupName: it.groupName,
            isOptional: it.isOptional,
          })),
          subtotal: parseFloat(quote.subtotal),
          discountAmount: parseFloat(quote.discountAmount || 0),
          taxAmount: parseFloat(quote.taxAmount || 0),
          total: parseFloat(quote.total),
          conditions: quote.conditions,
          notes: quote.notes,
          termsAndConditions: quote.termsAndConditions,
          salesPersonName: quote.salesPersonName,
          businessInfo: {
            name: cfg.business_name,
            rfc: cfg.business_rfc,
            address: cfg.business_address,
            phone: cfg.business_phone,
            email: cfg.business_email,
          },
          logoPath: cfg.business_logo_path || undefined,
        })
      }

      const emailResult = await sendQuoteEmail(db, {
        quoteId: req.params.id,
        to: parsed.data.to,
        cc: parsed.data.cc,
        subject: parsed.data.subject,
        body: parsed.data.body,
        attachPdf: parsed.data.attach_pdf,
        pdfBuffer,
        pdfFilename: `Cotizacion-${folio}.pdf`,
        sentBy: req.user?.id ?? 'system',
      })

      // Mark as sent
      await quoteService.markAsSent(db, req.params.id, req.user?.id ?? 'system')

      const io = req.app.get('io')
      if (io) io.emit('quote:sent', { id: req.params.id, status: 'sent' })

      res.json(emailResult)
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Error sending quote' })
    }
  }
)

// POST /:id/accept — accept quote
router.post(
  '/:id/accept',
  requirePermission('quotes.update') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const result = await quoteService.accept(db, req.params.id, req.user?.id ?? 'system')
      const io = req.app.get('io')
      if (io) io.emit('quote:accepted', result)
      res.json(result)
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Error accepting quote' })
    }
  }
)

// POST /:id/reject — reject quote
router.post(
  '/:id/reject',
  requirePermission('quotes.update') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const parsed = rejectQuoteSchema.safeParse(req.body)
      if (!parsed.success) {
        return res.status(400).json({ error: 'Validation error', details: parsed.error.flatten() })
      }
      const result = await quoteService.reject(db, req.params.id, parsed.data.reason, req.user?.id ?? 'system')
      const io = req.app.get('io')
      if (io) io.emit('quote:rejected', result)
      res.json(result)
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Error rejecting quote' })
    }
  }
)

// POST /:id/cancel — cancel quote
router.post(
  '/:id/cancel',
  requirePermission('quotes.cancel') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const parsed = cancelQuoteSchema.safeParse(req.body)
      if (!parsed.success) {
        return res.status(400).json({ error: 'Validation error', details: parsed.error.flatten() })
      }
      const result = await quoteService.cancel(db, req.params.id, parsed.data.reason, req.user?.id ?? 'system')
      const io = req.app.get('io')
      if (io) io.emit('quote:cancelled', result)
      res.json(result)
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Error cancelling quote' })
    }
  }
)

// POST /:id/convert — convert quote to ticket or remission
router.post(
  '/:id/convert',
  requirePermission('quotes.convert') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const parsed = convertQuoteSchema.safeParse(req.body)
      if (!parsed.success) {
        return res.status(400).json({ error: 'Validation error', details: parsed.error.flatten() })
      }

      let result: any
      if (parsed.data.target === 'ticket') {
        result = await conversionService.convertToTicket(
          db, req.params.id, parsed.data.payment_type, req.user?.id ?? 'system'
        )
      } else {
        result = await conversionService.convertToRemission(
          db, req.params.id, parsed.data.payment_type, req.user?.id ?? 'system'
        )
      }

      const io = req.app.get('io')
      if (io) io.emit('quote:converted', result)
      res.json(result)
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Error converting quote' })
    }
  }
)

// POST /:id/activity — add activity
router.post(
  '/:id/activity',
  requirePermission('quotes.update') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const parsed = addActivitySchema.safeParse(req.body)
      if (!parsed.success) {
        return res.status(400).json({ error: 'Validation error', details: parsed.error.flatten() })
      }
      const result = await logActivity(
        db, req.params.id, parsed.data.activity_type,
        parsed.data.description, req.user?.id ?? 'system'
      )
      res.status(201).json(result)
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Error adding activity' })
    }
  }
)

// POST /from-template/:templateId — create from template
router.post(
  '/from-template/:templateId',
  requirePermission('quotes.create') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const { customer_id, customer_name } = req.body
      if (!customer_name) return res.status(400).json({ error: 'customer_name is required' })

      const result = await quoteService.fromTemplate(
        db, req.params.templateId,
        { customer_id, customer_name },
        req.user?.id ?? 'system',
        req.user?.name ?? 'Sistema'
      )
      const io = req.app.get('io')
      if (io) io.emit('quote:created', result)
      res.status(201).json(result)
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Error creating from template' })
    }
  }
)

// GET /:id/pdf — generate PDF
router.get(
  '/:id/pdf',
  requirePermission('quotes.read') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const quote = await quoteService.getById(db, req.params.id)
      if (!quote) return res.status(404).json({ error: 'Cotizacion no encontrada' })

      const settingsRows = await db.select().from(settings)
        .where(inArray(settings.key, ['business_name', 'business_rfc', 'business_address', 'business_phone', 'business_email', 'business_logo_path']))
      const cfg: Record<string, string> = {}
      for (const row of settingsRows) cfg[row.key] = row.value

      const buffer = await generateQuotePDF({
        folio: quote.folio,
        series: quote.series,
        version: quote.version,
        createdAt: quote.createdAt,
        validUntil: quote.validUntil,
        status: quote.status,
        customer: {
          name: quote.customerName,
          rfc: quote.customerRfc,
          phone: quote.customerPhone,
          email: quote.customerEmail,
          address: quote.customerAddress,
        },
        items: (quote.items || []).map((it: any) => ({
          itemName: it.itemName,
          itemDescription: it.itemDescription,
          itemSku: it.itemSku,
          itemType: it.itemType,
          quantity: parseFloat(it.quantity),
          unitPrice: parseFloat(it.unitPrice),
          discount: parseFloat(it.discount || 0),
          taxRate: parseFloat(it.taxRate || 0),
          taxAmount: parseFloat(it.taxAmount || 0),
          total: parseFloat(it.total),
          groupName: it.groupName,
          isOptional: it.isOptional,
        })),
        subtotal: parseFloat(quote.subtotal),
        discountAmount: parseFloat(quote.discountAmount || 0),
        taxAmount: parseFloat(quote.taxAmount || 0),
        total: parseFloat(quote.total),
        conditions: quote.conditions,
        notes: quote.notes,
        termsAndConditions: quote.termsAndConditions,
        salesPersonName: quote.salesPersonName,
        businessInfo: {
          name: cfg.business_name,
          rfc: cfg.business_rfc,
          address: cfg.business_address,
          phone: cfg.business_phone,
          email: cfg.business_email,
        },
        logoPath: cfg.business_logo_path || undefined,
      })

      const folio = `${quote.series}-${String(quote.folio).padStart(4, '0')}`
      res.setHeader('Content-Type', 'application/pdf')
      res.setHeader('Content-Disposition', `inline; filename="Cotizacion-${folio}.pdf"`)
      res.send(buffer)
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error generating PDF' })
    }
  }
)

export default router
