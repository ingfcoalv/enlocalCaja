import { changeJournal } from '@enlocal/core-db'
import { sql } from 'drizzle-orm'
import { ensureTable as ensureIngredientsTable } from './ingredients.service'

interface RecipeItem {
  ingredientId: string
  quantity: number
}

/**
 * Ensures the recipes table exists. Called before operations.
 */
export async function ensureTable(db: any): Promise<void> {
  await ensureIngredientsTable(db)
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS recipes (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      product_id uuid NOT NULL,
      ingredient_id uuid NOT NULL,
      quantity numeric(12,4) NOT NULL
    )
  `)
}

export async function getRecipeByProduct(
  db: any,
  productId: string
): Promise<any[]> {
  await ensureTable(db)

  const result = await db.execute(
    sql`SELECT r.id, r.product_id, r.ingredient_id, r.quantity,
               i.name as ingredient_name, i.unit as ingredient_unit, i.cost as ingredient_cost
        FROM recipes r
        LEFT JOIN ingredients i ON r.ingredient_id = i.id
        WHERE r.product_id = ${productId}
        ORDER BY i.name ASC`
  )

  return result.rows ?? result
}

export async function setRecipe(
  db: any,
  productId: string,
  items: RecipeItem[],
  userId: string
): Promise<any[]> {
  await ensureTable(db)

  // Delete old recipe entries for this product
  await db.execute(
    sql`DELETE FROM recipes WHERE product_id = ${productId}`
  )

  // Insert new recipe entries
  const inserted: any[] = []

  for (const item of items) {
    const result = await db.execute(
      sql`INSERT INTO recipes (product_id, ingredient_id, quantity)
          VALUES (${productId}, ${item.ingredientId}, ${item.quantity})
          RETURNING *`
    )
    const rows = result.rows ?? result
    if (rows.length) {
      inserted.push(rows[0])
    }
  }

  // Log to change journal
  await db.insert(changeJournal).values({
    tableName: 'recipes',
    recordId: productId,
    action: 'update',
    data: { productId, items: inserted },
    userId,
    synced: false,
  })

  return inserted
}
