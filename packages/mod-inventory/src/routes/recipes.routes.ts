import { Router } from 'express'
import { z } from 'zod'
import type { AuthenticatedRequest } from '@enlocal/core-server'
import { requirePermission } from '@enlocal/core-server'
import { getRecipeByProduct, setRecipe } from '../services/recipes.service'

const setRecipeSchema = z.object({
  items: z.array(
    z.object({
      ingredient_id: z.string().uuid(),
      quantity: z.union([z.string(), z.number()]).transform(Number),
    })
  ).min(1),
})

const router = Router()

// GET /:productId — get recipe for a product
router.get(
  '/:productId',
  requirePermission('inventory.read') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const { productId } = req.params

      const recipe = await getRecipeByProduct(db, productId)
      res.json({ data: recipe })
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error fetching recipe' })
    }
  }
)

// PUT /:productId — set recipe for a product
router.put(
  '/:productId',
  requirePermission('inventory.update') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const { productId } = req.params
      const parsed = setRecipeSchema.safeParse(req.body)

      if (!parsed.success) {
        return res.status(400).json({ error: 'Validation error', details: parsed.error.flatten() })
      }

      const userId = req.user?.id ?? 'system'
      const items = parsed.data.items.map((item) => ({
        ingredientId: item.ingredient_id,
        quantity: item.quantity,
      }))

      const recipe = await setRecipe(db, productId, items, userId)
      res.json({ data: recipe })
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error setting recipe' })
    }
  }
)

export default router
