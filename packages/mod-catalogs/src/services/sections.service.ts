import { sections, changeJournal } from '@enlocal/core-db'
import { eq, and, sql, asc } from 'drizzle-orm'

interface SectionFilters {
  active?: boolean
  type?: 'area' | 'zone' | 'department'
  parentId?: string | null
}

export async function listSections(
  db: any,
  filters: SectionFilters
): Promise<any[]> {
  const conditions: any[] = []

  if (filters.active !== undefined) {
    conditions.push(eq(sections.active, filters.active))
  }

  if (filters.type) {
    conditions.push(eq(sections.type, filters.type))
  }

  if (filters.parentId !== undefined) {
    if (filters.parentId === null) {
      conditions.push(sql`${sections.parentId} IS NULL`)
    } else {
      conditions.push(eq(sections.parentId, filters.parentId))
    }
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined

  const rows = await db
    .select()
    .from(sections)
    .where(where)
    .orderBy(asc(sections.sortOrder))

  return rows
}

export async function createSection(
  db: any,
  data: any,
  requestUserId: string
): Promise<any> {
  const [row] = await db.insert(sections).values(data).returning()

  await db.insert(changeJournal).values({
    tableName: 'sections',
    recordId: row.id,
    action: 'insert',
    data: row,
    userId: requestUserId,
    synced: false,
  })

  return row
}

export async function updateSection(
  db: any,
  id: string,
  data: any,
  requestUserId: string
): Promise<any> {
  const [row] = await db
    .update(sections)
    .set({ ...data, updatedAt: sql`now()` })
    .where(eq(sections.id, id))
    .returning()

  if (!row) return null

  await db.insert(changeJournal).values({
    tableName: 'sections',
    recordId: id,
    action: 'update',
    data: row,
    userId: requestUserId,
    synced: false,
  })

  return row
}

export async function deleteSection(
  db: any,
  id: string,
  requestUserId: string
): Promise<any> {
  const [row] = await db
    .update(sections)
    .set({ active: false, updatedAt: sql`now()` })
    .where(eq(sections.id, id))
    .returning()

  if (!row) return null

  await db.insert(changeJournal).values({
    tableName: 'sections',
    recordId: id,
    action: 'soft_delete',
    data: row,
    userId: requestUserId,
    synced: false,
  })

  return row
}
