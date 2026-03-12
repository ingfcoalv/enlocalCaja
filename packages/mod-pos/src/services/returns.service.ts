import { sql } from 'drizzle-orm'

interface ReturnItemInput {
  invoiceItemId: string
  productId: string | null
  productName: string
  quantity: number
  unitPrice: number
}

interface CreateReturnInput {
  invoiceId: string
  items: ReturnItemInput[]
  reason: string
  notes?: string
  userId: string
  registerId: string | null
}

interface PosReturn {
  id: string
  invoiceId: string
  ticketNumber: string | null
  reason: string
  totalRefunded: number
  status: string
  userId: string
  notes: string | null
  createdAt: string
  items: {
    id: string
    productName: string
    quantity: number
    unitPrice: number
    totalRefund: number
  }[]
}

/**
 * Ensure pos_returns tables exist.
 */
async function ensureReturnTables(db: any): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS pos_returns (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      invoice_id uuid NOT NULL REFERENCES invoices(id),
      ticket_number text,
      reason text NOT NULL,
      total_refunded numeric(12,2) NOT NULL DEFAULT 0,
      status text NOT NULL DEFAULT 'completed',
      user_id uuid,
      notes text,
      register_id uuid,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `)
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS pos_return_items (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      return_id uuid NOT NULL REFERENCES pos_returns(id) ON DELETE CASCADE,
      invoice_item_id uuid,
      product_id uuid,
      product_name text NOT NULL,
      quantity numeric(12,4) NOT NULL,
      unit_price numeric(12,2) NOT NULL DEFAULT 0,
      total_refund numeric(12,2) NOT NULL DEFAULT 0,
      restocked boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `)
}

export async function createReturn(
  db: any,
  pool: any,
  input: CreateReturnInput
): Promise<PosReturn> {
  await ensureReturnTables(db)

  // Validate invoice exists
  const invResult = await pool.query(
    `SELECT id, status, total, ticket_number FROM invoices WHERE id = $1`,
    [input.invoiceId]
  )
  if (!invResult.rows.length) {
    throw new Error('Venta no encontrada')
  }

  // 2.2 — Check for existing completed returns on this invoice
  const existingReturns = await pool.query(
    `SELECT id FROM pos_returns WHERE invoice_id = $1 AND status = 'completed'`,
    [input.invoiceId]
  )

  // 2.1 — Validate return quantities against original invoice items
  const originalItems = await pool.query(
    `SELECT ii.id, ii.quantity::numeric as quantity, ii.description
     FROM invoice_items ii WHERE ii.invoice_id = $1`,
    [input.invoiceId]
  )

  // Sum already-returned quantities per invoice_item
  let alreadyReturnedMap: Record<string, number> = {}
  if (existingReturns.rows.length > 0) {
    const returnIds = existingReturns.rows.map((r: any) => r.id)
    const placeholders = returnIds.map((_: any, i: number) => `$${i + 1}`).join(',')
    const prevItems = await pool.query(
      `SELECT invoice_item_id, sum(quantity)::numeric as total_returned
       FROM pos_return_items WHERE return_id IN (${placeholders})
       GROUP BY invoice_item_id`,
      returnIds
    )
    for (const row of prevItems.rows) {
      alreadyReturnedMap[row.invoice_item_id] = parseFloat(row.total_returned)
    }
  }

  // Validate each item
  for (const item of input.items) {
    if (item.invoiceItemId) {
      const original = originalItems.rows.find((oi: any) => oi.id === item.invoiceItemId)
      if (!original) {
        throw new Error(`Artículo ${item.productName} no pertenece a esta venta`)
      }
      const alreadyReturned = alreadyReturnedMap[item.invoiceItemId] || 0
      const maxReturnable = parseFloat(original.quantity) - alreadyReturned
      if (item.quantity > maxReturnable + 0.0001) {
        throw new Error(`No se pueden devolver ${item.quantity} unidades de "${item.productName}". Máximo disponible: ${maxReturnable}`)
      }
    }
  }

  // Calculate total refund
  const totalRefunded = input.items.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0
  )

  // Generate return ticket number (DEV-YYYYMMDD-NNNN)
  let ticketNumber: string | null = null
  try {
    const now = new Date()
    const datePrefix = 'DEV-' + now.getFullYear().toString() +
      String(now.getMonth() + 1).padStart(2, '0') +
      String(now.getDate()).padStart(2, '0')
    const tnResult = await pool.query(
      `SELECT COALESCE(MAX(CAST(SPLIT_PART(ticket_number, '-', 3) AS INTEGER)), 0) + 1 as next_num
       FROM pos_returns WHERE ticket_number LIKE $1`,
      [datePrefix + '-%']
    )
    const nextNum = tnResult.rows[0]?.next_num ?? 1
    ticketNumber = `${datePrefix}-${String(nextNum).padStart(4, '0')}`
  } catch { /* non-critical */ }

  // Create return record
  const returnResult = await pool.query(
    `INSERT INTO pos_returns (invoice_id, ticket_number, reason, total_refunded, status, user_id, notes, register_id)
     VALUES ($1, $2, $3, $4, 'completed', $5, $6, $7)
     RETURNING *`,
    [input.invoiceId, ticketNumber, input.reason, totalRefunded.toFixed(2), input.userId, input.notes || null, input.registerId]
  )
  const posReturn = returnResult.rows[0]

  // Create return items and restock inventory
  const returnItems: any[] = []
  for (const item of input.items) {
    const itemTotal = (item.quantity * item.unitPrice).toFixed(2)
    const itemResult = await pool.query(
      `INSERT INTO pos_return_items (return_id, invoice_item_id, product_id, product_name, quantity, unit_price, total_refund, restocked)
       VALUES ($1, $2, $3, $4, $5, $6, $7, true)
       RETURNING *`,
      [posReturn.id, item.invoiceItemId, item.productId, item.productName, item.quantity, item.unitPrice.toFixed(2), itemTotal]
    )
    returnItems.push(itemResult.rows[0])

    // Restock inventory
    if (item.productId) {
      try {
        await pool.query(
          `INSERT INTO stock_movements (ingredient_id, type, quantity, reference, notes, user_id)
           VALUES ($1, 'in', $2, $3, 'Devolucion POS', $4)`,
          [item.productId, String(item.quantity), ticketNumber || `RET-${posReturn.id.slice(0, 8)}`, input.userId]
        )
        await pool.query(
          `UPDATE products SET current_stock = current_stock + $1, updated_at = now() WHERE id = $2`,
          [String(item.quantity), item.productId]
        )
      } catch { /* stock_movements may not exist */ }
    }
  }

  // Create negative payment (refund) linked to original invoice
  try {
    const shiftResult = await pool.query(
      `SELECT id FROM cash_shifts WHERE user_id = $1 AND status = 'open' LIMIT 1`,
      [input.userId]
    )
    const shiftId = shiftResult.rows[0]?.id ?? null

    await pool.query(
      `INSERT INTO payments (invoice_id, method, amount, reference, shift_id, user_id, register_id)
       VALUES ($1, 'cash', $2, $3, $4, $5, $6)`,
      [input.invoiceId, (-totalRefunded).toFixed(2), `Devolucion ${ticketNumber || ''}`.trim(), shiftId, input.userId, input.registerId]
    )
  } catch { /* non-critical */ }

  // Audit
  try {
    await db.execute(
      sql`INSERT INTO change_journal (table_name, record_id, action, data, user_id, synced)
          VALUES ('pos_returns', ${posReturn.id}, 'insert', ${JSON.stringify({ ...posReturn, items: returnItems })}::jsonb, ${input.userId}, false)`
    )
  } catch { /* non-critical */ }

  return {
    id: posReturn.id,
    invoiceId: posReturn.invoice_id,
    ticketNumber: posReturn.ticket_number,
    reason: posReturn.reason,
    totalRefunded: parseFloat(posReturn.total_refunded),
    status: posReturn.status,
    userId: posReturn.user_id,
    notes: posReturn.notes,
    createdAt: posReturn.created_at,
    items: returnItems.map((ri: any) => ({
      id: ri.id,
      productName: ri.product_name,
      quantity: parseFloat(ri.quantity),
      unitPrice: parseFloat(ri.unit_price),
      totalRefund: parseFloat(ri.total_refund),
    })),
  }
}

export async function listReturns(
  pool: any,
  filters: { from?: string; to?: string; page?: number; limit?: number }
): Promise<{ data: any[]; total: number; page: number; pages: number }> {
  const page = filters.page || 1
  const limit = filters.limit || 50
  const offset = (page - 1) * limit

  const conditions: string[] = []
  const params: any[] = []
  let paramIdx = 1

  if (filters.from) {
    const [y, m, d] = filters.from.split('-').map(Number)
    const fromDate = new Date(y, m - 1, d, 0, 0, 0, 0)
    conditions.push(`r.created_at >= $${paramIdx++}`)
    params.push(fromDate)
  }
  if (filters.to) {
    const [y, m, d] = filters.to.split('-').map(Number)
    const toDate = new Date(y, m - 1, d, 23, 59, 59, 999)
    conditions.push(`r.created_at <= $${paramIdx++}`)
    params.push(toDate)
  }

  const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : ''

  const countResult = await pool.query(
    `SELECT count(*)::int as count FROM pos_returns r ${whereClause}`,
    params
  )
  const total = countResult.rows[0]?.count ?? 0

  const dataResult = await pool.query(
    `SELECT r.*, i.ticket_number as sale_ticket, u.name as user_name
     FROM pos_returns r
     LEFT JOIN invoices i ON i.id = r.invoice_id
     LEFT JOIN users u ON u.id = r.user_id
     ${whereClause}
     ORDER BY r.created_at DESC
     LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
    [...params, limit, offset]
  )

  return {
    data: dataResult.rows.map((r: any) => ({
      id: r.id,
      invoiceId: r.invoice_id,
      ticketNumber: r.ticket_number,
      saleTicket: r.sale_ticket,
      reason: r.reason,
      totalRefunded: parseFloat(r.total_refunded),
      status: r.status,
      userName: r.user_name,
      notes: r.notes,
      createdAt: r.created_at,
    })),
    total,
    page,
    pages: Math.ceil(total / limit),
  }
}
