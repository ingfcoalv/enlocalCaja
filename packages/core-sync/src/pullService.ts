/**
 * Pull service — downloads changes from cloud API.
 * GET /api/v2/pos-sync/pull?token={terminal_token}&since={lastSync}
 * Maps cloud entities to local DB schema and upserts by cloud_id.
 */

import type { Pool } from 'pg'
import type {
  SyncConfig,
  PullResponse,
  PullResult,
  CloudCategory,
  CloudProduct,
  CloudCashier,
  CloudClient,
  CloudRegister,
} from './types'

// ─── Helpers ──────────────────────────────────────────────

async function getLastPullTimestamp(db: Pool): Promise<string> {
  const result = await db.query(
    `SELECT value FROM sync_state WHERE key = 'last_pull_timestamp'`
  )
  return result.rows[0]?.value || '1970-01-01T00:00:00.000Z'
}

/**
 * Resolve a cloud_id to a local UUID in the given table.
 * Returns null if not found.
 */
async function resolveLocalId(db: Pool, table: string, cloudId: string): Promise<string | null> {
  const result = await db.query(
    `SELECT id FROM "${table}" WHERE cloud_id = $1 LIMIT 1`,
    [cloudId]
  )
  return result.rows[0]?.id ?? null
}

// ─── Upsert Categories ───────────────────────────────────

async function upsertCategories(db: Pool, categories: CloudCategory[]): Promise<number> {
  let count = 0

  for (const cat of categories) {
    // Resolve parent_category_id → local parent_id
    let parentId: string | null = null
    if (cat.parent_category_id) {
      parentId = await resolveLocalId(db, 'categories', cat.parent_category_id)
    }

    try {
      await db.query(
        `INSERT INTO categories (id, cloud_id, name, sort_order, parent_id, active, created_at, updated_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, NOW(), NOW())
         ON CONFLICT (cloud_id) WHERE cloud_id IS NOT NULL DO UPDATE SET
           name = EXCLUDED.name,
           sort_order = EXCLUDED.sort_order,
           parent_id = EXCLUDED.parent_id,
           active = EXCLUDED.active,
           updated_at = NOW()`,
        [cat.id, cat.name, cat.order ?? 0, parentId, cat.is_active]
      )
      count++
    } catch (err) {
      console.error('[pull-service] Upsert category failed:', cat.id, err)
    }
  }

  return count
}

// ─── Upsert Products ─────────────────────────────────────

async function upsertProducts(db: Pool, products: CloudProduct[]): Promise<number> {
  let count = 0

  for (const prod of products) {
    // Resolve subcategory_id → local category_id
    let categoryId: string | null = null
    if (prod.subcategory_id) {
      categoryId = await resolveLocalId(db, 'categories', prod.subcategory_id)
    }

    const source = prod.source === 'dashboard' ? 'cloud' : (prod.source || 'cloud')

    try {
      await db.query(
        `INSERT INTO products (
           id, cloud_id, name, description, price, cost,
           wholesale_price, wholesale_enabled, sku, sat_code, sat_unit,
           tax_rate, ieps_rate, category_id, active,
           hidden_from_marketplace, min_stock, source, created_at, updated_at
         )
         VALUES (
           gen_random_uuid(), $1, $2, $3, $4, $5,
           $6, $7, $8, $9, $10,
           $11, $12, $13, $14,
           $15, $16, $17, NOW(), NOW()
         )
         ON CONFLICT (cloud_id) WHERE cloud_id IS NOT NULL DO UPDATE SET
           name = EXCLUDED.name,
           description = EXCLUDED.description,
           price = EXCLUDED.price,
           cost = EXCLUDED.cost,
           wholesale_price = EXCLUDED.wholesale_price,
           wholesale_enabled = EXCLUDED.wholesale_enabled,
           sku = EXCLUDED.sku,
           sat_code = EXCLUDED.sat_code,
           sat_unit = EXCLUDED.sat_unit,
           tax_rate = EXCLUDED.tax_rate,
           ieps_rate = EXCLUDED.ieps_rate,
           category_id = EXCLUDED.category_id,
           active = EXCLUDED.active,
           hidden_from_marketplace = EXCLUDED.hidden_from_marketplace,
           min_stock = EXCLUDED.min_stock,
           source = EXCLUDED.source,
           updated_at = NOW()`,
        [
          prod.id,                                         // $1 cloud_id
          prod.name,                                       // $2
          prod.description_short ?? null,                   // $3 description
          prod.pricing?.price ?? 0,                         // $4 price
          prod.pricing?.cost ?? 0,                          // $5 cost
          prod.pricing?.wholesale_price ?? null,            // $6 wholesale_price
          prod.is_wholesale ?? false,                       // $7 wholesale_enabled
          prod.sku ?? null,                                 // $8
          prod.sat_code ?? null,                            // $9
          prod.sat_unit ?? 'E48',                           // $10
          prod.tax_config?.iva_rate ?? 0.16,                // $11 tax_rate
          prod.tax_config?.ieps_rate ?? 0,                  // $12 ieps_rate
          categoryId,                                       // $13 category_id
          prod.is_active,                                   // $14 active
          prod.hidden_from_marketplace ?? false,            // $15
          prod.stock_min ?? 0,                              // $16 min_stock
          source,                                           // $17
        ]
      )
      count++
    } catch (err) {
      console.error('[pull-service] Upsert product failed:', prod.id, err)
    }
  }

  return count
}

// ─── Upsert Cashiers → users table ──────────────────────

async function upsertCashiers(
  db: Pool,
  cashiers: CloudCashier[],
  hashPin?: (pin: string) => Promise<string>
): Promise<number> {
  let count = 0

  for (const cashier of cashiers) {
    try {
      // Hash PIN if hashPin function is provided, otherwise store raw
      const pinHash = hashPin ? await hashPin(cashier.pin) : cashier.pin

      await db.query(
        `INSERT INTO users (id, cloud_id, name, pin_hash, role, active, created_at, updated_at)
         VALUES (gen_random_uuid(), $1, $2, $3, 'cashier', $4, NOW(), NOW())
         ON CONFLICT (cloud_id) WHERE cloud_id IS NOT NULL DO UPDATE SET
           name = EXCLUDED.name,
           pin_hash = EXCLUDED.pin_hash,
           active = EXCLUDED.active,
           updated_at = NOW()`,
        [cashier.id, cashier.name, pinHash, cashier.is_active]
      )
      count++
    } catch (err) {
      console.error('[pull-service] Upsert cashier failed:', cashier.id, err)
    }
  }

  return count
}

// ─── Upsert Clients → customers table ───────────────────

async function upsertClients(db: Pool, clients: CloudClient[]): Promise<number> {
  let count = 0

  for (const client of clients) {
    try {
      await db.query(
        `INSERT INTO customers (
           id, cloud_id, name, rfc, razon_social, regimen_fiscal,
           uso_cfdi, codigo_postal, email, phone, notes, active,
           created_at, updated_at
         )
         VALUES (
           gen_random_uuid(), $1, $2, $3, $4, $5,
           $6, $7, $8, $9, $10, $11,
           NOW(), NOW()
         )
         ON CONFLICT (cloud_id) WHERE cloud_id IS NOT NULL DO UPDATE SET
           name = EXCLUDED.name,
           rfc = EXCLUDED.rfc,
           razon_social = EXCLUDED.razon_social,
           regimen_fiscal = EXCLUDED.regimen_fiscal,
           uso_cfdi = EXCLUDED.uso_cfdi,
           codigo_postal = EXCLUDED.codigo_postal,
           email = EXCLUDED.email,
           phone = EXCLUDED.phone,
           notes = EXCLUDED.notes,
           active = EXCLUDED.active,
           updated_at = NOW()`,
        [
          client.id,                                       // $1 cloud_id
          client.razon_social || client.rfc || 'Sin nombre', // $2 name
          client.rfc ?? null,                              // $3
          client.razon_social ?? null,                     // $4
          client.regimen_fiscal ?? null,                   // $5
          client.uso_cfdi ?? 'G03',                        // $6
          client.domicilio_fiscal ?? null,                 // $7 codigo_postal
          client.email ?? null,                            // $8
          client.phone ?? null,                            // $9
          client.notes ?? null,                            // $10
          client.is_active,                                // $11
        ]
      )
      count++
    } catch (err) {
      console.error('[pull-service] Upsert client failed:', client.id, err)
    }
  }

  return count
}

// ─── Upsert Price Lists ─────────────────────────────────

async function upsertPriceLists(db: Pool, priceLists: any[]): Promise<number> {
  let count = 0

  for (const pl of priceLists) {
    try {
      await db.query(
        `INSERT INTO price_lists (id, cloud_id, name, is_default, active, created_at, updated_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, NOW(), NOW())
         ON CONFLICT (cloud_id) WHERE cloud_id IS NOT NULL DO UPDATE SET
           name = EXCLUDED.name,
           is_default = EXCLUDED.is_default,
           active = EXCLUDED.active,
           updated_at = NOW()`,
        [pl.id, pl.name, pl.is_default ?? false, pl.is_active ?? true]
      )
      count++
    } catch (err) {
      console.error('[pull-service] Upsert price list failed:', pl.id, err)
    }
  }

  return count
}

// ─── Upsert Registers → pos_registers table ────────────

async function upsertRegisters(db: Pool, registers: CloudRegister[]): Promise<number> {
  let count = 0

  // Ensure table exists
  await db.query(`
    CREATE TABLE IF NOT EXISTS pos_registers (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name text NOT NULL,
      is_active boolean NOT NULL DEFAULT true,
      cloud_id text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `)

  for (const reg of registers) {
    try {
      await db.query(
        `INSERT INTO pos_registers (id, cloud_id, name, is_active, created_at, updated_at)
         VALUES (gen_random_uuid(), $1, $2, $3, NOW(), NOW())
         ON CONFLICT (cloud_id) WHERE cloud_id IS NOT NULL DO UPDATE SET
           name = EXCLUDED.name,
           is_active = EXCLUDED.is_active,
           updated_at = NOW()`,
        [reg.id, reg.name, reg.is_active]
      )
      count++
    } catch (err) {
      console.error('[pull-service] Upsert register failed:', reg.id, err)
    }
  }

  return count
}

// ─── Update Inventory from Cloud ────────────────────────

async function updateInventory(db: Pool, inventoryItems: any[]): Promise<number> {
  let count = 0

  for (const inv of inventoryItems) {
    try {
      // Resolve product cloud_id to local id
      const localProduct = await db.query(
        `SELECT id FROM products WHERE cloud_id = $1 LIMIT 1`,
        [inv.product_id]
      )
      if (!localProduct.rows[0]) continue

      await db.query(
        `UPDATE products SET current_stock = $1, updated_at = NOW() WHERE id = $2`,
        [inv.quantity ?? 0, localProduct.rows[0].id]
      )
      count++
    } catch (err) {
      console.error('[pull-service] Update inventory failed:', inv.product_id, err)
    }
  }

  return count
}

// ─── Main Pull ───────────────────────────────────────────

export async function pullFromCloud(db: Pool, config: SyncConfig): Promise<PullResult> {
  let lastPull = await getLastPullTimestamp(db)
  const token = config.getTerminalToken()

  // ─── Recovery: if DB has no cloud products but timestamp is set, force full pull ───
  // Handles case where previous pull saved server_time but inserts failed
  if (lastPull !== '1970-01-01T00:00:00.000Z') {
    try {
      const counts = await db.query(
        `SELECT (SELECT COUNT(*)::int FROM products WHERE cloud_id IS NOT NULL) as cloud_products`
      )
      if (counts.rows[0]?.cloud_products === 0) {
        console.log('[pull-service] Recovery: DB has 0 cloud products but last_pull is set — forcing full pull')
        lastPull = '1970-01-01T00:00:00.000Z'
      }
    } catch {
      // Ignore — table might not exist yet
    }
  }

  // ─── Detect business change → force full pull ───
  // Compare stored business RFC with current license's business
  try {
    const storedBiz = await db.query(`SELECT value FROM sync_state WHERE key = 'pull_business_rfc'`)
    const currentBizResult = await db.query(`SELECT value FROM settings WHERE key = 'business_rfc'`)
    const storedRfc = storedBiz.rows[0]?.value
    const currentRfc = currentBizResult.rows[0]?.value
    if (currentRfc && storedRfc && currentRfc !== storedRfc) {
      console.log(`[pull-service] Business changed (${storedRfc} → ${currentRfc}), forcing full pull`)
      lastPull = '1970-01-01T00:00:00.000Z'
    }
  } catch {
    // sync_state or settings table might not exist yet — ignore
  }

  const url = new URL(`${config.cloudApiUrl}/api/v2/pos-sync/pull`)
  url.searchParams.set('token', token)
  if (lastPull !== '1970-01-01T00:00:00.000Z') {
    url.searchParams.set('since', lastPull)
  }

  console.log(`[pull-service] Fetching: ${url.toString().replace(token, 'TOKEN')} (since=${lastPull})`)

  const abortController = new AbortController()
  const timeout = setTimeout(() => abortController.abort(), 30_000)

  let response: Response
  try {
    response = await fetch(url.toString(), {
      headers: {
        'X-Terminal-Token': token,
        'X-Hardware-Fingerprint': config.getFingerprint(),
        'Content-Type': 'application/json',
      },
      signal: abortController.signal,
    })
  } finally {
    clearTimeout(timeout)
  }

  if (!response.ok) {
    throw new Error(`Pull failed: ${response.status} ${response.statusText}`)
  }

  const data = (await response.json()) as PullResponse
  let recordsUpdated = 0
  const errors: string[] = []

  console.log(`[pull-service] Cloud returned: ${data.categories?.length ?? 0} categories, ${data.products?.length ?? 0} products, ${data.cashiers?.length ?? 0} cashiers, ${data.clients?.length ?? 0} clients (since=${lastPull})`)

  // 4.8 — Wrap all upserts in a transaction for atomicity
  // Process in order: categories → products → cashiers → clients
  // (categories first so product FK lookups work)

  await db.query('BEGIN')
  try {
    if (data.categories?.length) {
      try {
        const count = await upsertCategories(db, data.categories)
        recordsUpdated += count
        console.log(`[pull-service] Upserted ${count} categories`)
      } catch (err: any) {
        errors.push(`categories: ${err.message}`)
      }
    }

    if (data.products?.length) {
      try {
        const count = await upsertProducts(db, data.products)
        recordsUpdated += count
        console.log(`[pull-service] Upserted ${count} products`)
      } catch (err: any) {
        errors.push(`products: ${err.message}`)
      }
    }

    if (data.cashiers?.length) {
      try {
        const count = await upsertCashiers(db, data.cashiers, config.hashPin)
        recordsUpdated += count
        console.log(`[pull-service] Upserted ${count} cashiers`)
      } catch (err: any) {
        errors.push(`cashiers: ${err.message}`)
      }
    }

    if (data.clients?.length) {
      try {
        const count = await upsertClients(db, data.clients)
        recordsUpdated += count
        console.log(`[pull-service] Upserted ${count} clients`)
      } catch (err: any) {
        errors.push(`clients: ${err.message}`)
      }
    }

    // Registers
    if (data.registers?.length) {
      try {
        const count = await upsertRegisters(db, data.registers)
        recordsUpdated += count
        console.log(`[pull-service] Upserted ${count} registers`)
      } catch (err: any) {
        errors.push(`registers: ${err.message}`)
      }
    }

    // V2: price_lists
    if ((data as any).price_lists?.length) {
      try {
        const count = await upsertPriceLists(db, (data as any).price_lists)
        recordsUpdated += count
        console.log(`[pull-service] Upserted ${count} price lists`)
      } catch (err: any) {
        errors.push(`price_lists: ${err.message}`)
      }
    }

    // V2: inventory sync
    if ((data as any).inventory?.length) {
      try {
        const count = await updateInventory(db, (data as any).inventory)
        recordsUpdated += count
        console.log(`[pull-service] Updated ${count} inventory items`)
      } catch (err: any) {
        errors.push(`inventory: ${err.message}`)
      }
    }

    // Update sync_state with server_time
    await db.query(
      `INSERT INTO sync_state (key, value, updated_at) VALUES ('last_pull_timestamp', $1, NOW())
       ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`,
      [data.server_time]
    )

    await db.query('COMMIT')
  } catch (txErr: any) {
    await db.query('ROLLBACK')
    throw new Error(`Pull transaction failed: ${txErr.message}`)
  }

  // Store business RFC for change detection
  if (data.business_config?.rfc) {
    await db.query(
      `INSERT INTO sync_state (key, value, updated_at) VALUES ('pull_business_rfc', $1, NOW())
       ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`,
      [String(data.business_config.rfc)]
    )
  }

  // ─── Save business_config to settings (for invoicing) ───
  if (data.business_config) {
    const biz = data.business_config as Record<string, unknown>
    const bizSettings: [string, string][] = [
      ['business_rfc', String(biz.rfc ?? '')],
      ['business_razon_social', String(biz.razon_social ?? '')],
      ['business_regimen_fiscal', String(biz.regimen_fiscal ?? '')],
      ['business_codigo_postal', String(biz.codigo_postal ?? '')],
      ['billing_enabled', String(biz.billing_enabled ?? false)],
    ]
    for (const [key, value] of bizSettings) {
      if (value) {
        try {
          await db.query(
            `INSERT INTO settings (key, value, updated_at) VALUES ($1, $2, NOW())
             ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
            [key, value]
          )
        } catch {
          // Non-critical — settings table may have different schema
        }
      }
    }
  }

  return {
    success: errors.length === 0,
    recordsUpdated,
    lastPullTimestamp: data.server_time,
    errors: errors.length > 0 ? errors : undefined,
  }
}
