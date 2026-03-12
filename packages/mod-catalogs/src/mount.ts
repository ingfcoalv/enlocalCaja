import type { Express } from 'express'
import { authMiddleware } from '@enlocal/core-server'
import productsRoutes from './routes/products.routes'
import categoriesRoutes from './routes/categories.routes'
import servicesRoutes from './routes/services.routes'
import customersRoutes from './routes/customers.routes'
import suppliersRoutes from './routes/suppliers.routes'
import sectionsRoutes from './routes/sections.routes'
import priceListsRoutes from './routes/priceLists.routes'

export function mountCatalogRoutes(app: Express, db: any): void {
  app.set('db', db)
  app.use('/api/products', authMiddleware as any, productsRoutes)
  app.use('/api/categories', authMiddleware as any, categoriesRoutes)
  app.use('/api/services', authMiddleware as any, servicesRoutes)
  app.use('/api/customers', authMiddleware as any, customersRoutes)
  app.use('/api/suppliers', authMiddleware as any, suppliersRoutes)
  app.use('/api/sections', authMiddleware as any, sectionsRoutes)
  app.use('/api/price-lists', authMiddleware as any, priceListsRoutes)
}
