import { remissionNotes, remissionReturns, settings } from '@enlocal/core-db'
import { sql, eq } from 'drizzle-orm'

export async function getNextRemissionFolio(db: any, series: string = 'NR'): Promise<number> {
  const [maxRow] = await db
    .select({ maxFolio: sql<number>`coalesce(max(${remissionNotes.folio}), 0)` })
    .from(remissionNotes)
    .where(eq(remissionNotes.series, series))

  const [configRow] = await db.select().from(settings)
    .where(eq(settings.key, 'remission_starting_folio'))

  const maxCurrent = maxRow?.maxFolio ?? 0
  const startingFolio = configRow ? parseInt(configRow.value) : 0

  return Math.max(maxCurrent, startingFolio - 1) + 1
}

export async function getNextReturnFolio(db: any, series: string = 'DEV'): Promise<number> {
  const [maxRow] = await db
    .select({ maxFolio: sql<number>`coalesce(max(${remissionReturns.folio}), 0)` })
    .from(remissionReturns)
    .where(eq(remissionReturns.series, series))

  const [configRow] = await db.select().from(settings)
    .where(eq(settings.key, 'return_starting_folio'))

  const maxCurrent = maxRow?.maxFolio ?? 0
  const startingFolio = configRow ? parseInt(configRow.value) : 0

  return Math.max(maxCurrent, startingFolio - 1) + 1
}
