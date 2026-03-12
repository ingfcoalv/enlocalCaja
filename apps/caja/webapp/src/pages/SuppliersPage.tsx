import { useEffect, useState, useCallback } from 'react'
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  X,
  Loader2,
  Building2,
  Phone,
  Mail,
  ChevronDown,
} from 'lucide-react'
import { useCRUD, useToast } from '@enlocal/react-hooks'
import { ModuleGate } from '@enlocal/react-components'

interface Supplier {
  id: string
  name: string
  rfc?: string
  contactName?: string
  phone?: string
  email?: string
  address?: string
  notes?: string
  active?: boolean
  // Commercial profile
  paymentTerms?: string
  defaultCreditDays?: number | string
  defaultPaymentMethod?: string
  bankName?: string
  bankAccount?: string
  bankClabe?: string
  bankReference?: string
  currency?: string
  taxRate?: number | string
  createdAt?: string
}

const emptySupplier: Partial<Supplier> = {
  name: '',
  rfc: '',
  contactName: '',
  phone: '',
  email: '',
  address: '',
  notes: '',
  paymentTerms: 'cash',
  defaultCreditDays: 0,
  defaultPaymentMethod: 'transferencia',
  bankName: '',
  bankAccount: '',
  bankClabe: '',
  bankReference: '',
  currency: 'MXN',
  taxRate: 0.16,
}

const inputClass =
  'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20'
const labelClass = 'mb-1 block text-sm font-medium text-gray-700'
const sectionTitleClass = 'mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-gray-500'

export default function SuppliersPage() {
  const toast = useToast()
  const { items, loading, error, pagination, fetchAll, create, update, remove } =
    useCRUD<Supplier>('/api/suppliers')

  const [searchQuery, setSearchQuery] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingSupplier, setEditingSupplier] = useState<Partial<Supplier> | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [showCommercial, setShowCommercial] = useState(false)

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  const filteredSuppliers = items.filter((s) => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      s.name.toLowerCase().includes(q) ||
      s.rfc?.toLowerCase().includes(q) ||
      s.contactName?.toLowerCase().includes(q) ||
      s.email?.toLowerCase().includes(q) ||
      s.phone?.includes(q)
    )
  })

  const handleAdd = () => {
    setEditingSupplier({ ...emptySupplier })
    setIsEditing(false)
    setShowCommercial(false)
    setShowModal(true)
  }

  const handleEdit = (supplier: Supplier) => {
    setEditingSupplier({ ...supplier })
    setIsEditing(true)
    setShowCommercial(false)
    setShowModal(true)
  }

  const setField = (field: keyof Supplier, value: any) => {
    setEditingSupplier((prev) => (prev ? { ...prev, [field]: value } : prev))
  }

  const handleSave = useCallback(async () => {
    if (!editingSupplier) return
    if (!editingSupplier.name?.trim()) {
      toast.error('El nombre del proveedor es requerido')
      return
    }

    setSaving(true)
    try {
      if (isEditing && editingSupplier.id) {
        await update(editingSupplier.id, editingSupplier)
        toast.success('Proveedor actualizado')
      } else {
        await create(editingSupplier)
        toast.success('Proveedor creado')
      }
      setShowModal(false)
      setEditingSupplier(null)
      fetchAll()
    } catch {
      toast.error('Error al guardar el proveedor')
    } finally {
      setSaving(false)
    }
  }, [editingSupplier, isEditing, update, create, fetchAll, toast])

  const handleDelete = useCallback(
    async (id: string) => {
      setDeleting(true)
      try {
        await remove(id)
        toast.success('Proveedor eliminado')
        setShowDeleteConfirm(null)
      } catch {
        toast.error('Error al eliminar el proveedor')
      } finally {
        setDeleting(false)
      }
    },
    [remove, toast]
  )

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Proveedores</h1>
          <p className="mt-1 text-sm text-gray-500">
            {pagination.total} proveedores registrados
          </p>
        </div>
        <button
          onClick={handleAdd}
          className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700"
          type="button"
        >
          <Plus className="h-4 w-4" />
          Nuevo proveedor
        </button>
      </div>

      {/* Search */}
      <div className="mb-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por nombre, RFC, contacto..."
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

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-3 font-medium text-gray-600">Proveedor</th>
                <th className="px-4 py-3 font-medium text-gray-600">Contacto</th>
                <th className="px-4 py-3 font-medium text-gray-600">RFC</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading && items.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-12 text-center">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-gray-400" />
                    <p className="mt-2 text-sm text-gray-500">Cargando proveedores...</p>
                  </td>
                </tr>
              ) : filteredSuppliers.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-12 text-center">
                    <Building2 className="mx-auto h-8 w-8 text-gray-300" />
                    <p className="mt-2 text-sm text-gray-500">No se encontraron proveedores</p>
                  </td>
                </tr>
              ) : (
                filteredSuppliers.map((supplier) => (
                  <tr
                    key={supplier.id}
                    className="border-b border-gray-100 hover:bg-gray-50"
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{supplier.name}</p>
                      {supplier.contactName && (
                        <p className="text-xs text-gray-400">{supplier.contactName}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-0.5">
                        {supplier.email && (
                          <div className="flex items-center gap-1.5 text-xs text-gray-500">
                            <Mail className="h-3 w-3" />
                            {supplier.email}
                          </div>
                        )}
                        {supplier.phone && (
                          <div className="flex items-center gap-1.5 text-xs text-gray-500">
                            <Phone className="h-3 w-3" />
                            {supplier.phone}
                          </div>
                        )}
                        {!supplier.email && !supplier.phone && (
                          <span className="text-gray-400">-</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {supplier.rfc || '-'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleEdit(supplier)}
                          className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-primary-600"
                          title="Editar"
                          type="button"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setShowDeleteConfirm(supplier.id)}
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
      </div>

      {/* Add/Edit Modal */}
      {showModal && editingSupplier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="relative mx-4 w-full max-w-2xl rounded-xl border border-gray-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <h3 className="text-lg font-semibold text-gray-900">
                {isEditing ? 'Editar proveedor' : 'Nuevo proveedor'}
              </h3>
              <button
                onClick={() => { setShowModal(false); setShowCommercial(false) }}
                disabled={saving}
                className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                type="button"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="max-h-[70vh] overflow-y-auto p-6">
              {/* --- SECCION: Informacion General --- */}
              <div className="mb-6">
                <div className={sectionTitleClass}>
                  <Building2 className="h-4 w-4" />
                  Informacion General
                </div>

                <div className="space-y-4">
                  <div>
                    <label htmlFor="sup-name" className={labelClass}>
                      Nombre del Proveedor *
                    </label>
                    <input
                      id="sup-name"
                      type="text"
                      value={editingSupplier.name || ''}
                      onChange={(e) => setField('name', e.target.value)}
                      className={inputClass}
                      placeholder="Nombre o razon social"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="sup-rfc" className={labelClass}>RFC</label>
                      <input
                        id="sup-rfc"
                        type="text"
                        value={editingSupplier.rfc || ''}
                        onChange={(e) => setField('rfc', e.target.value.toUpperCase())}
                        className={`${inputClass} uppercase`}
                        placeholder="XAXX010101000"
                        maxLength={13}
                      />
                    </div>
                    <div>
                      <label htmlFor="sup-contact" className={labelClass}>Contacto</label>
                      <input
                        id="sup-contact"
                        type="text"
                        value={editingSupplier.contactName || ''}
                        onChange={(e) => setField('contactName', e.target.value)}
                        className={inputClass}
                        placeholder="Nombre del contacto"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="sup-phone" className={labelClass}>Telefono</label>
                      <input
                        id="sup-phone"
                        type="tel"
                        value={editingSupplier.phone || ''}
                        onChange={(e) => setField('phone', e.target.value)}
                        className={inputClass}
                        placeholder="55 1234 5678"
                      />
                    </div>
                    <div>
                      <label htmlFor="sup-email" className={labelClass}>Email</label>
                      <input
                        id="sup-email"
                        type="email"
                        value={editingSupplier.email || ''}
                        onChange={(e) => setField('email', e.target.value)}
                        className={inputClass}
                        placeholder="proveedor@ejemplo.com"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="sup-address" className={labelClass}>Direccion</label>
                    <input
                      id="sup-address"
                      type="text"
                      value={editingSupplier.address || ''}
                      onChange={(e) => setField('address', e.target.value)}
                      className={inputClass}
                      placeholder="Direccion del proveedor"
                    />
                  </div>

                  <div>
                    <label htmlFor="sup-notes" className={labelClass}>Notas</label>
                    <textarea
                      id="sup-notes"
                      value={editingSupplier.notes || ''}
                      onChange={(e) => setField('notes', e.target.value)}
                      rows={2}
                      className={inputClass}
                      placeholder="Notas internas..."
                    />
                  </div>
                </div>
              </div>

              {/* --- SECCION: Perfil Comercial (colapsable) --- */}
              <ModuleGate module="payables">
                <div className="mb-6">
                  <button
                    type="button"
                    onClick={() => setShowCommercial(!showCommercial)}
                    className={`${sectionTitleClass} w-full cursor-pointer hover:text-gray-700`}
                  >
                    <ChevronDown className={`h-4 w-4 transition-transform ${showCommercial ? 'rotate-180' : ''}`} />
                    Perfil Comercial
                  </button>

                  {showCommercial && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <label htmlFor="sup-payment-terms" className={labelClass}>Terminos de Pago</label>
                          <select
                            id="sup-payment-terms"
                            value={editingSupplier.paymentTerms || 'cash'}
                            onChange={(e) => setField('paymentTerms', e.target.value)}
                            className={inputClass}
                          >
                            <option value="cash">Contado</option>
                            <option value="credit">Credito</option>
                          </select>
                        </div>
                        <div>
                          <label htmlFor="sup-credit-days" className={labelClass}>Dias de Credito</label>
                          <input
                            id="sup-credit-days"
                            type="number"
                            min="0"
                            step="1"
                            value={editingSupplier.defaultCreditDays ?? 0}
                            onChange={(e) => setField('defaultCreditDays', parseInt(e.target.value) || 0)}
                            className={inputClass}
                            placeholder="0"
                          />
                        </div>
                        <div>
                          <label htmlFor="sup-payment-method" className={labelClass}>Metodo de Pago</label>
                          <select
                            id="sup-payment-method"
                            value={editingSupplier.defaultPaymentMethod || 'transferencia'}
                            onChange={(e) => setField('defaultPaymentMethod', e.target.value)}
                            className={inputClass}
                          >
                            <option value="transferencia">Transferencia</option>
                            <option value="cheque">Cheque</option>
                            <option value="efectivo">Efectivo</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label htmlFor="sup-bank" className={labelClass}>Banco</label>
                          <input
                            id="sup-bank"
                            type="text"
                            value={editingSupplier.bankName || ''}
                            onChange={(e) => setField('bankName', e.target.value)}
                            className={inputClass}
                            placeholder="Nombre del banco"
                          />
                        </div>
                        <div>
                          <label htmlFor="sup-account" className={labelClass}>No. de Cuenta</label>
                          <input
                            id="sup-account"
                            type="text"
                            value={editingSupplier.bankAccount || ''}
                            onChange={(e) => setField('bankAccount', e.target.value)}
                            className={inputClass}
                            placeholder="Numero de cuenta"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label htmlFor="sup-clabe" className={labelClass}>CLABE</label>
                          <input
                            id="sup-clabe"
                            type="text"
                            value={editingSupplier.bankClabe || ''}
                            onChange={(e) => setField('bankClabe', e.target.value)}
                            className={inputClass}
                            placeholder="CLABE interbancaria (18 digitos)"
                            maxLength={18}
                          />
                        </div>
                        <div>
                          <label htmlFor="sup-ref" className={labelClass}>Referencia Bancaria</label>
                          <input
                            id="sup-ref"
                            type="text"
                            value={editingSupplier.bankReference || ''}
                            onChange={(e) => setField('bankReference', e.target.value)}
                            className={inputClass}
                            placeholder="Referencia"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label htmlFor="sup-currency" className={labelClass}>Moneda</label>
                          <select
                            id="sup-currency"
                            value={editingSupplier.currency || 'MXN'}
                            onChange={(e) => setField('currency', e.target.value)}
                            className={inputClass}
                          >
                            <option value="MXN">MXN - Peso Mexicano</option>
                            <option value="USD">USD - Dolar Americano</option>
                          </select>
                        </div>
                        <div>
                          <label htmlFor="sup-tax" className={labelClass}>Tasa de IVA (%)</label>
                          <input
                            id="sup-tax"
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            value={(() => {
                              const r = editingSupplier.taxRate
                              if (r === undefined || r === null || r === '') return '16'
                              const n = typeof r === 'string' ? parseFloat(r) : r
                              return isNaN(n) ? '16' : String(Math.round(n * 10000) / 100)
                            })()}
                            onChange={(e) => {
                              const pct = parseFloat(e.target.value)
                              setField('taxRate', isNaN(pct) ? '' : pct / 100)
                            }}
                            className={inputClass}
                            placeholder="16"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </ModuleGate>
            </div>

            <div className="flex justify-end gap-3 border-t border-gray-200 px-6 py-4">
              <button
                onClick={() => { setShowModal(false); setShowCommercial(false) }}
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
                {isEditing ? 'Guardar cambios' : 'Crear proveedor'}
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
              Eliminar proveedor
            </h3>
            <p className="mb-6 text-sm text-gray-500">
              El proveedor sera desactivado y no aparecera en futuras busquedas.
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
