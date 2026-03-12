/**
 * Module activation service — reads/writes settings table
 * for dynamic module and stamps management.
 */

// Settings keys
const KEYS = {
  ADDONS: 'license_addons',
  STAMPS_AVAILABLE: 'license_stamps_available',
  STAMPS_TOTAL_PURCHASED: 'license_stamps_total_purchased',
  STAMPS_TOTAL_USED: 'license_stamps_total_used',
  STAMPS_UPDATED_AT: 'license_stamps_updated_at',
  LICENSE_PLAN: 'license_plan',
  LICENSE_STATE: 'license_state',
  LICENSE_EXPIRES_AT: 'license_expires_at',
  LICENSE_MODULES: 'license_modules',
  LICENSE_MAX_REGISTERS: 'license_max_registers',
} as const

export interface StampsBalance {
  available: number
  totalPurchased: number
  totalUsed: number
  updatedAt: string | null
}

export interface ModuleStatus {
  code: string
  active: boolean
  source: 'default' | 'addon'
}

export interface LicenseSyncData {
  plan?: string
  state?: string
  expiresAt?: string
  modules?: string[]
  addons?: string[]
  stamps?: {
    available: number
    totalPurchased: number
    totalUsed: number
  }
  maxRegisters?: number
}

// Generic DB interface to avoid tight coupling with Drizzle
interface SettingsDb {
  query(sql: string, params?: unknown[]): Promise<{ rows: Array<{ key: string; value: string }> }>
  execute(sql: string, params?: unknown[]): Promise<void>
}

// We use raw SQL to stay ORM-agnostic; works with any pg client or Drizzle raw
async function getSetting(db: SettingsDb, key: string): Promise<string | null> {
  const result = await db.query(
    `SELECT value FROM settings WHERE key = $1 LIMIT 1`,
    [key]
  )
  return result.rows[0]?.value ?? null
}

async function setSetting(db: SettingsDb, key: string, value: string, module?: string): Promise<void> {
  await db.execute(
    `INSERT INTO settings (key, value, module, created_at, updated_at)
     VALUES ($1, $2, $3, NOW(), NOW())
     ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
    [key, value, module ?? 'license']
  )
}

/**
 * Get list of active addon module codes from settings.
 */
export async function getActiveModules(db: SettingsDb): Promise<string[]> {
  const raw = await getSetting(db, KEYS.ADDONS)
  if (!raw) return []
  try {
    return JSON.parse(raw) as string[]
  } catch {
    return []
  }
}

/**
 * Check if a specific module is active.
 */
export async function isModuleActive(db: SettingsDb, code: string): Promise<boolean> {
  const modules = await getActiveModules(db)
  // Also check base modules
  const baseModules = await getSetting(db, KEYS.LICENSE_MODULES)
  const allModules = [...modules]
  if (baseModules) {
    try {
      allModules.push(...(JSON.parse(baseModules) as string[]))
    } catch { /* ignore parse errors */ }
  }
  // Normalize: accept both 'invoicing' and 'mod-invoicing'
  const normalized = code.startsWith('mod-') ? code : `mod-${code}`
  return allModules.includes(normalized) || allModules.includes(code)
}

/**
 * Get all modules with their active/inactive status.
 */
export async function getAllModulesWithStatus(db: SettingsDb, defaultModules: string[]): Promise<ModuleStatus[]> {
  const addons = await getActiveModules(db)
  const result: ModuleStatus[] = []

  for (const mod of defaultModules) {
    result.push({ code: mod, active: true, source: 'default' })
  }

  for (const addon of addons) {
    if (!defaultModules.includes(addon)) {
      result.push({ code: addon, active: true, source: 'addon' })
    }
  }

  return result
}

/**
 * Get current stamps balance from settings.
 */
export async function getStampsBalance(db: SettingsDb): Promise<StampsBalance> {
  const [available, totalPurchased, totalUsed, updatedAt] = await Promise.all([
    getSetting(db, KEYS.STAMPS_AVAILABLE),
    getSetting(db, KEYS.STAMPS_TOTAL_PURCHASED),
    getSetting(db, KEYS.STAMPS_TOTAL_USED),
    getSetting(db, KEYS.STAMPS_UPDATED_AT),
  ])

  return {
    available: available ? parseInt(available, 10) : 0,
    totalPurchased: totalPurchased ? parseInt(totalPurchased, 10) : 0,
    totalUsed: totalUsed ? parseInt(totalUsed, 10) : 0,
    updatedAt,
  }
}

/**
 * Update local stamps balance after a stamp operation.
 */
export async function updateLocalStampsAfterUse(db: SettingsDb, newBalance: number): Promise<void> {
  const now = new Date().toISOString()
  await Promise.all([
    setSetting(db, KEYS.STAMPS_AVAILABLE, String(newBalance)),
    setSetting(db, KEYS.STAMPS_UPDATED_AT, now),
  ])
}

/**
 * Sync full license data from cloud into settings table.
 */
export async function syncLicenseToSettings(db: SettingsDb, data: LicenseSyncData): Promise<void> {
  const tasks: Promise<void>[] = []

  if (data.plan) {
    tasks.push(setSetting(db, KEYS.LICENSE_PLAN, data.plan))
  }
  if (data.state) {
    tasks.push(setSetting(db, KEYS.LICENSE_STATE, data.state))
  }
  if (data.expiresAt) {
    tasks.push(setSetting(db, KEYS.LICENSE_EXPIRES_AT, data.expiresAt))
  }
  if (data.modules) {
    tasks.push(setSetting(db, KEYS.LICENSE_MODULES, JSON.stringify(data.modules)))
  }
  if (data.addons) {
    tasks.push(setSetting(db, KEYS.ADDONS, JSON.stringify(data.addons)))
  }
  if (data.maxRegisters != null) {
    tasks.push(setSetting(db, KEYS.LICENSE_MAX_REGISTERS, String(data.maxRegisters)))
  }
  if (data.stamps) {
    tasks.push(
      setSetting(db, KEYS.STAMPS_AVAILABLE, String(data.stamps.available)),
      setSetting(db, KEYS.STAMPS_TOTAL_PURCHASED, String(data.stamps.totalPurchased)),
      setSetting(db, KEYS.STAMPS_TOTAL_USED, String(data.stamps.totalUsed)),
      setSetting(db, KEYS.STAMPS_UPDATED_AT, new Date().toISOString()),
    )
  }

  await Promise.all(tasks)
}
