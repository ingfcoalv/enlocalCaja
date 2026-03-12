import { useEffect, useState, useCallback } from 'react'
import {
  Plus,
  Pencil,
  Trash2,
  X,
  Loader2,
  Tag,
  Star,
} from 'lucide-react'
import { useToast } from '@enlocal/react-hooks'
import { useAuth } from '@enlocal/react-hooks'

interface PriceList {
  id: string
  name: string
  isDefault: boolean
  active: boolean
  createdAt?: string
}

export default function PriceListsPage() {
  const toast = useToast()
  const { token } = useAuth()
  const [items, setItems] = useState<PriceList[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Partial<PriceList> | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/price-lists', { headers })
      const json = await res.json()
      setItems(json.data || [])
    } catch {
      toast.error('Error al cargar listas de precios')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => { fetchAll() }, [fetchAll])

  const handleAdd = () => {
    setEditing({ name: '', isDefault: false })
    setIsEditing(false)
    setShowModal(true)
  }

  const handleEdit = (item: PriceList) => {
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
      const url = isEditing && editing.id ? `/api/price-lists/${editing.id}` : '/api/price-lists'
      const method = isEditing && editing.id ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers,
        body: JSON.stringify({ name: editing.name, isDefault: editing.isDefault, active: editing.active ?? true }),
      })
      if (!res.ok) throw new Error('Error')
      toast.success(isEditing ? 'Lista actualizada' : 'Lista creada')
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
      const res = await fetch(`/api/price-lists/${id}`, { method: 'DELETE', headers })
      if (!res.ok) throw new Error('Error')
      toast.success('Lista eliminada')
      setShowDeleteConfirm(null)
      fetchAll()
    } catch {
      toast.error('Error al eliminar')
    } finally {
      setDeleting(false)
    }
  }, [fetchAll, toast, token])

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Listas de Precios</h1>
          <p className="mt-1 text-sm text-gray-500">
            {items.length} listas configuradas
          </p>
        </div>
        <button
          onClick={handleAdd}
          className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700"
          type="button"
        >
          <Plus className="h-4 w-4" />
          Nueva lista
        </button>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="px-4 py-3 font-medium text-gray-600">Nombre</th>
              <th className="px-4 py-3 font-medium text-gray-600">Predeterminada</th>
              <th className="px-4 py-3 font-medium text-gray-600">Estado</th>
              <th className="px-4 py-3 text-right font-medium text-gray-600">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} className="px-4 py-12 text-center">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin text-gray-400" />
                  <p className="mt-2 text-sm text-gray-500">Cargando...</p>
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-12 text-center">
                  <Tag className="mx-auto h-8 w-8 text-gray-300" />
                  <p className="mt-2 text-sm text-gray-500">No hay listas de precios</p>
                  <p className="text-xs text-gray-400">Crea tu primera lista para empezar</p>
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Tag className="h-4 w-4 text-gray-400" />
                      <span className="font-medium text-gray-900">{item.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {item.isDefault ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-yellow-50 px-2 py-0.5 text-xs font-medium text-yellow-700">
                        <Star className="h-3 w-3" />
                        Predeterminada
                      </span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      item.active
                        ? 'bg-green-50 text-green-700'
                        : 'bg-red-50 text-red-700'
                    }`}>
                      {item.active ? 'Activa' : 'Inactiva'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => handleEdit(item)}
                        className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-primary-600"
                        title="Editar"
                        type="button"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setShowDeleteConfirm(item.id)}
                        className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                        title="Eliminar"
                        type="button"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Modal */}
      {showModal && editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="relative mx-4 w-full max-w-md rounded-xl border border-gray-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <h3 className="text-lg font-semibold text-gray-900">
                {isEditing ? 'Editar lista' : 'Nueva lista de precios'}
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
                <label htmlFor="pl-name" className="mb-1 block text-sm font-medium text-gray-700">
                  Nombre *
                </label>
                <input
                  id="pl-name"
                  type="text"
                  value={editing.name || ''}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                  placeholder="Ej: Mayoreo, VIP, Distribuidor..."
                  autoFocus
                />
              </div>
              <div className="flex items-center gap-3">
                <input
                  id="pl-default"
                  type="checkbox"
                  checked={editing.isDefault || false}
                  onChange={(e) => setEditing({ ...editing, isDefault: e.target.checked })}
                  className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <label htmlFor="pl-default" className="text-sm text-gray-700">
                  Marcar como lista predeterminada
                </label>
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
            <h3 className="mb-2 text-lg font-semibold text-gray-900">Eliminar lista</h3>
            <p className="mb-6 text-sm text-gray-500">
              Los precios asociados a esta lista seran eliminados. Los clientes asignados perderan su lista de precios.
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
