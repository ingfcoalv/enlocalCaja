import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import jwt from 'jsonwebtoken'
import { eq, and } from 'drizzle-orm'
import { users, roles, userRoles } from '@enlocal/core-db'

// Generate a random JWT secret per installation if none is set via env
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex')
}
const JWT_SECRET = process.env.JWT_SECRET
const JWT_EXPIRES_IN_SECONDS = parseInt(process.env.JWT_EXPIRES_IN_SECONDS || '28800', 10) // 8 hours

interface UserPayload {
  id: string
  name: string
  role: string
  permissions: string[]
  maxDiscountPercent?: number
}

/**
 * Resolve the permissions for a user by looking up their assigned roles.
 * Falls back to an empty array if no explicit role assignments exist.
 */
async function resolvePermissions(db: any, userId: string): Promise<string[]> {
  const assignments = await db
    .select({
      permissions: roles.permissions,
    })
    .from(userRoles)
    .innerJoin(roles, eq(roles.id, userRoles.roleId))
    .where(eq(userRoles.userId, userId))

  const allPermissions: string[] = []
  for (const row of assignments) {
    if (Array.isArray(row.permissions)) {
      allPermissions.push(...row.permissions)
    }
  }
  return [...new Set(allPermissions)]
}

/**
 * Authenticate a user by PIN.
 * If userId is provided, only check that specific user's PIN.
 * Otherwise, iterate active users to find a matching PIN.
 */
export async function loginWithPin(
  db: any,
  pin: string,
  userId?: string,
): Promise<{ token: string; user: UserPayload; mustChangePin: boolean }> {
  let matchedUsers: any[]

  if (userId) {
    matchedUsers = await db
      .select()
      .from(users)
      .where(and(eq(users.id, userId), eq(users.active, true)))
      .limit(1)
  } else {
    matchedUsers = await db
      .select()
      .from(users)
      .where(eq(users.active, true))
  }

  if (!matchedUsers || matchedUsers.length === 0) {
    throw new Error('USER_NOT_FOUND')
  }

  let foundUser: any = null

  if (userId) {
    const user = matchedUsers[0]
    const valid = await bcrypt.compare(pin, user.pinHash)
    if (!valid) {
      throw new Error('INVALID_PIN')
    }
    foundUser = user
  } else {
    for (const user of matchedUsers) {
      const valid = await bcrypt.compare(pin, user.pinHash)
      if (valid) {
        foundUser = user
        break
      }
    }
    if (!foundUser) {
      throw new Error('INVALID_PIN')
    }
  }

  const permissions = await resolvePermissions(db, foundUser.id)

  const payload: UserPayload = {
    id: foundUser.id,
    name: foundUser.name,
    role: foundUser.role,
    permissions,
    maxDiscountPercent: parseFloat(foundUser.maxDiscountPercent ?? '100'),
  }

  const token = jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN_SECONDS,
  })

  // 3.5 — Include must_change_pin flag in response
  return { token, user: payload, mustChangePin: foundUser.mustChangePin ?? false }
}

/**
 * Reissue a new JWT from an existing authenticated user payload.
 */
export function refreshToken(user: UserPayload): { token: string; user: UserPayload } {
  const token = jwt.sign(
    { id: user.id, name: user.name, role: user.role, permissions: user.permissions, maxDiscountPercent: user.maxDiscountPercent ?? 100 },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN_SECONDS },
  )
  return { token, user }
}

/**
 * Return a list of active users for the login screen.
 * Only exposes non-sensitive fields: id, name, color, photo, role.
 */
export async function getStaffList(db: any): Promise<
  { id: string; name: string; color: string | null; photo: string | null; role: string }[]
> {
  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      color: users.color,
      photo: users.photo,
      role: users.role,
    })
    .from(users)
    .where(eq(users.active, true))
    .orderBy(users.name)

  return rows
}
