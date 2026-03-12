import { sql } from 'drizzle-orm'

/**
 * Daily check: if we're in the last 5 days of the month and there are
 * uninvoiced tickets, log a reminder to generate the global invoice.
 */
export async function checkGlobalInvoiceReminder(db: any): Promise<void> {
  try {
    const now = new Date()
    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
    const daysRemaining = lastDayOfMonth - now.getDate()

    if (daysRemaining > 5) return

    // Count POS tickets without individual invoice this month
    const result = await db.execute(sql`
      SELECT count(*)::int as cnt
      FROM invoices
      WHERE source = 'pos'
        AND status IN ('paid', 'credit', 'partial')
        AND created_at >= date_trunc('month', now())
        AND NOT EXISTS (
          SELECT 1 FROM invoice_links il WHERE il.sale_invoice_id = invoices.id
        )
        AND NOT EXISTS (
          SELECT 1 FROM global_invoice_tickets git WHERE git.ticket_id = invoices.id
        )
    `)
    const count = (result.rows || result)[0]?.cnt ?? 0

    if (count > 0) {
      console.warn(`[mod-invoicing] ⚠️ ${count} tickets sin facturar este mes — quedan ${daysRemaining} días para factura global`)
    }
  } catch (err: any) {
    // global_invoice_tickets or invoice_links might not exist yet
    if (!err.message?.includes('does not exist')) {
      console.error('[mod-invoicing] Error checking global invoice reminder:', err.message)
    }
  }
}
