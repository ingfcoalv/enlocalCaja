import { useEffect, useState, useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  X,
  Loader2,
  Users,
  ArrowLeft,
  Shield,
  ChevronDown,
  ChevronRight,
  Check,
  Minus,
} from 'lucide-react'
import { useCRUD, useToast, usePermissionRegistry, api } from '@enlocal/react-hooks'
import type { PermissionSection } from '@enlocal/react-hooks'

interface User {
  id: string
  name: string
  email?: string
  pin?: string
  role: string
  color?: string
  active?: boolean
  permissions?: string[]
  assignedRoleId?: string | null
  maxDiscountPercent?: number
  createdAt?: string
}

const ROLES = [
  { value: 'admin', label: 'Administrador' },
  { value: 'manager', label: 'Gerente' },
  { value: 'operator', label: 'Operador' },
  { value: 'warehouse', label: 'Almacen' },
  { value: 'cashier', label: 'Cajero' },
  { value: 'viewer', label: 'Solo lectura' },
  { value: 'custom', label: 'Personalizado' },
]

const COLORS = [
  '#16a34a',
  '#2563eb',
  '#dc2626',
  '#9333ea',
  '#ea580c',
  '#0891b2',
  '#ca8a04',
  '#db2777',
]

const emptyUser: Partial<User> = {
  name: '',
  email: '',
  pin: '',
  role: 'cashier',
  color: '#16a34a',
  active: true,
  permissions: [],
  maxDiscountPercent: 10,
}

// ── Permission Editor Components ──────────────────────────────────

function PermissionSectionPanel({
  section,
  selectedPerms,
  onToggle,
  disabled,
}: {
  section: PermissionSection
  selectedPerms: string[]
  onToggle: (key: string) => void
  disabled: boolean
}) {
  const [expanded, setExpanded] = useState(false)

  const sectionKeys = section.permissions.map((p) => p.key)
  const checkedCount = sectionKeys.filter((k) => selectedPerms.includes(k)).length
  const allChecked = checkedCount === sectionKeys.length
  const someChecked = checkedCount > 0 && !allChecked

  const handleToggleAll = () => {
    if (disabled) return
    if (allChecked) {
      // Uncheck all in this section
      for (const k of sectionKeys) {
        if (selectedPerms.includes(k)) onToggle(k)
      }
    } else {
      // Check all in this section
      for (const k of sectionKeys) {
        if (!selectedPerms.includes(k)) onToggle(k)
      }
    }
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      <button
        type="button"
        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-gray-50"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-gray-400" />
          ) : (
            <ChevronRight className="h-4 w-4 text-gray-400" />
          )}
          <span className="text-sm font-medium text-gray-900">{section.label}</span>
          {section.module && (
            <span className="rounded-full bg-purple-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-purple-600">
              Addon
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">
            {checkedCount}/{sectionKeys.length}
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              handleToggleAll()
            }}
            disabled={disabled}
            className={`flex h-5 w-5 items-center justify-center rounded border transition-colors ${
              disabled
                ? 'cursor-not-allowed border-gray-200 bg-gray-100'
                : allChecked
                  ? 'border-primary-600 bg-primary-600 text-white'
                  : someChecked
                    ? 'border-primary-600 bg-primary-100'
                    : 'border-gray-300 hover:border-primary-400'
            }`}
          >
            {allChecked && <Check className="h-3 w-3" />}
            {someChecked && <Minus className="h-3 w-3 text-primary-600" />}
          </button>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-gray-100 px-4 py-3">
          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
            {section.permissions.map((perm) => (
              <label
                key={perm.key}
                className={`flex items-center gap-2 ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
              >
                <input
                  type="checkbox"
                  checked={selectedPerms.includes(perm.key)}
                  onChange={() => onToggle(perm.key)}
                  disabled={disabled}
                  className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500 disabled:cursor-not-allowed"
                />
                <span className="text-sm text-gray-700">{perm.label}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────

export default function UsersPage() {
  const toast = useToast()
  const { items, loading, error, pagination, fetchAll, create, update, remove } =
    useCRUD<User>('/api/users')
  const { sections, defaults, loading: permLoading } = usePermissionRegistry()

  const [searchQuery, setSearchQuery] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingUser, setEditingUser] = useState<Partial<User> | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [allRegisters, setAllRegisters] = useState<{ id: string; name: string }[]>([])
  const [userRegisterIds, setUserRegisterIds] = useState<string[]>([])
  const [loadingRegisters, setLoadingRegisters] = useState(false)

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  const filteredUsers = items.filter((u) => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      u.name.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.role.toLowerCase().includes(q)
    )
  })

  const isCustomRole = editingUser?.role === 'custom'
  const isPredefinedRole = editingUser?.role && editingUser.role !== 'custom'

  // Resolve displayed permissions based on role selection
  const displayedPermissions = useMemo(() => {
    if (!editingUser) return []
    if (isCustomRole) {
      return editingUser.permissions || []
    }
    // For predefined roles, show the default permissions
    if (editingUser.role && defaults[editingUser.role]) {
      return defaults[editingUser.role]
    }
    return []
  }, [editingUser, isCustomRole, defaults])

  // Expand wildcard permissions for display (e.g. 'pos.*' → all pos.* keys from registry)
  const resolvedPermissions = useMemo(() => {
    const allKeys = sections.flatMap((s) => s.permissions.map((p) => p.key))
    const resolved = new Set<string>()

    for (const perm of displayedPermissions) {
      if (perm === '*') {
        // All permissions
        for (const k of allKeys) resolved.add(k)
      } else if (perm.endsWith('.*')) {
        const prefix = perm.slice(0, -2)
        for (const k of allKeys) {
          if (k.startsWith(prefix + '.')) resolved.add(k)
        }
      } else {
        resolved.add(perm)
      }
    }

    return Array.from(resolved)
  }, [displayedPermissions, sections])

  const handleAdd = async () => {
    setEditingUser({ ...emptyUser })
    setIsEditing(false)
    setUserRegisterIds([])
    setShowModal(true)
    // Fetch registers for assignment
    setLoadingRegisters(true)
    try {
      const regsRes = await api.get('/api/pos/registers')
      setAllRegisters((regsRes.data?.data || []).map((r: any) => ({ id: r.id, name: r.name })))
    } catch {
      setAllRegisters([])
    } finally {
      setLoadingRegisters(false)
    }
  }

  const handleEdit = useCallback(
    async (user: User) => {
      // Fetch full user details including permissions
      try {
        const res = await api.get(`/api/users/${user.id}`)
        const fullUser = res.data
        const hasCustomPerms =
          fullUser.permissions &&
          fullUser.permissions.length > 0 &&
          fullUser.role === 'custom'

        setEditingUser({
          ...fullUser,
          pin: '',
          role: hasCustomPerms ? 'custom' : fullUser.role,
          permissions: fullUser.permissions || [],
          maxDiscountPercent: parseFloat(String(fullUser.maxDiscountPercent ?? 100)),
        })
      } catch {
        // Fallback to basic user data
        setEditingUser({ ...user, pin: '' })
      }
      setIsEditing(true)
      setShowModal(true)

      // Fetch registers
      setLoadingRegisters(true)
      try {
        const [regsRes, userRegsRes] = await Promise.all([
          api.get('/api/pos/registers'),
          api.get(`/api/users/${user.id}/registers`),
        ])
        setAllRegisters((regsRes.data?.data || []).map((r: any) => ({ id: r.id, name: r.name })))
        setUserRegisterIds((userRegsRes.data?.data || []).map((r: any) => r.id))
      } catch {
        setAllRegisters([])
        setUserRegisterIds([])
      } finally {
        setLoadingRegisters(false)
      }
    },
    []
  )

  const handleSave = useCallback(async () => {
    if (!editingUser) return
    if (!editingUser.name?.trim()) {
      toast.error('El nombre del usuario es requerido')
      return
    }
    if (!isEditing && (!editingUser.pin || editingUser.pin.length < 4)) {
      toast.error('El PIN debe tener al menos 4 digitos')
      return
    }

    setSaving(true)
    try {
      const payload: any = {
        name: editingUser.name,
        email: editingUser.email || null,
        role: editingUser.role,
        color: editingUser.color,
        active: editingUser.active,
        maxDiscountPercent: editingUser.maxDiscountPercent ?? 100,
      }

      // Include PIN only if provided
      if (editingUser.pin) {
        payload.pin = editingUser.pin
      }

      // For custom role, include the permissions array
      if (editingUser.role === 'custom') {
        payload.permissions = editingUser.permissions || []
      }

      if (isEditing && editingUser.id) {
        await update(editingUser.id, payload)
        // Save register assignments
        try {
          await api.put(`/api/users/${editingUser.id}/registers`, { registerIds: userRegisterIds })
        } catch { /* non-critical */ }
        toast.success('Usuario actualizado')
      } else {
        const result = await create(payload)
        // Save register assignments for new user
        const newUserId = (result as any)?.id
        if (newUserId) {
          try {
            await api.put(`/api/users/${newUserId}/registers`, { registerIds: userRegisterIds })
          } catch { /* non-critical */ }
        }
        toast.success('Usuario creado')
      }
      setShowModal(false)
      setEditingUser(null)
      setUserRegisterIds([])
      fetchAll()
    } catch {
      toast.error('Error al guardar el usuario')
    } finally {
      setSaving(false)
    }
  }, [editingUser, isEditing, update, create, fetchAll, toast])

  const handleDelete = useCallback(
    async (id: string) => {
      setDeleting(true)
      try {
        await remove(id)
        toast.success('Usuario eliminado')
        setShowDeleteConfirm(null)
      } catch {
        toast.error('Error al eliminar el usuario')
      } finally {
        setDeleting(false)
      }
    },
    [remove, toast]
  )

  const togglePermission = (perm: string) => {
    if (!editingUser || !isCustomRole) return
    const currentPerms = editingUser.permissions || []
    const newPerms = currentPerms.includes(perm)
      ? currentPerms.filter((p) => p !== perm)
      : [...currentPerms, perm]
    setEditingUser({ ...editingUser, permissions: newPerms })
  }

  const handleRoleChange = (role: string) => {
    if (!editingUser) return
    if (role === 'custom') {
      setEditingUser({ ...editingUser, role, permissions: [] })
    } else {
      // For predefined roles, clear custom permissions
      setEditingUser({ ...editingUser, role, permissions: [] })
    }
  }

  const getInitials = (name: string): string => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  const getRoleLabel = (role: string): string => {
    return ROLES.find((r) => r.value === role)?.label || role
  }

  return (
    <div>
      <div className="mb-6">
        <Link
          to="/settings"
          className="mb-3 flex items-center gap-1 text-sm text-gray-500 hover:text-primary-600"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a configuracion
        </Link>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Usuarios</h1>
            <p className="mt-1 text-sm text-gray-500">
              {pagination.total} usuarios registrados
            </p>
          </div>
          <button
            onClick={handleAdd}
            className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700"
            type="button"
          >
            <Plus className="h-4 w-4" />
            Nuevo usuario
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="mb-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por nombre, email o rol..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-4 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
          />
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Users Grid */}
      {loading && items.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12">
          <Users className="mb-2 h-10 w-10 text-gray-300" />
          <p className="text-sm text-gray-500">No se encontraron usuarios</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredUsers.map((user) => (
            <div
              key={user.id}
              className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-11 w-11 items-center justify-center rounded-full text-sm font-bold text-white"
                    style={{ backgroundColor: user.color || '#16a34a' }}
                  >
                    {getInitials(user.name)}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{user.name}</p>
                    <div className="flex items-center gap-1.5">
                      <Shield className="h-3 w-3 text-gray-400" />
                      <span className="text-xs text-gray-500">
                        {getRoleLabel(user.role)}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => handleEdit(user)}
                    className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-primary-600"
                    title="Editar"
                    type="button"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(user.id)}
                    className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                    title="Eliminar"
                    type="button"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              {user.email && (
                <p className="mt-2 text-xs text-gray-400">{user.email}</p>
              )}
              {user.active === false && (
                <span className="mt-2 inline-block rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-600">
                  Inactivo
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="relative mx-4 w-full max-w-2xl rounded-xl border border-gray-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <h3 className="text-lg font-semibold text-gray-900">
                {isEditing ? 'Editar usuario' : 'Nuevo usuario'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                disabled={saving}
                className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                type="button"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="max-h-[75vh] overflow-y-auto p-6">
              <div className="space-y-4">
                {/* Name & Email row */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="user-name" className="mb-1.5 block text-sm font-medium text-gray-700">
                      Nombre *
                    </label>
                    <input
                      id="user-name"
                      type="text"
                      value={editingUser.name || ''}
                      onChange={(e) =>
                        setEditingUser({ ...editingUser, name: e.target.value })
                      }
                      className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                      placeholder="Nombre completo"
                    />
                  </div>
                  <div>
                    <label htmlFor="user-email" className="mb-1.5 block text-sm font-medium text-gray-700">
                      Email
                    </label>
                    <input
                      id="user-email"
                      type="email"
                      value={editingUser.email || ''}
                      onChange={(e) =>
                        setEditingUser({ ...editingUser, email: e.target.value })
                      }
                      className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                      placeholder="email@ejemplo.com"
                    />
                  </div>
                </div>

                {/* PIN & Role row */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="user-pin" className="mb-1.5 block text-sm font-medium text-gray-700">
                      PIN {isEditing ? '(dejar vacio para no cambiar)' : '*'}
                    </label>
                    <input
                      id="user-pin"
                      type="password"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      value={editingUser.pin || ''}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '').slice(0, 6)
                        setEditingUser({ ...editingUser, pin: val })
                      }}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm tracking-[0.3em] focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                      placeholder="4-6 digitos"
                    />
                  </div>
                  <div>
                    <label htmlFor="user-role" className="mb-1.5 block text-sm font-medium text-gray-700">
                      Rol
                    </label>
                    <select
                      id="user-role"
                      value={editingUser.role || 'cashier'}
                      onChange={(e) => handleRoleChange(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                    >
                      {ROLES.map((role) => (
                        <option key={role.value} value={role.value}>
                          {role.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Max discount percent */}
                <div>
                  <label htmlFor="user-max-discount" className="mb-1.5 block text-sm font-medium text-gray-700">
                    Descuento maximo autorizado (%)
                  </label>
                  <input
                    id="user-max-discount"
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    value={editingUser.maxDiscountPercent ?? 100}
                    onChange={(e) =>
                      setEditingUser({
                        ...editingUser,
                        maxDiscountPercent: Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)),
                      })
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                    placeholder="0 - 100"
                  />
                  <p className="mt-1 text-xs text-gray-400">
                    Porcentaje maximo de descuento que este usuario puede aplicar en el punto de venta
                  </p>
                </div>

                {/* Color picker */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Color
                  </label>
                  <div className="flex gap-2">
                    {COLORS.map((color) => (
                      <button
                        key={color}
                        onClick={() =>
                          setEditingUser({ ...editingUser, color })
                        }
                        className={`h-8 w-8 rounded-full border-2 transition-all ${
                          editingUser.color === color
                            ? 'border-gray-800 scale-110'
                            : 'border-transparent hover:scale-105'
                        }`}
                        style={{ backgroundColor: color }}
                        type="button"
                      />
                    ))}
                  </div>
                </div>

                {/* Permissions Editor */}
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <label className="block text-sm font-medium text-gray-700">
                      Permisos
                    </label>
                    {isPredefinedRole && editingUser.role !== 'custom' && (
                      <span className="text-xs text-gray-400">
                        Solo lectura — definido por el rol
                      </span>
                    )}
                  </div>

                  {permLoading ? (
                    <div className="flex items-center justify-center py-6">
                      <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                      <span className="ml-2 text-sm text-gray-400">Cargando permisos...</span>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {sections.map((section) => (
                        <PermissionSectionPanel
                          key={section.id}
                          section={section}
                          selectedPerms={resolvedPermissions}
                          onToggle={togglePermission}
                          disabled={!isCustomRole}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* Register assignment */}
                {allRegisters.length > 0 && (
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">
                      Cajas asignadas
                    </label>
                    {loadingRegisters ? (
                      <div className="flex items-center gap-2 py-2 text-sm text-gray-400">
                        <Loader2 className="h-4 w-4 animate-spin" /> Cargando cajas...
                      </div>
                    ) : (
                      <div className="space-y-2 rounded-lg border border-gray-200 bg-white p-3">
                        {/* Select all */}
                        <label className="flex items-center gap-2 cursor-pointer border-b border-gray-100 pb-2">
                          <input
                            type="checkbox"
                            checked={userRegisterIds.length === allRegisters.length && allRegisters.length > 0}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setUserRegisterIds(allRegisters.map(r => r.id))
                              } else {
                                setUserRegisterIds([])
                              }
                            }}
                            className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                          />
                          <span className="text-sm font-medium text-gray-700">Todas las cajas</span>
                        </label>
                        {allRegisters.map((reg) => (
                          <label key={reg.id} className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={userRegisterIds.includes(reg.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setUserRegisterIds([...userRegisterIds, reg.id])
                                } else {
                                  setUserRegisterIds(userRegisterIds.filter(id => id !== reg.id))
                                }
                              }}
                              className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                            />
                            <span className="text-sm text-gray-700">{reg.name}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Active toggle */}
                <div className="flex items-center gap-3">
                  <label className="relative inline-flex cursor-pointer items-center">
                    <input
                      type="checkbox"
                      checked={editingUser.active !== false}
                      onChange={(e) =>
                        setEditingUser({
                          ...editingUser,
                          active: e.target.checked,
                        })
                      }
                      className="peer sr-only"
                    />
                    <div className="peer h-5 w-9 rounded-full bg-gray-300 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all peer-checked:bg-primary-600 peer-checked:after:translate-x-full" />
                  </label>
                  <span className="text-sm text-gray-700">Usuario activo</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-gray-200 px-6 py-4">
              <button
                onClick={() => setShowModal(false)}
                disabled={saving}
                className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                type="button"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
                type="button"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {isEditing ? 'Guardar cambios' : 'Crear usuario'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-sm rounded-xl border border-gray-200 bg-white p-6 shadow-2xl">
            <h3 className="mb-2 text-lg font-semibold text-gray-900">
              Eliminar usuario
            </h3>
            <p className="mb-6 text-sm text-gray-500">
              Esta accion no se puede deshacer. El usuario sera eliminado
              permanentemente.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                disabled={deleting}
                className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                type="button"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDelete(showDeleteConfirm)}
                disabled={deleting}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                type="button"
              >
                {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
