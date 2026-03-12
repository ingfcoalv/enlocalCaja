import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from './schema';
export async function createDbPool(config) {
    const poolConfig = {
        host: config.host ?? 'localhost',
        port: config.port ?? 5432,
        database: config.database,
        user: config.user ?? 'enlocal',
        password: config.password ?? 'enlocal',
        max: config.maxConnections ?? 10,
    };
    const pool = new Pool(poolConfig);
    const db = drizzle(pool, { schema });
    // Health check
    await pool.query('SELECT 1');
    return { pool, db };
}
export async function closeDbPool(instance) {
    await instance.pool.end();
}
//# sourceMappingURL=connection.js.map