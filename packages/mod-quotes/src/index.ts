export { mountQuoteRoutes } from './mount'

import { expireQuotes } from './cron/expireQuotes'
import { checkFollowUpAlerts } from './cron/followUpAlerts'

export function startQuoteCronJobs(db: any): () => void {
  // Run immediately on startup
  expireQuotes(db)
  checkFollowUpAlerts(db)

  // Expire quotes every hour
  const expireInterval = setInterval(() => {
    expireQuotes(db)
  }, 60 * 60 * 1000)

  // Follow-up alerts every 4 hours
  const followUpInterval = setInterval(() => {
    checkFollowUpAlerts(db)
  }, 4 * 60 * 60 * 1000)

  // Return stop function
  return () => {
    clearInterval(expireInterval)
    clearInterval(followUpInterval)
  }
}
