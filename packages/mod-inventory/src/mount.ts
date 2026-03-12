import type { Express } from 'express'
import { authMiddleware } from '@enlocal/core-server'
import ingredientsRoutes from './routes/ingredients.routes'
import movementsRoutes from './routes/movements.routes'
import recipesRoutes from './routes/recipes.routes'
import countsRoutes from './routes/counts.routes'

export function mountInventoryRoutes(app: Express, db: any): void {
  app.set('db', db)
  app.use('/api/ingredients', authMiddleware as any, ingredientsRoutes)
  app.use('/api/movements', authMiddleware as any, movementsRoutes)
  app.use('/api/recipes', authMiddleware as any, recipesRoutes)
  app.use('/api/inventory/counts', authMiddleware as any, countsRoutes)
}
