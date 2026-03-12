import { sql } from 'drizzle-orm'

// ─── Column name maps by invoice type ──

const folioDbColumn: Record<string, string> = {
  I: 'folio_ingreso',
  E: 'folio_egreso',
  P: 'folio_pago',
  T: 'folio_traslado',
}

const folioPropMap: Record<string, string> = {
  I: 'folio_ingreso',
  E: 'folio_egreso',
  P: 'folio_pago',
  T: 'folio_traslado',
}

const seriesPropMap: Record<string, string> = {
  I: 'series_ingreso',
  E: 'series_egreso',
  P: 'series_pago',
  T: 'series_traslado',
}

// ─── getFiscalConfig ────────────────────────────────────────────

export async function getFiscalConfig(db: any): Promise<any | null> {
  const result = await db.execute(sql`SELECT * FROM fiscal_config LIMIT 1`)
  const rows = result.rows || result
  return rows.length > 0 ? rows[0] : null
}

// ─── upsertFiscalConfig ─────────────────────────────────────────

export async function upsertFiscalConfig(db: any, data: any): Promise<any> {
  const existing = await getFiscalConfig(db)

  if (existing) {
    // Build SET clause dynamically
    const setClauses: string[] = []
    const values: any[] = []
    for (const [key, value] of Object.entries(data)) {
      // Convert camelCase to snake_case
      const col = key.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`)
      setClauses.push(`${col} = $${values.length + 1}`)
      values.push(value)
    }
    setClauses.push('updated_at = now()')

    const query = `UPDATE fiscal_config SET ${setClauses.join(', ')} WHERE id = $${values.length + 1} RETURNING *`
    values.push(existing.id)

    const result = await db.execute(sql.raw(query))
    const rows = result.rows || result
    return rows[0]
  }

  // Build INSERT dynamically
  const cols: string[] = []
  const placeholders: string[] = []
  const values: any[] = []
  for (const [key, value] of Object.entries(data)) {
    const col = key.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`)
    cols.push(col)
    placeholders.push(`$${values.length + 1}`)
    values.push(value)
  }

  const query = `INSERT INTO fiscal_config (${cols.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`
  const result = await db.execute(sql.raw(query))
  const rows = result.rows || result
  return rows[0]
}

// ─── getNextFolio ───────────────────────────────────────────────

export async function getNextFolio(
  db: any,
  type: 'I' | 'E' | 'P' | 'T'
): Promise<{ series: string; folio: number }> {
  const config = await getFiscalConfig(db)
  if (!config) {
    throw new Error('Fiscal config not found. Configure emisor data first.')
  }

  const folioCol = folioDbColumn[type]
  const folioProp = folioPropMap[type]
  const seriesProp = seriesPropMap[type]

  const series: string = config[seriesProp] ?? ''
  const folio: number = config[folioProp] ?? 1

  // Auto-increment the folio in the database
  const validFolioCols: Record<string, boolean> = {
    folio_ingreso: true, folio_egreso: true, folio_pago: true, folio_traslado: true,
  }
  if (!validFolioCols[folioCol]) throw new Error(`Invalid folio column: ${folioCol}`)
  await db.execute(sql`
    UPDATE fiscal_config SET updated_at = now() WHERE id = ${config.id}
  `)
  // Use raw for column name (whitelisted above) + parameterized id
  await db.execute(sql.raw(
    `UPDATE fiscal_config SET ${folioCol} = ${folioCol} + 1 WHERE id = '${config.id.replace(/'/g, "''")}'`
  ))

  return { series, folio }
}

// ─── getEmisorData ──────────────────────────────────────────────

export async function getEmisorData(
  db: any
): Promise<{ rfc: string; nombre: string; regimenFiscal: string; codigoPostal: string } | null> {
  const config = await getFiscalConfig(db)
  if (!config) {
    return null
  }

  return {
    rfc: config.rfc,
    nombre: config.razon_social,
    regimenFiscal: config.regimen_fiscal,
    codigoPostal: config.codigo_postal,
  }
}
