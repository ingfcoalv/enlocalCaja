import {
  supplierInvoices, supplierInvoiceItems, payables, suppliers, changeJournal,
} from '@enlocal/core-db'
import { eq, and, sql, asc, desc, gte, lte, inArray } from 'drizzle-orm'
import { recalculateSupplierBalance } from './supplierBalance.service'
import type { CreateSupplierInvoiceInput, UpdateSupplierInvoiceInput } from '../validators/supplierInvoice.validator'
import { DOMParser } from '@xmldom/xmldom'

// ─── Create ────────────────────────────────────────────────────
export async function create(
  db: any,
  data: CreateSupplierInvoiceInput,
  userId: string
): Promise<any> {
  const [supplier] = await db.select().from(suppliers).where(eq(suppliers.id, data.supplier_id))
  if (!supplier) throw new Error('Proveedor no encontrado')

  let subtotal = 0
  let totalTax = 0
  let totalAmount = 0
  const itemValues: any[] = []

  for (const item of data.items) {
    const taxRate = item.tax_rate ?? 0.16
    const lineSubtotal = item.quantity * item.unit_cost - (item.discount ?? 0)
    const taxAmount = lineSubtotal * taxRate
    const total = lineSubtotal + taxAmount

    subtotal += lineSubtotal
    totalTax += taxAmount
    totalAmount += total

    itemValues.push({
      description: item.description,
      quantity: String(item.quantity),
      unitCost: String(item.unit_cost),
      discount: String(item.discount ?? 0),
      taxRate: String(taxRate),
      taxAmount: String(taxAmount.toFixed(2)),
      total: String(total.toFixed(2)),
      productId: item.product_id ?? null,
      satCode: item.sat_code ?? null,
      satUnit: item.sat_unit ?? null,
    })
  }

  // For type 'P', use complement_amount as total (no line items)
  if (data.type === 'P' && data.complement_amount) {
    totalAmount = data.complement_amount
  }

  const insertValues: any = {
    supplierId: data.supplier_id,
    purchaseOrderId: data.purchase_order_id ?? null,
    invoiceNumber: data.invoice_number,
    invoiceUuid: data.invoice_uuid ?? null,
    type: data.type ?? 'I',
    issueDate: new Date(data.issue_date),
    subtotal: String(subtotal.toFixed(2)),
    taxAmount: String(totalTax.toFixed(2)),
    total: String(totalAmount.toFixed(2)),
    currency: data.currency ?? 'MXN',
    paymentMethod: data.payment_method ?? null,
    paymentForm: data.payment_form ?? null,
    notes: data.notes ?? null,
    status: 'pending',
    createdBy: userId,
  }

  // Set parentInvoiceId directly on insert for type 'P'
  if (data.type === 'P' && data.parent_invoice_id) {
    insertValues.parentInvoiceId = data.parent_invoice_id
  }

  const [invoice] = await db.insert(supplierInvoices).values(insertValues).returning()

  let insertedItems: any[] = []
  if (itemValues.length > 0) {
    const itemsWithInvoiceId = itemValues.map(v => ({ ...v, invoiceId: invoice.id }))
    insertedItems = await db.insert(supplierInvoiceItems).values(itemsWithInvoiceId).returning()
  }

  // For type 'I' (ingreso): link to existing CxP or create new one
  if ((data.type ?? 'I') === 'I') {
    if (data.payable_id) {
      // Link invoice to existing CxP
      await db.update(payables).set({
        supplierInvoiceId: invoice.id,
        updatedAt: sql`now()`,
      }).where(eq(payables.id, data.payable_id))
    } else {
      // Create new CxP
      const creditDays = supplier.defaultCreditDays ?? 30
      const dueDate = new Date(data.issue_date)
      dueDate.setDate(dueDate.getDate() + creditDays)

      await db.insert(payables).values({
        supplierId: data.supplier_id,
        supplierInvoiceId: invoice.id,
        purchaseOrderId: data.purchase_order_id ?? null,
        originalAmount: String(totalAmount.toFixed(2)),
        balance: String(totalAmount.toFixed(2)),
        issuedDate: new Date(data.issue_date),
        dueDate,
        status: 'current',
        paymentMethod: supplier.defaultPaymentMethod ?? null,
      })
    }
    await recalculateSupplierBalance(db, data.supplier_id)
  }

  // For type 'P' (complemento de pago), update parent PPD invoice progress
  if (data.type === 'P' && data.parent_invoice_id) {
    const [parent] = await db.select().from(supplierInvoices)
      .where(eq(supplierInvoices.id, data.parent_invoice_id))
    if (!parent) throw new Error('Factura padre no encontrada')

    const complementAmount = data.complement_amount || totalAmount
    const newComplemented = Number(parent.amountComplemented || 0) + complementAmount
    const parentUpdate: any = {
      amountComplemented: String(newComplemented.toFixed(2)),
      updatedAt: sql`now()`,
    }
    if (newComplemented >= Number(parent.total)) {
      parentUpdate.status = 'paid'
    }
    await db.update(supplierInvoices).set(parentUpdate)
      .where(eq(supplierInvoices.id, data.parent_invoice_id))
  }

  // For type 'E' (egreso / credit note), adjust existing payable
  if (data.type === 'E' && data.purchase_order_id) {
    const payableRows = await db.select().from(payables)
      .where(eq(payables.purchaseOrderId, data.purchase_order_id))
    for (const p of payableRows) {
      const newAdjustments = Number(p.adjustments) + totalAmount
      const newBalance = Number(p.originalAmount) - newAdjustments - Number(p.amountPaid)
      await db.update(payables).set({
        adjustments: String(newAdjustments.toFixed(2)),
        balance: String(Math.max(0, newBalance).toFixed(2)),
        status: newBalance <= 0 ? 'paid' : p.status,
        updatedAt: sql`now()`,
      }).where(eq(payables.id, p.id))
    }
    await recalculateSupplierBalance(db, data.supplier_id)
  }

  await db.insert(changeJournal).values({
    tableName: 'supplier_invoices', recordId: invoice.id, action: 'insert',
    data: invoice, userId, synced: false,
  })

  return { ...invoice, items: insertedItems }
}

// ─── Update (pending only) ────────────────────────────────────
export async function update(
  db: any,
  id: string,
  data: UpdateSupplierInvoiceInput,
  userId: string
): Promise<any> {
  const [existing] = await db.select().from(supplierInvoices).where(eq(supplierInvoices.id, id))
  if (!existing) throw new Error('Factura de proveedor no encontrada')
  if (existing.status !== 'pending') throw new Error('Solo se pueden editar facturas pendientes')

  const updateData: any = { updatedAt: sql`now()` }
  if (data.invoice_number) updateData.invoiceNumber = data.invoice_number
  if (data.invoice_uuid !== undefined) updateData.invoiceUuid = data.invoice_uuid
  if (data.issue_date) updateData.issueDate = new Date(data.issue_date)
  if (data.payment_method !== undefined) updateData.paymentMethod = data.payment_method
  if (data.payment_form !== undefined) updateData.paymentForm = data.payment_form
  if (data.notes !== undefined) updateData.notes = data.notes

  if (data.items && data.items.length > 0) {
    await db.delete(supplierInvoiceItems).where(eq(supplierInvoiceItems.invoiceId, id))

    let subtotal = 0, totalTax = 0, totalAmount = 0
    const itemValues: any[] = []

    for (const item of data.items) {
      const taxRate = item.tax_rate ?? 0.16
      const lineSubtotal = item.quantity * item.unit_cost - (item.discount ?? 0)
      const taxAmount = lineSubtotal * taxRate
      const total = lineSubtotal + taxAmount
      subtotal += lineSubtotal; totalTax += taxAmount; totalAmount += total
      itemValues.push({
        invoiceId: id,
        description: item.description,
        quantity: String(item.quantity),
        unitCost: String(item.unit_cost),
        discount: String(item.discount ?? 0),
        taxRate: String(taxRate),
        taxAmount: String(taxAmount.toFixed(2)),
        total: String(total.toFixed(2)),
        productId: item.product_id ?? null,
        satCode: item.sat_code ?? null,
        satUnit: item.sat_unit ?? null,
      })
    }

    await db.insert(supplierInvoiceItems).values(itemValues)
    updateData.subtotal = String(subtotal.toFixed(2))
    updateData.taxAmount = String(totalTax.toFixed(2))
    updateData.total = String(totalAmount.toFixed(2))
  }

  const [updated] = await db.update(supplierInvoices).set(updateData).where(eq(supplierInvoices.id, id)).returning()
  const items = await db.select().from(supplierInvoiceItems).where(eq(supplierInvoiceItems.invoiceId, id))
  return { ...updated, items }
}

// ─── Get All ──────────────────────────────────────────────────
export async function getAll(
  db: any,
  filters: {
    supplier_id?: string; status?: string; type?: string; payment_method?: string;
    from?: string; to?: string; q?: string; page?: number; limit?: number
  }
): Promise<{ data: any[]; total: number; page: number; pages: number }> {
  const page = filters.page || 1
  const limit = filters.limit || 50
  const offset = (page - 1) * limit
  const conditions: any[] = []

  if (filters.supplier_id) conditions.push(eq(supplierInvoices.supplierId, filters.supplier_id))
  if (filters.status) conditions.push(eq(supplierInvoices.status, filters.status))
  if (filters.type) conditions.push(eq(supplierInvoices.type, filters.type))
  if (filters.payment_method) conditions.push(eq(supplierInvoices.paymentMethod, filters.payment_method))
  if (filters.from) conditions.push(gte(supplierInvoices.issueDate, new Date(filters.from)))
  if (filters.to) conditions.push(lte(supplierInvoices.issueDate, new Date(filters.to)))

  const where = conditions.length > 0 ? and(...conditions) : undefined

  const rows = await db.select().from(supplierInvoices)
    .where(where).orderBy(desc(supplierInvoices.createdAt)).limit(limit).offset(offset)

  // Enrich with supplier names
  const supplierIds = [...new Set(rows.map((r: any) => r.supplierId).filter(Boolean))]
  const supplierMap: Record<string, any> = {}
  if (supplierIds.length > 0) {
    const sups = await db.select({ id: suppliers.id, name: suppliers.name })
      .from(suppliers).where(inArray(suppliers.id, supplierIds as string[]))
    for (const s of sups) supplierMap[s.id] = s
  }
  const enriched = rows.map((r: any) => ({
    ...r,
    supplierName: supplierMap[r.supplierId]?.name || null,
  }))

  const countResult = await db.select({ count: sql<number>`count(*)::int` }).from(supplierInvoices).where(where)
  return { data: enriched, total: countResult[0]?.count ?? 0, page, pages: Math.ceil((countResult[0]?.count ?? 0) / limit) }
}

// ─── Get By ID ────────────────────────────────────────────────
export async function getById(db: any, id: string): Promise<any> {
  const [invoice] = await db.select().from(supplierInvoices).where(eq(supplierInvoices.id, id))
  if (!invoice) return null

  const items = await db.select().from(supplierInvoiceItems)
    .where(eq(supplierInvoiceItems.invoiceId, id))

  const [supplier] = await db.select().from(suppliers).where(eq(suppliers.id, invoice.supplierId))

  // If PPD invoice, enrich with complements
  if (invoice.paymentMethod === 'PPD') {
    const complements = await db.select().from(supplierInvoices)
      .where(eq(supplierInvoices.parentInvoiceId, id))
      .orderBy(asc(supplierInvoices.createdAt))
    return { ...invoice, items, supplier, complements }
  }

  return { ...invoice, items, supplier }
}

// ─── Get Complements ──────────────────────────────────────────
export async function getComplements(db: any, parentId: string): Promise<any[]> {
  return db.select().from(supplierInvoices)
    .where(eq(supplierInvoices.parentInvoiceId, parentId))
    .orderBy(asc(supplierInvoices.createdAt))
}

// ─── Parse CFDI 3.3 / 4.0 XML ───────────────────────────────
export async function parseXml(db: any, xmlContent: string): Promise<any> {
  const parser = new DOMParser()
  const doc = parser.parseFromString(xmlContent, 'text/xml')

  // Helper: get attribute from first element matching local name
  const getAttr = (parent: any, localName: string, attr: string): string => {
    const els = parent.getElementsByTagNameNS('*', localName)
    return els.length > 0 ? (els[0].getAttribute(attr) || '') : ''
  }

  // Comprobante root
  const root = doc.documentElement
  if (!root) throw new Error('XML inválido: no se encontró elemento raíz')

  const serie = root.getAttribute('Serie') || ''
  const folio = root.getAttribute('Folio') || ''
  const invoiceNumber = serie && folio ? `${serie}-${folio}` : folio || serie || ''
  const fecha = root.getAttribute('Fecha') || ''
  const subtotal = parseFloat(root.getAttribute('SubTotal') || '0')
  const total = parseFloat(root.getAttribute('Total') || '0')
  const moneda = root.getAttribute('Moneda') || 'MXN'
  const formaPago = root.getAttribute('FormaPago') || ''
  const metodoPago = root.getAttribute('MetodoPago') || ''
  const tipoComprobante = root.getAttribute('TipoDeComprobante') || 'I'

  // Emisor (supplier)
  const emisorRfc = getAttr(root, 'Emisor', 'Rfc')
  const emisorNombre = getAttr(root, 'Emisor', 'Nombre')

  // UUID from TimbreFiscalDigital
  const invoiceUuid = getAttr(root, 'TimbreFiscalDigital', 'UUID')

  // Total taxes
  const impuestosEls = root.getElementsByTagNameNS('*', 'Impuestos')
  let taxAmount = 0
  for (let i = 0; i < impuestosEls.length; i++) {
    // Only direct child of Comprobante (not inside Concepto)
    if (impuestosEls[i].parentNode === root) {
      taxAmount = parseFloat(impuestosEls[i].getAttribute('TotalImpuestosTrasladados') || '0')
      break
    }
  }

  // Conceptos (line items)
  const conceptoEls = root.getElementsByTagNameNS('*', 'Concepto')
  const items: any[] = []
  for (let i = 0; i < conceptoEls.length; i++) {
    const c = conceptoEls[i]
    const qty = parseFloat(c.getAttribute('Cantidad') || '0')
    const unitCost = parseFloat(c.getAttribute('ValorUnitario') || '0')
    const importe = parseFloat(c.getAttribute('Importe') || '0')

    // Per-item tax
    let itemTaxRate = 0.16
    let itemTaxAmount = 0
    const trasladoEls = c.getElementsByTagNameNS('*', 'Traslado')
    if (trasladoEls.length > 0) {
      itemTaxRate = parseFloat(trasladoEls[0].getAttribute('TasaOCuota') || '0.16')
      itemTaxAmount = parseFloat(trasladoEls[0].getAttribute('Importe') || '0')
    }

    items.push({
      description: c.getAttribute('Descripcion') || '',
      quantity: qty,
      unit_cost: unitCost,
      discount: 0,
      tax_rate: itemTaxRate,
      tax_amount: itemTaxAmount,
      sat_code: c.getAttribute('ClaveProdServ') || '',
      sat_unit: c.getAttribute('ClaveUnidad') || '',
      product_key: c.getAttribute('NoIdentificacion') || '',
    })
  }

  // Try to match supplier by RFC
  let matchedSupplier: any = null
  if (emisorRfc) {
    const rows = await db.select({ id: suppliers.id, name: suppliers.name })
      .from(suppliers).where(eq(suppliers.rfc, emisorRfc))
    if (rows.length > 0) matchedSupplier = rows[0]
  }

  // Handle type 'P' (complemento de pago)
  if (tipoComprobante === 'P') {
    const pagoEls = root.getElementsByTagNameNS('*', 'Pago')
    let complementAmount = 0
    let paymentDate = fecha ? fecha.split('T')[0] : new Date().toISOString().split('T')[0]
    let paymentFormP = ''
    let relatedUuid = ''

    if (pagoEls.length > 0) {
      const pago = pagoEls[0]
      complementAmount = parseFloat(pago.getAttribute('Monto') || '0')
      const fechaPago = pago.getAttribute('FechaPago') || ''
      if (fechaPago) paymentDate = fechaPago.split('T')[0]
      paymentFormP = pago.getAttribute('FormaDePagoP') || ''

      const doctoEls = pago.getElementsByTagNameNS('*', 'DoctoRelacionado')
      if (doctoEls.length > 0) {
        relatedUuid = doctoEls[0].getAttribute('IdDocumento') || ''
        const impPagado = parseFloat(doctoEls[0].getAttribute('ImpPagado') || '0')
        if (impPagado > 0) complementAmount = impPagado
      }
    }

    // Try to find parent invoice by UUID
    let parentInvoice: any = null
    if (relatedUuid) {
      const rows = await db.select({ id: supplierInvoices.id, invoiceNumber: supplierInvoices.invoiceNumber })
        .from(supplierInvoices).where(eq(supplierInvoices.invoiceUuid, relatedUuid))
      if (rows.length > 0) parentInvoice = rows[0]
    }

    return {
      invoiceNumber,
      invoiceUuid,
      issueDate: paymentDate,
      subtotal: 0,
      taxAmount: 0,
      total: complementAmount,
      currency: moneda,
      paymentMethod: '',
      paymentForm: paymentFormP,
      type: 'P',
      complementAmount,
      relatedUuid,
      parentInvoice,
      emisor: { rfc: emisorRfc, nombre: emisorNombre },
      matchedSupplier,
      items: [],
    }
  }

  return {
    invoiceNumber,
    invoiceUuid,
    issueDate: fecha ? fecha.split('T')[0] : new Date().toISOString().split('T')[0],
    subtotal,
    taxAmount,
    total,
    currency: moneda,
    paymentMethod: metodoPago,
    paymentForm: formaPago,
    type: tipoComprobante === 'E' ? 'E' : 'I',
    emisor: { rfc: emisorRfc, nombre: emisorNombre },
    matchedSupplier,
    items,
  }
}
