/**
 * Payload builders — transform local (camelCase) entities to cloud (snake_case) format.
 * Pure functions, no side effects.
 */

const SOURCE = 'enlocal_caja'

function toISO(d: unknown): string | null {
  if (!d) return null
  if (d instanceof Date) return d.toISOString()
  return String(d)
}

// ─── Price Lists → Cloud price_lists ─────────────────────

export function buildPriceListPayload(
  row: Record<string, any>
): Record<string, unknown> {
  return {
    name: row.name,
    is_default: row.isDefault ?? false,
    is_active: row.active !== false,
    source: SOURCE,
    created_at: toISO(row.createdAt),
    updated_at: toISO(row.updatedAt),
  }
}

// ─── Categories → Cloud subcategories ────────────────────

export function buildCategoryPayload(
  row: Record<string, any>,
  parentCloudId?: string | null
): Record<string, unknown> {
  return {
    name: row.name,
    order: row.sortOrder ?? 0,
    parent_category_id: parentCloudId ?? null,
    is_active: row.active !== false,
    source: SOURCE,
    created_at: toISO(row.createdAt),
    updated_at: toISO(row.updatedAt),
  }
}

// ─── Products → Cloud products ───────────────────────────

export interface PriceListEntry {
  priceListCloudId: string | null
  priceListName: string
  price: number
}

export function buildProductPayload(
  row: Record<string, any>,
  categoryCloudId?: string | null,
  priceListPrices?: PriceListEntry[]
): Record<string, unknown> {
  const wholesaleTiers = Array.isArray(row.wholesaleTiers)
    ? row.wholesaleTiers.map((t: any) => ({
        min_quantity: t.minQty ?? t.min_quantity,
        unit_price: t.price ?? t.unit_price,
      }))
    : []

  const priceLists = (priceListPrices ?? [])
    .filter((p) => p.priceListCloudId)
    .map((p) => ({
      price_list_id: p.priceListCloudId,
      price_list_name: p.priceListName,
      price: p.price,
    }))

  return {
    name: row.name,
    sku: row.sku || `POS-${(row.id ?? '').slice(0, 8)}`,
    barcode: row.barcode || null,
    description_short: row.description || null,
    brand: row.brand || null,
    pricing: {
      retail_price: parseFloat(row.price ?? '0'),
      purchase_price: parseFloat(row.cost ?? '0'),
      compare_at_price: row.wholesalePrice != null ? parseFloat(row.wholesalePrice) : null,
      wholesale_enabled: row.wholesaleEnabled ?? false,
      wholesale_tiers: wholesaleTiers,
      price_lists: priceLists,
    },
    subcategory_id: categoryCloudId ?? null,
    stock_min: row.minStock != null ? parseFloat(row.minStock) : 0,
    sat_code: row.satCode || null,
    sat_unit: row.satUnit || null,
    tax_config: {
      iva_rate: parseFloat(row.taxRate ?? '0.16'),
      tax_object: row.objetoImpuesto || '02',
      ieps_rate: parseFloat(row.iepsRate ?? '0'),
    },
    is_active: row.active !== false,
    hidden_from_marketplace: row.hiddenFromMarketplace ?? false,
    source: SOURCE,
    created_at: toISO(row.createdAt),
    updated_at: toISO(row.updatedAt),
  }
}

// ─── Customers → Cloud business_clients ──────────────────

export function buildCustomerPayload(
  row: Record<string, any>,
  priceListCloudId?: string | null
): Record<string, unknown> {
  return {
    rfc: row.rfc || null,
    razon_social: row.razonSocial || row.name || null,
    regimen_fiscal: row.regimenFiscal || null,
    uso_cfdi: row.usoCfdi || null,
    domicilio_fiscal: row.codigoPostalFiscal || null,
    email: row.email || null,
    phone: row.phone || null,
    notes: row.notes || null,
    is_active: row.active !== false,
    discount_default_percent: row.defaultDiscount != null ? parseFloat(row.defaultDiscount) : 0,
    price_list_id: priceListCloudId ?? null,
    source: SOURCE,
    created_at: toISO(row.createdAt),
    updated_at: toISO(row.updatedAt),
  }
}

// ─── Registers → Cloud registers ────────────────────────

export function buildRegisterPayload(
  row: Record<string, any>
): Record<string, unknown> {
  return {
    name: row.name,
    series: row.series ?? null,
    is_active: row.isActive ?? row.is_active ?? true,
    source: SOURCE,
    created_at: toISO(row.createdAt ?? row.created_at),
  }
}

// ─── Cashiers → Cloud cashiers (bidirectional) ─────────

export function buildCashierPayload(
  row: Record<string, any>,
  registerCloudIds?: string[]
): Record<string, unknown> {
  return {
    full_name: row.name,
    pin: row.pinHash ?? row.pin_hash ?? '',
    role: row.role ?? 'cashier',
    is_active: row.active !== false,
    register_ids: registerCloudIds ?? [],
    source: SOURCE,
    created_at: toISO(row.createdAt ?? row.created_at),
    updated_at: toISO(row.updatedAt ?? row.updated_at),
  }
}

// ─── Cash Movements → Cloud cash_movements ──────────────

export function buildCashMovementPayload(
  row: Record<string, any>
): Record<string, unknown> {
  return {
    register_id: row.registerId ?? row.register_id ?? null,
    shift_id: row.shiftId ?? row.shift_id ?? null,
    type: row.type,
    amount: parseFloat(row.amount ?? '0'),
    reason: row.reason,
    notes: row.notes ?? null,
    cashier_id: row.userId ?? row.user_id ?? null,
    cashier_name: row.cashierName ?? row.cashier_name ?? null,
    authorized_by: row.authorizedBy ?? row.authorized_by ?? null,
    related_movement_id: row.relatedMovementId ?? row.related_movement_id ?? null,
    source: SOURCE,
    created_at: toISO(row.createdAt ?? row.created_at),
  }
}

// ─── Shift Close → Cloud shift_closes ───────────────────

export function buildShiftClosePayload(
  row: Record<string, any>
): Record<string, unknown> {
  return {
    register_id: row.registerId ?? row.register_id ?? null,
    cashier_id: row.userId ?? row.user_id ?? null,
    cashier_name: row.cashierName ?? row.cashier_name ?? null,
    opening_amount: parseFloat(row.openingAmount ?? row.opening_amount ?? '0'),
    closing_amount: parseFloat(row.closingAmount ?? row.closing_amount ?? '0'),
    expected_amount: parseFloat(row.expectedAmount ?? row.expected_amount ?? '0'),
    difference: parseFloat(row.difference ?? '0'),
    sales_total: parseFloat(row.totalSales ?? row.total_sales ?? '0'),
    total_cash_sales: parseFloat(row.totalCashSales ?? row.total_cash_sales ?? '0'),
    total_card_sales: parseFloat(row.totalCardSales ?? row.total_card_sales ?? '0'),
    total_transfer_sales: parseFloat(row.totalTransferSales ?? row.total_transfer_sales ?? '0'),
    total_deposits: parseFloat(row.totalDeposits ?? row.total_deposits ?? '0'),
    total_withdrawals: parseFloat(row.totalWithdrawals ?? row.total_withdrawals ?? '0'),
    transactions_count: row.transactionsCount ?? row.transactions_count ?? 0,
    sales_count: row.salesCount ?? row.sales_count ?? row.transactionsCount ?? row.transactions_count ?? 0,
    notes: row.notes ?? null,
    opened_at: toISO(row.openedAt ?? row.opened_at),
    closed_at: toISO(row.closedAt ?? row.closed_at),
    source: SOURCE,
  }
}

// ─── Sales → Cloud sales ────────────────────────────────

const PAYMENT_METHOD_MAP: Record<string, string> = {
  cash: 'CASH',
  card: 'CARD',
  transfer: 'TRANSFER',
  credit: 'CREDIT',
}

function resolvePaymentMethod(
  payments: Array<{ method: string; amount?: number }>
): string {
  if (!payments || payments.length === 0) return 'CASH'
  const methods = new Set(payments.map((p) => p.method))
  if (methods.size > 1) return 'mixed'
  return PAYMENT_METHOD_MAP[payments[0].method] || payments[0].method.toUpperCase()
}

export function buildSalePayload(
  invoice: Record<string, any>,
  items: Array<Record<string, any>>,
  payments: Array<Record<string, any>>,
  userCloudId?: string | null,
  registerCloudId?: string | null
): Record<string, unknown> {
  const mappedItems = items.map((item) => {
    const unitPrice = parseFloat(item.price ?? item.unitPrice ?? '0')
    const qty = parseFloat(item.quantity ?? '0')
    const taxRate = parseFloat(item.taxRate ?? '0.16')
    return {
      product_id: item.productCloudId ?? null,
      product_name: item.name ?? item.description ?? '',
      unit_price: unitPrice,
      quantity: qty,
      line_total: unitPrice * qty,
      taxes: {
        iva_rate: taxRate,
        tax_object: item.objetoImpuesto || '02',
        ieps_rate: parseFloat(item.iepsRate ?? '0'),
      },
      modifiers: [],
    }
  })

  const mappedPayments = payments.map((p) => ({
    method: PAYMENT_METHOD_MAP[p.method] || p.method.toUpperCase(),
    amount: parseFloat(p.amount ?? '0'),
    reference: p.reference || null,
  }))

  const status = invoice.status === 'paid' || invoice.status === 'credit'
    ? 'completed'
    : invoice.status

  return {
    items: mappedItems,
    payments: mappedPayments,
    payment_method: resolvePaymentMethod(payments as any),
    subtotal: parseFloat(invoice.subtotal ?? '0'),
    tax: parseFloat(invoice.tax ?? '0'),
    total: parseFloat(invoice.total ?? '0'),
    discount: 0,
    status,
    notes: invoice.observations || null,
    ticket_number: invoice.ticketNumber ?? invoice.ticket_number ?? null,
    source: SOURCE,
    is_offline_sale: true,
    created_at: toISO(invoice.createdAt),
    cashier_id: userCloudId ?? null,
    register_id: registerCloudId ?? null,
  }
}
