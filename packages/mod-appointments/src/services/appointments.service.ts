import { sql } from 'drizzle-orm'

interface AppointmentFilters {
  date?: string
  staffId?: string
  customerId?: string
  status?: string
  from?: string
  to?: string
  page?: number
  limit?: number
}

interface PaginatedResult<T> {
  data: T[]
  total: number
  page: number
  pages: number
}

interface Appointment {
  id: string
  customerId: string | null
  customerName: string | null
  serviceId: string | null
  serviceName: string | null
  staffId: string | null
  staffName: string | null
  date: string
  startTime: string
  endTime: string
  status: string
  notes: string | null
  createdAt: string
  updatedAt: string
}

interface CalendarDay {
  date: string
  appointments: Appointment[]
}

interface TimeSlot {
  startTime: string
  endTime: string
  staffId: string
  staffName: string
}

function mapRow(row: any): Appointment {
  return {
    id: row.id,
    customerId: row.customer_id,
    customerName: row.customer_name ?? null,
    serviceId: row.service_id,
    serviceName: row.service_name ?? null,
    staffId: row.staff_id,
    staffName: row.staff_name ?? null,
    date: row.date,
    startTime: row.start_time,
    endTime: row.end_time,
    status: row.status,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/**
 * Ensures the appointments table exists.
 */
export async function ensureTable(db: any): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS appointments (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      customer_id uuid,
      service_id uuid,
      staff_id uuid,
      date date NOT NULL,
      start_time time NOT NULL,
      end_time time NOT NULL,
      status text DEFAULT 'scheduled',
      notes text,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    )
  `)
}

const SELECT_WITH_JOINS = `
  SELECT
    a.id,
    a.customer_id,
    c.name AS customer_name,
    a.service_id,
    s.name AS service_name,
    a.staff_id,
    u.name AS staff_name,
    a.date,
    a.start_time,
    a.end_time,
    a.status,
    a.notes,
    a.created_at,
    a.updated_at
  FROM appointments a
  LEFT JOIN customers c ON c.id = a.customer_id
  LEFT JOIN services s ON s.id = a.service_id
  LEFT JOIN users u ON u.id = a.staff_id
`

export async function listAppointments(
  db: any,
  filters: AppointmentFilters
): Promise<PaginatedResult<Appointment>> {
  await ensureTable(db)

  const page = filters.page || 1
  const limit = filters.limit || 50
  const offset = (page - 1) * limit

  const conditions: string[] = []
  const params: any[] = []
  let paramIndex = 1

  if (filters.date) {
    conditions.push(`a.date = $${paramIndex}`)
    params.push(filters.date)
    paramIndex++
  }

  if (filters.staffId) {
    conditions.push(`a.staff_id = $${paramIndex}`)
    params.push(filters.staffId)
    paramIndex++
  }

  if (filters.customerId) {
    conditions.push(`a.customer_id = $${paramIndex}`)
    params.push(filters.customerId)
    paramIndex++
  }

  if (filters.status) {
    conditions.push(`a.status = $${paramIndex}`)
    params.push(filters.status)
    paramIndex++
  }

  if (filters.from) {
    conditions.push(`a.date >= $${paramIndex}`)
    params.push(filters.from)
    paramIndex++
  }

  if (filters.to) {
    conditions.push(`a.date <= $${paramIndex}`)
    params.push(filters.to)
    paramIndex++
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  // Use drizzle sql tagged template for parameterized queries
  // Build dynamic query with sql.raw for the static parts and parameters
  const dataResult = await db.execute(
    sql.raw(`
      ${SELECT_WITH_JOINS}
      ${whereClause}
      ORDER BY a.date ASC, a.start_time ASC
      LIMIT ${limit} OFFSET ${offset}
    `.replace(/\$(\d+)/g, (_, n) => {
      const val = params[parseInt(n) - 1]
      if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`
      return String(val)
    }))
  )

  const countResult = await db.execute(
    sql.raw(`
      SELECT count(*)::int AS count
      FROM appointments a
      ${whereClause}
    `.replace(/\$(\d+)/g, (_, n) => {
      const val = params[parseInt(n) - 1]
      if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`
      return String(val)
    }))
  )

  const dataRows = dataResult.rows ?? dataResult
  const countRows = countResult.rows ?? countResult
  const total = countRows[0]?.count ?? 0

  return {
    data: dataRows.map(mapRow),
    total,
    page,
    pages: Math.ceil(total / limit),
  }
}

export async function createAppointment(
  db: any,
  data: {
    customerId?: string | null
    serviceId?: string | null
    staffId?: string | null
    date: string
    startTime: string
    endTime: string
    status?: string
    notes?: string | null
  },
  userId: string
): Promise<Appointment> {
  await ensureTable(db)

  const result = await db.execute(
    sql`INSERT INTO appointments (customer_id, service_id, staff_id, date, start_time, end_time, status, notes)
        VALUES (${data.customerId ?? null}, ${data.serviceId ?? null}, ${data.staffId ?? null}, ${data.date}, ${data.startTime}, ${data.endTime}, ${data.status ?? 'scheduled'}, ${data.notes ?? null})
        RETURNING *`
  )

  const rows = result.rows ?? result
  const appointment = rows[0]

  // Log to change_journal
  await db.execute(
    sql`INSERT INTO change_journal (table_name, record_id, action, data, user_id, synced)
        VALUES ('appointments', ${appointment.id}, 'insert', ${JSON.stringify(appointment)}::jsonb, ${userId}, false)`
  )

  // Return with joined names
  const fullResult = await db.execute(
    sql.raw(`
      ${SELECT_WITH_JOINS}
      WHERE a.id = '${appointment.id}'
      LIMIT 1
    `)
  )

  const fullRows = fullResult.rows ?? fullResult
  return mapRow(fullRows[0])
}

export async function updateAppointment(
  db: any,
  id: string,
  data: {
    customerId?: string | null
    serviceId?: string | null
    staffId?: string | null
    date?: string
    startTime?: string
    endTime?: string
    status?: string
    notes?: string | null
  },
  userId: string
): Promise<Appointment | null> {
  await ensureTable(db)

  // Check existence
  const existing = await db.execute(
    sql`SELECT * FROM appointments WHERE id = ${id} LIMIT 1`
  )
  const existingRows = existing.rows ?? existing
  if (!existingRows.length) return null

  const setClauses: string[] = []
  const vals: any = { ...existingRows[0] }

  if (data.customerId !== undefined) {
    vals.customer_id = data.customerId
    setClauses.push(`customer_id = ${data.customerId === null ? 'NULL' : `'${data.customerId}'`}`)
  }
  if (data.serviceId !== undefined) {
    vals.service_id = data.serviceId
    setClauses.push(`service_id = ${data.serviceId === null ? 'NULL' : `'${data.serviceId}'`}`)
  }
  if (data.staffId !== undefined) {
    vals.staff_id = data.staffId
    setClauses.push(`staff_id = ${data.staffId === null ? 'NULL' : `'${data.staffId}'`}`)
  }
  if (data.date !== undefined) {
    setClauses.push(`date = '${data.date}'`)
  }
  if (data.startTime !== undefined) {
    setClauses.push(`start_time = '${data.startTime}'`)
  }
  if (data.endTime !== undefined) {
    setClauses.push(`end_time = '${data.endTime}'`)
  }
  if (data.status !== undefined) {
    setClauses.push(`status = '${data.status}'`)
  }
  if (data.notes !== undefined) {
    setClauses.push(`notes = ${data.notes === null ? 'NULL' : `'${data.notes.replace(/'/g, "''")}'`}`)
  }

  setClauses.push(`updated_at = now()`)

  if (setClauses.length === 1) {
    // Only updated_at, nothing to update
    const fullResult = await db.execute(
      sql.raw(`${SELECT_WITH_JOINS} WHERE a.id = '${id}' LIMIT 1`)
    )
    const fullRows = fullResult.rows ?? fullResult
    return fullRows.length ? mapRow(fullRows[0]) : null
  }

  const updateResult = await db.execute(
    sql.raw(`
      UPDATE appointments
      SET ${setClauses.join(', ')}
      WHERE id = '${id}'
      RETURNING *
    `)
  )

  const updateRows = updateResult.rows ?? updateResult
  if (!updateRows.length) return null

  const updated = updateRows[0]

  // Log to change_journal
  await db.execute(
    sql`INSERT INTO change_journal (table_name, record_id, action, data, user_id, synced)
        VALUES ('appointments', ${id}, 'update', ${JSON.stringify(updated)}::jsonb, ${userId}, false)`
  )

  // Return with joined names
  const fullResult = await db.execute(
    sql.raw(`${SELECT_WITH_JOINS} WHERE a.id = '${id}' LIMIT 1`)
  )
  const fullRows = fullResult.rows ?? fullResult
  return fullRows.length ? mapRow(fullRows[0]) : null
}

export async function deleteAppointment(
  db: any,
  id: string,
  userId: string
): Promise<Appointment | null> {
  await ensureTable(db)

  // Check existence
  const existing = await db.execute(
    sql`SELECT * FROM appointments WHERE id = ${id} LIMIT 1`
  )
  const existingRows = existing.rows ?? existing
  if (!existingRows.length) return null

  // Soft delete: set status to cancelled
  const updateResult = await db.execute(
    sql`UPDATE appointments SET status = 'cancelled', updated_at = now() WHERE id = ${id} RETURNING *`
  )
  const updateRows = updateResult.rows ?? updateResult
  if (!updateRows.length) return null

  const cancelled = updateRows[0]

  // Log to change_journal
  await db.execute(
    sql`INSERT INTO change_journal (table_name, record_id, action, data, user_id, synced)
        VALUES ('appointments', ${id}, 'delete', ${JSON.stringify(cancelled)}::jsonb, ${userId}, false)`
  )

  // Return with joined names
  const fullResult = await db.execute(
    sql.raw(`${SELECT_WITH_JOINS} WHERE a.id = '${id}' LIMIT 1`)
  )
  const fullRows = fullResult.rows ?? fullResult
  return fullRows.length ? mapRow(fullRows[0]) : null
}

export async function getCalendar(
  db: any,
  from: string,
  to: string,
  staffId?: string
): Promise<CalendarDay[]> {
  await ensureTable(db)

  const staffFilter = staffId
    ? `AND a.staff_id = '${staffId}'`
    : ''

  const result = await db.execute(
    sql.raw(`
      ${SELECT_WITH_JOINS}
      WHERE a.date >= '${from}' AND a.date <= '${to}'
      AND a.status != 'cancelled'
      ${staffFilter}
      ORDER BY a.date ASC, a.start_time ASC
    `)
  )

  const rows = result.rows ?? result
  const appointments = rows.map(mapRow)

  // Group by date
  const grouped = new Map<string, Appointment[]>()

  // Generate all dates in range
  const startDate = new Date(from)
  const endDate = new Date(to)
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split('T')[0]
    grouped.set(dateStr, [])
  }

  for (const appt of appointments) {
    const dateStr = typeof appt.date === 'string' ? appt.date.split('T')[0] : String(appt.date)
    if (!grouped.has(dateStr)) {
      grouped.set(dateStr, [])
    }
    grouped.get(dateStr)!.push(appt)
  }

  const calendar: CalendarDay[] = []
  for (const [date, appts] of grouped) {
    calendar.push({ date, appointments: appts })
  }

  calendar.sort((a, b) => a.date.localeCompare(b.date))

  return calendar
}

export async function getAvailability(
  db: any,
  date: string,
  serviceId: string
): Promise<TimeSlot[]> {
  await ensureTable(db)

  // Ensure schedules table exists
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

  // Get the service duration
  const serviceResult = await db.execute(
    sql`SELECT duration_minutes FROM services WHERE id = ${serviceId} LIMIT 1`
  )
  const serviceRows = serviceResult.rows ?? serviceResult
  if (!serviceRows.length) {
    return []
  }

  const durationMinutes = serviceRows[0].duration_minutes ?? 30

  // Determine day of week (0 = Sunday, 6 = Saturday)
  const dateObj = new Date(date + 'T00:00:00')
  const dayOfWeek = dateObj.getDay()

  // Get all active staff schedules for this day of week
  const schedulesResult = await db.execute(
    sql`SELECT sc.staff_id, sc.start_time, sc.end_time, u.name AS staff_name
        FROM schedules sc
        LEFT JOIN users u ON u.id = sc.staff_id
        WHERE sc.day_of_week = ${dayOfWeek} AND sc.active = true`
  )
  const schedulesRows = schedulesResult.rows ?? schedulesResult
  if (!schedulesRows.length) {
    return []
  }

  // Get existing appointments for this date that are not cancelled
  const appointmentsResult = await db.execute(
    sql`SELECT staff_id, start_time, end_time
        FROM appointments
        WHERE date = ${date} AND status != 'cancelled'`
  )
  const appointmentsRows = appointmentsResult.rows ?? appointmentsResult

  // Build existing appointment map per staff
  const staffAppointments = new Map<string, Array<{ start: number; end: number }>>()
  for (const appt of appointmentsRows) {
    const staffId = appt.staff_id
    if (!staffAppointments.has(staffId)) {
      staffAppointments.set(staffId, [])
    }
    staffAppointments.get(staffId)!.push({
      start: timeToMinutes(appt.start_time),
      end: timeToMinutes(appt.end_time),
    })
  }

  // For each staff schedule, calculate available time slots
  const availableSlots: TimeSlot[] = []

  for (const schedule of schedulesRows) {
    const schedStart = timeToMinutes(schedule.start_time)
    const schedEnd = timeToMinutes(schedule.end_time)
    const existingAppts = staffAppointments.get(schedule.staff_id) ?? []

    // Generate 30-minute intervals within the schedule
    for (let slotStart = schedStart; slotStart + durationMinutes <= schedEnd; slotStart += 30) {
      const slotEnd = slotStart + durationMinutes

      // Check if this slot overlaps with any existing appointment
      const hasConflict = existingAppts.some(
        (appt) => slotStart < appt.end && slotEnd > appt.start
      )

      if (!hasConflict) {
        availableSlots.push({
          startTime: minutesToTime(slotStart),
          endTime: minutesToTime(slotEnd),
          staffId: schedule.staff_id,
          staffName: schedule.staff_name ?? '',
        })
      }
    }
  }

  // Sort by start time then by staff name
  availableSlots.sort((a, b) => {
    const timeCompare = a.startTime.localeCompare(b.startTime)
    if (timeCompare !== 0) return timeCompare
    return a.staffName.localeCompare(b.staffName)
  })

  return availableSlots
}

/**
 * Converts a time string (HH:MM:SS or HH:MM) to minutes since midnight.
 */
function timeToMinutes(time: string): number {
  const parts = String(time).split(':')
  const hours = parseInt(parts[0], 10)
  const minutes = parseInt(parts[1], 10)
  return hours * 60 + minutes
}

/**
 * Converts minutes since midnight to HH:MM time string.
 */
function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
}
