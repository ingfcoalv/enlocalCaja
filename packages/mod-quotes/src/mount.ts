import type { Express } from 'express'
import { authMiddleware } from '@enlocal/core-server'
import quotesRoutes from './routes/quotes.routes'
import quoteStatsRoutes from './routes/quoteStats.routes'
import emailConfigRoutes from './routes/emailConfig.routes'
import quoteConfigRoutes from './routes/quoteConfig.routes'

export function mountQuoteRoutes(app: Express, db: any): void {
  app.set('db', db)

  // Stats routes MUST come before quotesRoutes because /:id would match /pipeline etc.
  app.use('/api/quotes', authMiddleware as any, quoteStatsRoutes)
  app.use('/api/quotes', authMiddleware as any, quotesRoutes)
  app.use('/api/settings', authMiddleware as any, emailConfigRoutes)
  app.use('/api/settings', authMiddleware as any, quoteConfigRoutes)
}
