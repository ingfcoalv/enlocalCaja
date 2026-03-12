import type { Pool } from 'pg'
import type { Server as SocketServer } from 'socket.io'
import type { SyncEngine } from '@enlocal/core-sync'
import { v4 as uuidv4 } from 'uuid'

/**
 * Handle an incoming online order from the marketplace via WebSocket.
 *
 * Cloud sends order data with:
 *   - items[].subtotal (NOT amount) = unit_price * quantity
 *   - payment_method: cash_on_pickup | card_on_pickup | cash_on_delivery | card_on_delivery
 *   - payment_status: pending | paid
 *   - items[].modifier_selections: array of modifier objects
 *   - items[].special_instructions: per-item notes
 *   - order_number for human-readable reference
 */
export async function handleIncomingOnlineOrder(
  pool: Pool,
  orderData: Record<string, any>,
  io: SocketServer,
  _syncEngine: SyncEngine,
): Promise<void> {
  if (!orderData || !orderData.id) return

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // Dedup: skip if this cloud order was already received (by cloud_id)
    const { rows: existingRows } = await client.query(
      'SELECT id FROM invoices WHERE cloud_id = $1',
      [orderData.id],
    )
    if (existingRows[0]) {
      await client.query('ROLLBACK')
      console.log(`[online-order] Already exists (cloud: ${orderData.id}), skipping`)
      return
    }

    const invoiceId = uuidv4()
    const now = new Date().toISOString()

    // Find admin/owner user to assign the order
    const { rows: ownerRows } = await client.query(
      "SELECT id FROM users WHERE role = 'admin' AND active = true LIMIT 1",
    )
    let userId = ownerRows[0]?.id
    if (!userId) {
      const { rows: anyUserRows } = await client.query(
        'SELECT id FROM users WHERE active = true LIMIT 1',
      )
      userId = anyUserRows[0]?.id
    }
    if (!userId) {
      await client.query('ROLLBACK')
      console.error('[online-order] No active user found to assign online order')
      return
    }

    const customerName = orderData.customer_name || 'Pedido Online'
    const customerPhone = orderData.customer_phone || null
    const deliveryType = orderData.delivery_type || 'pickup'
    const orderNumber = orderData.order_number || null
    const paymentMethodCloud = orderData.payment_method || null
    const paymentStatusCloud = orderData.payment_status || 'pending'
    const deliveryAddress = orderData.delivery_address || null

    // Build observations from notes (keep it concise — structured data now in columns)
    const parts: string[] = []
    if (orderNumber) parts.push(`Pedido: ${orderNumber}`)
    if (orderData.notes) parts.push(orderData.notes)
    const observations = parts.length > 0 ? parts.join(' | ') : 'Pedido Online'

    // Resolve items — cloud uses item.subtotal (NOT item.amount)
    const items = Array.isArray(orderData.items) ? orderData.items : []

    const resolvedItems: Array<{
      id: string
      productId: string | null
      description: string
      qty: number
      unitPrice: number
      amount: number
      specialInstructions: string | null
      modifierSelections: any[] | null
    }> = []

    for (const item of items) {
      let productId: string | null = null
      let productName: string | null = null
      if (item.product_id) {
        const { rows: prodRows } = await client.query(
          'SELECT id, name FROM products WHERE cloud_id = $1',
          [item.product_id],
        )
        productId = prodRows[0]?.id || null
        productName = prodRows[0]?.name || null
      }

      const qty = Number.isFinite(Number(item.quantity)) ? Number(item.quantity) || 1 : 1
      const unitPrice = Number.isFinite(Number(item.unit_price)) ? Number(item.unit_price) : 0
      const rawSubtotal = item.subtotal != null
        ? Number(item.subtotal)
        : item.amount != null
          ? Number(item.amount)
          : Math.round((qty * unitPrice + Number.EPSILON) * 100) / 100
      const amount = Number.isFinite(rawSubtotal) ? rawSubtotal : 0

      // Build description: product name + modifiers summary
      let description = item.product_name || productName || item.name || 'Producto'

      // Append modifier selections summary to description for readability
      const modifiers = Array.isArray(item.modifier_selections) ? item.modifier_selections : null
      if (modifiers && modifiers.length > 0) {
        const modSummary = modifiers
          .map((m: any) => {
            const selected = Array.isArray(m.selected) ? m.selected.join(', ') : ''
            return selected
          })
          .filter(Boolean)
          .join('; ')
        if (modSummary) description += ` [${modSummary}]`
      }

      // Append special instructions
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
        modifierSelections: modifiers,
      })
    }

    // Cloud does NOT send tax separately — calculate as total - subtotal
    const subtotal = Number.isFinite(Number(orderData.subtotal)) ? Number(orderData.subtotal) : 0
    const total = Number.isFinite(Number(orderData.total)) ? Number(orderData.total) : 0
    const rawTax = orderData.tax != null ? Number(orderData.tax) : Math.round((total - subtotal + Number.EPSILON) * 100) / 100
    const tax = Number.isFinite(rawTax) ? rawTax : 0

    const { rowCount } = await client.query(
      `INSERT INTO invoices (
        id, type, status, source, source_type,
        subtotal, tax, total,
        cloud_id, cloud_status, delivery_type_cloud,
        customer_name, customer_phone, observations,
        payment_method_cloud, payment_status_cloud, delivery_address, order_number,
        created_by, created_at, updated_at
      ) VALUES (
        $1, 'I', 'draft', 'online', 'online',
        $2, $3, $4,
        $5, 'new', $6,
        $7, $8, $9,
        $10, $11, $12, $13,
        $14, $15, $16
      ) ON CONFLICT (cloud_id) WHERE cloud_id IS NOT NULL DO NOTHING`,
      [
        invoiceId, subtotal, tax, total,
        orderData.id, deliveryType,
        customerName, customerPhone, observations,
        paymentMethodCloud, paymentStatusCloud, deliveryAddress, orderNumber,
        userId, now, now,
      ],
    )

    // If ON CONFLICT skipped the insert, abort
    if (rowCount === 0) {
      await client.query('ROLLBACK')
      console.log(`[online-order] Duplicate detected via ON CONFLICT (cloud: ${orderData.id}), skipping`)
      return
    }

    for (let i = 0; i < resolvedItems.length; i++) {
      const item = resolvedItems[i]
      await client.query(
        `INSERT INTO invoice_items (
          id, invoice_id, product_id,
          description, quantity, unit_price, amount,
          sort_order, special_instructions, modifier_selections
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          item.id, invoiceId, item.productId,
          item.description, item.qty, item.unitPrice, item.amount,
          i, item.specialInstructions,
          item.modifierSelections ? JSON.stringify(item.modifierSelections) : null,
        ],
      )
    }

    await client.query('COMMIT')

    console.log(`[online-order] Created invoice ${invoiceId} (cloud: ${orderData.id}, order: ${orderNumber || 'N/A'}, payment: ${paymentStatusCloud}/${paymentMethodCloud})`)

    // Fetch the full order with items for the socket emission (outside transaction, read-only)
    const { rows: fullRows } = await pool.query(
      'SELECT * FROM invoices WHERE id = $1',
      [invoiceId],
    )
    const fullOrder = fullRows[0]

    const { rows: orderItems } = await pool.query(
      `SELECT ii.*, p.name as product_name
       FROM invoice_items ii
       LEFT JOIN products p ON ii.product_id = p.id
       WHERE ii.invoice_id = $1
       ORDER BY ii.sort_order`,
      [invoiceId],
    )

    io.emit('online-order:new', {
      ...fullOrder,
      items: orderItems,
    })
  } catch (err: any) {
    await client.query('ROLLBACK').catch(() => {})
    console.error('[online-order] Error handling new order:', err)
  } finally {
    client.release()
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

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // Find the local invoice by cloud_id
    const { rows } = await client.query(
      "SELECT id, cloud_status, cloud_id, total, created_by, payment_method_cloud, payment_status_cloud FROM invoices WHERE cloud_id = $1 AND source = 'online'",
      [cloudOrderId],
    )
    const invoice = rows[0]
    if (!invoice) {
      await client.query('ROLLBACK')
      console.warn(`[delivery-status] Invoice not found for cloud order ${cloudOrderId}`)
      return
    }

    // Update cloud_status
    await client.query(
      'UPDATE invoices SET cloud_status = $1, updated_at = now() WHERE id = $2',
      [newStatus, invoice.id],
    )
    console.log(`[delivery-status] Updated invoice ${invoice.id} cloud_status → ${newStatus} (delivery_status: ${data.delivery_status})`)

    // If delivered: mark as paid + create payment + deduct inventory
    if (newStatus === 'delivered') {
      await client.query(
        "UPDATE invoices SET status = 'paid', updated_at = now() WHERE id = $1",
        [invoice.id],
      )

      const paymentAmount = Number.isFinite(Number(invoice.total)) ? Number(invoice.total) : 0

      // Determine payment method from cloud payment_method
      const cloudMethod = invoice.payment_method_cloud || ''
      let payMethod = 'transfer'
      if (cloudMethod.startsWith('cash')) payMethod = 'cash'
      else if (cloudMethod.startsWith('card')) payMethod = 'card'

      try {
        await client.query(
          `INSERT INTO payments (invoice_id, method, amount, reference, user_id)
           VALUES ($1, $2, $3, $4, $5)`,
          [invoice.id, payMethod, paymentAmount, 'Pago online marketplace', invoice.created_by],
        )
      } catch (payErr: any) {
        console.error('[delivery-status] Payment insert error (non-critical):', payErr.message)
      }

      // Deduct inventory
      const { rows: invoiceItems } = await client.query(
        'SELECT product_id, quantity FROM invoice_items WHERE invoice_id = $1',
        [invoice.id],
      )
      for (const item of invoiceItems) {
        if (!item.product_id) continue
        const qty = Number.isFinite(Number(item.quantity)) ? Number(item.quantity) || 1 : 1
        try {
          await client.query(
            `INSERT INTO stock_movements (ingredient_id, type, quantity, reference, notes, user_id)
             VALUES ($1, 'out', $2, $3, $4, $5)`,
            [item.product_id, qty, 'ONLINE-' + (invoice.cloud_id || invoice.id), 'Pedido online marketplace', invoice.created_by],
          )
          await client.query(
            'UPDATE products SET current_stock = current_stock - $1, updated_at = now() WHERE id = $2',
            [qty, item.product_id],
          )
        } catch {
          // Non-critical: stock_movements table may not exist
        }
      }
    }

    await client.query('COMMIT')

    // Emit socket event to refresh frontend (outside transaction, read-only)
    const ITEMS_JSON_AGG = `
      COALESCE(
        json_agg(
          json_build_object(
            'id', ii.id, 'product_id', ii.product_id,
            'description', ii.description, 'quantity', ii.quantity,
            'unit_price', ii.unit_price, 'amount', ii.amount,
            'product_name', p.name,
            'special_instructions', ii.special_instructions,
            'modifier_selections', ii.modifier_selections
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
    await client.query('ROLLBACK').catch(() => {})
    console.error('[delivery-status] Error handling delivery status update:', err)
  } finally {
    client.release()
  }
}
