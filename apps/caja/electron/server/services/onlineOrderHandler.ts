import type { Pool } from 'pg'
import type { Server as SocketServer } from 'socket.io'
import type { SyncEngine } from '@enlocal/core-sync'
import { v4 as uuidv4 } from 'uuid'

/**
 * Handle an incoming online order from the marketplace via WebSocket.
 * Adapted from comanda-pro handleNewOrder — uses invoices/invoice_items tables.
 *
 * Cloud sends order data with:
 *   - items[].subtotal (NOT amount) = unit_price * quantity
 *   - No separate tax field — calculate as total - subtotal
 *   - idempotency_key for envelope messages (order.new)
 *   - order_number for human-readable reference
 */
export async function handleIncomingOnlineOrder(
  pool: Pool,
  orderData: Record<string, any>,
  io: SocketServer,
  _syncEngine: SyncEngine,
): Promise<void> {
  if (!orderData || !orderData.id) return

  try {
    // Dedup: skip if this cloud order was already received (by cloud_id)
    const { rows: existingRows } = await pool.query(
      'SELECT id FROM invoices WHERE cloud_id = $1',
      [orderData.id],
    )
    if (existingRows[0]) {
      console.log(`[online-order] Already exists (cloud: ${orderData.id}), skipping`)
      return
    }

    const invoiceId = uuidv4()
    const now = new Date().toISOString()

    // Find admin/owner user to assign the order
    const { rows: ownerRows } = await pool.query(
      "SELECT id FROM users WHERE role = 'admin' AND active = true LIMIT 1",
    )
    let userId = ownerRows[0]?.id
    if (!userId) {
      const { rows: anyUserRows } = await pool.query(
        'SELECT id FROM users WHERE active = true LIMIT 1',
      )
      userId = anyUserRows[0]?.id
    }
    if (!userId) {
      console.error('[online-order] No active user found to assign online order')
      return
    }

    const customerName = orderData.customer_name || 'Pedido Online'
    const customerPhone = orderData.customer_phone || null
    const deliveryType = orderData.delivery_type || 'pickup'
    const orderNumber = orderData.order_number || null

    // Build observations from notes + special instructions
    const parts: string[] = []
    if (orderNumber) parts.push(`Pedido: ${orderNumber}`)
    if (orderData.notes) parts.push(orderData.notes)
    if (orderData.delivery_address) parts.push(`Direccion: ${orderData.delivery_address}`)
    if (orderData.payment_method) parts.push(`Pago: ${orderData.payment_method}`)
    const observations = parts.length > 0 ? parts.join(' | ') : 'Pedido Online'

    // Resolve items — cloud uses item.subtotal (NOT item.amount)
    const resolvedItems: Array<{
      id: string
      productId: string | null
      description: string
      qty: number
      unitPrice: number
      amount: number
      specialInstructions: string | null
    }> = []

    for (const item of orderData.items || []) {
      let productId: string | null = null
      let productName: string | null = null
      if (item.product_id) {
        const { rows: prodRows } = await pool.query(
          'SELECT id, name FROM products WHERE cloud_id = $1',
          [item.product_id],
        )
        productId = prodRows[0]?.id || null
        productName = prodRows[0]?.name || null
      }

      const qty = item.quantity || 1
      const unitPrice = item.unit_price || 0
      // Cloud sends "subtotal" (= unit_price * qty), NOT "amount"
      const amount = item.subtotal != null
        ? Number(item.subtotal)
        : item.amount != null
          ? Number(item.amount)
          : Math.round((qty * unitPrice + Number.EPSILON) * 100) / 100

      let description = item.product_name || productName || item.name || 'Producto'
      // Append special instructions if present
      if (item.special_instructions) {
        description += ` (${item.special_instructions})`
      }

      if (!productId) {
        console.warn(`[online-order] Could not resolve product cloud_id: ${item.product_id} — inserting with NULL product_id`)
      }

      resolvedItems.push({
        id: uuidv4(),
        productId,
        description,
        qty,
        unitPrice,
        amount,
        specialInstructions: item.special_instructions || null,
      })
    }

    // Cloud does NOT send tax separately — calculate as total - subtotal
    const subtotal = orderData.subtotal || 0
    const total = orderData.total || 0
    const tax = orderData.tax != null ? orderData.tax : Math.round((total - subtotal + Number.EPSILON) * 100) / 100

    // Transaction: insert invoice + items
    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      const { rowCount } = await client.query(
        `INSERT INTO invoices (
          id, type, status, source, source_type,
          subtotal, tax, total,
          cloud_id, cloud_status, delivery_type_cloud,
          customer_name, customer_phone, observations,
          created_by, created_at, updated_at
        ) VALUES (
          $1, 'I', 'draft', 'online', 'online',
          $2, $3, $4,
          $5, 'new', $6,
          $7, $8, $9,
          $10, $11, $12
        ) ON CONFLICT (cloud_id) WHERE cloud_id IS NOT NULL DO NOTHING`,
        [
          invoiceId, subtotal, tax, total,
          orderData.id, deliveryType,
          customerName, customerPhone, observations,
          userId, now, now,
        ],
      )

      // If ON CONFLICT skipped the insert, abort
      if (rowCount === 0) {
        await client.query('ROLLBACK')
        console.log(`[online-order] Duplicate detected via ON CONFLICT (cloud: ${orderData.id}), skipping`)
        return
      }

      for (const item of resolvedItems) {
        await client.query(
          `INSERT INTO invoice_items (
            id, invoice_id, product_id,
            description, quantity, unit_price, amount,
            sort_order
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [item.id, invoiceId, item.productId, item.description, item.qty, item.unitPrice, item.amount, 0],
        )
      }

      await client.query('COMMIT')
    } catch (txErr) {
      await client.query('ROLLBACK')
      throw txErr
    } finally {
      client.release()
    }

    console.log(`[online-order] Created invoice ${invoiceId} (cloud: ${orderData.id}, order: ${orderNumber || 'N/A'})`)

    // Fetch the full order with items for the socket emission
    const { rows: fullRows } = await pool.query(
      'SELECT * FROM invoices WHERE id = $1',
      [invoiceId],
    )
    const fullOrder = fullRows[0]

    const { rows: items } = await pool.query(
      `SELECT ii.*, p.name as product_name
       FROM invoice_items ii
       LEFT JOIN products p ON ii.product_id = p.id
       WHERE ii.invoice_id = $1
       ORDER BY ii.sort_order`,
      [invoiceId],
    )

    io.emit('online-order:new', {
      ...fullOrder,
      items,
    })
  } catch (err: any) {
    console.error('[online-order] Error handling new order:', err)
  }
}

/**
 * Handle delivery_status_update messages from the marketplace.
 * Sent by drivers when they pick up, transit, or deliver an order.
 *
 * Fields: order_id (cloud UUID), status, delivery_status, order_number, updated_at
 */
export async function handleDeliveryStatusUpdate(
  pool: Pool,
  data: Record<string, any>,
  io: SocketServer,
): Promise<void> {
  const cloudOrderId = data.order_id
  const newStatus = data.status // in_transit, delivered, delivery_failed
  if (!cloudOrderId || !newStatus) return

  try {
    // Find the local invoice by cloud_id
    const { rows } = await pool.query(
      "SELECT id, cloud_status, cloud_id, total, created_by FROM invoices WHERE cloud_id = $1 AND source = 'online'",
      [cloudOrderId],
    )
    const invoice = rows[0]
    if (!invoice) {
      console.warn(`[delivery-status] Invoice not found for cloud order ${cloudOrderId}`)
      return
    }

    // Update cloud_status
    await pool.query(
      'UPDATE invoices SET cloud_status = $1, updated_at = now() WHERE id = $2',
      [newStatus, invoice.id],
    )
    console.log(`[delivery-status] Updated invoice ${invoice.id} cloud_status → ${newStatus} (delivery_status: ${data.delivery_status})`)

    // If delivered: mark as paid + create payment + deduct inventory
    if (newStatus === 'delivered') {
      await pool.query(
        "UPDATE invoices SET status = 'paid', updated_at = now() WHERE id = $1",
        [invoice.id],
      )

      try {
        await pool.query(
          `INSERT INTO payments (invoice_id, method, amount, reference, user_id)
           VALUES ($1, 'transfer', $2, $3, $4)`,
          [invoice.id, invoice.total, 'Pago online marketplace', invoice.created_by],
        )
      } catch (payErr: any) {
        console.error('[delivery-status] Payment insert error (non-critical):', payErr.message)
      }

      // Deduct inventory
      const { rows: items } = await pool.query(
        'SELECT product_id, quantity FROM invoice_items WHERE invoice_id = $1',
        [invoice.id],
      )
      for (const item of items) {
        if (!item.product_id) continue
        try {
          await pool.query(
            `INSERT INTO stock_movements (ingredient_id, type, quantity, reference, notes, user_id)
             VALUES ($1, 'out', $2, $3, $4, $5)`,
            [item.product_id, String(item.quantity), 'ONLINE-' + (invoice.cloud_id || invoice.id), 'Pedido online marketplace', invoice.created_by],
          )
          await pool.query(
            'UPDATE products SET current_stock = current_stock - $1, updated_at = now() WHERE id = $2',
            [String(item.quantity), item.product_id],
          )
        } catch {
          // Non-critical: stock_movements table may not exist
        }
      }
    }

    // Emit socket event to refresh frontend
    const ITEMS_JSON_AGG = `
      COALESCE(
        json_agg(
          json_build_object(
            'id', ii.id, 'product_id', ii.product_id,
            'description', ii.description, 'quantity', ii.quantity,
            'unit_price', ii.unit_price, 'amount', ii.amount,
            'product_name', p.name
          ) ORDER BY ii.sort_order
        ) FILTER (WHERE ii.id IS NOT NULL),
        '[]'::json
      ) as items`
    const { rows: updatedRows } = await pool.query(
      `SELECT i.*, ${ITEMS_JSON_AGG}
       FROM invoices i
       LEFT JOIN invoice_items ii ON ii.invoice_id = i.id
       LEFT JOIN products p ON ii.product_id = p.id
       WHERE i.id = $1
       GROUP BY i.id`,
      [invoice.id],
    )

    io.emit('online-order:updated', updatedRows[0])
  } catch (err: any) {
    console.error('[delivery-status] Error handling delivery status update:', err)
  }
}
