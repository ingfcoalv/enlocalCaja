import { Router } from 'express'
import type { AuthenticatedRequest } from '@enlocal/core-server'
import { requirePermission } from '@enlocal/core-server'
import { eq, and, inArray, isNull, sql } from 'drizzle-orm'
import { remissionNotes, invoices, invoiceLinks, invoiceItems, remissionNoteItems, customers } from '@enlocal/core-db'
import { getInvoicingModule } from '../utils/invoicingBridge'

const router = Router()

// GET /consolidation-candidates/:customerId — uninvoiced tickets for a customer
router.get(
  '/consolidation-candidates/:customerId',
  requirePermission('invoicing.create') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const { customerId } = req.params

      // Find delivered remissions for this customer that have tickets but no invoice link
      const notes = await db.select().from(remissionNotes)
        .where(and(
          eq(remissionNotes.customerId, customerId),
          eq(remissionNotes.status, 'delivered'),
        ))

      // Get customer name
      const [cust] = await db.select({ name: customers.name }).from(customers).where(eq(customers.id, customerId))
      const customerName = cust?.name || ''

      const candidates: any[] = []
      const seenTicketIds = new Set<string>()

      // 1. Remission-based candidates (delivered remissions with tickets)
      for (const note of notes) {
        if (!note.ticketId) continue

        // Check if ticket already has an invoice link
        const existingLink = await db.select({ id: invoiceLinks.id }).from(invoiceLinks)
          .where(eq(invoiceLinks.saleInvoiceId, note.ticketId))
          .limit(1)

        if (existingLink.length > 0) continue

        // Get ticket info
        const [ticket] = await db.select().from(invoices).where(eq(invoices.id, note.ticketId))
        if (!ticket || ticket.type !== 'I' || ticket.source !== 'pos') continue

        seenTicketIds.add(ticket.id)
        candidates.push({
          ticketId: ticket.id,
          remissionNoteId: note.id,
          folio: note.folio,
          series: note.series,
          total: ticket.total,
          date: note.createdAt,
          customerName: note.customerName || customerName,
        })
      }

      // 2. Direct POS credit tickets (no remission note)
      const posCredits = await db.select().from(invoices).where(
        and(
          eq(invoices.customerId, customerId),
          eq(invoices.source, 'pos'),
          inArray(invoices.status, ['credit', 'partial']),
          eq(invoices.type, 'I'),
        )
      )

      for (const ticket of posCredits) {
        if (seenTicketIds.has(ticket.id)) continue

        // Check if already invoiced
        const existingLink = await db.select({ id: invoiceLinks.id }).from(invoiceLinks)
          .where(eq(invoiceLinks.saleInvoiceId, ticket.id))
          .limit(1)
        if (existingLink.length > 0) continue

        candidates.push({
          ticketId: ticket.id,
          remissionNoteId: null,
          folio: ticket.folio,
          series: ticket.series || 'POS',
          total: ticket.total,
          date: ticket.createdAt,
          customerName,
        })
      }

      res.json({ data: candidates })
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error fetching consolidation candidates' })
    }
  }
)

// POST /consolidate — create single CFDI from multiple tickets
router.post(
  '/consolidate',
  requirePermission('invoicing.create') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const pool = req.app.get('pool')
      const { customer_id, ticket_ids, use_cfdi, payment_form, notes } = req.body

      if (!customer_id || !ticket_ids || !Array.isArray(ticket_ids) || ticket_ids.length === 0) {
        return res.status(400).json({ error: 'Se requiere customer_id y al menos un ticket_id' })
      }

      // Try to use mod-invoicing's createInvoiceFromSales
      const invoicing = await getInvoicingModule(req.app)
      if (invoicing?.createInvoiceFromSales && pool) {
        const result = await invoicing.createInvoiceFromSales(
          db, pool, ticket_ids,
          { customerId: customer_id, useCfdi: use_cfdi || 'G03' },
          req.user?.id ?? 'system'
        )
        return res.status(201).json(result)
      }

      // Fallback: manual consolidation without mod-invoicing
      // Verify all tickets belong to this customer and are uninvoiced
      const tickets: any[] = []
      for (const ticketId of ticket_ids) {
        const [ticket] = await db.select().from(invoices)
          .where(and(eq(invoices.id, ticketId), eq(invoices.customerId, customer_id)))
        if (!ticket) return res.status(400).json({ error: `Ticket ${ticketId} no encontrado para este cliente` })

        const link = await db.select({ id: invoiceLinks.id }).from(invoiceLinks)
          .where(eq(invoiceLinks.saleInvoiceId, ticketId)).limit(1)
        if (link.length > 0) return res.status(400).json({ error: `Ticket ${ticketId.slice(0, 8)} ya fue facturado` })

        tickets.push(ticket)
      }

      // Get customer
      const [customer] = await db.select().from(customers).where(eq(customers.id, customer_id))
      if (!customer) return res.status(400).json({ error: 'Cliente no encontrado' })

      // Aggregate totals
      let totalSubtotal = 0
      let totalTax = 0
      let totalAmount = 0

      for (const ticket of tickets) {
        totalSubtotal += Number(ticket.subtotal)
        totalTax += Number(ticket.tax)
        totalAmount += Number(ticket.total)
      }

      // Create consolidated CFDI invoice
      const [cfdi] = await db.insert(invoices).values({
        series: 'FC',
        customerId: customer_id,
        type: 'I',
        status: 'draft',
        useCfdi: use_cfdi || 'G03',
        paymentMethod: 'PUE',
        paymentForm: payment_form || '99',
        subtotal: String(totalSubtotal.toFixed(2)),
        tax: String(totalTax.toFixed(2)),
        total: String(totalAmount.toFixed(2)),
        source: 'cfdi',
        observations: notes || `Factura consolidada de ${ticket_ids.length} tickets`,
      }).returning()

      // Collect all items from all tickets and insert as CFDI items
      for (const ticket of tickets) {
        const ticketItems = await db.select().from(invoiceItems)
          .where(eq(invoiceItems.invoiceId, ticket.id))

        for (const item of ticketItems) {
          await db.insert(invoiceItems).values({
            invoiceId: cfdi.id,
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            amount: item.amount,
            discount: item.discount,
            productId: item.productId,
            satCode: item.satCode,
            satUnit: item.satUnit,
            taxRate: item.taxRate,
          })
        }

        // Create invoice link
        await db.insert(invoiceLinks).values({
          saleInvoiceId: ticket.id,
          cfdiInvoiceId: cfdi.id,
        })
      }

      const io = req.app.get('io')
      if (io) io.emit('invoice:consolidated', { invoice: cfdi, ticketCount: ticket_ids.length })

      res.status(201).json({ data: cfdi })
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Error consolidating invoices' })
    }
  }
)

export default router
