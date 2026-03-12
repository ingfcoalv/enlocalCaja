export { mountPayableRoutes } from './mount'

import { updateOverduePayables } from './cron/overduePayables'

export function startPayableCronJobs(db: any): () => void {
  // Run immediately on startup
  updateOverduePayables(db)

  // Run every hour
  const interval = setInterval(() => {
    updateOverduePayables(db)
  }, 60 * 60 * 1000)

  // Return stop function
  return () => clearInterval(interval)
}
