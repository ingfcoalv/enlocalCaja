import { changeJournal } from '@enlocal/core-db'
import { sql } from 'drizzle-orm'

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

interface EmployeeFilters {
  active?: boolean
  department?: string
  q?: string
}

interface Employee {
  id: string
  userId: string | null
  curp: string | null
  nss: string | null
  rfc: string | null
  salaryType: string
  salaryAmount: string
  bank: string | null
  clabe: string | null
  department: string | null
  hireDate: string | null
  active: boolean
  createdAt: string
  updatedAt: string
}

/* ------------------------------------------------------------------ */
/*  Row mapper                                                        */
/* ------------------------------------------------------------------ */

function mapRow(row: any): Employee {
  return {
    id: row.id,
    userId: row.user_id,
    curp: row.curp,
    nss: row.nss,
    rfc: row.rfc,
    salaryType: row.salary_type,
    salaryAmount: row.salary_amount,
    bank: row.bank,
    clabe: row.clabe,
    department: row.department,
    hireDate: row.hire_date,
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/* ------------------------------------------------------------------ */
/*  Ensure table                                                      */
/* ------------------------------------------------------------------ */

export async function ensureTable(db: any): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS employees (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid,
      curp text,
      nss text,
      rfc text,
      salary_type text NOT NULL DEFAULT 'fixed',
      salary_amount numeric(12,2) NOT NULL DEFAULT 0,
      bank text,
      clabe text,
      department text,
      hire_date date,
      active boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `)
}

/* ------------------------------------------------------------------ */
/*  CRUD operations                                                   */
/* ------------------------------------------------------------------ */

export async function listEmployees(
  db: any,
  filters: EmployeeFilters
): Promise<Employee[]> {
  await ensureTable(db)

  const conditions: string[] = []
  const values: any[] = []

  if (filters.active !== undefined) {
    conditions.push(`active = ${filters.active}`)
  }

  if (filters.department) {
    values.push(filters.department)
    conditions.push(`department = '${filters.department}'`)
  }

  // Build dynamic query with raw SQL
  if (filters.q) {
    const search = `%${filters.q}%`
    // Use raw sql template for the search query
    const whereClause = conditions.length > 0 ? conditions.join(' AND ') + ' AND' : ''
    const result = await db.execute(
      sql`SELECT * FROM employees
          WHERE ${sql.raw(whereClause)}
          (curp ILIKE ${search} OR nss ILIKE ${search} OR rfc ILIKE ${search} OR department ILIKE ${search})
          ORDER BY created_at DESC`
    )
    const rows = result.rows ?? result
    return rows.map(mapRow)
  }

  if (conditions.length > 0) {
    const whereClause = conditions.join(' AND ')
    const result = await db.execute(
      sql`SELECT * FROM employees WHERE ${sql.raw(whereClause)} ORDER BY created_at DESC`
    )
    const rows = result.rows ?? result
    return rows.map(mapRow)
  }

  const result = await db.execute(
    sql`SELECT * FROM employees ORDER BY created_at DESC`
  )
  const rows = result.rows ?? result
  return rows.map(mapRow)
}

export async function getEmployeeById(
  db: any,
  id: string
): Promise<Employee | null> {
  await ensureTable(db)

  const result = await db.execute(
    sql`SELECT * FROM employees WHERE id = ${id}`
  )
  const rows = result.rows ?? result
  if (!rows.length) return null
  return mapRow(rows[0])
}

export async function createEmployee(
  db: any,
  data: {
    user_id?: string
    curp?: string
    nss?: string
    rfc?: string
    salary_type?: string
    salary_amount?: number
    bank?: string
    clabe?: string
    department?: string
    hire_date?: string
  },
  userId: string
): Promise<Employee> {
  await ensureTable(db)

  const result = await db.execute(
    sql`INSERT INTO employees (
          user_id, curp, nss, rfc, salary_type, salary_amount,
          bank, clabe, department, hire_date
        )
        VALUES (
          ${data.user_id ?? null},
          ${data.curp ?? null},
          ${data.nss ?? null},
          ${data.rfc ?? null},
          ${data.salary_type ?? 'fixed'},
          ${data.salary_amount ?? 0},
          ${data.bank ?? null},
          ${data.clabe ?? null},
          ${data.department ?? null},
          ${data.hire_date ?? null}
        )
        RETURNING *`
  )

  const rows = result.rows ?? result
  const employee = mapRow(rows[0])

  // Log to change journal
  await db.insert(changeJournal).values({
    tableName: 'employees',
    recordId: employee.id,
    action: 'create',
    data: rows[0],
    userId,
    synced: false,
  })

  return employee
}

export async function updateEmployee(
  db: any,
  id: string,
  data: {
    user_id?: string
    curp?: string
    nss?: string
    rfc?: string
    salary_type?: string
    salary_amount?: number
    bank?: string
    clabe?: string
    department?: string
    hire_date?: string
    active?: boolean
  },
  userId: string
): Promise<Employee> {
  await ensureTable(db)

  // Build SET clause dynamically
  const setClauses: string[] = []

  if (data.user_id !== undefined) setClauses.push(`user_id = '${data.user_id}'`)
  if (data.curp !== undefined) setClauses.push(`curp = '${data.curp}'`)
  if (data.nss !== undefined) setClauses.push(`nss = '${data.nss}'`)
  if (data.rfc !== undefined) setClauses.push(`rfc = '${data.rfc}'`)
  if (data.salary_type !== undefined) setClauses.push(`salary_type = '${data.salary_type}'`)
  if (data.salary_amount !== undefined) setClauses.push(`salary_amount = ${data.salary_amount}`)
  if (data.bank !== undefined) setClauses.push(`bank = '${data.bank}'`)
  if (data.clabe !== undefined) setClauses.push(`clabe = '${data.clabe}'`)
  if (data.department !== undefined) setClauses.push(`department = '${data.department}'`)
  if (data.hire_date !== undefined) setClauses.push(`hire_date = '${data.hire_date}'`)
  if (data.active !== undefined) setClauses.push(`active = ${data.active}`)

  setClauses.push(`updated_at = now()`)

  const setClause = setClauses.join(', ')

  const result = await db.execute(
    sql`UPDATE employees SET ${sql.raw(setClause)} WHERE id = ${id} RETURNING *`
  )

  const rows = result.rows ?? result
  if (!rows.length) {
    throw new Error('Employee not found')
  }

  const employee = mapRow(rows[0])

  // Log to change journal
  await db.insert(changeJournal).values({
    tableName: 'employees',
    recordId: employee.id,
    action: 'update',
    data: rows[0],
    userId,
    synced: false,
  })

  return employee
}

export async function deleteEmployee(
  db: any,
  id: string,
  userId: string
): Promise<Employee> {
  await ensureTable(db)

  // Soft delete: set active = false
  const result = await db.execute(
    sql`UPDATE employees SET active = false, updated_at = now() WHERE id = ${id} RETURNING *`
  )

  const rows = result.rows ?? result
  if (!rows.length) {
    throw new Error('Employee not found')
  }

  const employee = mapRow(rows[0])

  // Log to change journal
  await db.insert(changeJournal).values({
    tableName: 'employees',
    recordId: employee.id,
    action: 'delete',
    data: rows[0],
    userId,
    synced: false,
  })

  return employee
}
