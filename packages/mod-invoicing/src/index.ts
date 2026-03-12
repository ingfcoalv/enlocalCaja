// @enlocal/mod-invoicing — Módulo de Facturación CFDI 4.0
export { mountInvoicingRoutes } from './mount'
export { createInvoiceFromSales, createComplementoPago } from './services/invoices.service'
export { seedSatCatalogs } from './seeds/satCatalogSeed'

import { checkCancelPendingInvoices } from './cron/cancelStatusCheck'
import { checkCertificateExpiry } from './cron/certExpiryAlert'
import { checkGlobalInvoiceReminder } from './cron/globalInvoiceReminder'

export function startInvoicingCronJobs(db: any): () => void {
  // Check cancel-pending invoices every 30 min
  const cancelCheckInterval = setInterval(() => {
    checkCancelPendingInvoices(db)
  }, 30 * 60 * 1000)

  // Daily checks (cert expiry + global invoice reminder) — run every 24h
  const dailyInterval = setInterval(() => {
    checkCertificateExpiry(db)
    checkGlobalInvoiceReminder(db)
  }, 24 * 60 * 60 * 1000)

  // Run daily checks once on startup
  checkCertificateExpiry(db).catch(() => {})
  checkGlobalInvoiceReminder(db).catch(() => {})

  return () => {
    clearInterval(cancelCheckInterval)
    clearInterval(dailyInterval)
  }
}
