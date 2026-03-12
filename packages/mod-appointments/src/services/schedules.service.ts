import { sql } from 'drizzle-orm'

interface Schedule {
  id: string
  staffId: string
  staffName: string | null
  dayOfWeek: number
  startTime: string
  endTime: string
  active: boolean
}

function mapRow(row: any): Schedule {
  return {
    id: row.id,
    staffId: row.staff_id,
    staffName: row.staff_name ?? null,
    dayOfWeek: row.day_of_week,
    startTime: row.start_time,
    endTime: row.end_time,
    active: row.active,
  }
}

/**
 * Ensures the schedules table exists.
 */
export async function ensureTable(db: any): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS schedules (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      staff_id uuid NOT NULL,
      day_of_week integer NOT NULL,
      start_time time NOT NULL,
      end_time time NOT NULL,
      active boolean DEFAULT true
    )
  `)
}

export async function listSchedules(
  db: any,
  staffId?: string
): Promise<Schedule[]> {
  await ensureTable(db)

  const staffFilter = staffId
    ? `WHERE sc.staff_id = '${staffId}'`
    : ''

  const result = await db.execute(
    sql.raw(`
      SELECT sc.id, sc.staff_id, u.name AS staff_name, sc.day_of_week, sc.start_time, sc.end_time, sc.active
      FROM schedules sc
      LEFT JOIN users u ON u.id = sc.staff_id
      ${staffFilter}
      ORDER BY sc.staff_id, sc.day_of_week, sc.start_time
    `)
  )

  const rows = result.rows ?? result
  return rows.map(mapRow)
}

export async function createSchedule(
  db: any,
  data: {
    staffId: string
    dayOfWeek: number
    startTime: string
    endTime: string
    active?: boolean
  },
  userId: string
): Promise<Schedule> {
  await ensureTable(db)

  const result = await db.execute(
    sql`INSERT INTO schedules (staff_id, day_of_week, start_time, end_time, active)
        VALUES (${data.staffId}, ${data.dayOfWeek}, ${data.startTime}, ${data.endTime}, ${data.active !== undefined ? data.active : true})
        RETURNING *`
  )

  const rows = result.rows ?? result
  const schedule = rows[0]

  // Fetch with staff name
  const fullResult = await db.execute(
    sql.raw(`
      SELECT sc.id, sc.staff_id, u.name AS staff_name, sc.day_of_week, sc.start_time, sc.end_time, sc.active
      FROM schedules sc
      LEFT JOIN users u ON u.id = sc.staff_id
      WHERE sc.id = '${schedule.id}'
      LIMIT 1
    `)
  )

  const fullRows = fullResult.rows ?? fullResult
  return mapRow(fullRows[0])
}

export async function updateSchedule(
  db: any,
  id: string,
  data: {
    staffId?: string
    dayOfWeek?: number
    startTime?: string
    endTime?: string
    active?: boolean
  },
  userId: string
): Promise<Schedule | null> {
  await ensureTable(db)

  // Check existence
  const existing = await db.execute(
    sql`SELECT * FROM schedules WHERE id = ${id} LIMIT 1`
  )
  const existingRows = existing.rows ?? existing
  if (!existingRows.length) return null

  const setClauses: string[] = []

  if (data.staffId !== undefined) {
    setClauses.push(`staff_id = '${data.staffId}'`)
  }
  if (data.dayOfWeek !== undefined) {
    setClauses.push(`day_of_week = ${data.dayOfWeek}`)
  }
  if (data.startTime !== undefined) {
    setClauses.push(`start_time = '${data.startTime}'`)
  }
  if (data.endTime !== undefined) {
    setClauses.push(`end_time = '${data.endTime}'`)
  }
  if (data.active !== undefined) {
    setClauses.push(`active = ${data.active}`)
  }

  if (setClauses.length === 0) {
    // Nothing to update, return existing
    const fullResult = await db.execute(
      sql.raw(`
        SELECT sc.id, sc.staff_id, u.name AS staff_name, sc.day_of_week, sc.start_time, sc.end_time, sc.active
        FROM schedules sc
        LEFT JOIN users u ON u.id = sc.staff_id
        WHERE sc.id = '${id}'
        LIMIT 1
      `)
    )
    const fullRows = fullResult.rows ?? fullResult
    return fullRows.length ? mapRow(fullRows[0]) : null
  }

  await db.execute(
    sql.raw(`
      UPDATE schedules
      SET ${setClauses.join(', ')}
      WHERE id = '${id}'
    `)
  )

  // Fetch with staff name
  const fullResult = await db.execute(
    sql.raw(`
      SELECT sc.id, sc.staff_id, u.name AS staff_name, sc.day_of_week, sc.start_time, sc.end_time, sc.active
      FROM schedules sc
      LEFT JOIN users u ON u.id = sc.staff_id
      WHERE sc.id = '${id}'
      LIMIT 1
    `)
  )

  const fullRows = fullResult.rows ?? fullResult
  return fullRows.length ? mapRow(fullRows[0]) : null
}

export async function deleteSchedule(
  db: any,
  id: string
): Promise<boolean> {
  await ensureTable(db)

  // Check existence
  const existing = await db.execute(
    sql`SELECT id FROM schedules WHERE id = ${id} LIMIT 1`
  )
  const existingRows = existing.rows ?? existing
  if (!existingRows.length) return false

  // Hard delete
  await db.execute(
    sql`DELETE FROM schedules WHERE id = ${id}`
  )

  return true
}
