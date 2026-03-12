import {
  quotes, quoteItems, invoices, invoiceItems,
  remissionNotes, remissionNoteItems, customers, settings,
} from '@enlocal/core-db'
import { eq, sql, inArray } from 'drizzle-orm'
import { logActivity } from './activity.service'

// ─── Convert to Ticket (Invoice) ─────────────────────────────
export async function convertToTicket(
  db: any,
  quoteId: string,
  paymentType: string = 'cash',
  userId: string
): Promise<any> {
  const [quote] = await db.select().from(quotes).where(eq(quotes.id, quoteId))
  if (!quote) throw new Error('Cotizacion no encontrada')
  if (quote.status !== 'accepted') throw new Error('Solo se pueden convertir cotizaciones aceptadas')

  // Get quote items (exclude optional)
  const items = await db.select().from(quoteItems)
    .where(eq(quoteItems.quoteId, quoteId))

  const ticketItems = items.filter((i: any) => !i.isOptional)

  if (ticketItems.length === 0) throw new Error('No hay items para incluir en el ticket')

  // Create ticket
  const [ticket] = await db.insert(invoices).values({
    series: 'COT',
    folio: quote.folio,
    customerId: quote.customerId,
    type: 'I',
    status: 'draft',
    paymentMethod: paymentType === 'credit' ? 'PPD' : 'PUE',
    subtotal: quote.subtotal,
    tax: quote.taxAmount,
    total: quote.total,
    source: 'quote',
    observations: `Cotizacion ${quote.series}-${String(quote.folio).padStart(4, '0')} v${quote.version}`,
  }).returning()

  // Copy items to invoice
  if (ticketItems.length > 0) {
    const invoiceItemValues = ticketItems.map((item: any) => ({
      invoiceId: ticket.id,
      description: item.itemName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      amount: item.total,
      discount: item.discount,
      productId: item.productId,
      satCode: item.satCode,
      satUnit: item.satUnit,
      taxRate: item.taxRate,
    }))
    await db.insert(invoiceItems).values(invoiceItemValues)
  }

  // Update quote status
  await db.update(quotes).set({
    status: 'converted',
    convertedToTicketId: ticket.id,
    convertedAt: sql`now()`,
    updatedAt: sql`now()`,
  }).where(eq(quotes.id, quoteId))

  await logActivity(db, quoteId, 'converted', `Convertida a ticket #${ticket.folio}`, userId)

  return { quote: { ...quote, status: 'converted' }, ticket }
}

// ─── Convert to Remission ─────────────────────────────────────
export async function convertToRemission(
  db: any,
  quoteId: string,
  paymentType: string = 'cash',
  userId: string
): Promise<any> {
  const [quote] = await db.select().from(quotes).where(eq(quotes.id, quoteId))
  if (!quote) throw new Error('Cotizacion no encontrada')
  if (quote.status !== 'accepted') throw new Error('Solo se pueden convertir cotizaciones aceptadas')
  if (!quote.customerId) throw new Error('La cotizacion debe tener un cliente asignado para crear una remision')

  // Verify customer exists
  const [customer] = await db.select().from(customers).where(eq(customers.id, quote.customerId))
  if (!customer) throw new Error('Cliente no encontrado')

  // Get quote items — only products (not services or custom), exclude optional
  const items = await db.select().from(quoteItems)
    .where(eq(quoteItems.quoteId, quoteId))

  const productItems = items.filter((i: any) => !i.isOptional && i.itemType === 'product' && i.productId)

  if (productItems.length === 0) throw new Error('No hay productos para incluir en la remision (servicios e items custom no se incluyen)')

  // Get next remission folio
  const [maxRow] = await db
    .select({ maxFolio: sql<number>`coalesce(max(${remissionNotes.folio}), 0)` })
    .from(remissionNotes)
    .where(eq(remissionNotes.series, 'NR'))

  const [configRow] = await db.select().from(settings)
    .where(eq(settings.key, 'remission_starting_folio'))

  const maxCurrent = maxRow?.maxFolio ?? 0
  const startingFolio = configRow ? parseInt(configRow.value) : 0
  const nextFolio = Math.max(maxCurrent, startingFolio - 1) + 1

  // Calculate totals for product items only
  let subtotal = 0, totalTax = 0, totalAmount = 0
  for (const item of productItems) {
    const lineSubtotal = parseFloat(item.quantity) * parseFloat(item.unitPrice) - parseFloat(item.discount || '0')
    const taxAmt = parseFloat(item.taxAmount || '0')
    subtotal += lineSubtotal
    totalTax += taxAmt
    totalAmount += parseFloat(item.total)
  }

  // Credit check if needed
  let creditDays: number | null = null
  let dueDate: Date | null = null
  if (paymentType === 'credit') {
    if (!customer.creditEnabled) throw new Error('Cliente no tiene credito habilitado')
    creditDays = Number(customer.creditDays) || 0
    dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + creditDays)
  }

  // Create remission note in draft
  const [remission] = await db.insert(remissionNotes).values({
    folio: nextFolio,
    customerId: quote.customerId,
    customerName: customer.name,
    customerRfc: customer.rfc || null,
    paymentType,
    creditDays,
    dueDate,
    status: 'draft',
    subtotal: String(subtotal.toFixed(2)),
    taxAmount: String(totalTax.toFixed(2)),
    total: String(totalAmount.toFixed(2)),
    deliveryAddress: quote.customerAddress || null,
    internalNotes: `Desde cotizacion ${quote.series}-${String(quote.folio).padStart(4, '0')} v${quote.version}`,
    createdBy: userId,
  }).returning()

  // Copy product items
  const remissionItemValues = productItems.map((item: any, idx: number) => ({
    remissionNoteId: remission.id,
    productId: item.productId,
    productName: item.itemName,
    productSku: item.itemSku || null,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    discount: item.discount || '0',
    taxRate: item.taxRate || '0.1600',
    taxAmount: item.taxAmount || '0',
    total: item.total,
    satCode: item.satCode || null,
    satUnit: item.satUnit || 'E48',
    notes: item.notes || null,
    sortOrder: idx,
  }))
  await db.insert(remissionNoteItems).values(remissionItemValues)

  // Update quote status
  await db.update(quotes).set({
    status: 'converted',
    convertedToRemissionId: remission.id,
    convertedAt: sql`now()`,
    updatedAt: sql`now()`,
  }).where(eq(quotes.id, quoteId))

  await logActivity(db, quoteId, 'converted', `Convertida a remision NR-${String(nextFolio).padStart(4, '0')}`, userId)

  return { quote: { ...quote, status: 'converted' }, remission }
}
