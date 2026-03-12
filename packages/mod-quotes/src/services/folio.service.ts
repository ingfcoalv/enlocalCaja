import { quotes, settings } from '@enlocal/core-db'
import { sql, eq } from 'drizzle-orm'

export async function getNextQuoteFolio(db: any, series: string = 'COT'): Promise<number> {
  const [maxRow] = await db
    .select({ maxFolio: sql<number>`coalesce(max(${quotes.folio}), 0)` })
    .from(quotes)
    .where(eq(quotes.series, series))

  const [configRow] = await db.select().from(settings)
    .where(eq(settings.key, 'quote_starting_folio'))

  const maxCurrent = maxRow?.maxFolio ?? 0
  const startingFolio = configRow ? parseInt(configRow.value) : 0

  return Math.max(maxCurrent, startingFolio - 1) + 1
}
