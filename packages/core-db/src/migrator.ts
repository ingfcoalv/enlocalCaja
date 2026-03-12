import { migrate } from 'drizzle-orm/node-postgres/migrator'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import path from 'path'

export async function runMigrations(
  db: NodePgDatabase<any>,
  migrationsPath?: string,
): Promise<void> {
  const migrationsFolder = migrationsPath ?? path.join(__dirname, '..', 'migrations')
  await migrate(db, { migrationsFolder })
}
