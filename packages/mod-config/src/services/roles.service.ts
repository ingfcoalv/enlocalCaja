import { v4 as uuidv4 } from 'uuid'
import { eq } from 'drizzle-orm'
import { roles, changeJournal } from '@enlocal/core-db'

interface CreateRoleData {
  name: string
  permissions: string[]
  isSystem?: boolean
}

interface UpdateRoleData {
  name?: string
  permissions?: string[]
}

/**
 * List all roles.
 */
export async function listRoles(db: any) {
  return db
    .select({
      id: roles.id,
      name: roles.name,
      permissions: roles.permissions,
      isSystem: roles.isSystem,
      createdAt: roles.createdAt,
    })
    .from(roles)
    .orderBy(roles.name)
}

/**
 * Create a new role with a permissions array. Logs the action to the change journal.
 */
export async function createRole(db: any, data: CreateRoleData, requestUserId: string) {
  const id = uuidv4()

  const [newRole] = await db
    .insert(roles)
    .values({
      id,
      name: data.name,
      permissions: data.permissions || [],
      isSystem: data.isSystem || false,
    })
    .returning({
      id: roles.id,
      name: roles.name,
      permissions: roles.permissions,
      isSystem: roles.isSystem,
      createdAt: roles.createdAt,
    })

  await db.insert(changeJournal).values({
    tableName: 'roles',
    recordId: id,
    action: 'INSERT',
    data: { name: data.name, permissions: data.permissions },
    userId: requestUserId,
  })

  return newRole
}

/**
 * Update a role's name and/or permissions. Logs the action to the change journal.
 */
export async function updateRole(db: any, id: string, data: UpdateRoleData, requestUserId: string) {
  const updateFields: Record<string, any> = {}

  if (data.name !== undefined) updateFields.name = data.name
  if (data.permissions !== undefined) updateFields.permissions = data.permissions

  if (Object.keys(updateFields).length === 0) {
    throw new Error('NO_FIELDS_TO_UPDATE')
  }

  const [updated] = await db
    .update(roles)
    .set(updateFields)
    .where(eq(roles.id, id))
    .returning({
      id: roles.id,
      name: roles.name,
      permissions: roles.permissions,
      isSystem: roles.isSystem,
      createdAt: roles.createdAt,
    })

  if (!updated) {
    throw new Error('ROLE_NOT_FOUND')
  }

  await db.insert(changeJournal).values({
    tableName: 'roles',
    recordId: id,
    action: 'UPDATE',
    data: updateFields,
    userId: requestUserId,
  })

  return updated
}

/**
 * Delete a role. Only non-system roles can be deleted.
 */
export async function deleteRole(db: any, id: string) {
  // First check if the role is a system role
  const [existing] = await db
    .select({ id: roles.id, isSystem: roles.isSystem, name: roles.name })
    .from(roles)
    .where(eq(roles.id, id))
    .limit(1)

  if (!existing) {
    throw new Error('ROLE_NOT_FOUND')
  }

  if (existing.isSystem) {
    throw new Error('CANNOT_DELETE_SYSTEM_ROLE')
  }

  await db.delete(roles).where(eq(roles.id, id))

  return { success: true, id: existing.id }
}
