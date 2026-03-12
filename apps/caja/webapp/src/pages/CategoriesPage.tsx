import { useEffect, useState, useCallback } from 'react'
import {
  Plus,
  Pencil,
  Trash2,
  X,
  Loader2,
  FolderTree,
  GripVertical,
} from 'lucide-react'
import { useToast, useAuth } from '@enlocal/react-hooks'

interface Category {
  id: string
  name: string
  sortOrder: number
  parentId: string | null
  active: boolean
}

export default function CategoriesPage() {
  const toast = useToast()
  const { token } = useAuth()
  const [items, setItems] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Partial<Category> | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  }

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/categories', { headers })
      const json = await res.json()
      setItems(json.data || [])
    } catch {
      toast.error('Error al cargar categorias')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => { fetchAll() }, [fetchAll])

  // Separate root categories and subcategories
  const rootCategories = items.filter((c) => !c.parentId)
  const getChildren = (parentId: string) => items.filter((c) => c.parentId === parentId)

  const handleAdd = (parentId: string | null = null) => {
    const maxSort = items
      .filter((c) => c.parentId === parentId)
      .reduce((max, c) => Math.max(max, c.sortOrder), -1)
    setEditing({ name: '', sortOrder: maxSort + 1, parentId, active: true })
    setIsEditing(false)
    setShowModal(true)
  }

  const handleEdit = (item: Category) => {
    setEditing({ ...item })
    setIsEditing(true)
    setShowModal(true)
  }

  const handleSave = useCallback(async () => {
    if (!editing) return
    if (!editing.name?.trim()) {
      toast.error('El nombre es requerido')
      return
    }
    setSaving(true)
    try {
      const url = isEditing && editing.id ? `/api/categories/${editing.id}` : '/api/categories'
      const method = isEditing && editing.id ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers,
        body: JSON.stringify({
          name: editing.name,
          sortOrder: editing.sortOrder ?? 0,
          parentId: editing.parentId || null,
        }),
      })
      if (!res.ok) throw new Error('Error')
      toast.success(isEditing ? 'Categoria actualizada' : 'Categoria creada')
      setShowModal(false)
      fetchAll()
    } catch {
      toast.error('Error al guardar')
    } finally {
      setSaving(false)
    }
  }, [editing, isEditing, fetchAll, toast, token])

  const handleDelete = useCallback(async (id: string) => {
    setDeleting(true)
    try {
      const res = await fetch(`/api/categories/${id}`, { method: 'DELETE', headers })
      if (!res.ok) throw new Error('Error')
      toast.success('Categoria eliminada')
      setShowDeleteConfirm(null)
      fetchAll()
    } catch {
      toast.error('Error al eliminar')
    } finally {
      setDeleting(false)
    }
  }, [fetchAll, toast, token])

  const renderCategory = (cat: Category, level: number = 0) => {
    const children = getChildren(cat.id)
    return (
      <div key={cat.id}>
        <div
          className={`flex items-center justify-between border-b border-gray-100 px-4 py-3 hover:bg-gray-50 ${
            level > 0 ? 'bg-gray-50/50' : ''
          }`}
          style={{ paddingLeft: `${16 + level * 24}px` }}
        >
          <div className="flex items-center gap-3">
            <GripVertical className="h-4 w-4 text-gray-300" />
            <div>
              <span className="font-medium text-gray-900">{cat.name}</span>
              {children.length > 0 && (
                <span className="ml-2 text-xs text-gray-400">
                  ({children.length} sub)
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            {level === 0 && (
              <button
                onClick={() => handleAdd(cat.id)}
                className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-primary-600"
                title="Agregar subcategoria"
                type="button"
              >
                <Plus className="h-4 w-4" />
              </button>
            )}
            <button
              onClick={() => handleEdit(cat)}
              className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-primary-600"
              title="Editar"
              type="button"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              onClick={() => setShowDeleteConfirm(cat.id)}
              className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
              title="Eliminar"
              type="button"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
        {children.map((child) => renderCategory(child, level + 1))}
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Categorias</h1>
          <p className="mt-1 text-sm text-gray-500">
            {items.length} categorias internas — se sincronizan como secciones en la nube
          </p>
        </div>
        <button
          onClick={() => handleAdd(null)}
          className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700"
          type="button"
        >
          <Plus className="h-4 w-4" />
          Nueva categoria
        </button>
      </div>

      {/* Categories tree */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        {loading ? (
          <div className="px-4 py-12 text-center">
            <Loader2 className="mx-auto h-6 w-6 animate-spin text-gray-400" />
            <p className="mt-2 text-sm text-gray-500">Cargando...</p>
          </div>
        ) : rootCategories.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <FolderTree className="mx-auto h-8 w-8 text-gray-300" />
            <p className="mt-2 text-sm text-gray-500">No hay categorias</p>
            <p className="text-xs text-gray-400">Crea tu primera categoria para organizar productos</p>
          </div>
        ) : (
          rootCategories.map((cat) => renderCategory(cat))
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="relative mx-4 w-full max-w-md rounded-xl border border-gray-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <h3 className="text-lg font-semibold text-gray-900">
                {isEditing ? 'Editar categoria' : editing.parentId ? 'Nueva subcategoria' : 'Nueva categoria'}
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

            <div className="p-6 space-y-4">
              <div>
                <label htmlFor="cat-name" className="mb-1 block text-sm font-medium text-gray-700">
                  Nombre *
                </label>
                <input
                  id="cat-name"
                  type="text"
                  value={editing.name || ''}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                  placeholder="Nombre de la categoria"
                  autoFocus
                />
              </div>
              {!editing.parentId && !isEditing && (
                <div>
                  <label htmlFor="cat-parent" className="mb-1 block text-sm font-medium text-gray-700">
                    Categoria padre (opcional)
                  </label>
                  <select
                    id="cat-parent"
                    value={editing.parentId || ''}
                    onChange={(e) => setEditing({ ...editing, parentId: e.target.value || null })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                  >
                    <option value="">Sin padre (categoria raiz)</option>
                    {rootCategories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label htmlFor="cat-order" className="mb-1 block text-sm font-medium text-gray-700">
                  Orden
                </label>
                <input
                  id="cat-order"
                  type="number"
                  min="0"
                  value={editing.sortOrder ?? 0}
                  onChange={(e) => setEditing({ ...editing, sortOrder: parseInt(e.target.value) || 0 })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                />
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
                {isEditing ? 'Guardar' : 'Crear'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-sm rounded-xl border border-gray-200 bg-white p-6 shadow-2xl">
            <h3 className="mb-2 text-lg font-semibold text-gray-900">Eliminar categoria</h3>
            <p className="mb-6 text-sm text-gray-500">
              La categoria sera desactivada. Los productos asignados a esta categoria no se veran afectados.
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
