import { Router } from 'express'
import type { Pool } from 'pg'
import type { SyncEngine } from '@enlocal/core-sync'
import { authMiddleware } from '@enlocal/core-server'

const ACTIVE_STATUSES = ['new', 'pending', 'preparing', 'ready_for_pickup', 'ready', 'waiting_driver', 'in_transit', 'delivery_failed']
const ALLOWED_STATUSES = ['preparing', 'ready', 'ready_for_pickup', 'waiting_driver', 'in_transit', 'delivered', 'delivery_failed', 'cancelled']

// Bug 19 fix: valid status transitions
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
        'product_name', p.name
      ) ORDER BY ii.sort_order
    ) FILTER (WHERE ii.id IS NOT NULL),
    '[]'::json
  ) as items`

export function createOnlineOrderRoutes(pool: Pool) {
  const router = Router()

  // Bug 11 fix: require authentication
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

      // Bug 19 fix: validate status transition
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

        // Create payment record (Bug 4 fix: wrapped in try/catch)
        try {
          await pool.query(
            `INSERT INTO payments (invoice_id, method, amount, reference, user_id)
             VALUES ($1, 'transfer', $2, $3, $4)`,
            [id, invoice.total, 'Pago online marketplace', invoice.created_by],
          )
        } catch (payErr: any) {
          console.error('[online-orders] Payment insert error (non-critical):', payErr.message)
        }

        // Deduct inventory
        const { rows: items } = await pool.query(
          'SELECT product_id, quantity FROM invoice_items WHERE invoice_id = $1',
          [id],
        )
        for (const item of items) {
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
            // Non-critical: stock_movements table may not exist if mod-inventory not loaded
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
