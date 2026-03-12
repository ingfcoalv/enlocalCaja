import { Pool, type PoolConfig } from 'pg'
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres'
import * as schema from './schema'

export interface DbPoolConfig {
  host?: string
  port?: number
  database: string
  user?: string
  password?: string
  maxConnections?: number
}

export interface DbInstance {
  pool: Pool
  db: NodePgDatabase<typeof schema>
}

export async function createDbPool(config: DbPoolConfig): Promise<DbInstance> {
  const poolConfig: PoolConfig = {
    host: config.host ?? 'localhost',
    port: config.port ?? 5432,
    database: config.database,
    user: config.user ?? 'enlocal',
    password: config.password ?? 'enlocal',
    max: config.maxConnections ?? 10,
  }

  const pool = new Pool(poolConfig)
  const db = drizzle(pool, { schema })

  // Health check
  await pool.query('SELECT 1')

  return { pool, db }
}

export async function closeDbPool(instance: DbInstance): Promise<void> {
  await instance.pool.end()
}
