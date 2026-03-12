import { sql } from 'drizzle-orm'

interface Register {
  id: string
  name: string
  isActive: boolean
  cloudId: string | null
  createdAt: string
  updatedAt: string
}

function mapRow(row: any): Register {
  return {
    id: row.id,
    name: row.name,
    isActive: row.is_active,
    cloudId: row.cloud_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/**
 * Ensures the pos_registers and user_registers tables exist.
 */
export async function ensureRegistersTable(db: any): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS pos_registers (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name text NOT NULL,
      is_active boolean NOT NULL DEFAULT true,
      cloud_id text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `)
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS user_registers (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL,
      register_id uuid NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE(user_id, register_id)
    )
  `)
}

export async function listRegisters(db: any): Promise<Register[]> {
  await ensureRegistersTable(db)
  const result = await db.execute(
    sql`SELECT * FROM pos_registers ORDER BY created_at ASC`
  )
  const rows = result.rows ?? result
  return rows.map(mapRow)
}

export async function getRegisterById(db: any, id: string): Promise<Register | null> {
  await ensureRegistersTable(db)
  const result = await db.execute(
    sql`SELECT * FROM pos_registers WHERE id = ${id}`
  )
  const rows = result.rows ?? result
  if (!rows.length) return null
  return mapRow(rows[0])
}

export async function createRegister(db: any, data: { name: string }, maxRegisters?: number): Promise<Register> {
  await ensureRegistersTable(db)

  // Validate max_registers limit if provided
  if (maxRegisters != null && maxRegisters > 0) {
    const countResult = await db.execute(
      sql`SELECT count(*)::int as count FROM pos_registers WHERE is_active = true`
    )
    const countRows = countResult.rows ?? countResult
    const activeCount = countRows[0]?.count ?? 0
    if (activeCount >= maxRegisters) {
      throw new Error(`Limite de cajas alcanzado (${maxRegisters}). Desactiva una caja existente para crear otra.`)
    }
  }

  const result = await db.execute(
    sql`INSERT INTO pos_registers (name) VALUES (${data.name}) RETURNING *`
  )
  const rows = result.rows ?? result
  const register = mapRow(rows[0])

  // Auto-generate series in register_sequences
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS register_sequences (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        register_id uuid NOT NULL UNIQUE,
        series text NOT NULL,
        last_folio integer NOT NULL DEFAULT 0
      )
    `)
    // Series = C + sequential number
    const seqResult = await db.execute(
      sql`SELECT count(*)::int as count FROM register_sequences`
    )
    const seqRows = seqResult.rows ?? seqResult
    const nextNum = (seqRows[0]?.count ?? 0) + 1
    const series = `C${nextNum}`
    await db.execute(
      sql`INSERT INTO register_sequences (register_id, series)
          VALUES (${register.id}, ${series})
          ON CONFLICT (register_id) DO NOTHING`
    )
  } catch {
    // Non-critical: series will just not be set
  }

  return register
}

export async function updateRegister(
  db: any,
  id: string,
  data: { name?: string; is_active?: boolean }
): Promise<Register> {
  await ensureRegistersTable(db)

  // Build update using parameterized drizzle sql
  if (data.name !== undefined && data.is_active !== undefined) {
    const result = await db.execute(
      sql`UPDATE pos_registers SET name = ${data.name}, is_active = ${data.is_active}, updated_at = now() WHERE id = ${id} RETURNING *`
    )
    const rows = result.rows ?? result
    if (!rows.length) throw new Error('Register not found')
    return mapRow(rows[0])
  } else if (data.name !== undefined) {
    const result = await db.execute(
      sql`UPDATE pos_registers SET name = ${data.name}, updated_at = now() WHERE id = ${id} RETURNING *`
    )
    const rows = result.rows ?? result
    if (!rows.length) throw new Error('Register not found')
    return mapRow(rows[0])
  } else if (data.is_active !== undefined) {
    const result = await db.execute(
      sql`UPDATE pos_registers SET is_active = ${data.is_active}, updated_at = now() WHERE id = ${id} RETURNING *`
    )
    const rows = result.rows ?? result
    if (!rows.length) throw new Error('Register not found')
    return mapRow(rows[0])
  }

  throw new Error('No fields to update')
}

export async function deleteRegister(db: any, id: string): Promise<Register> {
  await ensureRegistersTable(db)
  const result = await db.execute(
    sql`UPDATE pos_registers SET is_active = false, updated_at = now() WHERE id = ${id} RETURNING *`
  )
  const rows = result.rows ?? result
  if (!rows.length) throw new Error('Register not found')
  return mapRow(rows[0])
}

// ─── User-Register Assignments ─────────────────────────

export async function getUserRegisters(db: any, userId: string): Promise<Register[]> {
  await ensureRegistersTable(db)
  const result = await db.execute(
    sql`SELECT r.* FROM pos_registers r
        INNER JOIN user_registers ur ON ur.register_id = r.id
        WHERE ur.user_id = ${userId}
        ORDER BY r.name ASC`
  )
  const rows = result.rows ?? result
  return rows.map(mapRow)
}

export async function setUserRegisters(
  db: any,
  userId: string,
  registerIds: string[]
): Promise<void> {
  await ensureRegistersTable(db)
  // Delete existing assignments
  await db.execute(
    sql`DELETE FROM user_registers WHERE user_id = ${userId}`
  )
  // Insert new assignments
  for (const registerId of registerIds) {
    await db.execute(
      sql`INSERT INTO user_registers (user_id, register_id) VALUES (${userId}, ${registerId})
          ON CONFLICT (user_id, register_id) DO NOTHING`
    )
  }
}

/**
 * Get registers accessible by a user. Admins/owners with '*' permission get all.
 */
export async function getAccessibleRegisters(
  db: any,
  userId: string,
  userPermissions: string[]
): Promise<Register[]> {
  await ensureRegistersTable(db)

  const hasWildcard = userPermissions.includes('*')
  if (hasWildcard) {
    const result = await db.execute(
      sql`SELECT * FROM pos_registers WHERE is_active = true ORDER BY name ASC`
    )
    const rows = result.rows ?? result
    return rows.map(mapRow)
  }

  const result = await db.execute(
    sql`SELECT r.* FROM pos_registers r
        INNER JOIN user_registers ur ON ur.register_id = r.id
        WHERE ur.user_id = ${userId} AND r.is_active = true
        ORDER BY r.name ASC`
  )
  const rows = result.rows ?? result
  return rows.map(mapRow)
}

/**
 * Get all registers with their current shift status (for display).
 */
export async function listRegistersWithStatus(db: any): Promise<any[]> {
  await ensureRegistersTable(db)
  const result = await db.execute(
    sql`SELECT r.*,
           cs.id as shift_id,
           cs.user_id as shift_user_id,
           u.name as shift_user_name,
           cs.opened_at as shift_opened_at
        FROM pos_registers r
        LEFT JOIN cash_shifts cs ON cs.register_id = r.id AND cs.status = 'open'
        LEFT JOIN users u ON u.id = cs.user_id
        ORDER BY r.created_at ASC`
  )
  const rows = result.rows ?? result
  return rows.map((row: any) => ({
    ...mapRow(row),
    currentShift: row.shift_id ? {
      id: row.shift_id,
      userId: row.shift_user_id,
      userName: row.shift_user_name,
      openedAt: row.shift_opened_at,
    } : null,
  }))
}
