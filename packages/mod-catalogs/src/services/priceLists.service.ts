import { priceLists, productPrices, changeJournal } from '@enlocal/core-db'
import { eq, and, asc, sql } from 'drizzle-orm'

export async function listPriceLists(db: any, activeOnly = false): Promise<any[]> {
  const conditions: any[] = []
  if (activeOnly) {
    conditions.push(eq(priceLists.active, true))
  }
  const where = conditions.length > 0 ? and(...conditions) : undefined

  return db
    .select()
    .from(priceLists)
    .where(where)
    .orderBy(asc(priceLists.name))
}

export async function createPriceList(
  db: any,
  data: { name: string; isDefault?: boolean },
  requestUserId: string
): Promise<any> {
  // If setting as default, unset other defaults first
  if (data.isDefault) {
    await db.update(priceLists).set({ isDefault: false }).where(eq(priceLists.isDefault, true))
  }

  const [row] = await db.insert(priceLists).values(data).returning()

  await db.insert(changeJournal).values({
    tableName: 'price_lists',
    recordId: row.id,
    action: 'insert',
    data: row,
    userId: requestUserId,
    synced: false,
  })

  return row
}

export async function updatePriceList(
  db: any,
  id: string,
  data: { name?: string; isDefault?: boolean; active?: boolean },
  requestUserId: string
): Promise<any> {
  // If setting as default, unset other defaults first
  if (data.isDefault) {
    await db.update(priceLists).set({ isDefault: false }).where(eq(priceLists.isDefault, true))
  }

  const [row] = await db
    .update(priceLists)
    .set({ ...data, updatedAt: sql`now()` })
    .where(eq(priceLists.id, id))
    .returning()

  if (!row) return null

  await db.insert(changeJournal).values({
    tableName: 'price_lists',
    recordId: id,
    action: 'update',
    data: row,
    userId: requestUserId,
    synced: false,
  })

  return row
}

export async function deletePriceList(
  db: any,
  id: string,
  requestUserId: string
): Promise<any> {
  const [row] = await db
    .update(priceLists)
    .set({ active: false, updatedAt: sql`now()` })
    .where(eq(priceLists.id, id))
    .returning()

  if (!row) return null

  await db.insert(changeJournal).values({
    tableName: 'price_lists',
    recordId: id,
    action: 'soft_delete',
    data: row,
    userId: requestUserId,
    synced: false,
  })

  return row
}

// --- Product Prices ---

export async function getProductPrices(
  db: any,
  productId: string
): Promise<any[]> {
  return db
    .select({
      id: productPrices.id,
      priceListId: productPrices.priceListId,
      priceListName: priceLists.name,
      price: productPrices.price,
    })
    .from(productPrices)
    .innerJoin(priceLists, eq(productPrices.priceListId, priceLists.id))
    .where(eq(productPrices.productId, productId))
    .orderBy(asc(priceLists.name))
}

export async function setProductPrices(
  db: any,
  productId: string,
  prices: { priceListId: string; price: string }[]
): Promise<void> {
  // Delete existing prices for this product
  await db.delete(productPrices).where(eq(productPrices.productId, productId))

  // Insert new prices (only those with price > 0)
  const toInsert = prices
    .filter((p) => parseFloat(p.price) > 0)
    .map((p) => ({
      productId,
      priceListId: p.priceListId,
      price: p.price,
    }))

  if (toInsert.length > 0) {
    await db.insert(productPrices).values(toInsert)
  }
}
