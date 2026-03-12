import { changeJournal } from '@enlocal/core-db'
import { sql } from 'drizzle-orm'
import { ensureTable as ensureEmployeesTable } from './employees.service'

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

interface PeriodFilters {
  type?: string
  status?: string
  page?: number
  limit?: number
}

interface PaginatedResult<T> {
  data: T[]
  total: number
  page: number
  pages: number
}

interface PayrollPeriod {
  id: string
  name: string
  startDate: string
  endDate: string
  type: string
  status: string
  createdAt: string
}

interface PayrollEntry {
  id: string
  periodId: string
  employeeId: string
  baseSalary: string
  deductions: any
  perceptions: any
  netPay: string
  cfdiId: string | null
  createdAt: string
}

interface PayrollEntryWithEmployee extends PayrollEntry {
  employeeCurp: string | null
  employeeRfc: string | null
  employeeDepartment: string | null
  employeeBank: string | null
  employeeClabe: string | null
}

/* ------------------------------------------------------------------ */
/*  Row mappers                                                       */
/* ------------------------------------------------------------------ */

function mapPeriodRow(row: any): PayrollPeriod {
  return {
    id: row.id,
    name: row.name,
    startDate: row.start_date,
    endDate: row.end_date,
    type: row.type,
    status: row.status,
    createdAt: row.created_at,
  }
}

function mapEntryRow(row: any): PayrollEntry {
  return {
    id: row.id,
    periodId: row.period_id,
    employeeId: row.employee_id,
    baseSalary: row.base_salary,
    deductions: row.deductions,
    perceptions: row.perceptions,
    netPay: row.net_pay,
    cfdiId: row.cfdi_id,
    createdAt: row.created_at,
  }
}

function mapEntryWithEmployeeRow(row: any): PayrollEntryWithEmployee {
  return {
    ...mapEntryRow(row),
    employeeCurp: row.employee_curp ?? row.curp ?? null,
    employeeRfc: row.employee_rfc ?? row.rfc ?? null,
    employeeDepartment: row.employee_department ?? row.department ?? null,
    employeeBank: row.employee_bank ?? row.bank ?? null,
    employeeClabe: row.employee_clabe ?? row.clabe ?? null,
  }
}

/* ------------------------------------------------------------------ */
/*  Ensure tables                                                     */
/* ------------------------------------------------------------------ */

export async function ensureTables(db: any): Promise<void> {
  await ensureEmployeesTable(db)

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS payroll_periods (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name text NOT NULL,
      start_date date NOT NULL,
      end_date date NOT NULL,
      type text NOT NULL DEFAULT 'biweekly',
      status text NOT NULL DEFAULT 'draft',
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `)

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS payroll_entries (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      period_id uuid NOT NULL,
      employee_id uuid NOT NULL,
      base_salary numeric(12,2) NOT NULL DEFAULT 0,
      deductions jsonb NOT NULL DEFAULT '{}',
      perceptions jsonb NOT NULL DEFAULT '{}',
      net_pay numeric(12,2) NOT NULL DEFAULT 0,
      cfdi_id uuid,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `)
}

/* ------------------------------------------------------------------ */
/*  Periods CRUD                                                      */
/* ------------------------------------------------------------------ */

export async function listPeriods(
  db: any,
  filters: PeriodFilters
): Promise<PaginatedResult<PayrollPeriod>> {
  await ensureTables(db)

  const page = filters.page || 1
  const limit = filters.limit || 50
  const offset = (page - 1) * limit

  const conditions: string[] = []

  if (filters.type) {
    conditions.push(`type = '${filters.type}'`)
  }
  if (filters.status) {
    conditions.push(`status = '${filters.status}'`)
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  const result = await db.execute(
    sql`SELECT * FROM payroll_periods ${sql.raw(whereClause)} ORDER BY start_date DESC LIMIT ${limit} OFFSET ${offset}`
  )

  const countResult = await db.execute(
    sql`SELECT count(*)::int as count FROM payroll_periods ${sql.raw(whereClause)}`
  )

  const rows = result.rows ?? result
  const countRows = countResult.rows ?? countResult
  const total = countRows[0]?.count ?? 0

  return {
    data: rows.map(mapPeriodRow),
    total,
    page,
    pages: Math.ceil(total / limit),
  }
}

export async function createPeriod(
  db: any,
  data: {
    name: string
    start_date: string
    end_date: string
    type?: string
  },
  userId: string
): Promise<PayrollPeriod> {
  await ensureTables(db)

  const result = await db.execute(
    sql`INSERT INTO payroll_periods (name, start_date, end_date, type)
        VALUES (${data.name}, ${data.start_date}, ${data.end_date}, ${data.type ?? 'biweekly'})
        RETURNING *`
  )

  const rows = result.rows ?? result
  const period = mapPeriodRow(rows[0])

  // Log to change journal
  await db.insert(changeJournal).values({
    tableName: 'payroll_periods',
    recordId: period.id,
    action: 'create',
    data: rows[0],
    userId,
    synced: false,
  })

  return period
}

export async function updatePeriod(
  db: any,
  id: string,
  data: {
    name?: string
    start_date?: string
    end_date?: string
    type?: string
    status?: string
  },
  userId: string
): Promise<PayrollPeriod> {
  await ensureTables(db)

  const setClauses: string[] = []

  if (data.name !== undefined) setClauses.push(`name = '${data.name}'`)
  if (data.start_date !== undefined) setClauses.push(`start_date = '${data.start_date}'`)
  if (data.end_date !== undefined) setClauses.push(`end_date = '${data.end_date}'`)
  if (data.type !== undefined) setClauses.push(`type = '${data.type}'`)
  if (data.status !== undefined) setClauses.push(`status = '${data.status}'`)

  if (setClauses.length === 0) {
    throw new Error('No fields to update')
  }

  const setClause = setClauses.join(', ')

  const result = await db.execute(
    sql`UPDATE payroll_periods SET ${sql.raw(setClause)} WHERE id = ${id} RETURNING *`
  )

  const rows = result.rows ?? result
  if (!rows.length) {
    throw new Error('Period not found')
  }

  const period = mapPeriodRow(rows[0])

  // Log to change journal
  await db.insert(changeJournal).values({
    tableName: 'payroll_periods',
    recordId: period.id,
    action: 'update',
    data: rows[0],
    userId,
    synced: false,
  })

  return period
}

/* ------------------------------------------------------------------ */
/*  Payroll calculation                                               */
/* ------------------------------------------------------------------ */

export async function calculatePayroll(
  db: any,
  periodId: string,
  userId: string
): Promise<PayrollEntry[]> {
  await ensureTables(db)

  // Verify period exists and is in draft status
  const periodResult = await db.execute(
    sql`SELECT * FROM payroll_periods WHERE id = ${periodId}`
  )
  const periodRows = periodResult.rows ?? periodResult
  if (!periodRows.length) {
    throw new Error('Period not found')
  }

  const period = periodRows[0]
  if (period.status !== 'draft') {
    throw new Error('Payroll can only be calculated for periods in draft status')
  }

  // Delete any existing entries for this period (recalculation)
  await db.execute(
    sql`DELETE FROM payroll_entries WHERE period_id = ${periodId}`
  )

  // Get all active employees
  const employeesResult = await db.execute(
    sql`SELECT * FROM employees WHERE active = true`
  )
  const employees = employeesResult.rows ?? employeesResult

  const entries: PayrollEntry[] = []

  for (const emp of employees) {
    const baseSalary = parseFloat(emp.salary_amount || '0')

    // Default deductions: ISR 10%, IMSS 3%
    const isrAmount = Math.round(baseSalary * 0.10 * 100) / 100
    const imssAmount = Math.round(baseSalary * 0.03 * 100) / 100
    const totalDeductions = Math.round((isrAmount + imssAmount) * 100) / 100

    const deductions = {
      ISR: isrAmount,
      IMSS: imssAmount,
    }

    // Default perceptions: base salary
    const perceptions = {
      base: baseSalary,
    }

    const totalPerceptions = baseSalary

    // Net pay = base salary - deductions (perceptions IS the base salary here)
    const netPay = Math.round((totalPerceptions - totalDeductions) * 100) / 100

    const entryResult = await db.execute(
      sql`INSERT INTO payroll_entries (period_id, employee_id, base_salary, deductions, perceptions, net_pay)
          VALUES (${periodId}, ${emp.id}, ${baseSalary}, ${JSON.stringify(deductions)}::jsonb, ${JSON.stringify(perceptions)}::jsonb, ${netPay})
          RETURNING *`
    )

    const entryRows = entryResult.rows ?? entryResult
    entries.push(mapEntryRow(entryRows[0]))
  }

  // Update period status to 'calculated'
  await db.execute(
    sql`UPDATE payroll_periods SET status = 'calculated' WHERE id = ${periodId}`
  )

  // Log to change journal
  await db.insert(changeJournal).values({
    tableName: 'payroll_periods',
    recordId: periodId,
    action: 'update',
    data: { status: 'calculated', entriesCount: entries.length },
    userId,
    synced: false,
  })

  return entries
}

/* ------------------------------------------------------------------ */
/*  Approve payroll                                                   */
/* ------------------------------------------------------------------ */

export async function approvePayroll(
  db: any,
  periodId: string,
  userId: string
): Promise<PayrollPeriod> {
  await ensureTables(db)

  // Verify period exists and is in calculated status
  const periodResult = await db.execute(
    sql`SELECT * FROM payroll_periods WHERE id = ${periodId}`
  )
  const periodRows = periodResult.rows ?? periodResult
  if (!periodRows.length) {
    throw new Error('Period not found')
  }

  const period = periodRows[0]
  if (period.status !== 'calculated') {
    throw new Error('Only calculated payroll periods can be approved')
  }

  // Set status to 'paid'
  const updateResult = await db.execute(
    sql`UPDATE payroll_periods SET status = 'paid' WHERE id = ${periodId} RETURNING *`
  )

  const updateRows = updateResult.rows ?? updateResult
  const updatedPeriod = mapPeriodRow(updateRows[0])

  // Log to change journal
  await db.insert(changeJournal).values({
    tableName: 'payroll_periods',
    recordId: periodId,
    action: 'update',
    data: updateRows[0],
    userId,
    synced: false,
  })

  return updatedPeriod
}

/* ------------------------------------------------------------------ */
/*  Get payroll entries with employee info                            */
/* ------------------------------------------------------------------ */

export async function getPayrollEntries(
  db: any,
  periodId: string
): Promise<PayrollEntryWithEmployee[]> {
  await ensureTables(db)

  const result = await db.execute(
    sql`SELECT
          pe.*,
          e.curp as employee_curp,
          e.rfc as employee_rfc,
          e.department as employee_department,
          e.bank as employee_bank,
          e.clabe as employee_clabe
        FROM payroll_entries pe
        LEFT JOIN employees e ON pe.employee_id = e.id
        WHERE pe.period_id = ${periodId}
        ORDER BY e.department, e.rfc`
  )

  const rows = result.rows ?? result
  return rows.map(mapEntryWithEmployeeRow)
}

/* ------------------------------------------------------------------ */
/*  Stamp payroll receipts (placeholder)                              */
/* ------------------------------------------------------------------ */

export async function stampPayrollReceipts(
  db: any,
  periodId: string,
  userId: string
): Promise<PayrollPeriod> {
  await ensureTables(db)

  // Verify period exists and is in paid status
  const periodResult = await db.execute(
    sql`SELECT * FROM payroll_periods WHERE id = ${periodId}`
  )
  const periodRows = periodResult.rows ?? periodResult
  if (!periodRows.length) {
    throw new Error('Period not found')
  }

  const period = periodRows[0]
  if (period.status !== 'paid') {
    throw new Error('Only paid payroll periods can be stamped')
  }

  // Placeholder: mark all entries with a generated cfdi_id (simulated)
  // In a real implementation, this would call the SAT CFDI web service
  const entriesResult = await db.execute(
    sql`SELECT id FROM payroll_entries WHERE period_id = ${periodId}`
  )
  const entries = entriesResult.rows ?? entriesResult

  for (const entry of entries) {
    await db.execute(
      sql`UPDATE payroll_entries SET cfdi_id = gen_random_uuid() WHERE id = ${entry.id}`
    )
  }

  // Update period status to 'stamped'
  const updateResult = await db.execute(
    sql`UPDATE payroll_periods SET status = 'stamped' WHERE id = ${periodId} RETURNING *`
  )

  const updateRows = updateResult.rows ?? updateResult
  const updatedPeriod = mapPeriodRow(updateRows[0])

  // Log to change journal
  await db.insert(changeJournal).values({
    tableName: 'payroll_periods',
    recordId: periodId,
    action: 'update',
    data: { status: 'stamped', stampedEntries: entries.length },
    userId,
    synced: false,
  })

  return updatedPeriod
}
