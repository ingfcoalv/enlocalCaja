import bcrypt from 'bcryptjs'
import { v4 as uuidv4 } from 'uuid'
import { eq, and, ilike, sql } from 'drizzle-orm'
import { users, roles, userRoles, changeJournal } from '@enlocal/core-db'

const SALT_ROUNDS = 10

interface UserFilters {
  active?: boolean
  role?: string
  q?: string
}

interface CreateUserData {
  name: string
  email?: string | null
  pin: string
  role?: string
  color?: string | null
  photo?: string | null
  permissions?: string[]
  maxDiscountPercent?: number
}

interface UpdateUserData {
  name?: string
  email?: string | null
  role?: string
  color?: string | null
  photo?: string | null
  active?: boolean
  permissions?: string[]
  maxDiscountPercent?: number
}

/**
 * List users with optional filters.
 * - active: filter by active status
 * - role: filter by role
 * - q: ilike search on name
 */
export async function listUsers(db: any, filters: UserFilters = {}) {
  const conditions: any[] = []

  if (filters.active !== undefined) {
    conditions.push(eq(users.active, filters.active))
  }

  if (filters.role) {
    conditions.push(eq(users.role, filters.role))
  }

  if (filters.q) {
    conditions.push(ilike(users.name, `%${filters.q}%`))
  }

  const query = db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      color: users.color,
      photo: users.photo,
      active: users.active,
      maxDiscountPercent: users.maxDiscountPercent,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
    })
    .from(users)

  if (conditions.length > 0) {
    return query.where(and(...conditions)).orderBy(users.name)
  }

  return query.orderBy(users.name)
}

/**
 * Get a single user by ID (excluding pin_hash), including resolved permissions.
 */
export async function getUserById(db: any, id: string) {
  const [user] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      color: users.color,
      photo: users.photo,
      active: users.active,
      maxDiscountPercent: users.maxDiscountPercent,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
    })
    .from(users)
    .where(eq(users.id, id))

  if (!user) {
    throw new Error('USER_NOT_FOUND')
  }

  // Resolve permissions from user_roles → roles
  const userRoleRows = await db
    .select({ permissions: roles.permissions, roleName: roles.name })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .where(eq(userRoles.userId, id))

  let permissions: string[] = []
  let assignedRoleId: string | null = null

  if (userRoleRows.length > 0) {
    // Merge all role permissions
    for (const row of userRoleRows) {
      permissions = [...permissions, ...(row.permissions || [])]
    }
    // If the role is a custom user role, fetch the roleId
    const customRow = await db
      .select({ roleId: userRoles.roleId })
      .from(userRoles)
      .where(eq(userRoles.userId, id))
      .limit(1)
    if (customRow.length > 0) {
      assignedRoleId = customRow[0].roleId
    }
  }

  return { ...user, permissions, assignedRoleId }
}

/**
 * Assign a role to a user.
 * - If role is a predefined system role name, find the system role and assign it.
 * - If permissions[] is provided, create/update a custom role `user:<userId>`.
 */
export async function assignUserRole(
  db: any,
  userId: string,
  opts: { role?: string; permissions?: string[] }
) {
  // Remove existing user_roles for this user
  await db.delete(userRoles).where(eq(userRoles.userId, userId))

  // If custom permissions are provided, create/update a custom role
  if (opts.permissions && opts.permissions.length > 0) {
    const customRoleName = `user:${userId}`

    // Upsert the custom role
    const existing = await db
      .select({ id: roles.id })
      .from(roles)
      .where(eq(roles.name, customRoleName))
      .limit(1)

    let roleId: string
    if (existing.length > 0) {
      roleId = existing[0].id
      await db
        .update(roles)
        .set({ permissions: opts.permissions })
        .where(eq(roles.id, roleId))
    } else {
      roleId = uuidv4()
      await db.insert(roles).values({
        id: roleId,
        name: customRoleName,
        permissions: opts.permissions,
        isSystem: false,
      })
    }

    // Link user → custom role
    await db.insert(userRoles).values({
      id: uuidv4(),
      userId,
      roleId,
    })

    return
  }

  // If a predefined role name is provided, find or skip
  if (opts.role && opts.role !== 'custom') {
    const [systemRole] = await db
      .select({ id: roles.id })
      .from(roles)
      .where(eq(roles.name, opts.role))
      .limit(1)

    if (systemRole) {
      await db.insert(userRoles).values({
        id: uuidv4(),
        userId,
        roleId: systemRole.id,
      })
    }
  }
}

/**
 * Create a new user with a hashed PIN. Logs the action to the change journal.
 */
export async function createUser(db: any, data: CreateUserData, requestUserId: string) {
  const pinHash = await bcrypt.hash(data.pin, SALT_ROUNDS)
  const id = uuidv4()

  const [newUser] = await db
    .insert(users)
    .values({
      id,
      name: data.name,
      email: data.email || null,
      pinHash,
      role: data.role || 'staff',
      color: data.color || null,
      photo: data.photo || null,
      active: true,
      maxDiscountPercent: data.maxDiscountPercent != null ? String(data.maxDiscountPercent) : '100',
    })
    .returning({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      color: users.color,
      photo: users.photo,
      active: users.active,
      maxDiscountPercent: users.maxDiscountPercent,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
    })

  // Assign role/permissions
  if (data.role === 'custom' && data.permissions) {
    await assignUserRole(db, id, { permissions: data.permissions })
  } else if (data.role) {
    await assignUserRole(db, id, { role: data.role })
  }

  await db.insert(changeJournal).values({
    tableName: 'users',
    recordId: id,
    action: 'INSERT',
    data: { name: data.name, email: data.email, role: data.role || 'staff' },
    userId: requestUserId,
  })

  return newUser
}

/**
 * Update user fields (excluding PIN). Logs the action to the change journal.
 */
export async function updateUser(db: any, id: string, data: UpdateUserData, requestUserId: string) {
  const updateFields: Record<string, any> = {}

  if (data.name !== undefined) updateFields.name = data.name
  if (data.email !== undefined) updateFields.email = data.email
  if (data.role !== undefined) updateFields.role = data.role
  if (data.color !== undefined) updateFields.color = data.color
  if (data.photo !== undefined) updateFields.photo = data.photo
  if (data.active !== undefined) updateFields.active = data.active
  if (data.maxDiscountPercent !== undefined) updateFields.maxDiscountPercent = String(data.maxDiscountPercent)

  // For custom role, store 'custom' in the role field
  if (data.role === 'custom') {
    updateFields.role = 'custom'
  }

  if (Object.keys(updateFields).length === 0 && !data.permissions) {
    throw new Error('NO_FIELDS_TO_UPDATE')
  }

  if (Object.keys(updateFields).length > 0) {
    updateFields.updatedAt = sql`now()`

    const [updated] = await db
      .update(users)
      .set(updateFields)
      .where(eq(users.id, id))
      .returning({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        color: users.color,
        photo: users.photo,
        active: users.active,
        maxDiscountPercent: users.maxDiscountPercent,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })

    if (!updated) {
      throw new Error('USER_NOT_FOUND')
    }

    // Assign role/permissions
    if (data.role === 'custom' && data.permissions) {
      await assignUserRole(db, id, { permissions: data.permissions })
    } else if (data.role && data.role !== 'custom') {
      await assignUserRole(db, id, { role: data.role })
    }

    await db.insert(changeJournal).values({
      tableName: 'users',
      recordId: id,
      action: 'UPDATE',
      data: updateFields,
      userId: requestUserId,
    })

    return updated
  }

  // Only permissions changed
  if (data.permissions) {
    await assignUserRole(db, id, { permissions: data.permissions })

    await db
      .update(users)
      .set({ updatedAt: sql`now()` })
      .where(eq(users.id, id))
  }

  return getUserById(db, id)
}

/**
 * Change a user's PIN. Logs the action to the change journal (without the PIN value).
 */
export async function changePin(db: any, id: string, newPin: string, requestUserId: string) {
  const pinHash = await bcrypt.hash(newPin, SALT_ROUNDS)

  const [updated] = await db
    .update(users)
    .set({ pinHash, updatedAt: sql`now()` })
    .where(eq(users.id, id))
    .returning({ id: users.id })

  if (!updated) {
    throw new Error('USER_NOT_FOUND')
  }

  await db.insert(changeJournal).values({
    tableName: 'users',
    recordId: id,
    action: 'UPDATE',
    data: { field: 'pin_hash', changed: true },
    userId: requestUserId,
  })

  return { success: true }
}

/**
 * Soft delete a user by setting active=false. Logs the action to the change journal.
 */
export async function deleteUser(db: any, id: string, requestUserId: string) {
  const [updated] = await db
    .update(users)
    .set({ active: false, updatedAt: sql`now()` })
    .where(eq(users.id, id))
    .returning({ id: users.id, name: users.name })

  if (!updated) {
    throw new Error('USER_NOT_FOUND')
  }

  await db.insert(changeJournal).values({
    tableName: 'users',
    recordId: id,
    action: 'SOFT_DELETE',
    data: { active: false },
    userId: requestUserId,
  })

  return { success: true, id: updated.id }
}
