export { mountRemissionRoutes } from './mount'

import { updateOverdueReceivables } from './cron/overdueUpdater'

export function startRemissionCronJobs(db: any): () => void {
  // Run immediately on startup
  updateOverdueReceivables(db)

  // Run every hour
  const interval = setInterval(() => {
    updateOverdueReceivables(db)
  }, 60 * 60 * 1000)

  // Return stop function
  return () => clearInterval(interval)
}
