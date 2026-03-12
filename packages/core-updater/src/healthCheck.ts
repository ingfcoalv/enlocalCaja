import type { Pool } from 'pg'

const CRITICAL_TABLES = [
  'users', 'roles', 'customers', 'products', 'categories',
  'invoices', 'settings', 'change_journal',
]

export async function postUpdateHealthCheck(db: Pool): Promise<boolean> {
  try {
    // Check DB responds
    await db.query('SELECT 1')

    // Check critical tables exist
    const result = await db.query(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = ANY($1)`,
      [CRITICAL_TABLES]
    )

    const existingTables = result.rows.map((r: any) => r.table_name)
    const missingTables = CRITICAL_TABLES.filter((t) => !existingTables.includes(t))

    if (missingTables.length > 0) {
      console.error('[health-check] Missing tables:', missingTables)
      return false
    }

    // Check drizzle migrations table exists (migrations were applied)
    const migrationCheck = await db.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = '__drizzle_migrations'
      ) as exists`
    )

    if (!migrationCheck.rows[0]?.exists) {
      console.error('[health-check] Migrations table not found')
      return false
    }

    return true
  } catch (err) {
    console.error('[health-check] Failed:', err)
    return false
  }
}
