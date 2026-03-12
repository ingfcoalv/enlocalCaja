import { sql } from 'drizzle-orm'

/**
 * Check if the fiscal certificate is about to expire (within 30 days).
 * Logs a warning if so.
 */
export async function checkCertificateExpiry(db: any): Promise<void> {
  try {
    const result = await db.execute(
      sql`SELECT certificate_number, certificate_valid_to FROM fiscal_config LIMIT 1`
    )
    const config = (result.rows || result)[0]
    if (!config?.certificate_valid_to) return

    const validTo = new Date(config.certificate_valid_to)
    const now = new Date()
    const daysUntilExpiry = Math.ceil((validTo.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

    if (daysUntilExpiry <= 0) {
      console.warn(`[mod-invoicing] ⚠️ CERTIFICADO EXPIRADO — Certificado ${config.certificate_number} expiró hace ${Math.abs(daysUntilExpiry)} días`)
    } else if (daysUntilExpiry <= 30) {
      console.warn(`[mod-invoicing] ⚠️ Certificado ${config.certificate_number} expira en ${daysUntilExpiry} días (${validTo.toISOString().slice(0, 10)})`)
    }
  } catch (err: any) {
    console.error('[mod-invoicing] Error checking certificate expiry:', err.message)
  }
}
