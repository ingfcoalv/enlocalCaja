import { Router } from 'express'
import type { AuthenticatedRequest } from '@enlocal/core-server'
import { requirePermission } from '@enlocal/core-server'
import { customers } from '@enlocal/core-db'
import { eq } from 'drizzle-orm'
import { listSales, getSalesDashboard, getSalesSummary, getSaleDetail } from '../services/sales.service'
import { buildSalePayload } from '@enlocal/core-sync'
import { getCurrentShift } from '../services/cashShifts.service'
import { createReturn, listReturns } from '../services/returns.service'

const router = Router()

// POST / — create a quick sale (invoice + items + payments[])
router.post(
  '/',
  requirePermission('pos.write') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const pool = req.app.get('pool')
      const { items, customerId, payments, paymentMethod, subtotal, tax, total, cashTendered, shiftId, observations } = req.body

      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'Se requiere al menos un producto' })
      }

      // 2.5 — Validate item quantities, prices and discounts
      const maxDiscountPct = parseFloat(String((req as AuthenticatedRequest).user?.maxDiscountPercent ?? 0))
      for (const item of items) {
        if (!item.quantity || item.quantity <= 0) {
          return res.status(400).json({ error: 'La cantidad de cada producto debe ser mayor a 0' })
        }
        if (item.price == null || item.price < 0) {
          return res.status(400).json({ error: `Precio inválido para "${item.name || 'producto'}". Debe ser >= 0` })
        }
        if (item.discount != null && item.discount < 0) {
          return res.status(400).json({ error: `Descuento inválido para "${item.name || 'producto'}". No puede ser negativo` })
        }
        if (item.discount != null && item.discount > item.price * item.quantity) {
          return res.status(400).json({ error: `Descuento excede el subtotal para "${item.name || 'producto'}"` })
        }
        // Validate discount percentage against user's maxDiscountPercent
        if (item.discount != null && item.discount > 0) {
          const lineTotal = (item.price ?? 0) * (item.quantity ?? 0)
          if (lineTotal > 0) {
            const discountPct = (item.discount / lineTotal) * 100
            if (discountPct > maxDiscountPct + 0.01) {
              return res.status(400).json({
                error: `Descuento de ${discountPct.toFixed(1)}% en "${item.name || 'producto'}" excede tu límite autorizado de ${maxDiscountPct}%`,
              })
            }
          }
        }
      }

      // Reject explicitly empty payments array
      if (payments && Array.isArray(payments) && payments.length === 0) {
        return res.status(400).json({ error: 'Se requiere al menos un metodo de pago' })
      }

      // Normalize payments: support both legacy single paymentMethod and new payments[] array
      let paymentEntries: { method: string; amount: number; reference?: string }[]
      let isLegacyPayment = false
      if (payments && Array.isArray(payments) && payments.length > 0) {
        paymentEntries = payments
      } else {
        // Legacy single-method payment — amount will be corrected after server-side recalculation
        paymentEntries = [{ method: paymentMethod || 'cash', amount: total || 0 }]
        isLegacyPayment = true
      }

      // Check if any payment uses credit
      const hasCredit = paymentEntries.some((p) => p.method === 'credit')
      const creditAmount = paymentEntries
        .filter((p) => p.method === 'credit')
        .reduce((sum, p) => sum + (p.amount || 0), 0)
      const nonCreditAmount = paymentEntries
        .filter((p) => p.method !== 'credit')
        .reduce((sum, p) => sum + (p.amount || 0), 0)
      const allCredit = hasCredit && nonCreditAmount === 0

      // Validate credit: require customerId and check credit limit
      let customer: { id: string; creditLimit: string | null; creditBalance: string | null; creditDays: number | null; name: string | null } | undefined
      if (hasCredit) {
        if (!customerId) {
          return res.status(400).json({ error: 'Se requiere un cliente para ventas a credito' })
        }

        // Fetch customer credit limit and current balance
        const customerResult = await db
          .select({ id: customers.id, creditLimit: customers.creditLimit, creditBalance: customers.creditBalance, creditDays: customers.creditDays, name: customers.name })
          .from(customers)
          .where(eq(customers.id, customerId))
          .limit(1)

        if (!customerResult.length) {
          return res.status(400).json({ error: 'Cliente no encontrado' })
        }

        customer = customerResult[0]!
        const creditLimit = parseFloat(customer!.creditLimit ?? '0')
        const currentOutstanding = parseFloat(customer!.creditBalance ?? '0')

        if (currentOutstanding + creditAmount > creditLimit) {
          return res.status(400).json({
            error: `Limite de credito excedido. Disponible: $${(creditLimit - currentOutstanding).toFixed(2)}`,
          })
        }
      }

      // Determine invoice status and payment method code
      let invoiceStatus: string
      let invoicePaymentMethod: string
      if (allCredit) {
        invoiceStatus = 'credit'
        invoicePaymentMethod = 'PPD'
      } else if (hasCredit) {
        invoiceStatus = 'partial'
        invoicePaymentMethod = 'PPD'
      } else {
        invoiceStatus = 'paid'
        invoicePaymentMethod = 'PUE'
      }

      // Determine paymentForm for non-credit (first non-credit payment method)
      const firstNonCredit = paymentEntries.find((p) => p.method !== 'credit')
      const paymentFormMap: Record<string, string> = {
        cash: '01',
        card: '04',
        transfer: '03',
      }
      const paymentForm = firstNonCredit ? (paymentFormMap[firstNonCredit.method] || '99') : '99'

      // Recalculate totals server-side from item prices (net/tax-included) minus discounts
      let calcSubtotal = 0
      let calcTax = 0
      let calcTotal = 0
      for (const item of items) {
        const lineGross = (item.price ?? 0) * (item.quantity ?? 0)
        const discountAmt = item.discount ?? 0
        const lineNet = lineGross - discountAmt
        const taxRate = item.taxRate ?? 0.16
        const base = taxRate > 0 ? lineNet / (1 + taxRate) : lineNet
        calcSubtotal += base
        calcTax += (lineNet - base)
        calcTotal += lineNet
      }

      // Correct legacy payment amount to match recalculated total
      if (isLegacyPayment && paymentEntries.length === 1) {
        paymentEntries[0].amount = calcTotal
      }

      // FIX 2: Validate that payments cover the total (except credit-only sales)
      if (!allCredit) {
        const totalPayments = paymentEntries.reduce((sum, p) => sum + (p.amount || 0), 0)
        if (totalPayments < calcTotal - 0.01) {
          return res.status(400).json({
            error: `Pago insuficiente. Total: $${calcTotal.toFixed(2)}, pagado: $${totalPayments.toFixed(2)}`,
          })
        }
      }

      // Derive register_id from the current shift
      let saleRegisterId: string | null = null
      try {
        const currentUserShift = await getCurrentShift(db, req.user?.id ?? 'system')
        if (currentUserShift?.registerId) {
          saleRegisterId = currentUserShift.registerId
        }
      } catch { /* non-critical */ }

      // FIX 1: Wrap all DB writes in a transaction using a dedicated client
      const client = await pool.connect()
      try {
        await client.query('BEGIN')

        // 1. Create invoice
        const invoiceResult = await client.query(
          `INSERT INTO invoices (customer_id, type, status, payment_method, payment_form, subtotal, tax, total, source, observations, register_id)
           VALUES ($1, 'I', $2, $3, $4, $5, $6, $7, 'pos', $8, $9)
           RETURNING *`,
          [
            customerId || null,
            invoiceStatus,
            invoicePaymentMethod,
            paymentForm,
            calcSubtotal.toFixed(2),
            calcTax.toFixed(2),
            calcTotal.toFixed(2),
            observations || null,
            saleRegisterId,
          ]
        )
        const invoice = invoiceResult.rows[0]

        // Generate human-readable ticket number (YYYYMMDD-NNNN)
        let ticketNumber: string | null = null
        try {
          const now = new Date()
          const datePrefix = now.getFullYear().toString() +
            String(now.getMonth() + 1).padStart(2, '0') +
            String(now.getDate()).padStart(2, '0')
          const tnResult = await client.query(
            `UPDATE invoices SET ticket_number = (
              SELECT $1 || '-' || LPAD(
                (COALESCE(MAX(CAST(SPLIT_PART(ticket_number, '-', 2) AS INTEGER)), 0) + 1)::text,
                4, '0'
              )
              FROM invoices WHERE ticket_number LIKE $2 FOR UPDATE
            ) WHERE id = $3 RETURNING ticket_number`,
            [datePrefix, datePrefix + '-%', invoice.id]
          )
          ticketNumber = tnResult.rows[0]?.ticket_number ?? null
        } catch { /* non-critical */ }

        // 2. Insert invoice items (store base price without tax, apply discount)
        for (const item of items) {
          const taxRate = item.taxRate ?? 0.16
          const basePrice = taxRate > 0 ? item.price / (1 + taxRate) : item.price
          const lineGross = item.price * item.quantity
          const discountAmt = item.discount ?? 0
          const lineNet = lineGross - discountAmt
          const baseAmount = taxRate > 0 ? lineNet / (1 + taxRate) : lineNet
          await client.query(
            `INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, amount, discount, product_id, tax_rate)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
              invoice.id,
              item.name,
              String(item.quantity),
              basePrice.toFixed(2),
              baseAmount.toFixed(2),
              discountAmt > 0 ? discountAmt.toFixed(2) : '0',
              item.productId || null,
              String(taxRate),
            ]
          )
        }

        // 2b. Deduct inventory for POS sales (customer takes product immediately)
        for (const item of items) {
          if (!item.productId) continue
          try {
            await client.query(
              `INSERT INTO stock_movements (ingredient_id, type, quantity, reference, notes, user_id)
               VALUES ($1, 'out', $2, $3, $4, $5)`,
              [
                item.productId,
                String(item.quantity),
                'POS-' + (invoice.series || '') + (invoice.folio || invoice.id),
                'Venta POS',
                req.user?.id || null,
              ]
            )
            await client.query(
              `UPDATE products SET current_stock = current_stock - $1, updated_at = now() WHERE id = $2`,
              [String(item.quantity), item.productId]
            )
          } catch {
            // Non-critical: if stock_movements table doesn't exist (mod-inventory not loaded), sale continues
          }
        }

        // 3. Insert payment records
        for (const payment of paymentEntries) {
          await client.query(
            `INSERT INTO payments (invoice_id, method, amount, reference, shift_id, user_id, customer_id, register_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
              invoice.id,
              payment.method,
              payment.amount || 0,
              payment.reference || null,
              shiftId || null,
              req.user?.id || null,
              payment.method === 'credit' ? customerId : null,
              saleRegisterId,
            ]
          )
        }

        // 4. Create receivable and recalculate credit balance for credit sales
        if (hasCredit && customerId) {
          const creditDays = customer?.creditDays || 30
          const dueDate = new Date()
          dueDate.setDate(dueDate.getDate() + creditDays)

          await client.query(
            `INSERT INTO receivables (customer_id, ticket_id, original_amount, balance, issued_date, due_date, status)
             VALUES ($1, $2, $3, $4, now(), $5, 'current')`,
            [customerId, invoice.id, creditAmount, creditAmount, dueDate]
          )

          // Recalculate credit_balance from receivables
          const balResult = await client.query(
            `SELECT coalesce(sum(balance), 0) as total FROM receivables
             WHERE customer_id = $1 AND status IN ('current', 'overdue', 'partial')`,
            [customerId]
          )
          await client.query(
            `UPDATE customers SET credit_balance = $1, updated_at = now() WHERE id = $2`,
            [String(balResult.rows[0]?.total ?? '0'), customerId]
          )
        }

        await client.query('COMMIT')

        // Calculate change for cash payments
        let change = 0
        if (cashTendered) {
          const cashPayment = paymentEntries.find((p) => p.method === 'cash')
          if (cashPayment) {
            change = Math.max(0, cashTendered - cashPayment.amount)
          }
        }

        // 5. Enqueue sale for cloud sync (outside transaction — non-critical)
        try {
          // Resolve product cloud_ids for each item
          const enrichedItems = await Promise.all(
            items.map(async (item: any) => {
              let productCloudId = null
              if (item.productId) {
                const r = await pool.query('SELECT cloud_id FROM products WHERE id = $1', [item.productId])
                productCloudId = r.rows[0]?.cloud_id ?? null
              }
              return { ...item, productCloudId }
            })
          )

          // Resolve cashier cloud_id
          let userCloudId = null
          if (req.user?.id) {
            const ur = await pool.query('SELECT cloud_id FROM users WHERE id = $1', [req.user.id])
            userCloudId = ur.rows[0]?.cloud_id ?? null
          }

          // Resolve register cloud_id
          let registerCloudId = null
          if (saleRegisterId) {
            try {
              const rr = await pool.query('SELECT cloud_id FROM pos_registers WHERE id = $1', [saleRegisterId])
              registerCloudId = rr.rows[0]?.cloud_id ?? null
            } catch { /* table may not exist yet */ }
          }

          const salePayload = buildSalePayload(invoice, enrichedItems, paymentEntries, userCloudId, registerCloudId)
          await pool.query(
            `INSERT INTO sync_queue (id, entity_type, entity_local_id, payload, status)
             VALUES (gen_random_uuid(), 'sale', $1, $2, 'pending')`,
            [invoice.id, JSON.stringify(salePayload)]
          )
        } catch {
          // Non-critical: sale saved locally, sync will retry later
        }

        // 6. Trigger sync engine if available
        try {
          const syncEngine = req.app.get('syncEngine')
          if (syncEngine && typeof syncEngine.triggerSync === 'function') {
            syncEngine.triggerSync()
          }
        } catch {
          // Non-critical
        }

        res.status(201).json({
          id: invoice.id,
          ticketNumber,
          total: invoice.total,
          status: invoice.status,
          paymentMethod: invoice.payment_method,
          change: Math.max(0, change),
        })
      } catch (txErr) {
        await client.query('ROLLBACK')
        throw txErr
      } finally {
        client.release()
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error creating sale' })
    }
  }
)

// GET / — list sales with filters
router.get(
  '/',
  requirePermission('pos.read') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const filters = {
        from: req.query.from as string | undefined,
        to: req.query.to as string | undefined,
        status: req.query.status as string | undefined,
        method: req.query.method as string | undefined,
        q: req.query.q as string | undefined,
        registerId: req.query.registerId as string | undefined,
        page: req.query.page ? parseInt(req.query.page as string, 10) : undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
      }

      const result = await listSales(db, filters)
      res.json(result)
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error listing sales' })
    }
  }
)

// GET /dashboard — daily dashboard
router.get(
  '/dashboard',
  requirePermission('pos.read') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const rawDate = req.query.date as string | undefined
      const date = (!rawDate || rawDate === 'today')
        ? new Date().toISOString().split('T')[0]
        : rawDate

      const registerId = req.query.registerId as string | undefined
      const result = await getSalesDashboard(db, date, registerId)
      res.json(result)
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error loading dashboard' })
    }
  }
)

// GET /summary — period summary
router.get(
  '/summary',
  requirePermission('pos.read') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const from = req.query.from as string
      const to = req.query.to as string

      if (!from || !to) {
        return res.status(400).json({ error: 'Both "from" and "to" query parameters are required' })
      }

      const registerId = req.query.registerId as string | undefined
      const result = await getSalesSummary(db, from, to, registerId)
      res.json(result)
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error loading summary' })
    }
  }
)

// GET /returns — list POS returns
router.get(
  '/returns',
  requirePermission('pos.read') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const pool = req.app.get('pool')
      const filters = {
        from: req.query.from as string | undefined,
        to: req.query.to as string | undefined,
        page: req.query.page ? parseInt(req.query.page as string, 10) : undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
      }
      const result = await listReturns(pool, filters)
      res.json(result)
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error listing returns' })
    }
  }
)

// POST /:id/return — create a POS return (refund items from a sale)
router.post(
  '/:id/return',
  requirePermission('pos.write') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const pool = req.app.get('pool')
      const { id } = req.params
      const { items, reason, notes } = req.body

      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'Se requiere al menos un articulo para devolver' })
      }
      if (!reason) {
        return res.status(400).json({ error: 'Se requiere una razon para la devolucion' })
      }

      for (const item of items) {
        if (!item.quantity || item.quantity <= 0) {
          return res.status(400).json({ error: 'La cantidad de cada articulo debe ser mayor a 0' })
        }
      }

      const userId = req.user?.id ?? 'system'
      let registerId: string | null = null
      try {
        const shift = await getCurrentShift(db, userId)
        registerId = shift?.registerId ?? null
      } catch { /* non-critical */ }

      const result = await createReturn(db, pool, {
        invoiceId: id,
        items,
        reason,
        notes,
        userId,
        registerId,
      })

      res.status(201).json({ data: result })
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error procesando devolucion' })
    }
  }
)

// GET /:id — get full sale detail (must be AFTER /dashboard and /summary to avoid capturing those as :id)
router.get(
  '/:id',
  requirePermission('pos.read') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const pool = req.app.get('pool')
      const { id } = req.params

      // Avoid matching non-UUID routes like "dashboard" or "summary"
      if (!id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        return res.status(400).json({ error: 'Invalid sale ID' })
      }

      const result = await getSaleDetail(db, pool, id)
      if (!result) {
        return res.status(404).json({ error: 'Venta no encontrada' })
      }

      res.json(result)
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error fetching sale detail' })
    }
  }
)

export default router
