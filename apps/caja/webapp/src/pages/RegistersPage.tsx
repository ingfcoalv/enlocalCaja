import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  Plus,
  Pencil,
  X,
  Loader2,
  ArrowLeft,
  Monitor,
  Power,
  PowerOff,
} from 'lucide-react'
import { api, useToast } from '@enlocal/react-hooks'

interface Register {
  id: string
  name: string
  isActive: boolean
  cloudId?: string | null
  createdAt?: string
  currentShift?: {
    id: string
    userId: string
    userName: string
    openedAt: string
  } | null
}

export default function RegistersPage() {
  const toast = useToast()
  const [registers, setRegisters] = useState<Register[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingRegister, setEditingRegister] = useState<Register | null>(null)
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)

  const fetchRegisters = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/api/pos/registers')
      setRegisters(res.data?.data || [])
    } catch {
      toast.error('Error al cargar cajas')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    fetchRegisters()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('El nombre es requerido')
      return
    }

    setSaving(true)
    try {
      if (editingRegister) {
        await api.put(`/api/pos/registers/${editingRegister.id}`, { name: name.trim() })
        toast.success('Caja actualizada')
      } else {
        await api.post('/api/pos/registers', { name: name.trim() })
        toast.success('Caja creada')
      }
      setShowModal(false)
      setEditingRegister(null)
      setName('')
      fetchRegisters()
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const handleToggleActive = async (register: Register) => {
    try {
      await api.put(`/api/pos/registers/${register.id}`, {
        is_active: !register.isActive,
      })
      toast.success(register.isActive ? 'Caja desactivada' : 'Caja activada')
      fetchRegisters()
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Error al actualizar')
    }
  }

  const handleEdit = (register: Register) => {
    setEditingRegister(register)
    setName(register.name)
    setShowModal(true)
  }

  const handleNew = () => {
    setEditingRegister(null)
    setName('')
    setShowModal(true)
  }

  return (
    <div className="mx-auto max-w-4xl">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            to="/settings"
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Cajas</h1>
            <p className="text-sm text-gray-500">
              Gestiona las cajas (terminales POS) de tu sucursal
            </p>
          </div>
        </div>
        <button
          onClick={handleNew}
          className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
          type="button"
        >
          <Plus className="h-4 w-4" />
          Nueva Caja
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
        </div>
      ) : registers.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 py-16 text-center">
          <Monitor className="mb-3 h-12 w-12 text-gray-300" />
          <p className="text-sm font-medium text-gray-600">No hay cajas configuradas</p>
          <p className="mt-1 text-xs text-gray-400">
            Crea tu primera caja para empezar a asignar turnos
          </p>
          <button
            onClick={handleNew}
            className="mt-4 flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
            type="button"
          >
            <Plus className="h-4 w-4" />
            Crear caja
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {registers.map((register) => (
            <div
              key={register.id}
              className={`relative rounded-xl border bg-white p-5 shadow-sm transition-all ${
                register.isActive
                  ? 'border-gray-200 hover:border-primary-300 hover:shadow-md'
                  : 'border-gray-100 bg-gray-50 opacity-60'
              }`}
            >
              {/* Status badge */}
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Monitor className={`h-5 w-5 ${register.isActive ? 'text-primary-600' : 'text-gray-400'}`} />
                  <h3 className="font-semibold text-gray-900">{register.name}</h3>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    register.isActive
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {register.isActive ? 'Activa' : 'Inactiva'}
                </span>
              </div>

              {/* Current shift info */}
              {register.currentShift ? (
                <div className="mb-3 rounded-lg bg-primary-50 px-3 py-2">
                  <p className="text-xs font-medium text-primary-700">
                    Turno abierto
                  </p>
                  <p className="text-xs text-primary-600">
                    {register.currentShift.userName}
                  </p>
                </div>
              ) : (
                <div className="mb-3 rounded-lg bg-gray-50 px-3 py-2">
                  <p className="text-xs text-gray-400">Sin turno abierto</p>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={() => handleEdit(register)}
                  className="flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                  type="button"
                >
                  <Pencil className="h-3 w-3" />
                  Editar
                </button>
                <button
                  onClick={() => handleToggleActive(register)}
                  className={`flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-medium ${
                    register.isActive
                      ? 'border-red-200 text-red-600 hover:bg-red-50'
                      : 'border-green-200 text-green-600 hover:bg-green-50'
                  }`}
                  type="button"
                >
                  {register.isActive ? (
                    <>
                      <PowerOff className="h-3 w-3" />
                      Desactivar
                    </>
                  ) : (
                    <>
                      <Power className="h-3 w-3" />
                      Activar
                    </>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="relative mx-4 w-full max-w-sm rounded-xl border border-gray-200 bg-white p-6 shadow-2xl">
            <button
              onClick={() => {
                setShowModal(false)
                setEditingRegister(null)
              }}
              className="absolute right-3 top-3 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              type="button"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="mb-4 text-lg font-semibold text-gray-900">
              {editingRegister ? 'Editar caja' : 'Nueva caja'}
            </h3>

            <div className="mb-5">
              <label
                htmlFor="register-name"
                className="mb-1.5 block text-sm font-medium text-gray-700"
              >
                Nombre
              </label>
              <input
                id="register-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej: Caja 1"
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowModal(false)
                  setEditingRegister(null)
                }}
                disabled={saving}
                className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                type="button"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !name.trim()}
                className="flex-1 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
                type="button"
              >
                {saving ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Guardando...
                  </span>
                ) : editingRegister ? (
                  'Guardar cambios'
                ) : (
                  'Crear caja'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
