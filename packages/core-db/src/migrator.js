import { migrate } from 'drizzle-orm/node-postgres/migrator';
import path from 'path';
export async function runMigrations(db) {
    const migrationsFolder = path.join(__dirname, '..', 'migrations');
    await migrate(db, { migrationsFolder });
}
//# sourceMappingURL=migrator.js.map