import {
  quotes, quoteItems, quoteEmails, quoteActivities,
  customers, products, services, settings, changeJournal,
} from '@enlocal/core-db'
import { eq, and, ilike, inArray, sql, asc, desc, gte, lte } from 'drizzle-orm'
import { getNextQuoteFolio } from './folio.service'
import { logActivity } from './activity.service'
import type { CreateQuoteInput, UpdateQuoteInput } from '../validators/quote.validator'

// ─── Helpers ───────────────────────────────────────────────────
function calcItemTotals(item: { quantity: number; unit_price: number; discount: number; tax_rate?: number }) {
  const taxRate = item.tax_rate ?? 0.16
  const lineSubtotal = item.quantity * item.unit_price - item.discount
  const taxAmount = lineSubtotal * taxRate
  const total = lineSubtotal + taxAmount
  return { lineSubtotal, taxAmount, total }
}

function buildItemValues(items: CreateQuoteInput['items'], idx_start: number = 0): any[] {
  return items.map((item, idx) => {
    const taxRate = item.tax_rate ?? 0.16
    const { lineSubtotal, taxAmount, total } = calcItemTotals({
      quantity: item.quantity,
      unit_price: item.unit_price,
      discount: item.discount ?? 0,
      tax_rate: taxRate,
    })

    return {
      itemType: item.item_type || 'product',
      productId: item.product_id || null,
      serviceId: item.service_id || null,
      itemName: item.item_name,
      itemDescription: item.item_description || null,
      itemSku: item.item_sku || null,
      quantity: String(item.quantity),
      unitPrice: String(item.unit_price),
      discount: String(item.discount ?? 0),
      taxRate: String(taxRate),
      taxAmount: String(taxAmount.toFixed(2)),
      total: String(total.toFixed(2)),
      groupName: item.group_name || null,
      isOptional: item.is_optional ?? false,
      satCode: item.sat_code || null,
      satUnit: item.sat_unit || 'E48',
      notes: item.notes || null,
      sortOrder: idx_start + idx,
      _lineSubtotal: lineSubtotal,
      _taxAmount: taxAmount,
      _total: total,
      _isOptional: item.is_optional ?? false,
    }
  })
}

// ─── Create ────────────────────────────────────────────────────
export async function create(
  db: any,
  data: CreateQuoteInput,
  userId: string,
  userName: string = 'Sistema'
): Promise<any> {
  const folio = await getNextQuoteFolio(db)

  // If customer_id, snapshot customer data
  let customerName = data.customer_name
  let customerEmail = data.customer_email
  let customerPhone = data.customer_phone
  let customerRfc = data.customer_rfc
  let customerAddress = data.customer_address

  if (data.customer_id) {
    const [customer] = await db.select().from(customers).where(eq(customers.id, data.customer_id))
    if (customer) {
      customerName = customer.name
      customerEmail = customerEmail || customer.email || null
      customerPhone = customerPhone || customer.phone || customer.cellphone || null
      customerRfc = customerRfc || customer.rfc || null
      customerAddress = customerAddress || customer.address || null
    }
  }

  // Get default T&C and valid days from settings
  let validDays = data.valid_days ?? 30
  let termsAndConditions = data.terms_and_conditions

  if (!termsAndConditions) {
    const [tcRow] = await db.select().from(settings).where(eq(settings.key, 'quote_terms_and_conditions'))
    termsAndConditions = tcRow?.value || null
  }
  if (!data.valid_days) {
    const [vdRow] = await db.select().from(settings).where(eq(settings.key, 'quote_valid_days'))
    if (vdRow) validDays = parseInt(vdRow.value) || 30
  }

  const validUntil = new Date()
  validUntil.setDate(validUntil.getDate() + validDays)

  // Build items and calculate totals (optionals don't sum)
  const itemValues = buildItemValues(data.items)

  let subtotal = 0
  let totalTax = 0
  let totalAmount = 0
  let totalDiscount = 0

  for (const iv of itemValues) {
    if (!iv._isOptional) {
      subtotal += iv._lineSubtotal
      totalTax += iv._taxAmount
      totalAmount += iv._total
      totalDiscount += parseFloat(iv.discount)
    }
  }

  const [quote] = await db.insert(quotes).values({
    folio,
    customerId: data.customer_id || null,
    customerName,
    customerEmail: customerEmail || null,
    customerPhone: customerPhone || null,
    customerRfc: customerRfc || null,
    customerAddress: customerAddress || null,
    subtotal: String(subtotal.toFixed(2)),
    discountAmount: String(totalDiscount.toFixed(2)),
    taxAmount: String(totalTax.toFixed(2)),
    total: String(totalAmount.toFixed(2)),
    validDays,
    validUntil,
    conditions: data.conditions || null,
    notes: data.notes || null,
    termsAndConditions: termsAndConditions || null,
    salesPersonName: data.sales_person_name || userName,
    isTemplate: data.is_template ?? false,
    templateName: data.template_name || null,
    followUpDate: data.follow_up_date ? new Date(data.follow_up_date) : null,
    followUpNotes: data.follow_up_notes || null,
    createdBy: userId,
  }).returning()

  // Insert items (strip internal calc fields)
  const dbItems = itemValues.map(({ _lineSubtotal, _taxAmount, _total, _isOptional, ...rest }) => ({
    ...rest,
    quoteId: quote.id,
  }))
  const insertedItems = await db.insert(quoteItems).values(dbItems).returning()

  // Log activity
  await logActivity(db, quote.id, 'created', `Cotizacion ${formattedFolio(quote)} creada`, userId)

  // Change journal
  await db.insert(changeJournal).values({
    tableName: 'quotes',
    recordId: quote.id,
    action: 'insert',
    data: quote,
    userId,
    synced: false,
  })

  return { ...quote, items: insertedItems }
}

// ─── Update (draft only) ──────────────────────────────────────
export async function update(
  db: any,
  id: string,
  data: UpdateQuoteInput,
  userId: string
): Promise<any> {
  const [existing] = await db.select().from(quotes).where(eq(quotes.id, id))
  if (!existing) throw new Error('Cotizacion no encontrada')
  if (existing.status !== 'draft') throw new Error('Solo se pueden editar cotizaciones en borrador')

  const updateData: any = { updatedAt: sql`now()` }

  if (data.customer_id) {
    const [customer] = await db.select().from(customers).where(eq(customers.id, data.customer_id))
    if (customer) {
      updateData.customerId = data.customer_id
      updateData.customerName = customer.name
      updateData.customerEmail = data.customer_email ?? customer.email ?? null
      updateData.customerPhone = data.customer_phone ?? customer.phone ?? customer.cellphone ?? null
      updateData.customerRfc = data.customer_rfc ?? customer.rfc ?? null
      updateData.customerAddress = data.customer_address ?? customer.address ?? null
    }
  } else {
    if (data.customer_name !== undefined) updateData.customerName = data.customer_name
    if (data.customer_email !== undefined) updateData.customerEmail = data.customer_email
    if (data.customer_phone !== undefined) updateData.customerPhone = data.customer_phone
    if (data.customer_rfc !== undefined) updateData.customerRfc = data.customer_rfc
    if (data.customer_address !== undefined) updateData.customerAddress = data.customer_address
  }

  if (data.valid_days !== undefined) {
    updateData.validDays = data.valid_days
    const validUntil = new Date(existing.createdAt)
    validUntil.setDate(validUntil.getDate() + data.valid_days)
    updateData.validUntil = validUntil
  }
  if (data.conditions !== undefined) updateData.conditions = data.conditions
  if (data.notes !== undefined) updateData.notes = data.notes
  if (data.terms_and_conditions !== undefined) updateData.termsAndConditions = data.terms_and_conditions
  if (data.sales_person_name !== undefined) updateData.salesPersonName = data.sales_person_name
  if (data.is_template !== undefined) updateData.isTemplate = data.is_template
  if (data.template_name !== undefined) updateData.templateName = data.template_name
  if (data.follow_up_date !== undefined) updateData.followUpDate = data.follow_up_date ? new Date(data.follow_up_date) : null
  if (data.follow_up_notes !== undefined) updateData.followUpNotes = data.follow_up_notes

  // Recalculate items if provided
  if (data.items && data.items.length > 0) {
    await db.delete(quoteItems).where(eq(quoteItems.quoteId, id))

    const itemValues = buildItemValues(data.items)

    let subtotal = 0, totalTax = 0, totalAmount = 0, totalDiscount = 0
    for (const iv of itemValues) {
      if (!iv._isOptional) {
        subtotal += iv._lineSubtotal
        totalTax += iv._taxAmount
        totalAmount += iv._total
        totalDiscount += parseFloat(iv.discount)
      }
    }

    const dbItems = itemValues.map(({ _lineSubtotal, _taxAmount, _total, _isOptional, ...rest }) => ({
      ...rest,
      quoteId: id,
    }))
    await db.insert(quoteItems).values(dbItems)

    updateData.subtotal = String(subtotal.toFixed(2))
    updateData.discountAmount = String(totalDiscount.toFixed(2))
    updateData.taxAmount = String(totalTax.toFixed(2))
    updateData.total = String(totalAmount.toFixed(2))
  }

  const [updated] = await db.update(quotes).set(updateData).where(eq(quotes.id, id)).returning()
  const items = await db.select().from(quoteItems).where(eq(quoteItems.quoteId, id)).orderBy(asc(quoteItems.sortOrder))

  await logActivity(db, id, 'updated', 'Cotizacion actualizada', userId)

  return { ...updated, items }
}

// ─── Get All ──────────────────────────────────────────────────
export async function getAll(
  db: any,
  filters: {
    status?: string; customer_id?: string; created_by?: string;
    from?: string; to?: string; q?: string; is_template?: string;
    needs_followup?: string; page?: number; limit?: number
  }
): Promise<{ data: any[]; total: number; page: number; pages: number }> {
  const page = filters.page || 1
  const limit = filters.limit || 50
  const offset = (page - 1) * limit
  const conditions: any[] = []

  if (filters.status) conditions.push(eq(quotes.status, filters.status))
  if (filters.customer_id) conditions.push(eq(quotes.customerId, filters.customer_id))
  if (filters.created_by) conditions.push(eq(quotes.createdBy, filters.created_by))
  if (filters.from) conditions.push(gte(quotes.createdAt, new Date(filters.from)))
  if (filters.to) conditions.push(lte(quotes.createdAt, new Date(filters.to)))
  if (filters.is_template === 'true') conditions.push(eq(quotes.isTemplate, true))
  if (filters.is_template === 'false') conditions.push(eq(quotes.isTemplate, false))
  if (filters.needs_followup === 'true') {
    conditions.push(lte(quotes.followUpDate, sql`now()`))
    conditions.push(inArray(quotes.status, ['draft', 'sent']))
  }
  if (filters.q) {
    conditions.push(
      sql`(${quotes.customerName} ILIKE ${'%' + filters.q + '%'} OR CAST(${quotes.folio} AS text) LIKE ${'%' + filters.q + '%'})`
    )
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined

  const rows = await db.select().from(quotes)
    .where(where).orderBy(desc(quotes.createdAt)).limit(limit).offset(offset)

  const countResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(quotes).where(where)

  return { data: rows, total: countResult[0]?.count ?? 0, page, pages: Math.ceil((countResult[0]?.count ?? 0) / limit) }
}

// ─── Get By ID ────────────────────────────────────────────────
export async function getById(db: any, id: string): Promise<any> {
  const [quote] = await db.select().from(quotes).where(eq(quotes.id, id))
  if (!quote) return null

  const items = await db.select().from(quoteItems)
    .where(eq(quoteItems.quoteId, id)).orderBy(asc(quoteItems.sortOrder))

  const emails = await db.select().from(quoteEmails)
    .where(eq(quoteEmails.quoteId, id)).orderBy(desc(quoteEmails.sentAt))

  const activities = await db.select().from(quoteActivities)
    .where(eq(quoteActivities.quoteId, id)).orderBy(asc(quoteActivities.createdAt))

  // Get versions (same folio or parent chain)
  let versions: any[] = []
  if (quote.parentQuoteId) {
    versions = await db.select().from(quotes)
      .where(eq(quotes.parentQuoteId, quote.parentQuoteId))
      .orderBy(asc(quotes.version))
    // Also include the parent
    const [parent] = await db.select().from(quotes).where(eq(quotes.id, quote.parentQuoteId))
    if (parent) versions = [parent, ...versions]
  } else {
    // This might be a parent; find children
    const children = await db.select().from(quotes)
      .where(eq(quotes.parentQuoteId, id))
      .orderBy(asc(quotes.version))
    if (children.length > 0) versions = [quote, ...children]
  }

  return { ...quote, items, emails, activities, versions }
}

// ─── New Version ──────────────────────────────────────────────
export async function newVersion(
  db: any,
  id: string,
  userId: string,
  userName: string = 'Sistema'
): Promise<any> {
  const existing = await getById(db, id)
  if (!existing) throw new Error('Cotizacion no encontrada')
  if (!['draft', 'sent', 'rejected'].includes(existing.status)) {
    throw new Error('Solo se pueden versionar cotizaciones en borrador, enviadas o rechazadas')
  }

  const parentId = existing.parentQuoteId || existing.id
  const newVer = existing.version + 1

  // Mark current as superseded
  await db.update(quotes).set({
    status: 'superseded',
    updatedAt: sql`now()`,
  }).where(eq(quotes.id, id))

  await logActivity(db, id, 'new_version', `Reemplazada por version ${newVer}`, userId)

  // Create new version
  const validUntil = new Date()
  validUntil.setDate(validUntil.getDate() + (existing.validDays || 30))

  const [newQuote] = await db.insert(quotes).values({
    folio: existing.folio,
    version: newVer,
    parentQuoteId: parentId,
    customerId: existing.customerId,
    customerName: existing.customerName,
    customerEmail: existing.customerEmail,
    customerPhone: existing.customerPhone,
    customerRfc: existing.customerRfc,
    customerAddress: existing.customerAddress,
    subtotal: existing.subtotal,
    discountAmount: existing.discountAmount,
    taxAmount: existing.taxAmount,
    total: existing.total,
    validDays: existing.validDays,
    validUntil,
    conditions: existing.conditions,
    notes: existing.notes,
    termsAndConditions: existing.termsAndConditions,
    salesPersonName: existing.salesPersonName,
    followUpDate: existing.followUpDate,
    followUpNotes: existing.followUpNotes,
    createdBy: userId,
  }).returning()

  // Copy items
  if (existing.items && existing.items.length > 0) {
    const newItems = existing.items.map((item: any) => ({
      quoteId: newQuote.id,
      itemType: item.itemType,
      productId: item.productId,
      serviceId: item.serviceId,
      itemName: item.itemName,
      itemDescription: item.itemDescription,
      itemSku: item.itemSku,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      discount: item.discount,
      taxRate: item.taxRate,
      taxAmount: item.taxAmount,
      total: item.total,
      groupName: item.groupName,
      isOptional: item.isOptional,
      satCode: item.satCode,
      satUnit: item.satUnit,
      notes: item.notes,
      sortOrder: item.sortOrder,
    }))
    await db.insert(quoteItems).values(newItems)
  }

  await logActivity(db, newQuote.id, 'created', `Version ${newVer} creada desde version ${existing.version}`, userId)

  return getById(db, newQuote.id)
}

// ─── Accept ───────────────────────────────────────────────────
export async function accept(db: any, id: string, userId: string): Promise<any> {
  const [existing] = await db.select().from(quotes).where(eq(quotes.id, id))
  if (!existing) throw new Error('Cotizacion no encontrada')
  if (!['sent', 'draft'].includes(existing.status)) throw new Error('Solo se pueden aceptar cotizaciones enviadas o en borrador')

  const [updated] = await db.update(quotes).set({
    status: 'accepted',
    acceptedAt: sql`now()`,
    updatedAt: sql`now()`,
  }).where(eq(quotes.id, id)).returning()

  await logActivity(db, id, 'accepted', 'Cotizacion aceptada', userId)
  return updated
}

// ─── Reject ───────────────────────────────────────────────────
export async function reject(db: any, id: string, reason: string, userId: string): Promise<any> {
  const [existing] = await db.select().from(quotes).where(eq(quotes.id, id))
  if (!existing) throw new Error('Cotizacion no encontrada')
  if (!['sent', 'draft'].includes(existing.status)) throw new Error('Solo se pueden rechazar cotizaciones enviadas o en borrador')

  const [updated] = await db.update(quotes).set({
    status: 'rejected',
    rejectedAt: sql`now()`,
    rejectedReason: reason,
    updatedAt: sql`now()`,
  }).where(eq(quotes.id, id)).returning()

  await logActivity(db, id, 'rejected', `Cotizacion rechazada: ${reason}`, userId)
  return updated
}

// ─── Cancel ───────────────────────────────────────────────────
export async function cancel(db: any, id: string, reason: string, userId: string): Promise<any> {
  const [existing] = await db.select().from(quotes).where(eq(quotes.id, id))
  if (!existing) throw new Error('Cotizacion no encontrada')
  if (['cancelled', 'converted'].includes(existing.status)) throw new Error('No se puede cancelar esta cotizacion')

  const [updated] = await db.update(quotes).set({
    status: 'cancelled',
    cancelledBy: userId,
    cancelledAt: sql`now()`,
    cancelReason: reason,
    updatedAt: sql`now()`,
  }).where(eq(quotes.id, id)).returning()

  await logActivity(db, id, 'cancelled', `Cotizacion cancelada: ${reason}`, userId)
  return updated
}

// ─── Mark as Sent ─────────────────────────────────────────────
export async function markAsSent(db: any, id: string, userId: string): Promise<any> {
  const [existing] = await db.select().from(quotes).where(eq(quotes.id, id))
  if (!existing) throw new Error('Cotizacion no encontrada')

  if (existing.status === 'draft') {
    await db.update(quotes).set({
      status: 'sent',
      updatedAt: sql`now()`,
    }).where(eq(quotes.id, id))
  }

  await logActivity(db, id, 'sent', 'Cotizacion enviada por email', userId)
}

// ─── From Template ────────────────────────────────────────────
export async function fromTemplate(
  db: any,
  templateId: string,
  customerData: { customer_id?: string; customer_name: string },
  userId: string,
  userName: string = 'Sistema'
): Promise<any> {
  const template = await getById(db, templateId)
  if (!template) throw new Error('Plantilla no encontrada')
  if (!template.isTemplate) throw new Error('La cotizacion seleccionada no es una plantilla')

  const createData: CreateQuoteInput = {
    customer_id: customerData.customer_id,
    customer_name: customerData.customer_name,
    is_template: false,
    valid_days: template.validDays,
    conditions: template.conditions,
    notes: template.notes,
    terms_and_conditions: template.termsAndConditions,
    sales_person_name: template.salesPersonName || userName,
    items: template.items.map((item: any) => ({
      item_type: item.itemType,
      product_id: item.productId || undefined,
      service_id: item.serviceId || undefined,
      item_name: item.itemName,
      item_description: item.itemDescription || undefined,
      item_sku: item.itemSku || undefined,
      quantity: parseFloat(item.quantity),
      unit_price: parseFloat(item.unitPrice),
      discount: parseFloat(item.discount || 0),
      tax_rate: parseFloat(item.taxRate || 0.16),
      group_name: item.groupName || undefined,
      is_optional: item.isOptional,
      sat_code: item.satCode || undefined,
      sat_unit: item.satUnit || undefined,
      notes: item.notes || undefined,
    })),
  }

  return create(db, createData, userId, userName)
}

// ─── Pipeline Stats ───────────────────────────────────────────
export async function getPipeline(db: any): Promise<any[]> {
  const statuses = ['draft', 'sent', 'accepted', 'rejected', 'expired', 'converted', 'cancelled']
  const result = await db
    .select({
      status: quotes.status,
      count: sql<number>`count(*)::int`,
      total: sql<string>`coalesce(sum(${quotes.total}::numeric), 0)`,
    })
    .from(quotes)
    .where(eq(quotes.isTemplate, false))
    .groupBy(quotes.status)

  const pipeline = statuses.map(s => {
    const row = result.find((r: any) => r.status === s)
    return { status: s, count: row?.count ?? 0, total: parseFloat(row?.total ?? '0') }
  })

  return pipeline
}

export async function getConversionRate(db: any): Promise<{ total: number; converted: number; rate: number }> {
  const [totalRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(quotes)
    .where(and(eq(quotes.isTemplate, false), inArray(quotes.status, ['accepted', 'converted', 'rejected', 'expired', 'cancelled'])))

  const [convertedRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(quotes)
    .where(and(eq(quotes.isTemplate, false), inArray(quotes.status, ['accepted', 'converted'])))

  const total = totalRow?.count ?? 0
  const converted = convertedRow?.count ?? 0
  const rate = total > 0 ? (converted / total) * 100 : 0

  return { total, converted, rate: Math.round(rate * 10) / 10 }
}

export async function getNeedsFollowUp(db: any): Promise<any[]> {
  return db.select().from(quotes)
    .where(
      and(
        lte(quotes.followUpDate, sql`now()`),
        inArray(quotes.status, ['draft', 'sent']),
        eq(quotes.isTemplate, false)
      )
    )
    .orderBy(asc(quotes.followUpDate))
}

export async function getExpiringSoon(db: any, withinDays: number = 3): Promise<any[]> {
  const threshold = new Date()
  threshold.setDate(threshold.getDate() + withinDays)

  return db.select().from(quotes)
    .where(
      and(
        lte(quotes.validUntil, threshold),
        gte(quotes.validUntil, sql`now()`),
        eq(quotes.status, 'sent'),
        eq(quotes.isTemplate, false)
      )
    )
    .orderBy(asc(quotes.validUntil))
}

// ─── Helper ───────────────────────────────────────────────────
function formattedFolio(q: any): string {
  return `${q.series || 'COT'}-${String(q.folio).padStart(4, '0')} v${q.version || 1}`
}
