import { eq, sql } from 'drizzle-orm'
import { settings, changeJournal } from '@enlocal/core-db'

/**
 * Get all settings, optionally filtered by module.
 */
export async function getAllSettings(db: any, module?: string) {
  if (module) {
    return db
      .select({
        id: settings.id,
        key: settings.key,
        value: settings.value,
        module: settings.module,
        createdAt: settings.createdAt,
        updatedAt: settings.updatedAt,
      })
      .from(settings)
      .where(eq(settings.module, module))
      .orderBy(settings.key)
  }

  return db
    .select({
      id: settings.id,
      key: settings.key,
      value: settings.value,
      module: settings.module,
      createdAt: settings.createdAt,
      updatedAt: settings.updatedAt,
    })
    .from(settings)
    .orderBy(settings.key)
}

/**
 * Get a single setting by key.
 */
export async function getSetting(db: any, key: string) {
  const [row] = await db
    .select({
      id: settings.id,
      key: settings.key,
      value: settings.value,
      module: settings.module,
      createdAt: settings.createdAt,
      updatedAt: settings.updatedAt,
    })
    .from(settings)
    .where(eq(settings.key, key))
    .limit(1)

  if (!row) {
    throw new Error('SETTING_NOT_FOUND')
  }

  return row
}

/**
 * Upsert a setting (insert or update on conflict). Logs the change.
 */
export async function updateSetting(
  db: any,
  key: string,
  value: string,
  requestUserId: string,
  module?: string,
) {
  const [result] = await db
    .insert(settings)
    .values({
      key,
      value,
      module: module || null,
    })
    .onConflictDoUpdate({
      target: settings.key,
      set: {
        value,
        updatedAt: sql`now()`,
      },
    })
    .returning({
      id: settings.id,
      key: settings.key,
      value: settings.value,
      module: settings.module,
      createdAt: settings.createdAt,
      updatedAt: settings.updatedAt,
    })

  await db.insert(changeJournal).values({
    tableName: 'settings',
    recordId: key,
    action: 'UPSERT',
    data: { key, value },
    userId: requestUserId,
  })

  return result
}

/**
 * Bulk upsert multiple settings. Logs each change.
 */
export async function bulkUpdateSettings(
  db: any,
  items: { key: string; value: string; module?: string }[],
  requestUserId: string,
) {
  const results: any[] = []

  for (const item of items) {
    const result = await updateSetting(db, item.key, item.value, requestUserId, item.module)
    results.push(result)
  }

  return results
}
