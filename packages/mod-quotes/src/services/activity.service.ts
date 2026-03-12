import { quoteActivities } from '@enlocal/core-db'
import { eq, asc } from 'drizzle-orm'

export async function logActivity(
  db: any,
  quoteId: string,
  activityType: string,
  description: string,
  createdBy: string,
  metadata?: any
): Promise<any> {
  const [activity] = await db.insert(quoteActivities).values({
    quoteId,
    activityType,
    description,
    metadata: metadata ? JSON.stringify(metadata) : null,
    createdBy,
  }).returning()
  return activity
}

export async function getActivities(db: any, quoteId: string): Promise<any[]> {
  return db.select().from(quoteActivities)
    .where(eq(quoteActivities.quoteId, quoteId))
    .orderBy(asc(quoteActivities.createdAt))
}
