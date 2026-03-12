import { invoices, invoiceItems, customers, changeJournal } from '@enlocal/core-db'
import { eq, and, gte, lte, ilike, sql, desc, or, ne } from 'drizzle-orm'
import type { InvoicePDFData } from './invoicePdf.service'

interface InvoiceFilters {
  status?: string
  customerId?: string
  from?: string
  to?: string
  type?: string
  source?: string
  q?: string
  page?: number
  limit?: number
}

interface PaginatedResult<T> {
  data: T[]
  total: number
  page: number
  pages: number
}

export async function listInvoices(
  db: any,
  filters: InvoiceFilters
): Promise<PaginatedResult<any>> {
  const page = filters.page || 1
  const limit = filters.limit || 50
  const offset = (page - 1) * limit

  const conditions: any[] = []

  // Filter by source — default to 'cfdi' for invoicing views
  if (filters.source) {
    conditions.push(eq(invoices.source, filters.source))
  }

  if (filters.status) {
    conditions.push(eq(invoices.status, filters.status))
  }

  if (filters.customerId) {
    conditions.push(eq(invoices.customerId, filters.customerId))
  }

  if (filters.type) {
    conditions.push(eq(invoices.type, filters.type))
  }

  if (filters.from) {
    conditions.push(gte(invoices.createdAt, new Date(filters.from)))
  }

  if (filters.to) {
    conditions.push(lte(invoices.createdAt, new Date(filters.to)))
  }

  if (filters.q) {
    const search = `%${filters.q}%`
    conditions.push(
      or(
        ilike(invoices.series, search),
        sql`${invoices.folio}::text ILIKE ${search}`,
        sql`EXISTS (
          SELECT 1 FROM customers c
          WHERE c.id = ${invoices.customerId}
          AND c.name ILIKE ${search}
        )`
      )
    )
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined

  const rows = await db
    .select({
      id: invoices.id,
      series: invoices.series,
      folio: invoices.folio,
      customerId: invoices.customerId,
      customerName: customers.name,
      type: invoices.type,
      status: invoices.status,
      useCfdi: invoices.useCfdi,
      paymentMethod: invoices.paymentMethod,
      paymentForm: invoices.paymentForm,
      subtotal: invoices.subtotal,
      tax: invoices.tax,
      total: invoices.total,
      currency: invoices.currency,
      source: invoices.source,
      uuidFiscal: invoices.uuidFiscal,
      pdfUrl: invoices.pdfUrl,
      stampedAt: invoices.stampedAt,
      cancelledAt: invoices.cancelledAt,
      cloudId: invoices.cloudId,
      createdAt: invoices.createdAt,
      updatedAt: invoices.updatedAt,
    })
    .from(invoices)
    .leftJoin(customers, eq(invoices.customerId, customers.id))
    .where(where)
    .orderBy(desc(invoices.createdAt))
    .limit(limit)
    .offset(offset)

  const countResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(invoices)
    .where(where)

  const total = countResult[0]?.count ?? 0

  return {
    data: rows,
    total,
    page,
    pages: Math.ceil(total / limit),
  }
}

export async function getInvoiceById(
  db: any,
  id: string
): Promise<any | null> {
  const invoiceRows = await db
    .select({
      id: invoices.id,
      series: invoices.series,
      folio: invoices.folio,
      customerId: invoices.customerId,
      customerName: customers.name,
      customerRfc: customers.rfc,
      customerRazonSocial: customers.razonSocial,
      customerRegimenFiscal: customers.regimenFiscal,
      customerCodigoPostal: customers.codigoPostalFiscal,
      type: invoices.type,
      status: invoices.status,
      useCfdi: invoices.useCfdi,
      paymentMethod: invoices.paymentMethod,
      paymentForm: invoices.paymentForm,
      subtotal: invoices.subtotal,
      tax: invoices.tax,
      total: invoices.total,
      currency: invoices.currency,
      source: invoices.source,
      observations: invoices.observations,
      relatedInvoiceId: invoices.relatedInvoiceId,
      uuidFiscal: invoices.uuidFiscal,
      xmlContent: invoices.xmlContent,
      pdfUrl: invoices.pdfUrl,
      stampedAt: invoices.stampedAt,
      cancelledAt: invoices.cancelledAt,
      cloudId: invoices.cloudId,
      createdAt: invoices.createdAt,
      updatedAt: invoices.updatedAt,
    })
    .from(invoices)
    .leftJoin(customers, eq(invoices.customerId, customers.id))
    .where(eq(invoices.id, id))
    .limit(1)

  if (invoiceRows.length === 0) {
    return null
  }

  const invoice = invoiceRows[0]

  const items = await db
    .select()
    .from(invoiceItems)
    .where(eq(invoiceItems.invoiceId, id))

  return { ...invoice, items }
}

export async function createInvoice(
  db: any,
  data: any,
  items: any[],
  requestUserId: string
): Promise<any> {
  const computedItems = items.map((item) => {
    const quantity = parseFloat(item.quantity) || 0
    const unitPrice = parseFloat(item.unitPrice) || 0
    const discount = parseFloat(item.discount) || 0
    const amount = quantity * unitPrice - discount
    return {
      ...item,
      quantity: quantity.toFixed(4),
      unitPrice: unitPrice.toFixed(2),
      discount: discount.toFixed(2),
      amount: amount.toFixed(2),
    }
  })

  const subtotal = computedItems.reduce(
    (sum, item) => sum + parseFloat(item.amount),
    0
  )

  const tax = computedItems.reduce((sum, item) => {
    const taxRate = parseFloat(item.taxRate) || 0.16
    return sum + parseFloat(item.amount) * taxRate
  }, 0)

  const total = subtotal + tax

  const [invoice] = await db
    .insert(invoices)
    .values({
      series: data.series || null,
      folio: data.folio || null,
      customerId: data.customerId || null,
      type: data.type || 'I',
      status: 'draft',
      useCfdi: data.useCfdi || null,
      paymentMethod: data.paymentMethod || null,
      paymentForm: data.paymentForm || null,
      subtotal: subtotal.toFixed(2),
      tax: tax.toFixed(2),
      total: total.toFixed(2),
      currency: data.currency || 'MXN',
      source: data.source || 'cfdi',
      cloudId: data.cloudId || null,
    })
    .returning()

  const insertedItems: any[] = []
  for (const item of computedItems) {
    const [row] = await db
      .insert(invoiceItems)
      .values({
        invoiceId: invoice.id,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        amount: item.amount,
        discount: item.discount,
        productId: item.productId || null,
        serviceId: item.serviceId || null,
        satCode: item.satCode || null,
        satUnit: item.satUnit || null,
        taxRate: item.taxRate !== undefined ? parseFloat(item.taxRate).toFixed(4) : '0.1600',
      })
      .returning()
    insertedItems.push(row)
  }

  await db.insert(changeJournal).values({
    tableName: 'invoices',
    recordId: invoice.id,
    action: 'insert',
    data: { ...invoice, items: insertedItems },
    userId: requestUserId,
    synced: false,
  })

  return { ...invoice, items: insertedItems }
}

export async function updateInvoice(
  db: any,
  id: string,
  data: any,
  items: any[] | undefined,
  requestUserId: string
): Promise<any> {
  // Fetch current invoice to check status
  const existing = await db
    .select()
    .from(invoices)
    .where(eq(invoices.id, id))
    .limit(1)

  if (existing.length === 0) {
    return null
  }

  if (existing[0].status !== 'draft') {
    throw new Error('Only draft invoices can be updated')
  }

  let subtotal = parseFloat(existing[0].subtotal)
  let tax = parseFloat(existing[0].tax)
  let total = parseFloat(existing[0].total)

  // If items are provided, recalculate totals
  if (items && items.length > 0) {
    // Delete existing items
    await db
      .delete(invoiceItems)
      .where(eq(invoiceItems.invoiceId, id))

    const computedItems = items.map((item) => {
      const quantity = parseFloat(item.quantity) || 0
      const unitPrice = parseFloat(item.unitPrice) || 0
      const discount = parseFloat(item.discount) || 0
      const amount = quantity * unitPrice - discount
      return {
        ...item,
        quantity: quantity.toFixed(4),
        unitPrice: unitPrice.toFixed(2),
        discount: discount.toFixed(2),
        amount: amount.toFixed(2),
      }
    })

    subtotal = computedItems.reduce(
      (sum, item) => sum + parseFloat(item.amount),
      0
    )

    tax = computedItems.reduce((sum, item) => {
      const taxRate = parseFloat(item.taxRate) || 0.16
      return sum + parseFloat(item.amount) * taxRate
    }, 0)

    total = subtotal + tax

    for (const item of computedItems) {
      await db.insert(invoiceItems).values({
        invoiceId: id,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        amount: item.amount,
        discount: item.discount,
        productId: item.productId || null,
        serviceId: item.serviceId || null,
        satCode: item.satCode || null,
        satUnit: item.satUnit || null,
        taxRate: item.taxRate !== undefined ? parseFloat(item.taxRate).toFixed(4) : '0.1600',
      })
    }
  }

  const updateData: any = {
    updatedAt: sql`now()`,
    subtotal: subtotal.toFixed(2),
    tax: tax.toFixed(2),
    total: total.toFixed(2),
  }

  if (data.series !== undefined) updateData.series = data.series
  if (data.folio !== undefined) updateData.folio = data.folio
  if (data.customerId !== undefined) updateData.customerId = data.customerId
  if (data.type !== undefined) updateData.type = data.type
  if (data.useCfdi !== undefined) updateData.useCfdi = data.useCfdi
  if (data.paymentMethod !== undefined) updateData.paymentMethod = data.paymentMethod
  if (data.paymentForm !== undefined) updateData.paymentForm = data.paymentForm
  if (data.currency !== undefined) updateData.currency = data.currency
  if (data.cloudId !== undefined) updateData.cloudId = data.cloudId

  const [updated] = await db
    .update(invoices)
    .set(updateData)
    .where(eq(invoices.id, id))
    .returning()

  if (!updated) return null

  const updatedItems = await db
    .select()
    .from(invoiceItems)
    .where(eq(invoiceItems.invoiceId, id))

  await db.insert(changeJournal).values({
    tableName: 'invoices',
    recordId: id,
    action: 'update',
    data: { ...updated, items: updatedItems },
    userId: requestUserId,
    synced: false,
  })

  return { ...updated, items: updatedItems }
}

export async function deleteInvoice(
  db: any,
  id: string,
  requestUserId: string
): Promise<any> {
  const existing = await db
    .select()
    .from(invoices)
    .where(eq(invoices.id, id))
    .limit(1)

  if (existing.length === 0) {
    return null
  }

  if (existing[0].status !== 'draft') {
    throw new Error('Only draft invoices can be deleted')
  }

  // Items are deleted via cascade from the FK constraint
  const [deleted] = await db
    .delete(invoices)
    .where(eq(invoices.id, id))
    .returning()

  if (!deleted) return null

  await db.insert(changeJournal).values({
    tableName: 'invoices',
    recordId: id,
    action: 'delete',
    data: deleted,
    userId: requestUserId,
    synced: false,
  })

  return deleted
}

/**
 * Create a CFDI invoice from one or more POS sale tickets.
 */
export async function createInvoiceFromSales(
  db: any,
  pool: any,
  saleIds: string[],
  customerData: { customerId: string; useCfdi?: string; series?: string },
  requestUserId: string
): Promise<any> {
  if (!saleIds.length) throw new Error('Se requiere al menos un ticket de venta')

  // Fetch all sale invoices
  const saleInvoices: any[] = []
  for (const saleId of saleIds) {
    const rows = await db
      .select()
      .from(invoices)
      .where(and(eq(invoices.id, saleId), eq(invoices.source, 'pos')))
      .limit(1)
    if (!rows.length) throw new Error(`Ticket ${saleId} no encontrado`)
    saleInvoices.push(rows[0])
  }

  // Check that these sales haven't already been invoiced
  for (const sale of saleInvoices) {
    const linkCheck = await pool.query(
      'SELECT id FROM invoice_links WHERE sale_invoice_id = $1 LIMIT 1',
      [sale.id]
    )
    if (linkCheck.rows.length > 0) {
      throw new Error(`El ticket ${sale.id.slice(0, 8)} ya fue facturado`)
    }
  }

  // Consolidate items from all sales
  const allItems: any[] = []
  for (const sale of saleInvoices) {
    const items = await db
      .select()
      .from(invoiceItems)
      .where(eq(invoiceItems.invoiceId, sale.id))
    allItems.push(...items)
  }

  // Determine payment method based on sale statuses
  const hasCredit = saleInvoices.some((s) => ['credit', 'partial'].includes(s.status))
  const paymentMethod = hasCredit ? 'PPD' : 'PUE'

  // Sum totals
  const subtotal = saleInvoices.reduce((sum, s) => sum + parseFloat(s.subtotal), 0)
  const tax = saleInvoices.reduce((sum, s) => sum + parseFloat(s.tax), 0)
  const total = saleInvoices.reduce((sum, s) => sum + parseFloat(s.total), 0)

  // Create the CFDI invoice
  const [cfdiInvoice] = await db
    .insert(invoices)
    .values({
      series: customerData.series || 'FA',
      customerId: customerData.customerId,
      type: 'I',
      status: 'draft',
      useCfdi: customerData.useCfdi || 'G03',
      paymentMethod,
      paymentForm: hasCredit ? '99' : '01',
      subtotal: subtotal.toFixed(2),
      tax: tax.toFixed(2),
      total: total.toFixed(2),
      source: 'cfdi',
    })
    .returning()

  // Insert consolidated items
  for (const item of allItems) {
    await db.insert(invoiceItems).values({
      invoiceId: cfdiInvoice.id,
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      amount: item.amount,
      discount: item.discount || '0',
      productId: item.productId,
      serviceId: item.serviceId,
      satCode: item.satCode,
      satUnit: item.satUnit,
      taxRate: item.taxRate,
    })
  }

  // Create invoice_links records
  for (const sale of saleInvoices) {
    await pool.query(
      'INSERT INTO invoice_links (sale_invoice_id, cfdi_invoice_id) VALUES ($1, $2)',
      [sale.id, cfdiInvoice.id]
    )
  }

  // Log
  await db.insert(changeJournal).values({
    tableName: 'invoices',
    recordId: cfdiInvoice.id,
    action: 'insert',
    data: { cfdiInvoice, saleIds },
    userId: requestUserId,
    synced: false,
  })

  const items = await db
    .select()
    .from(invoiceItems)
    .where(eq(invoiceItems.invoiceId, cfdiInvoice.id))

  return { ...cfdiInvoice, items, linkedSaleIds: saleIds }
}

/**
 * Create a Complemento de Pago (type='P') for a stamped PPD invoice.
 */
export async function createComplementoPago(
  db: any,
  pool: any,
  data: {
    invoiceId: string
    paymentIds: string[]
    series?: string
  },
  requestUserId: string
): Promise<any> {
  // Fetch the original stamped PPD invoice
  const [originalInvoice] = await db
    .select()
    .from(invoices)
    .where(eq(invoices.id, data.invoiceId))
    .limit(1)

  if (!originalInvoice) throw new Error('Factura original no encontrada')
  if (originalInvoice.paymentMethod !== 'PPD') {
    throw new Error('Solo facturas PPD pueden tener complemento de pago')
  }

  // Fetch the payment records
  const paymentPlaceholders = data.paymentIds.map((_, i) => `$${i + 1}`).join(',')
  const paymentsResult = await pool.query(
    `SELECT id, method, amount::numeric, reference, created_at
     FROM payments
     WHERE id IN (${paymentPlaceholders}) AND is_abono = true`,
    data.paymentIds
  )

  if (!paymentsResult.rows.length) {
    throw new Error('No se encontraron los pagos de abono seleccionados')
  }

  const paymentRows = paymentsResult.rows
  const totalPagado = paymentRows.reduce((sum: number, r: any) => sum + parseFloat(r.amount), 0)

  // Map payment methods to SAT codes
  const satFormaPago: Record<string, string> = {
    cash: '01',
    card: '04',
    transfer: '03',
  }

  // Create complemento invoice
  const [complemento] = await db
    .insert(invoices)
    .values({
      series: data.series || 'CP',
      customerId: originalInvoice.customerId,
      type: 'P',
      status: 'draft',
      paymentMethod: 'PPD',
      paymentForm: '99',
      subtotal: '0',
      tax: '0',
      total: '0',
      source: 'cfdi',
      relatedInvoiceId: data.invoiceId,
    })
    .returning()

  // Log
  await db.insert(changeJournal).values({
    tableName: 'invoices',
    recordId: complemento.id,
    action: 'insert',
    data: {
      complemento,
      relatedInvoiceId: data.invoiceId,
      paymentIds: data.paymentIds,
      totalPagado,
    },
    userId: requestUserId,
    synced: false,
  })

  return {
    ...complemento,
    relatedInvoice: {
      id: originalInvoice.id,
      series: originalInvoice.series,
      folio: originalInvoice.folio,
      uuidFiscal: originalInvoice.uuidFiscal,
      total: originalInvoice.total,
    },
    payments: paymentRows.map((r: any) => ({
      id: r.id,
      method: r.method,
      formaPago: satFormaPago[r.method] || '99',
      amount: parseFloat(r.amount),
      reference: r.reference,
      date: r.created_at,
    })),
    totalPagado,
  }
}

/**
 * List uninvoiced POS tickets (sales with no entry in invoice_links).
 */
export async function listAvailableSalesForInvoicing(
  db: any,
  pool: any,
  filters: { customerId?: string; page?: number; limit?: number }
): Promise<PaginatedResult<any>> {
  const page = filters.page || 1
  const limit = filters.limit || 50
  const offset = (page - 1) * limit

  const params: any[] = [limit, offset]
  let customerFilter = ''
  if (filters.customerId) {
    params.push(filters.customerId)
    customerFilter = `AND i.customer_id = $${params.length}`
  }

  const result = await pool.query(
    `SELECT i.id, i.folio, i.series, i.customer_id, c.name as customer_name,
            i.status, i.payment_method, i.subtotal::numeric, i.tax::numeric, i.total::numeric,
            i.created_at
     FROM invoices i
     LEFT JOIN customers c ON i.customer_id = c.id
     WHERE i.source = 'pos'
       AND i.status IN ('paid', 'credit', 'partial')
       AND NOT EXISTS (SELECT 1 FROM invoice_links il WHERE il.sale_invoice_id = i.id)
       ${customerFilter}
     ORDER BY i.created_at DESC
     LIMIT $1 OFFSET $2`,
    params
  )

  const countParams: any[] = []
  let countCustomerFilter = ''
  if (filters.customerId) {
    countParams.push(filters.customerId)
    countCustomerFilter = `AND i.customer_id = $${countParams.length}`
  }

  const countResult = await pool.query(
    `SELECT count(*)::int as cnt
     FROM invoices i
     WHERE i.source = 'pos'
       AND i.status IN ('paid', 'credit', 'partial')
       AND NOT EXISTS (SELECT 1 FROM invoice_links il WHERE il.sale_invoice_id = i.id)
       ${countCustomerFilter}`,
    countParams
  )

  const total = countResult.rows[0]?.cnt ?? 0

  return {
    data: result.rows.map((r: any) => ({
      id: r.id,
      folio: r.folio,
      series: r.series,
      customerId: r.customer_id,
      customerName: r.customer_name,
      status: r.status,
      paymentMethod: r.payment_method,
      subtotal: parseFloat(r.subtotal),
      tax: parseFloat(r.tax),
      total: parseFloat(r.total),
      createdAt: r.created_at,
    })),
    total,
    page,
    pages: Math.ceil(total / limit),
  }
}

// ── PDF Data Gathering ──────────────────────────────────────────

/**
 * Gather all data needed to generate the CFDI PDF representation.
 * Collects invoice, items, relations, payment details, carta porte,
 * emisor config, receptor data, and SAT catalog descriptions.
 */
export async function getInvoiceForPdf(
  db: any,
  invoiceId: string
): Promise<InvoicePDFData> {
  // 1. Invoice with customer
  const invoiceRows = await db
    .select({
      id: invoices.id,
      series: invoices.series,
      folio: invoices.folio,
      customerId: invoices.customerId,
      customerName: customers.name,
      customerRfc: customers.rfc,
      customerRazonSocial: customers.razonSocial,
      customerRegimenFiscal: customers.regimenFiscal,
      customerCodigoPostal: customers.codigoPostalFiscal,
      type: invoices.type,
      status: invoices.status,
      useCfdi: invoices.useCfdi,
      paymentMethod: invoices.paymentMethod,
      paymentForm: invoices.paymentForm,
      subtotal: invoices.subtotal,
      tax: invoices.tax,
      total: invoices.total,
      currency: invoices.currency,
      uuidFiscal: invoices.uuidFiscal,
      stampedAt: invoices.stampedAt,
      createdAt: invoices.createdAt,
      observations: invoices.observations,
    })
    .from(invoices)
    .leftJoin(customers, eq(invoices.customerId, customers.id))
    .where(eq(invoices.id, invoiceId))
    .limit(1)

  if (invoiceRows.length === 0) {
    throw new Error('Factura no encontrada')
  }

  const inv = invoiceRows[0]

  // Fetch extended invoice fields via raw SQL (columns added by mount.ts)
  const extResult = await db.execute(sql`
    SELECT
      exchange_rate, payment_conditions,
      total_discounts, total_iva_16, total_iva_8, total_iva_0,
      total_iva_exempt, total_ieps, total_transferred,
      total_iva_retained, total_isr_retained, total_retained,
      xml_original_chain, sat_certificate_number, sat_stamp_date,
      sat_digital_stamp, issuer_seal,
      is_global, global_periodicity, global_month, global_year,
      cancellation_reason, cancelled_at,
      receptor_rfc, receptor_nombre, receptor_regimen, receptor_cp, receptor_email,
      emitted_at
    FROM invoices WHERE id = ${invoiceId}
  `)
  const ext = (extResult.rows || extResult)[0] || {}

  // 2. Items
  const rawItems = await db
    .select()
    .from(invoiceItems)
    .where(eq(invoiceItems.invoiceId, invoiceId))

  // 3. Fiscal config (emisor)
  const fcResult = await db.execute(sql`
    SELECT rfc, razon_social, nombre_comercial, regimen_fiscal,
           codigo_postal, lugar_expedicion
    FROM fiscal_config LIMIT 1
  `)
  const fc = (fcResult.rows || fcResult)[0] || {}

  // 4. SAT catalog lookups
  const emisorRegimenDesc = await satLookup(db, 'sat_tax_regimes', fc.regimen_fiscal || '601')
  const receptorRegimenFiscal = ext.receptor_regimen || inv.customerRegimenFiscal || '616'
  const receptorRegimenDesc = await satLookup(db, 'sat_tax_regimes', receptorRegimenFiscal)
  const usoCfdiCode = inv.useCfdi || 'S01'
  const usoCfdiDesc = await satLookup(db, 'sat_cfdi_uses', usoCfdiCode)
  const paymentFormCode = inv.paymentForm || '99'
  const paymentFormDesc = await satLookup(db, 'sat_payment_forms', paymentFormCode)

  // 5. Relations
  const relResult = await db.execute(sql`
    SELECT relationship_type, related_uuid
    FROM invoice_relations
    WHERE invoice_id = ${invoiceId}
  `)
  const relRows = relResult.rows || relResult || []

  const relations = []
  for (const r of relRows) {
    const relTypeDesc = await satLookup(db, 'sat_relationship_types', r.relationship_type)
    relations.push({
      relationship_type: r.relationship_type,
      relationship_type_desc: relTypeDesc,
      related_uuid: r.related_uuid,
    })
  }

  // 6. Payment details (tipo P)
  let paymentDetails: InvoicePDFData['paymentDetails'] = undefined
  if (inv.type === 'P') {
    const pdResult = await db.execute(sql`
      SELECT id, payment_date, payment_form, currency, exchange_rate,
             amount, operation_number, bank_rfc_emisor, bank_name_emisor,
             bank_rfc_receptor, bank_account_receptor
      FROM invoice_payment_details
      WHERE invoice_id = ${invoiceId}
    `)
    const pdRows = pdResult.rows || pdResult || []

    paymentDetails = []
    for (const pd of pdRows) {
      const pdFormDesc = await satLookup(db, 'sat_payment_forms', pd.payment_form)

      const rdResult = await db.execute(sql`
        SELECT related_uuid, series, folio, currency, partial_number,
               previous_balance, amount_paid, remaining_balance
        FROM invoice_payment_related_docs
        WHERE payment_detail_id = ${pd.id}
      `)
      const rdRows = rdResult.rows || rdResult || []

      paymentDetails.push({
        payment_date: pd.payment_date,
        payment_form: pd.payment_form,
        payment_form_desc: pdFormDesc,
        currency: pd.currency || 'MXN',
        exchange_rate: parseFloat(pd.exchange_rate) || 1,
        amount: parseFloat(pd.amount) || 0,
        operation_number: pd.operation_number,
        rfc_issuer_bank: pd.bank_rfc_emisor,
        issuer_bank_name: pd.bank_name_emisor,
        rfc_receiver_bank: pd.bank_rfc_receptor,
        receiver_bank_account: pd.bank_account_receptor,
        related_docs: rdRows.map((rd: any) => ({
          related_uuid: rd.related_uuid,
          series: rd.series,
          folio: rd.folio,
          currency: rd.currency || 'MXN',
          partial_number: rd.partial_number || 1,
          previous_balance: parseFloat(rd.previous_balance) || 0,
          amount_paid: parseFloat(rd.amount_paid) || 0,
          remaining_balance: parseFloat(rd.remaining_balance) || 0,
        })),
      })
    }
  }

  // 7. Carta porte (tipo T)
  let cartaPorte: InvoicePDFData['cartaPorte'] = undefined
  if (inv.type === 'T' || ext.has_carta_porte) {
    const cpResult = await db.execute(sql`
      SELECT id, transport_international, perm_sct, num_permiso_sct,
             vehicle_config, vehicle_plate, vehicle_year,
             insurance_company, insurance_policy
      FROM invoice_carta_porte
      WHERE invoice_id = ${invoiceId}
      LIMIT 1
    `)
    const cpRow = (cpResult.rows || cpResult)[0]

    if (cpRow) {
      // Locations
      const locResult = await db.execute(sql`
        SELECT location_type, id_ubicacion, rfc_addressee, addressee_name,
               street, ext_number, neighborhood, municipality, state,
               country, zip_code, departure_date, arrival_date, distance_km
        FROM invoice_carta_porte_locations
        WHERE carta_porte_id = ${cpRow.id}
        ORDER BY sort_order
      `)
      const locRows = locResult.rows || locResult || []

      // Goods
      const goodsResult = await db.execute(sql`
        SELECT bienes_transp, descripcion, cantidad, clave_unidad,
               peso_kg, valor_mercancia, material_peligroso
        FROM invoice_carta_porte_goods
        WHERE carta_porte_id = ${cpRow.id}
        ORDER BY sort_order
      `)
      const goodsRows = goodsResult.rows || goodsResult || []

      // Operators
      const opResult = await db.execute(sql`
        SELECT operator_type, rfc, nombre, num_licencia
        FROM invoice_carta_porte_operators
        WHERE carta_porte_id = ${cpRow.id}
      `)
      const opRows = opResult.rows || opResult || []

      cartaPorte = {
        transport_international: cpRow.transport_international || false,
        locations: locRows.map((l: any) => ({
          location_type: l.location_type,
          id_ubicacion: l.id_ubicacion || '',
          rfc_addressee: l.rfc_addressee,
          addressee_name: l.addressee_name,
          street: l.street,
          ext_number: l.ext_number,
          neighborhood: l.neighborhood,
          municipality: l.municipality,
          state: l.state,
          country: l.country || 'MEX',
          zip_code: l.zip_code || '',
          departure_date: l.departure_date,
          arrival_date: l.arrival_date,
          distance_km: l.distance_km ? parseFloat(l.distance_km) : undefined,
        })),
        goods: goodsRows.map((g: any) => ({
          bienes_transp: g.bienes_transp,
          descripcion: g.descripcion,
          cantidad: parseFloat(g.cantidad) || 0,
          clave_unidad: g.clave_unidad,
          peso_kg: parseFloat(g.peso_kg) || 0,
          valor_mercancia: g.valor_mercancia ? parseFloat(g.valor_mercancia) : undefined,
          material_peligroso: g.material_peligroso || false,
        })),
        vehicle: {
          perm_sct: cpRow.perm_sct,
          num_permiso_sct: cpRow.num_permiso_sct,
          vehicle_config: cpRow.vehicle_config || '',
          vehicle_plate: cpRow.vehicle_plate || '',
          vehicle_year: cpRow.vehicle_year,
          insurance_company: cpRow.insurance_company,
          insurance_policy: cpRow.insurance_policy,
        },
        operators: opRows.map((o: any) => ({
          operator_type: o.operator_type,
          rfc: o.rfc || '',
          nombre: o.nombre,
          num_licencia: o.num_licencia,
        })),
      }
    }
  }

  // 8. Logo path
  let logoPath: string | undefined
  try {
    const settingsResult = await db.execute(sql`
      SELECT value FROM settings WHERE key = 'business_logo_path' LIMIT 1
    `)
    const settingsRow = (settingsResult.rows || settingsResult)[0]
    if (settingsRow?.value) logoPath = settingsRow.value
  } catch { /* settings table may not exist */ }

  // ─── Assemble InvoicePDFData ────────────────────────────
  const receptorRfc = ext.receptor_rfc || inv.customerRfc || 'XAXX010101000'
  const receptorNombre = ext.receptor_nombre || inv.customerRazonSocial || inv.customerName || 'PUBLICO EN GENERAL'
  const receptorCp = ext.receptor_cp || inv.customerCodigoPostal || '00000'

  return {
    emisor: {
      rfc: fc.rfc || 'XAXX010101000',
      razon_social: fc.razon_social || 'MI EMPRESA',
      nombre_comercial: fc.nombre_comercial,
      regimen_fiscal: fc.regimen_fiscal || '601',
      regimen_fiscal_desc: emisorRegimenDesc,
      codigo_postal: fc.lugar_expedicion || fc.codigo_postal || '00000',
      logo_path: logoPath,
    },
    invoice: {
      id: inv.id,
      type: inv.type as 'I' | 'E' | 'P' | 'T',
      series: inv.series || '',
      folio: inv.folio || 0,
      uuid_fiscal: inv.uuidFiscal || '',
      status: inv.status,
      currency: inv.currency || 'MXN',
      exchange_rate: parseFloat(ext.exchange_rate) || 1,
      payment_method: inv.paymentMethod || 'PUE',
      payment_form: paymentFormCode,
      payment_form_desc: paymentFormDesc,
      payment_conditions: ext.payment_conditions,
      created_at: inv.createdAt,
      emitted_at: ext.emitted_at || inv.createdAt,
      subtotal: parseFloat(inv.subtotal) || 0,
      total_discounts: parseFloat(ext.total_discounts) || 0,
      total_iva_16: parseFloat(ext.total_iva_16) || 0,
      total_iva_8: parseFloat(ext.total_iva_8) || 0,
      total_iva_0: parseFloat(ext.total_iva_0) || 0,
      total_iva_exempt: parseFloat(ext.total_iva_exempt) || 0,
      total_ieps: parseFloat(ext.total_ieps) || 0,
      total_transferred: parseFloat(ext.total_transferred) || parseFloat(inv.tax) || 0,
      total_iva_retained: parseFloat(ext.total_iva_retained) || 0,
      total_isr_retained: parseFloat(ext.total_isr_retained) || 0,
      total_retained: parseFloat(ext.total_retained) || 0,
      total: parseFloat(inv.total) || 0,
      sat_certificate_number: ext.sat_certificate_number,
      sat_stamp_date: ext.sat_stamp_date,
      sat_digital_stamp: ext.sat_digital_stamp,
      issuer_seal: ext.issuer_seal,
      xml_original_chain: ext.xml_original_chain,
      is_global: ext.is_global || false,
      global_periodicity: ext.global_periodicity,
      global_month: ext.global_month,
      global_year: ext.global_year,
      cancellation_reason: ext.cancellation_reason,
      cancelled_at: ext.cancelled_at,
      notes: inv.observations,
    },
    receptor: {
      rfc: receptorRfc,
      nombre: receptorNombre,
      regimen_fiscal: receptorRegimenFiscal,
      regimen_fiscal_desc: receptorRegimenDesc,
      uso_cfdi: usoCfdiCode,
      uso_cfdi_desc: usoCfdiDesc,
      domicilio_fiscal_cp: receptorCp,
      email: ext.receptor_email,
    },
    items: rawItems.map((item: any) => ({
      clave_prod_serv: item.satCode || '01010101',
      clave_unidad: item.satUnit || 'H87',
      unidad: item.unit,
      no_identificacion: item.noIdentificacion,
      description: item.description || '',
      quantity: parseFloat(item.quantity) || 1,
      unit_price: parseFloat(item.unitPrice) || 0,
      amount: parseFloat(item.amount) || 0,
      discount: parseFloat(item.discount) || 0,
      objeto_imp: item.objetoImp || '02',
      iva_rate: item.ivaRate !== null && item.ivaRate !== undefined ? parseFloat(item.ivaRate) : parseFloat(item.taxRate) || 0.16,
      iva_amount: item.ivaAmount !== null && item.ivaAmount !== undefined ? parseFloat(item.ivaAmount) : (parseFloat(item.amount) || 0) * (parseFloat(item.taxRate) || 0.16),
      ieps_rate: item.iepsRate !== null && item.iepsRate !== undefined ? parseFloat(item.iepsRate) : null,
      ieps_amount: parseFloat(item.iepsAmount) || 0,
      iva_retained_rate: item.ivaRetainedRate !== null && item.ivaRetainedRate !== undefined ? parseFloat(item.ivaRetainedRate) : null,
      iva_retained_amount: parseFloat(item.ivaRetainedAmount) || 0,
      isr_retained_rate: item.isrRetainedRate !== null && item.isrRetainedRate !== undefined ? parseFloat(item.isrRetainedRate) : null,
      isr_retained_amount: parseFloat(item.isrRetainedAmount) || 0,
    })),
    relations,
    paymentDetails,
    cartaPorte,
  }
}

// ── SAT catalog description lookup helper ───────────────────────

const VALID_SAT_TABLES: Record<string, boolean> = {
  sat_tax_regimes: true,
  sat_cfdi_uses: true,
  sat_payment_forms: true,
  sat_payment_methods: true,
  sat_relationship_types: true,
  sat_product_codes: true,
  sat_unit_codes: true,
}

async function satLookup(db: any, table: string, code: string): Promise<string> {
  if (!code) return ''
  if (!VALID_SAT_TABLES[table]) return ''
  try {
    // Use table-specific queries to avoid dynamic table names
    let queryResult
    switch (table) {
      case 'sat_tax_regimes':
        queryResult = await db.execute(sql`SELECT description FROM sat_tax_regimes WHERE code = ${code} LIMIT 1`)
        break
      case 'sat_cfdi_uses':
        queryResult = await db.execute(sql`SELECT description FROM sat_cfdi_uses WHERE code = ${code} LIMIT 1`)
        break
      case 'sat_payment_forms':
        queryResult = await db.execute(sql`SELECT description FROM sat_payment_forms WHERE code = ${code} LIMIT 1`)
        break
      case 'sat_payment_methods':
        queryResult = await db.execute(sql`SELECT description FROM sat_payment_methods WHERE code = ${code} LIMIT 1`)
        break
      case 'sat_relationship_types':
        queryResult = await db.execute(sql`SELECT description FROM sat_relationship_types WHERE code = ${code} LIMIT 1`)
        break
      case 'sat_product_codes':
        queryResult = await db.execute(sql`SELECT description FROM sat_product_codes WHERE code = ${code} LIMIT 1`)
        break
      case 'sat_unit_codes':
        queryResult = await db.execute(sql`SELECT description FROM sat_unit_codes WHERE code = ${code} LIMIT 1`)
        break
      default:
        return ''
    }
    const row = (queryResult.rows || queryResult)[0]
    return row?.description || ''
  } catch {
    return ''
  }
}
