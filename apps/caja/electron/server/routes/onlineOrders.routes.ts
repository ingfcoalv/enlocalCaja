import { Router } from 'express'
import type { Pool } from 'pg'
import type { SyncEngine } from '@enlocal/core-sync'
import { authMiddleware } from '@enlocal/core-server'

const ACTIVE_STATUSES = ['new', 'pending', 'preparing', 'ready_for_pickup', 'ready', 'waiting_driver', 'in_transit', 'delivery_failed']
const ALLOWED_STATUSES = ['preparing', 'ready', 'ready_for_pickup', 'waiting_driver', 'in_transit', 'delivered', 'delivery_failed', 'cancelled']

const VALID_TRANSITIONS: Record<string, string[]> = {
  new: ['preparing', 'cancelled'],
  pending: ['preparing', 'cancelled'],
  preparing: ['ready', 'ready_for_pickup', 'cancelled'],
  ready: ['waiting_driver', 'delivered', 'cancelled'],
  ready_for_pickup: ['delivered', 'cancelled'],
  waiting_driver: ['in_transit', 'delivered', 'cancelled'],
  in_transit: ['delivered', 'delivery_failed', 'cancelled'],
  delivery_failed: ['preparing', 'cancelled'],
}

const ITEMS_JSON_AGG = `
  COALESCE(
    json_agg(
      json_build_object(
        'id', ii.id,
        'product_id', ii.product_id,
        'description', ii.description,
        'quantity', ii.quantity,
        'unit_price', ii.unit_price,
        'amount', ii.amount,
        'product_name', p.name,
        'special_instructions', ii.special_instructions,
        'modifier_selections', ii.modifier_selections
      ) ORDER BY ii.sort_order
    ) FILTER (WHERE ii.id IS NOT NULL),
    '[]'::json
  ) as items`

export function createOnlineOrderRoutes(pool: Pool) {
  const router = Router()

  router.use(authMiddleware as any)

  // GET /api/online-orders — list active online orders
  router.get('/', async (_req, res) => {
    try {
      const placeholders = ACTIVE_STATUSES.map((_, i) => `$${i + 1}`).join(', ')
      const { rows } = await pool.query(
        `SELECT i.*, ${ITEMS_JSON_AGG}
         FROM invoices i
         LEFT JOIN invoice_items ii ON ii.invoice_id = i.id
         LEFT JOIN products p ON ii.product_id = p.id
         WHERE i.source = 'online' AND i.cloud_status IN (${placeholders})
         GROUP BY i.id
         ORDER BY i.created_at DESC`,
        ACTIVE_STATUSES,
      )
      res.json(rows)
    } catch (err: any) {
      console.error('[online-orders] GET error:', err)
      res.status(500).json({ error: err.message })
    }
  })

  // GET /api/online-orders/:id/receipt — generate printable receipt text for an online order
  router.get('/:id/receipt', async (req, res) => {
    try {
      const { id } = req.params

      // Fetch invoice with all online-specific fields
      const { rows: invoiceRows } = await pool.query(
        `SELECT * FROM invoices WHERE id = $1 AND source = 'online'`,
        [id],
      )
      const invoice = invoiceRows[0]
      if (!invoice) {
        return res.status(404).json({ error: 'Online order not found' })
      }

      // Fetch items
      const { rows: items } = await pool.query(
        `SELECT ii.*, p.name as product_name
         FROM invoice_items ii
         LEFT JOIN products p ON ii.product_id = p.id
         WHERE ii.invoice_id = $1
         ORDER BY ii.sort_order`,
        [id],
      )

      // Generate receipt text
      const W = 40
      const SEP = '-'.repeat(W)
      const DSEP = '='.repeat(W)
      const lines: string[] = []

      const center = (t: string) => {
        if (t.length >= W) return t.substring(0, W)
        return ' '.repeat(Math.floor((W - t.length) / 2)) + t
      }
      const padR = (s: string, n: number) => s.length >= n ? s.substring(0, n) : s + ' '.repeat(n - s.length)
      const padL = (s: string, n: number) => s.length >= n ? s.substring(0, n) : ' '.repeat(n - s.length) + s
      const money = (v: number) => `$${v.toFixed(2)}`

      // Header
      lines.push(center('PEDIDO ONLINE'))
      lines.push(SEP)

      // Order number
      if (invoice.order_number) {
        lines.push(`Pedido: ${invoice.order_number}`)
      } else if (invoice.cloud_id) {
        lines.push(`Pedido: #${invoice.cloud_id.slice(-6).toUpperCase()}`)
      }

      lines.push(`Fecha: ${new Date(invoice.created_at).toLocaleString('es-MX')}`)

      // Delivery type
      const isPickup = (invoice.delivery_type_cloud || 'pickup') === 'pickup'
      lines.push(`Tipo: ${isPickup ? 'RECOGER EN TIENDA' : 'ENTREGA A DOMICILIO'}`)

      lines.push(SEP)

      // Items header
      lines.push(padR('Descripcion', 20) + padL('Cant', 6) + padL('Importe', 14))
      lines.push(SEP)

      // Items
      for (const item of items) {
        const desc = (item.product_name || item.description || 'Producto').substring(0, 20)
        const qty = parseFloat(item.quantity || '1')
        const amount = parseFloat(item.amount || '0')
        const unitPrice = parseFloat(item.unit_price || '0')

        lines.push(padR(desc, 20) + padL(String(qty), 6) + padL(money(amount), 14))

        if (qty > 1) {
          lines.push(`  ${money(unitPrice)} c/u`)
        }

        // Modifier selections
        const modifiers = item.modifier_selections
        if (Array.isArray(modifiers) && modifiers.length > 0) {
          for (const mod of modifiers) {
            const selected = Array.isArray(mod.selected) ? mod.selected.join(', ') : ''
            if (selected) {
              const modPrice = mod.price ? ` +${money(mod.price)}` : ''
              lines.push(`  + ${selected}${modPrice}`)
            }
          }
        }

        // Special instructions
        if (item.special_instructions) {
          lines.push(`  * ${item.special_instructions}`)
        }
      }

      lines.push(SEP)

      // Totals
      const subtotal = parseFloat(invoice.subtotal || '0')
      const tax = parseFloat(invoice.tax || '0')
      const total = parseFloat(invoice.total || '0')

      lines.push(padR('Subtotal:', 26) + padL(money(subtotal), 14))
      if (tax > 0) {
        lines.push(padR('IVA:', 26) + padL(money(tax), 14))
      }
      lines.push(DSEP)
      lines.push(padR('TOTAL:', 26) + padL(money(total), 14))
      lines.push(DSEP)

      // Payment status highlight
      const paymentStatus = invoice.payment_status_cloud || 'pending'
      const paymentMethod = invoice.payment_method_cloud || ''
      lines.push('')
      if (paymentStatus === 'paid') {
        lines.push(center('*** YA PAGADO ***'))
      } else {
        lines.push(center('*** COBRAR AL CLIENTE ***'))
        if (paymentMethod) {
          lines.push(center(getPaymentMethodLabel(paymentMethod)))
        }
      }

      // ─── Datos para el repartidor ───────────────
      lines.push('')
      lines.push(SEP)
      lines.push(center('DATOS DE ENTREGA'))
      lines.push(SEP)

      lines.push(`Cliente: ${invoice.customer_name || 'N/A'}`)
      if (invoice.customer_phone) {
        lines.push(`Tel: ${invoice.customer_phone}`)
      }
      if (invoice.delivery_address) {
        // Wrap long addresses
        const addr = invoice.delivery_address
        if (addr.length > W) {
          const words = addr.split(' ')
          let line = 'Dir: '
          for (const word of words) {
            if (line.length + word.length + 1 > W) {
              lines.push(line)
              line = '     ' + word
            } else {
              line += (line.length > 5 ? ' ' : '') + word
            }
          }
          if (line.trim()) lines.push(line)
        } else {
          lines.push(`Dir: ${addr}`)
        }
      }

      // Payment method for driver
      if (paymentStatus !== 'paid' && paymentMethod) {
        lines.push('')
        lines.push(`Metodo pago: ${getPaymentMethodLabel(paymentMethod)}`)
        if (paymentMethod.startsWith('card')) {
          lines.push('>> LLEVAR TERMINAL <<')
        }
      }

      // Notes (important for driver — e.g. "llevar cambio de 500")
      // Parse notes from observations (format: "Pedido: XXX | notes text")
      const rawObs = invoice.observations || ''
      const obsParts = rawObs.split(' | ').filter((p: string) => !p.startsWith('Pedido:'))
      const notesText = obsParts.length > 0 ? obsParts.join(' | ') : ''
      if (notesText) {
        lines.push('')
        lines.push(`Notas: ${notesText}`)
      }

      lines.push('')
      lines.push(SEP)
      lines.push(center('Pedido Online - todoEnLocal'))
      lines.push('')

      res.type('text/plain').send(lines.join('\n'))
    } catch (err: any) {
      console.error('[online-orders] Receipt error:', err)
      res.status(500).json({ error: err.message })
    }
  })

  // PUT /api/online-orders/:id/status — change cloud_status
  router.put('/:id/status', async (req, res) => {
    try {
      const { id } = req.params
      const { status } = req.body

      if (!status || !ALLOWED_STATUSES.includes(status)) {
        return res.status(400).json({ error: `Invalid status. Allowed: ${ALLOWED_STATUSES.join(', ')}` })
      }

      // Fetch the current invoice
      const { rows: invoiceRows } = await pool.query(
        'SELECT * FROM invoices WHERE id = $1 AND source = $2',
        [id, 'online'],
      )
      const invoice = invoiceRows[0]
      if (!invoice) {
        return res.status(404).json({ error: 'Online order not found' })
      }

      // Validate status transition
      const currentStatus = invoice.cloud_status || 'new'
      const validNextStatuses = VALID_TRANSITIONS[currentStatus]
      if (!validNextStatuses || !validNextStatuses.includes(status)) {
        return res.status(400).json({
          error: `Invalid transition from '${currentStatus}' to '${status}'`,
        })
      }

      // Update cloud_status
      await pool.query(
        'UPDATE invoices SET cloud_status = $1, updated_at = now() WHERE id = $2',
        [status, id],
      )

      // Send status to cloud via WebSocket
      const syncEngine = req.app.get('syncEngine') as SyncEngine | undefined
      if (syncEngine && invoice.cloud_id) {
        syncEngine.sendOrderStatus({
          order_id: invoice.cloud_id,
          status,
        })
      }

      // If delivered: mark as paid + create payment + deduct inventory
      if (status === 'delivered') {
        await pool.query(
          "UPDATE invoices SET status = 'paid', updated_at = now() WHERE id = $1",
          [id],
        )

        // Determine payment method from cloud payment_method
        const cloudMethod = invoice.payment_method_cloud || ''
        let payMethod = 'transfer'
        if (cloudMethod.startsWith('cash')) payMethod = 'cash'
        else if (cloudMethod.startsWith('card')) payMethod = 'card'

        try {
          await pool.query(
            `INSERT INTO payments (invoice_id, method, amount, reference, user_id)
             VALUES ($1, $2, $3, $4, $5)`,
            [id, payMethod, invoice.total, 'Pago online marketplace', invoice.created_by],
          )
        } catch (payErr: any) {
          console.error('[online-orders] Payment insert error (non-critical):', payErr.message)
        }

        // Deduct inventory
        const { rows: orderItems } = await pool.query(
          'SELECT product_id, quantity FROM invoice_items WHERE invoice_id = $1',
          [id],
        )
        for (const item of orderItems) {
          if (!item.product_id) continue
          try {
            await pool.query(
              `INSERT INTO stock_movements (ingredient_id, type, quantity, reference, notes, user_id)
               VALUES ($1, 'out', $2, $3, $4, $5)`,
              [item.product_id, String(item.quantity), 'ONLINE-' + (invoice.cloud_id || id), 'Pedido online marketplace', invoice.created_by],
            )
            await pool.query(
              'UPDATE products SET current_stock = current_stock - $1, updated_at = now() WHERE id = $2',
              [String(item.quantity), item.product_id],
            )
          } catch {
            // Non-critical
          }
        }
      }

      // Fetch updated order with items
      const { rows: updatedRows } = await pool.query(
        `SELECT i.*, ${ITEMS_JSON_AGG}
         FROM invoices i
         LEFT JOIN invoice_items ii ON ii.invoice_id = i.id
         LEFT JOIN products p ON ii.product_id = p.id
         WHERE i.id = $1
         GROUP BY i.id`,
        [id],
      )

      const io = req.app.get('io')
      if (io) {
        io.emit('online-order:updated', updatedRows[0])
      }

      res.json(updatedRows[0])
    } catch (err: any) {
      console.error('[online-orders] PUT status error:', err)
      res.status(500).json({ error: err.message })
    }
  })

  return router
}

function getPaymentMethodLabel(method: string): string {
  switch (method) {
    case 'cash_on_pickup': return 'Efectivo al recoger'
    case 'card_on_pickup': return 'Tarjeta al recoger'
    case 'cash_on_delivery': return 'Efectivo contra entrega'
    case 'card_on_delivery': return 'Tarjeta contra entrega'
    default: return method
  }
}
