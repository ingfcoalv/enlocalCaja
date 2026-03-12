import { useEffect, useState, useCallback } from 'react'
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  X,
  Loader2,
  Users,
  Phone,
  Mail,
  FileText,
} from 'lucide-react'
import { useCRUD, useToast, useAuth } from '@enlocal/react-hooks'
import { ModuleGate } from '@enlocal/react-components'
import { CreditProfileSection } from '../components/CreditProfileSection'

interface Customer {
  id: string
  name: string
  email?: string
  phone?: string
  cellphone?: string
  contactName?: string
  priceListId?: string | null
  defaultDiscount?: number | string
  creditLimit?: number | string
  creditDays?: number | string
  personType?: string
  razonSocial?: string
  rfc?: string
  regimenFiscal?: string
  usoCfdi?: string
  codigoPostalFiscal?: string
  emailFacturas?: string
  address?: string
  notes?: string
  createdAt?: string
}

interface PriceListOption {
  id: string
  name: string
}

const REGIMENES_FISCALES = [
  { value: '', label: 'Seleccionar...' },
  { value: '601', label: '601 - General de Ley Personas Morales' },
  { value: '603', label: '603 - Personas Morales con Fines no Lucrativos' },
  { value: '605', label: '605 - Sueldos y Salarios e Ingresos Asimilados' },
  { value: '606', label: '606 - Arrendamiento' },
  { value: '607', label: '607 - Regimen de Enajenacion o Adquisicion de Bienes' },
  { value: '608', label: '608 - Demas ingresos' },
  { value: '610', label: '610 - Residentes en el Extranjero' },
  { value: '611', label: '611 - Ingresos por Dividendos' },
  { value: '612', label: '612 - Personas Fisicas con Actividades Empresariales y Profesionales' },
  { value: '614', label: '614 - Ingresos por intereses' },
  { value: '615', label: '615 - Regimen de los ingresos por obtencion de premios' },
  { value: '616', label: '616 - Sin obligaciones fiscales' },
  { value: '620', label: '620 - Sociedades Cooperativas de Produccion' },
  { value: '621', label: '621 - Incorporacion Fiscal' },
  { value: '622', label: '622 - Actividades Agricolas, Ganaderas, Silvicolas y Pesqueras' },
  { value: '623', label: '623 - Opcional para Grupos de Sociedades' },
  { value: '624', label: '624 - Coordinados' },
  { value: '625', label: '625 - Regimen de las Actividades Empresariales con ingr. a traves de Plataformas Tecnologicas' },
  { value: '626', label: '626 - Regimen Simplificado de Confianza' },
]

const USOS_CFDI = [
  { value: 'G01', label: 'G01 - Adquisicion de mercancias' },
  { value: 'G02', label: 'G02 - Devoluciones, descuentos o bonificaciones' },
  { value: 'G03', label: 'G03 - Gastos en general' },
  { value: 'I01', label: 'I01 - Construcciones' },
  { value: 'I02', label: 'I02 - Mobiliario y equipo de oficina' },
  { value: 'I03', label: 'I03 - Equipo de transporte' },
  { value: 'I04', label: 'I04 - Equipo de computo y accesorios' },
  { value: 'I08', label: 'I08 - Otra maquinaria y equipo' },
  { value: 'D01', label: 'D01 - Honorarios medicos, dentales y gastos hospitalarios' },
  { value: 'D02', label: 'D02 - Gastos medicos por incapacidad o discapacidad' },
  { value: 'D03', label: 'D03 - Gastos funerales' },
  { value: 'D04', label: 'D04 - Donativos' },
  { value: 'D05', label: 'D05 - Intereses por creditos hipotecarios' },
  { value: 'D06', label: 'D06 - Aportaciones voluntarias al SAR' },
  { value: 'D07', label: 'D07 - Primas por seguros de gastos medicos' },
  { value: 'D08', label: 'D08 - Gastos de transportacion escolar' },
  { value: 'D10', label: 'D10 - Pagos por servicios educativos' },
  { value: 'P01', label: 'P01 - Por definir' },
  { value: 'S01', label: 'S01 - Sin efectos fiscales' },
  { value: 'CP01', label: 'CP01 - Pagos' },
]

const emptyCustomer: Partial<Customer> = {
  name: '',
  email: '',
  phone: '',
  cellphone: '',
  contactName: '',
  priceListId: null,
  defaultDiscount: 0,
  creditLimit: 0,
  creditDays: 0,
  personType: 'fisica',
  razonSocial: '',
  rfc: '',
  regimenFiscal: '',
  usoCfdi: 'G03',
  codigoPostalFiscal: '',
  emailFacturas: '',
  address: '',
  notes: '',
}

const inputClass =
  'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20'
const labelClass = 'mb-1 block text-sm font-medium text-gray-700'
const sectionTitleClass = 'mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-gray-500'

export default function CustomersPage() {
  const toast = useToast()
  const { token } = useAuth()
  const { items, loading, error, pagination, fetchAll, create, update, remove } =
    useCRUD<Customer>('/api/customers')

  const [priceLists, setPriceLists] = useState<PriceListOption[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<Partial<Customer> | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    fetchAll()
    // Fetch price lists for the dropdown
    fetch('/api/price-lists?active=true', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((json) => setPriceLists(json.data || []))
      .catch(() => {})
  }, [fetchAll, token])

  const filteredCustomers = items.filter((c) => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      c.name.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q) ||
      c.phone?.includes(q) ||
      c.rfc?.toLowerCase().includes(q) ||
      c.razonSocial?.toLowerCase().includes(q)
    )
  })

  const handleAdd = () => {
    setEditingCustomer({ ...emptyCustomer })
    setIsEditing(false)
    setShowModal(true)
  }

  const handleEdit = (customer: Customer) => {
    setEditingCustomer({ ...customer })
    setIsEditing(true)
    setShowModal(true)
  }

  const setField = (field: keyof Customer, value: any) => {
    setEditingCustomer((prev) => (prev ? { ...prev, [field]: value } : prev))
  }

  const handleSave = useCallback(async () => {
    if (!editingCustomer) return
    if (!editingCustomer.name?.trim()) {
      toast.error('El nombre del cliente es requerido')
      return
    }

    setSaving(true)
    try {
      if (isEditing && editingCustomer.id) {
        await update(editingCustomer.id, editingCustomer)
        toast.success('Cliente actualizado')
      } else {
        await create(editingCustomer)
        toast.success('Cliente creado')
      }
      setShowModal(false)
      setEditingCustomer(null)
      fetchAll()
    } catch {
      toast.error('Error al guardar el cliente')
    } finally {
      setSaving(false)
    }
  }, [editingCustomer, isEditing, update, create, fetchAll, toast])

  const handleDelete = useCallback(
    async (id: string) => {
      setDeleting(true)
      try {
        await remove(id)
        toast.success('Cliente eliminado')
        setShowDeleteConfirm(null)
      } catch {
        toast.error('Error al eliminar el cliente')
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
          <h1 className="text-2xl font-bold text-gray-900">Clientes</h1>
          <p className="mt-1 text-sm text-gray-500">
            {pagination.total} clientes registrados
          </p>
        </div>
        <button
          onClick={handleAdd}
          className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700"
          type="button"
        >
          <Plus className="h-4 w-4" />
          Nuevo cliente
        </button>
      </div>

      {/* Search */}
      <div className="mb-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por nombre, email, telefono, RFC..."
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
                <th className="px-4 py-3 font-medium text-gray-600">Cliente</th>
                <th className="px-4 py-3 font-medium text-gray-600">Contacto</th>
                <th className="px-4 py-3 font-medium text-gray-600">RFC</th>
                <th className="px-4 py-3 font-medium text-gray-600">Descuento</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading && items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-gray-400" />
                    <p className="mt-2 text-sm text-gray-500">Cargando clientes...</p>
                  </td>
                </tr>
              ) : filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center">
                    <Users className="mx-auto h-8 w-8 text-gray-300" />
                    <p className="mt-2 text-sm text-gray-500">No se encontraron clientes</p>
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((customer) => (
                  <tr
                    key={customer.id}
                    className="border-b border-gray-100 hover:bg-gray-50"
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{customer.name}</p>
                      {customer.razonSocial && (
                        <p className="text-xs text-gray-400">{customer.razonSocial}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-0.5">
                        {customer.email && (
                          <div className="flex items-center gap-1.5 text-xs text-gray-500">
                            <Mail className="h-3 w-3" />
                            {customer.email}
                          </div>
                        )}
                        {customer.phone && (
                          <div className="flex items-center gap-1.5 text-xs text-gray-500">
                            <Phone className="h-3 w-3" />
                            {customer.phone}
                          </div>
                        )}
                        {!customer.email && !customer.phone && (
                          <span className="text-gray-400">-</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {customer.rfc || '-'}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {Number(customer.defaultDiscount || 0) > 0
                        ? `${customer.defaultDiscount}%`
                        : '-'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleEdit(customer)}
                          className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-primary-600"
                          title="Editar"
                          type="button"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setShowDeleteConfirm(customer.id)}
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
      {showModal && editingCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="relative mx-4 w-full max-w-2xl rounded-xl border border-gray-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <h3 className="text-lg font-semibold text-gray-900">
                {isEditing ? 'Editar cliente' : 'Nuevo cliente'}
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

            <div className="max-h-[70vh] overflow-y-auto p-6">
              {/* --- SECCION: Datos del Cliente --- */}
              <div className="mb-6">
                <div className={sectionTitleClass}>
                  <Users className="h-4 w-4" />
                  Datos del Cliente
                </div>

                <div className="space-y-4">
                  <div>
                    <label htmlFor="cust-name" className={labelClass}>
                      Nombre del Cliente *
                    </label>
                    <input
                      id="cust-name"
                      type="text"
                      value={editingCustomer.name || ''}
                      onChange={(e) => setField('name', e.target.value)}
                      className={inputClass}
                      placeholder="Nombre completo o nombre comercial"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="cust-email" className={labelClass}>Email</label>
                      <input
                        id="cust-email"
                        type="email"
                        value={editingCustomer.email || ''}
                        onChange={(e) => setField('email', e.target.value)}
                        className={inputClass}
                        placeholder="email@ejemplo.com"
                      />
                    </div>
                    <div>
                      <label htmlFor="cust-phone" className={labelClass}>Telefono</label>
                      <input
                        id="cust-phone"
                        type="tel"
                        value={editingCustomer.phone || ''}
                        onChange={(e) => setField('phone', e.target.value)}
                        className={inputClass}
                        placeholder="55 1234 5678"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="cust-cell" className={labelClass}>Celular</label>
                      <input
                        id="cust-cell"
                        type="tel"
                        value={editingCustomer.cellphone || ''}
                        onChange={(e) => setField('cellphone', e.target.value)}
                        className={inputClass}
                        placeholder="55 9876 5432"
                      />
                    </div>
                    <div>
                      <label htmlFor="cust-contact" className={labelClass}>Contacto</label>
                      <input
                        id="cust-contact"
                        type="text"
                        value={editingCustomer.contactName || ''}
                        onChange={(e) => setField('contactName', e.target.value)}
                        className={inputClass}
                        placeholder="Nombre del contacto"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="cust-pricing" className={labelClass}>Lista de Precios</label>
                      <select
                        id="cust-pricing"
                        value={editingCustomer.priceListId || ''}
                        onChange={(e) => setField('priceListId', e.target.value || null)}
                        className={inputClass}
                      >
                        <option value="">Sin lista (precio base)</option>
                        {priceLists.map((pl) => (
                          <option key={pl.id} value={pl.id}>{pl.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="cust-discount" className={labelClass}>Descuento (%)</label>
                      <input
                        id="cust-discount"
                        type="number"
                        min="0"
                        max="100"
                        step="0.5"
                        value={editingCustomer.defaultDiscount ?? 0}
                        onChange={(e) => setField('defaultDiscount', e.target.value)}
                        className={inputClass}
                        placeholder="0"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* --- SECCION: Datos Fiscales --- */}
              <div className="mb-6">
                <div className={sectionTitleClass}>
                  <FileText className="h-4 w-4" />
                  Datos Fiscales
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="cust-person-type" className={labelClass}>Tipo de Persona</label>
                      <select
                        id="cust-person-type"
                        value={editingCustomer.personType || 'fisica'}
                        onChange={(e) => setField('personType', e.target.value)}
                        className={inputClass}
                      >
                        <option value="fisica">Persona Fisica</option>
                        <option value="moral">Persona Moral</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="cust-rfc" className={labelClass}>RFC</label>
                      <input
                        id="cust-rfc"
                        type="text"
                        value={editingCustomer.rfc || ''}
                        onChange={(e) => setField('rfc', e.target.value.toUpperCase())}
                        className={`${inputClass} uppercase`}
                        placeholder={editingCustomer.personType === 'moral' ? 'ABC010101AAA' : 'XAXX010101000'}
                        maxLength={13}
                        pattern="^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$"
                        title="Formato RFC: 3-4 letras + 6 dígitos + 3 caracteres (ej: XAXX010101000)"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="cust-razon" className={labelClass}>Nombre o Razon Social</label>
                    <input
                      id="cust-razon"
                      type="text"
                      value={editingCustomer.razonSocial || ''}
                      onChange={(e) => setField('razonSocial', e.target.value)}
                      className={inputClass}
                      placeholder="Razon social tal como aparece en la constancia de situacion fiscal"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="cust-regimen" className={labelClass}>Regimen Fiscal</label>
                      <select
                        id="cust-regimen"
                        value={editingCustomer.regimenFiscal || ''}
                        onChange={(e) => setField('regimenFiscal', e.target.value)}
                        className={inputClass}
                      >
                        {REGIMENES_FISCALES.map((r) => (
                          <option key={r.value} value={r.value}>{r.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="cust-uso" className={labelClass}>Uso de CFDI</label>
                      <select
                        id="cust-uso"
                        value={editingCustomer.usoCfdi || 'G03'}
                        onChange={(e) => setField('usoCfdi', e.target.value)}
                        className={inputClass}
                      >
                        {USOS_CFDI.map((u) => (
                          <option key={u.value} value={u.value}>{u.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="cust-cp" className={labelClass}>Codigo Postal Fiscal</label>
                      <input
                        id="cust-cp"
                        type="text"
                        value={editingCustomer.codigoPostalFiscal || ''}
                        onChange={(e) => setField('codigoPostalFiscal', e.target.value.replace(/\D/g, ''))}
                        className={inputClass}
                        placeholder="06600"
                        maxLength={5}
                      />
                    </div>
                    <div>
                      <label htmlFor="cust-email-fact" className={labelClass}>Email para Facturas</label>
                      <input
                        id="cust-email-fact"
                        type="email"
                        value={editingCustomer.emailFacturas || ''}
                        onChange={(e) => setField('emailFacturas', e.target.value)}
                        className={inputClass}
                        placeholder="facturas@empresa.com"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* --- SECCION: Notas --- */}
              <div className="mb-6">
                <div className={sectionTitleClass}>
                  Notas Internas
                </div>
                <textarea
                  id="cust-notes"
                  value={editingCustomer.notes || ''}
                  onChange={(e) => setField('notes', e.target.value)}
                  rows={3}
                  className={inputClass}
                  placeholder="Notas internas sobre el cliente..."
                />
              </div>

              {/* --- SECCION: Perfil Crediticio (solo en edicion, con remissions habilitado) --- */}
              {isEditing && editingCustomer.id && (
                <ModuleGate module="remissions">
                  <CreditProfileSection customerId={editingCustomer.id} />
                </ModuleGate>
              )}
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
                {isEditing ? 'Guardar cambios' : 'Crear cliente'}
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
              Eliminar cliente
            </h3>
            <p className="mb-6 text-sm text-gray-500">
              Esta accion no se puede deshacer. El cliente sera eliminado
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
