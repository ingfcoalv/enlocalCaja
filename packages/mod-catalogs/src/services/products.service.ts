import { products, changeJournal, productPrices, priceLists, categories } from '@enlocal/core-db'
import { eq, and, ilike, inArray, ne, sql, asc } from 'drizzle-orm'

interface ProductFilters {
  categoryId?: string
  active?: boolean
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

export async function listProducts(
  db: any,
  filters: ProductFilters
): Promise<PaginatedResult<any>> {
  const page = filters.page || 1
  const limit = filters.limit || 50
  const offset = (page - 1) * limit

  const conditions: any[] = []

  if (filters.categoryId) {
    conditions.push(eq(products.categoryId, filters.categoryId))
  }

  if (filters.active !== undefined) {
    conditions.push(eq(products.active, filters.active))
  }

  if (filters.q) {
    conditions.push(ilike(products.name, `%${filters.q}%`))
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined

  const rows = await db
    .select()
    .from(products)
    .where(where)
    .orderBy(asc(products.name))
    .limit(limit)
    .offset(offset)

  const countResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(products)
    .where(where)

  const total = countResult[0]?.count ?? 0

  // Fetch prices per list for all returned products
  const productIds = rows.map((r: any) => r.id)
  let pricesMap: Record<string, any[]> = {}

  if (productIds.length > 0) {
    const allPrices = await db
      .select({
        productId: productPrices.productId,
        priceListId: productPrices.priceListId,
        priceListName: priceLists.name,
        price: productPrices.price,
      })
      .from(productPrices)
      .innerJoin(priceLists, eq(productPrices.priceListId, priceLists.id))
      .where(inArray(productPrices.productId, productIds))

    for (const p of allPrices) {
      if (!pricesMap[p.productId]) pricesMap[p.productId] = []
      pricesMap[p.productId].push({
        priceListId: p.priceListId,
        priceListName: p.priceListName,
        price: p.price,
      })
    }
  }

  const data = rows.map((r: any) => ({
    ...r,
    prices: pricesMap[r.id] || [],
  }))

  return {
    data,
    total,
    page,
    pages: Math.ceil(total / limit),
  }
}

export async function createProduct(
  db: any,
  data: any,
  requestUserId: string
): Promise<any> {
  const { prices, ...productData } = data

  // Check SKU uniqueness (only for non-empty SKUs)
  if (productData.sku && productData.sku.trim() !== '') {
    const existing = await db
      .select({ id: products.id })
      .from(products)
      .where(eq(products.sku, productData.sku.trim()))
      .limit(1)
    if (existing.length > 0) {
      throw new Error(`El SKU "${productData.sku}" ya existe en otro producto`)
    }
  }

  const [row] = await db.insert(products).values(productData).returning()

  // Insert price list prices if provided
  if (prices && Array.isArray(prices) && prices.length > 0) {
    const toInsert = prices
      .filter((p: any) => parseFloat(p.price) > 0)
      .map((p: any) => ({
        productId: row.id,
        priceListId: p.priceListId,
        price: String(p.price),
      }))
    if (toInsert.length > 0) {
      await db.insert(productPrices).values(toInsert)
    }
  }

  await db.insert(changeJournal).values({
    tableName: 'products',
    recordId: row.id,
    action: 'insert',
    data: row,
    userId: requestUserId,
    synced: false,
  })

  return row
}

export async function updateProduct(
  db: any,
  id: string,
  data: any,
  requestUserId: string
): Promise<any> {
  const { prices, ...productData } = data

  // Check SKU uniqueness on update (exclude current product)
  if (productData.sku && productData.sku.trim() !== '') {
    const existing = await db
      .select({ id: products.id })
      .from(products)
      .where(and(eq(products.sku, productData.sku.trim()), ne(products.id, id)))
      .limit(1)
    if (existing.length > 0) {
      throw new Error(`El SKU "${productData.sku}" ya existe en otro producto`)
    }
  }

  const [row] = await db
    .update(products)
    .set({ ...productData, updatedAt: sql`now()` })
    .where(eq(products.id, id))
    .returning()

  if (!row) return null

  // Update price list prices if provided
  if (prices && Array.isArray(prices)) {
    await db.delete(productPrices).where(eq(productPrices.productId, id))
    const toInsert = prices
      .filter((p: any) => parseFloat(p.price) > 0)
      .map((p: any) => ({
        productId: id,
        priceListId: p.priceListId,
        price: String(p.price),
      }))
    if (toInsert.length > 0) {
      await db.insert(productPrices).values(toInsert)
    }
  }

  await db.insert(changeJournal).values({
    tableName: 'products',
    recordId: id,
    action: 'update',
    data: row,
    userId: requestUserId,
    synced: false,
  })

  return row
}

export async function deleteProduct(
  db: any,
  id: string,
  requestUserId: string
): Promise<any> {
  const [row] = await db
    .update(products)
    .set({ active: false, updatedAt: sql`now()` })
    .where(eq(products.id, id))
    .returning()

  if (!row) return null

  await db.insert(changeJournal).values({
    tableName: 'products',
    recordId: id,
    action: 'soft_delete',
    data: row,
    userId: requestUserId,
    synced: false,
  })

  return row
}

export async function bulkCreateProducts(
  db: any,
  items: any[],
  requestUserId: string
): Promise<any[]> {
  if (!items.length) return []

  const rows = await db.insert(products).values(items).returning()

  const journalEntries = rows.map((row: any) => ({
    tableName: 'products',
    recordId: row.id,
    action: 'insert',
    data: row,
    userId: requestUserId,
    synced: false,
  }))

  await db.insert(changeJournal).values(journalEntries)

  return rows
}

// ---------------------------------------------------------------------------
// Bulk Import: validate
// ---------------------------------------------------------------------------
export interface ImportRawRow {
  rowNum: number
  nombre: string
  sku: string
  codigo_barras: string
  categoria: string
  precio: string
  costo: string
  inventario: string
  stock_minimo: string
  tasa_iva: string
  tasa_ieps: string
  objeto_impuesto: string
  clave_sat: string
  unidad_sat: string
  venta_granel: string
  unidad_venta: string
  descripcion: string
}

export interface ValidatedRow {
  rowNum: number
  status: 'new' | 'update' | 'error'
  errors: string[]
  existingProductId?: string
  matchField?: string
  data: {
    name: string
    sku: string
    barcode: string
    categoryId: string | null
    categoryName: string
    price: string
    cost: string
    currentStock: string
    minStock: string
    taxRate: string
    iepsRate: string
    objetoImpuesto: string
    satCode: string
    satUnit: string
    sellByWeight: boolean
    saleUnit: string | null
    description: string
  }
}

export interface ImportValidation {
  rows: ValidatedRow[]
  stats: { total: number; new: number; updates: number; errors: number }
  newCategories: string[]
}

export async function validateImportData(
  db: any,
  rawRows: ImportRawRow[]
): Promise<ImportValidation> {
  // Fetch existing categories
  const existingCats = await db
    .select({ id: categories.id, name: categories.name })
    .from(categories)
    .where(eq(categories.active, true))
  const categoryMap = new Map<string, string>()
  for (const c of existingCats) categoryMap.set(c.name.toLowerCase().trim(), c.id)

  // Fetch existing products for duplicate detection
  const existingProds = await db
    .select({ id: products.id, sku: products.sku, barcode: products.barcode })
    .from(products)
    .where(eq(products.active, true))
  const skuMap = new Map<string, string>()
  const barcodeMap = new Map<string, string>()
  for (const p of existingProds) {
    if (p.sku && p.sku.trim()) skuMap.set(p.sku.toLowerCase().trim(), p.id)
    if (p.barcode && p.barcode.trim()) barcodeMap.set(p.barcode.trim(), p.id)
  }

  const validated: ValidatedRow[] = []
  const newCategoriesSet = new Set<string>()
  const seenSkus = new Set<string>()
  const seenBarcodes = new Set<string>()

  for (const raw of rawRows) {
    const errors: string[] = []
    const nombre = raw.nombre?.trim() || ''
    if (!nombre) errors.push('Nombre es requerido')

    const precio = parseFloat(raw.precio)
    if (!raw.precio || isNaN(precio) || precio <= 0) errors.push('Precio debe ser mayor a 0')

    const costo = raw.costo ? parseFloat(raw.costo) : 0
    if (raw.costo && raw.costo.trim() && isNaN(costo)) errors.push('Costo debe ser numerico')

    const inv = raw.inventario ? parseFloat(raw.inventario) : 0
    if (raw.inventario && raw.inventario.trim() && isNaN(inv)) errors.push('Inventario debe ser numerico')

    const minSt = raw.stock_minimo ? parseFloat(raw.stock_minimo) : 0
    if (raw.stock_minimo && raw.stock_minimo.trim() && isNaN(minSt)) errors.push('Stock minimo debe ser numerico')

    const taxRate = raw.tasa_iva && raw.tasa_iva.trim() ? parseFloat(raw.tasa_iva) : 0.16
    if (raw.tasa_iva && raw.tasa_iva.trim() && isNaN(taxRate)) errors.push('Tasa IVA debe ser numerica')

    const iepsRate = raw.tasa_ieps && raw.tasa_ieps.trim() ? parseFloat(raw.tasa_ieps) : 0
    if (raw.tasa_ieps && raw.tasa_ieps.trim() && isNaN(iepsRate)) errors.push('Tasa IEPS debe ser numerica')

    // Duplicate detection within CSV
    const sku = raw.sku?.trim() || ''
    const barcode = raw.codigo_barras?.trim() || ''

    if (sku && seenSkus.has(sku.toLowerCase())) {
      errors.push(`SKU "${sku}" duplicado en el archivo`)
    }
    if (sku) seenSkus.add(sku.toLowerCase())

    if (barcode && seenBarcodes.has(barcode)) {
      errors.push(`Codigo de barras "${barcode}" duplicado en el archivo`)
    }
    if (barcode) seenBarcodes.add(barcode)

    // Duplicate detection against DB
    let existingId: string | undefined
    let matchField: string | undefined
    if (sku && skuMap.has(sku.toLowerCase())) {
      existingId = skuMap.get(sku.toLowerCase())
      matchField = 'sku'
    } else if (barcode && barcodeMap.has(barcode)) {
      existingId = barcodeMap.get(barcode)
      matchField = 'barcode'
    }

    // Category resolution
    const catName = raw.categoria?.trim() || ''
    let categoryId: string | null = null
    if (catName) {
      categoryId = categoryMap.get(catName.toLowerCase().trim()) || null
      if (!categoryId) newCategoriesSet.add(catName)
    }

    const sellByWeight = ['si', 'sí', 'yes', 'true', '1'].includes(
      (raw.venta_granel || '').toLowerCase().trim()
    )

    const status: ValidatedRow['status'] =
      errors.length > 0 ? 'error' : existingId ? 'update' : 'new'

    validated.push({
      rowNum: raw.rowNum,
      status,
      errors,
      existingProductId: existingId,
      matchField,
      data: {
        name: nombre,
        sku,
        barcode,
        categoryId,
        categoryName: catName,
        price: isNaN(precio) ? '0' : String(precio),
        cost: isNaN(costo) ? '0' : String(costo),
        currentStock: isNaN(inv) ? '0' : String(inv),
        minStock: isNaN(minSt) ? '0' : String(minSt),
        taxRate: isNaN(taxRate) ? '0.16' : String(taxRate),
        iepsRate: isNaN(iepsRate) ? '0' : String(iepsRate),
        objetoImpuesto: raw.objeto_impuesto?.trim() || '02',
        satCode: raw.clave_sat?.trim() || '01010101',
        satUnit: raw.unidad_sat?.trim() || 'E48',
        sellByWeight,
        saleUnit: raw.unidad_venta?.trim() || null,
        description: raw.descripcion?.trim() || '',
      },
    })
  }

  return {
    rows: validated,
    stats: {
      total: validated.length,
      new: validated.filter((r) => r.status === 'new').length,
      updates: validated.filter((r) => r.status === 'update').length,
      errors: validated.filter((r) => r.status === 'error').length,
    },
    newCategories: Array.from(newCategoriesSet),
  }
}

// ---------------------------------------------------------------------------
// Bulk Import: execute
// ---------------------------------------------------------------------------
export async function executeImport(
  db: any,
  rows: ValidatedRow[],
  mode: 'skip' | 'update',
  userId: string
): Promise<{ created: number; updated: number; skipped: number }> {
  let created = 0
  let updated = 0
  let skipped = 0

  // Create missing categories
  const newCatNames = new Set<string>()
  for (const row of rows) {
    if (row.status !== 'error' && row.data.categoryName && !row.data.categoryId) {
      newCatNames.add(row.data.categoryName)
    }
  }

  const catNameToId = new Map<string, string>()
  for (const name of newCatNames) {
    const [cat] = await db.insert(categories).values({ name }).returning()
    catNameToId.set(name.toLowerCase().trim(), cat.id)
    await db.insert(changeJournal).values({
      tableName: 'categories',
      recordId: cat.id,
      action: 'insert',
      data: cat,
      userId,
      synced: false,
    })
  }

  // Also map existing categories
  const existingCats = await db
    .select({ id: categories.id, name: categories.name })
    .from(categories)
    .where(eq(categories.active, true))
  for (const c of existingCats) catNameToId.set(c.name.toLowerCase().trim(), c.id)

  for (const row of rows) {
    if (row.status === 'error') continue

    const categoryId = row.data.categoryName
      ? catNameToId.get(row.data.categoryName.toLowerCase().trim()) || null
      : null

    const productData: Record<string, any> = {
      name: row.data.name,
      sku: row.data.sku || null,
      barcode: row.data.barcode || null,
      categoryId,
      price: row.data.price,
      cost: row.data.cost,
      currentStock: row.data.currentStock,
      minStock: row.data.minStock,
      taxRate: row.data.taxRate,
      iepsRate: row.data.iepsRate,
      objetoImpuesto: row.data.objetoImpuesto,
      satCode: row.data.satCode,
      satUnit: row.data.satUnit,
      sellByWeight: row.data.sellByWeight,
      saleUnit: row.data.saleUnit,
      description: row.data.description,
      source: 'import',
    }

    if (row.status === 'update' && row.existingProductId) {
      if (mode === 'update') {
        const [updatedRow] = await db
          .update(products)
          .set({ ...productData, updatedAt: sql`now()` })
          .where(eq(products.id, row.existingProductId))
          .returning()
        await db.insert(changeJournal).values({
          tableName: 'products',
          recordId: row.existingProductId,
          action: 'update',
          data: updatedRow,
          userId,
          synced: false,
        })
        updated++
      } else {
        skipped++
      }
    } else {
      const [newRow] = await db.insert(products).values(productData).returning()
      await db.insert(changeJournal).values({
        tableName: 'products',
        recordId: newRow.id,
        action: 'insert',
        data: newRow,
        userId,
        synced: false,
      })
      created++
    }
  }

  return { created, updated, skipped }
}

// ---------------------------------------------------------------------------
// Export products as CSV
// ---------------------------------------------------------------------------
export async function exportProductsCSV(db: any): Promise<string> {
  const rows = await db
    .select({
      name: products.name,
      sku: products.sku,
      barcode: products.barcode,
      categoryName: categories.name,
      price: products.price,
      cost: products.cost,
      currentStock: products.currentStock,
      minStock: products.minStock,
      taxRate: products.taxRate,
      iepsRate: products.iepsRate,
      objetoImpuesto: products.objetoImpuesto,
      satCode: products.satCode,
      satUnit: products.satUnit,
      sellByWeight: products.sellByWeight,
      saleUnit: products.saleUnit,
      description: products.description,
    })
    .from(products)
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .where(eq(products.active, true))
    .orderBy(asc(products.name))

  const headers = [
    'nombre', 'sku', 'codigo_barras', 'categoria', 'precio', 'costo',
    'inventario', 'stock_minimo', 'tasa_iva', 'tasa_ieps', 'objeto_impuesto',
    'clave_sat', 'unidad_sat', 'venta_granel', 'unidad_venta', 'descripcion',
  ]

  const escapeCSV = (val: string | null | undefined): string => {
    const s = val ?? ''
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`
    }
    return s
  }

  const lines = [headers.join(',')]
  for (const r of rows) {
    lines.push([
      escapeCSV(r.name),
      escapeCSV(r.sku),
      escapeCSV(r.barcode),
      escapeCSV(r.categoryName),
      r.price ?? '0',
      r.cost ?? '0',
      r.currentStock ?? '0',
      r.minStock ?? '0',
      r.taxRate ?? '0.16',
      r.iepsRate ?? '0',
      escapeCSV(r.objetoImpuesto),
      escapeCSV(r.satCode),
      escapeCSV(r.satUnit),
      r.sellByWeight ? 'si' : 'no',
      escapeCSV(r.saleUnit),
      escapeCSV(r.description),
    ].join(','))
  }

  return lines.join('\n')
}
