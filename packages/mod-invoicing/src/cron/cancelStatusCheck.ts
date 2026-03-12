import { sql } from 'drizzle-orm'

/**
 * Check status of invoices with cancel_pending status.
 * Queries the cloud API to see if SAT has accepted/rejected the cancellation.
 */
export async function checkCancelPendingInvoices(db: any): Promise<void> {
  try {
    const pendingResult = await db.execute(
      sql`SELECT id, uuid_fiscal, cancellation_reason FROM invoices WHERE status = 'cancel_pending' AND uuid_fiscal IS NOT NULL`
    )
    const pending = pendingResult.rows || pendingResult
    if (!pending.length) return

    console.log(`[mod-invoicing] Checking ${pending.length} cancel-pending invoices...`)

    for (const inv of pending) {
      try {
        // Import dynamically to avoid circular deps at startup
        const { getCancelStatus } = await import('../services/cloudStamping.service')
        const fiscalResult = await db.execute(sql`SELECT cloud_tenant_id FROM fiscal_config LIMIT 1`)
        const fiscal = (fiscalResult.rows || fiscalResult)[0]
        if (!fiscal?.cloud_tenant_id) continue

        const status = await getCancelStatus(fiscal.cloud_tenant_id, inv.uuid_fiscal)

        if (status.status === 'Cancelado') {
          await db.execute(
            sql`UPDATE invoices SET status = 'cancelled', cancelled_at = now(), updated_at = now() WHERE id = ${inv.id}`
          )
          console.log(`[mod-invoicing] Invoice ${inv.uuid_fiscal} cancelled by SAT`)
        } else if (status.status === 'Vigente' && !status.cancellable) {
          // SAT rejected the cancellation
          await db.execute(
            sql`UPDATE invoices SET status = 'stamped', cancellation_response = 'SAT rechazó cancelación', updated_at = now() WHERE id = ${inv.id}`
          )
          console.log(`[mod-invoicing] Invoice ${inv.uuid_fiscal} cancellation rejected by SAT`)
        }
      } catch (err: any) {
        console.error(`[mod-invoicing] Error checking cancel status for ${inv.uuid_fiscal}:`, err.message)
      }
    }
  } catch (err: any) {
    console.error('[mod-invoicing] Error in cancel status check cron:', err.message)
  }
}
