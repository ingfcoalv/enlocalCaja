import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useSearchParams, useNavigate, Link } from 'react-router-dom'
import {
  Search, Loader2, FileText, Plus, Trash2, CheckCircle2, XCircle, Download,
  Stamp, ArrowLeft, ChevronLeft, ChevronRight, Receipt, CreditCard, Globe,
  FileX, Truck, Copy, AlertTriangle, ChevronDown, Eye,
} from 'lucide-react'
import { api, useToast } from '@enlocal/react-hooks'
import { useInvoiceStore, type CfdiInvoice } from '../stores/useInvoiceStore'
import { useSatCatalogStore } from '../stores/useSatCatalogStore'

// ── Styling constants ──────────────────────────────────
const inputClass = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20'
const selectClass = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none'
const labelClass = 'mb-1 block text-xs font-medium text-gray-600'
const sectionTitleClass = 'mb-3 text-sm font-semibold text-gray-700'
const btnPrimary = 'flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50'
const btnOutline = 'flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50'
const btnDanger = 'flex items-center gap-2 rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50'

// ── Helpers ─────────────────────────────────────────────
function formatCurrency(amount: number | string): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(num || 0)
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('es-MX', {
      year: 'numeric', month: 'short', day: 'numeric',
    })
  } catch { return dateStr }
}

function statusBadge(status: string) {
  const styles: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-700',
    stamped: 'bg-green-100 text-green-700',
    cancelled: 'bg-red-100 text-red-700',
    cancel_pending: 'bg-yellow-100 text-yellow-700',
    error: 'bg-red-100 text-red-600',
  }
  const labels: Record<string, string> = {
    draft: 'Borrador',
    stamped: 'Timbrada',
    cancelled: 'Cancelada',
    cancel_pending: 'Pend. cancelacion',
    error: 'Error',
  }
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[status] || 'bg-gray-100 text-gray-700'}`}>
      {labels[status] || status}
    </span>
  )
}

function typeBadge(type: string) {
  const config: Record<string, { label: string; color: string }> = {
    I: { label: 'Ingreso', color: 'bg-blue-50 text-blue-700' },
    E: { label: 'Egreso', color: 'bg-orange-50 text-orange-700' },
    P: { label: 'Pago', color: 'bg-purple-50 text-purple-700' },
    T: { label: 'Traslado', color: 'bg-teal-50 text-teal-700' },
  }
  const c = config[type] || { label: type, color: 'bg-gray-50 text-gray-700' }
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${c.color}`}>{c.label}</span>
}

function numberToLetters(n: number): string {
  const units = ['', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE']
  const teens = ['DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISEIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE']
  const tens = ['', '', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA']
  const hundreds = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS']

  if (n === 0) return 'CERO'
  if (n === 100) return 'CIEN'

  const convertGroup = (num: number): string => {
    if (num === 0) return ''
    if (num < 10) return units[num]
    if (num < 20) return teens[num - 10]
    if (num < 30) return num === 20 ? 'VEINTE' : 'VEINTI' + units[num - 20]
    if (num < 100) {
      const t = Math.floor(num / 10)
      const u = num % 10
      return u === 0 ? tens[t] : tens[t] + ' Y ' + units[u]
    }
    if (num === 100) return 'CIEN'
    if (num < 1000) {
      const h = Math.floor(num / 100)
      const rest = num % 100
      return hundreds[h] + (rest > 0 ? ' ' + convertGroup(rest) : '')
    }
    return ''
  }

  const intPart = Math.floor(n)
  const decPart = Math.round((n - intPart) * 100)

  let result = ''
  if (intPart >= 1000000) {
    const millions = Math.floor(intPart / 1000000)
    result += (millions === 1 ? 'UN MILLON' : convertGroup(millions) + ' MILLONES')
    const rest = intPart % 1000000
    if (rest > 0) result += ' '
    else return result + ' ' + String(decPart).padStart(2, '0') + '/100 M.N.'
  }
  const afterMillions = intPart % 1000000
  if (afterMillions >= 1000) {
    const thousands = Math.floor(afterMillions / 1000)
    result += (thousands === 1 ? 'MIL' : convertGroup(thousands) + ' MIL')
    const rest = afterMillions % 1000
    if (rest > 0) result += ' ' + convertGroup(rest)
  } else if (afterMillions > 0) {
    result += convertGroup(afterMillions)
  }

  return result + ' ' + String(decPart).padStart(2, '0') + '/100 M.N.'
}

interface CustomerOption {
  id: string
  name: string
  rfc?: string
  razonSocial?: string
  regimenFiscal?: string
  usoCfdi?: string
  codigoPostal?: string
}

// ── Main Component ──────────────────────────────────────

export default function InvoicingPage() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const mode = searchParams.get('mode')

  if (mode === 'new') return <InvoiceForm />
  if (id && mode === 'edit') return <InvoiceForm id={id} />
  if (id) return <InvoiceDetail id={id} />
  return <InvoiceList />
}

// ══════════════════════════════════════════════════════════
// InvoiceList — Enhanced list with summary cards
// ══════════════════════════════════════════════════════════

function InvoiceList() {
  const toast = useToast()
  const navigate = useNavigate()
  const { invoices, loading, pagination, fetchInvoices } = useInvoiceStore()
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [page, setPage] = useState(1)

  const doFetch = useCallback(() => {
    const filters: any = { page: String(page), limit: '25' }
    if (searchQuery) filters.q = searchQuery
    if (statusFilter) filters.status = statusFilter
    if (typeFilter) filters.type = typeFilter
    fetchInvoices(filters)
  }, [searchQuery, statusFilter, typeFilter, page, fetchInvoices])

  useEffect(() => { doFetch() }, [doFetch])

  // Summary calculations
  const stampedInvoices = invoices.filter((i) => i.status === 'stamped')
  const draftCount = invoices.filter((i) => i.status === 'draft').length
  const cancelPendingCount = invoices.filter((i) => i.status === 'cancel_pending').length
  const stampedTotal = stampedInvoices.reduce((sum, i) => sum + parseFloat(i.total || '0'), 0)

  const totalPages = pagination.pages || 1

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Facturacion</h1>
        <p className="mt-1 text-sm text-gray-500">CFDI 4.0 — Emision y gestion de facturas</p>
      </div>

      {/* Summary cards */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-green-200 bg-green-50 p-4">
          <p className="text-xs font-medium text-green-600">Timbradas</p>
          <p className="text-2xl font-bold text-green-700">{stampedInvoices.length}</p>
          <p className="text-xs text-green-600">{formatCurrency(stampedTotal)}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs font-medium text-gray-500">Borradores</p>
          <p className="text-2xl font-bold text-gray-700">{draftCount}</p>
        </div>
        <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4">
          <p className="text-xs font-medium text-yellow-600">Pend. cancelacion</p>
          <p className="text-2xl font-bold text-yellow-700">{cancelPendingCount}</p>
        </div>
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
          <p className="text-xs font-medium text-blue-600">Total en pagina</p>
          <p className="text-2xl font-bold text-blue-700">{invoices.length}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por serie, folio, cliente o RFC..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setPage(1) }}
            className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-4 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
          className={selectClass}
        >
          <option value="">Todos los estados</option>
          <option value="draft">Borrador</option>
          <option value="stamped">Timbrada</option>
          <option value="cancelled">Cancelada</option>
          <option value="cancel_pending">Pend. cancelacion</option>
          <option value="error">Error</option>
        </select>
        <select
          value={typeFilter}
          onChange={(e) => { setTypeFilter(e.target.value); setPage(1) }}
          className={selectClass}
        >
          <option value="">Todos los tipos</option>
          <option value="I">Ingreso</option>
          <option value="E">Egreso</option>
          <option value="P">Pago</option>
          <option value="T">Traslado</option>
        </select>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="px-4 py-3 font-medium text-gray-600">Folio</th>
              <th className="px-4 py-3 font-medium text-gray-600">Tipo</th>
              <th className="px-4 py-3 font-medium text-gray-600">Receptor / RFC</th>
              <th className="px-4 py-3 text-right font-medium text-gray-600">Total</th>
              <th className="px-4 py-3 font-medium text-gray-600">Estado</th>
              <th className="px-4 py-3 font-medium text-gray-600">Fecha</th>
              <th className="px-4 py-3 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin text-gray-400" />
                </td>
              </tr>
            ) : invoices.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center">
                  <FileText className="mx-auto h-8 w-8 text-gray-300" />
                  <p className="mt-2 text-sm text-gray-500">No hay facturas</p>
                </td>
              </tr>
            ) : (
              invoices.map((inv) => (
                <tr
                  key={inv.id}
                  className="border-b border-gray-100 cursor-pointer hover:bg-gray-50"
                  onClick={() => navigate(`/invoicing/${inv.id}`)}
                >
                  <td className="px-4 py-3 font-mono text-xs text-gray-700">
                    {inv.series || ''}{inv.folio || inv.id.slice(0, 8)}
                  </td>
                  <td className="px-4 py-3">{typeBadge(inv.type)}</td>
                  <td className="px-4 py-3">
                    <div className="text-gray-700">{inv.customerName || inv.customerRazonSocial || 'Sin cliente'}</div>
                    {inv.customerRfc && <div className="text-xs text-gray-400">{inv.customerRfc}</div>}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatCurrency(inv.total)}</td>
                  <td className="px-4 py-3">{statusBadge(inv.status)}</td>
                  <td className="px-4 py-3 text-gray-500">{formatDate(inv.createdAt)}</td>
                  <td className="px-4 py-3">
                    {inv.status === 'stamped' && (
                      <button
                        onClick={(e) => { e.stopPropagation(); window.open(`/api/invoices/${inv.id}/pdf`, '_blank') }}
                        className="text-gray-400 hover:text-gray-600"
                        title="Descargar PDF"
                        type="button"
                      >
                        <Download className="h-4 w-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <span className="text-sm text-gray-500">Pagina {page} de {totalPages}</span>
          <div className="flex gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="rounded-lg border border-gray-300 p-2 text-sm disabled:opacity-50" type="button">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="rounded-lg border border-gray-300 p-2 text-sm disabled:opacity-50" type="button">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Quick action buttons */}
      <div className="mt-6 flex flex-wrap gap-3">
        <button onClick={() => navigate('/invoicing/new?mode=new')} className={btnPrimary} type="button">
          <Plus className="h-4 w-4" /> Nueva factura
        </button>
        <Link to="/invoicing/from-ticket" className={btnOutline}>
          <Receipt className="h-4 w-4" /> Facturar ticket
        </Link>
        <Link to="/invoicing/global" className={btnOutline}>
          <Globe className="h-4 w-4" /> Factura global
        </Link>
        <Link to="/invoicing/payment-complement" className={btnOutline}>
          <CreditCard className="h-4 w-4" /> Complemento pago
        </Link>
        <Link to="/invoicing/credit-note" className={btnOutline}>
          <FileX className="h-4 w-4" /> Nota de credito
        </Link>
        <Link to="/invoicing/carta-porte" className={btnOutline}>
          <Truck className="h-4 w-4" /> Carta porte
        </Link>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════
// InvoiceForm — Create / Edit invoice
// ══════════════════════════════════════════════════════════

interface DraftItem {
  id: string
  description: string
  quantity: string
  unitPrice: string
  discount: string
  satCode: string
  satUnit: string
  taxRate: string
  retentionType: string
}

function InvoiceForm({ id }: { id?: string }) {
  const toast = useToast()
  const navigate = useNavigate()
  const { create, update, fetchById, stamp } = useInvoiceStore()
  const { paymentForms, cfdiUses, unitCodes, fetchAll, searchProductCodes, productCodes } = useSatCatalogStore()

  const [invoiceType, setInvoiceType] = useState<'I' | 'E'>('I')
  const [series, setSeries] = useState('FA')
  const [customers, setCustomers] = useState<CustomerOption[]>([])
  const [customerSearch, setCustomerSearch] = useState('')
  const [customerId, setCustomerId] = useState('')
  const [customerRfc, setCustomerRfc] = useState('')
  const [customerRegimen, setCustomerRegimen] = useState('')
  const [useCfdi, setUseCfdi] = useState('G03')
  const [customerCp, setCustomerCp] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('PUE')
  const [paymentForm, setPaymentForm] = useState('01')
  const [currency, setCurrency] = useState('MXN')
  const [exchangeRate, setExchangeRate] = useState('1')
  const [items, setItems] = useState<DraftItem[]>([
    { id: '1', description: '', quantity: '1', unitPrice: '', discount: '0', satCode: '01010101', satUnit: 'H87', taxRate: '0.16', retentionType: 'none' },
  ])
  const [relationType, setRelationType] = useState('')
  const [relatedUuids, setRelatedUuids] = useState('')
  const [saving, setSaving] = useState(false)
  const [loadingForm, setLoadingForm] = useState(false)
  const [showStampModal, setShowStampModal] = useState(false)
  const [pendingInvoiceId, setPendingInvoiceId] = useState<string | null>(null)
  const [satCodeSearch, setSatCodeSearch] = useState<Record<string, string>>({})
  const [activeSatDropdown, setActiveSatDropdown] = useState<string | null>(null)

  // Load SAT catalogs
  useEffect(() => { fetchAll() }, [fetchAll])

  // Load existing invoice for edit
  useEffect(() => {
    if (!id) return
    setLoadingForm(true)
    fetchById(id).then((inv) => {
      setInvoiceType((inv.type as 'I' | 'E') || 'I')
      setSeries(inv.series || 'FA')
      setCustomerId(inv.customerId || '')
      setCustomerSearch(inv.customerRazonSocial || inv.customerName || '')
      setCustomerRfc(inv.customerRfc || '')
      setUseCfdi(inv.useCfdi || 'G03')
      setPaymentMethod(inv.paymentMethod || 'PUE')
      setPaymentForm(inv.paymentForm || '01')
      setCurrency(inv.currency || 'MXN')
      setExchangeRate(inv.exchangeRate || '1')
      if (inv.items?.length) {
        setItems(inv.items.map((item: any) => ({
          id: item.id || `${Date.now()}-${Math.random()}`,
          description: item.description || '',
          quantity: String(item.quantity || '1'),
          unitPrice: String(item.unitPrice || ''),
          discount: String(item.discount || '0'),
          satCode: item.satCode || '01010101',
          satUnit: item.satUnit || 'H87',
          taxRate: String(item.taxRate || '0.16'),
          retentionType: item.retentionRate ? (parseFloat(item.retentionRate) > 0.06 ? 'iva_isr' : 'iva_ret') : 'none',
        })))
      }
      setLoadingForm(false)
    }).catch(() => {
      toast.error('Error al cargar factura')
      setLoadingForm(false)
    })
  }, [id, fetchById, toast])

  // Customer search debounce
  useEffect(() => {
    if (customerSearch.length < 2) { setCustomers([]); return }
    const timer = setTimeout(async () => {
      try {
        const { data } = await api.get('/api/customers', { params: { q: customerSearch, limit: 10 } })
        setCustomers((data?.data || []).map((c: any) => ({
          id: c.id, name: c.name, rfc: c.rfc, razonSocial: c.razonSocial,
          regimenFiscal: c.regimenFiscal, usoCfdi: c.usoCfdi, codigoPostal: c.codigoPostal,
        })))
      } catch { /* ignore */ }
    }, 300)
    return () => clearTimeout(timer)
  }, [customerSearch])

  // PPD auto-sets forma 99
  useEffect(() => {
    if (paymentMethod === 'PPD') setPaymentForm('99')
  }, [paymentMethod])

  // SAT product code search debounce
  const satSearchTimerRef = useRef<ReturnType<typeof setTimeout>>()
  const handleSatCodeSearch = (itemId: string, q: string) => {
    setSatCodeSearch((prev) => ({ ...prev, [itemId]: q }))
    setActiveSatDropdown(itemId)
    if (satSearchTimerRef.current) clearTimeout(satSearchTimerRef.current)
    if (q.length < 2) return
    satSearchTimerRef.current = setTimeout(() => {
      searchProductCodes(q)
    }, 300)
  }

  const selectCustomer = (c: CustomerOption) => {
    setCustomerId(c.id)
    setCustomerSearch(c.razonSocial || c.name)
    setCustomerRfc(c.rfc || '')
    setCustomerRegimen(c.regimenFiscal || '')
    if (c.usoCfdi) setUseCfdi(c.usoCfdi)
    if (c.codigoPostal) setCustomerCp(c.codigoPostal)
    setCustomers([])
  }

  const addItem = () => {
    setItems([...items, {
      id: `${Date.now()}`,
      description: '', quantity: '1', unitPrice: '', discount: '0',
      satCode: '01010101', satUnit: 'H87', taxRate: '0.16', retentionType: 'none',
    }])
  }

  const removeItem = (itemId: string) => {
    if (items.length <= 1) return
    setItems(items.filter((i) => i.id !== itemId))
  }

  const updateItem = (itemId: string, field: keyof DraftItem, value: string) => {
    setItems(items.map((i) => (i.id === itemId ? { ...i, [field]: value } : i)))
  }

  // Calculations
  const calcItemAmount = (item: DraftItem) => {
    const qty = parseFloat(item.quantity) || 0
    const price = parseFloat(item.unitPrice) || 0
    const disc = parseFloat(item.discount) || 0
    return qty * price - disc
  }

  const calcItemTax = (item: DraftItem) => {
    const amount = calcItemAmount(item)
    const rate = parseFloat(item.taxRate) || 0
    return amount * rate
  }

  const calcItemRetention = (item: DraftItem) => {
    const amount = calcItemAmount(item)
    if (item.retentionType === 'iva_ret') return amount * (2 / 3) * 0.16
    if (item.retentionType === 'isr') return amount * 0.10
    if (item.retentionType === 'iva_isr') return amount * (2 / 3) * 0.16 + amount * 0.10
    return 0
  }

  const subtotal = items.reduce((sum, item) => sum + calcItemAmount(item), 0)
  const totalDiscount = items.reduce((sum, item) => sum + (parseFloat(item.discount) || 0), 0)
  const iva16 = items.filter((i) => i.taxRate === '0.16').reduce((sum, i) => sum + calcItemTax(i), 0)
  const iva8 = items.filter((i) => i.taxRate === '0.08').reduce((sum, i) => sum + calcItemTax(i), 0)
  const totalTax = iva16 + iva8
  const totalRetentions = items.reduce((sum, i) => sum + calcItemRetention(i), 0)
  const total = subtotal + totalTax - totalRetentions

  const canSave = customerId && items.every((i) => i.description && parseFloat(i.unitPrice) > 0)

  const buildPayload = () => ({
    customerId,
    series,
    useCfdi,
    paymentMethod,
    paymentForm,
    currency,
    exchangeRate: currency !== 'MXN' ? exchangeRate : undefined,
    type: invoiceType,
    items: items.map((i) => ({
      description: i.description,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      discount: i.discount || '0',
      satCode: i.satCode,
      satUnit: i.satUnit,
      taxRate: i.taxRate,
    })),
    ...(relationType && relatedUuids ? {
      relations: relatedUuids.split(',').map((uuid) => ({ relationType, relatedUuid: uuid.trim() })),
    } : {}),
  })

  const handleSaveDraft = async () => {
    if (!canSave) return
    setSaving(true)
    try {
      const payload = buildPayload()
      if (id) {
        await update(id, payload)
        toast.success('Factura actualizada')
      } else {
        const created = await create(payload)
        toast.success('Borrador creado')
        navigate(`/invoicing/${created.id}`)
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveAndStamp = async () => {
    if (!canSave) return
    setSaving(true)
    try {
      const payload = buildPayload()
      let invoiceId = id
      if (id) {
        await update(id, payload)
      } else {
        const created = await create(payload)
        invoiceId = created.id
      }
      setPendingInvoiceId(invoiceId!)
      setShowStampModal(true)
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const confirmStamp = async () => {
    if (!pendingInvoiceId) return
    setSaving(true)
    setShowStampModal(false)
    try {
      await stamp(pendingInvoiceId)
      toast.success('Factura timbrada exitosamente')
      navigate(`/invoicing/${pendingInvoiceId}`)
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Error al timbrar')
    } finally {
      setSaving(false)
    }
  }

  if (loadingForm) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div>
      <button onClick={() => navigate('/invoicing')} className="mb-4 flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900" type="button">
        <ArrowLeft className="h-4 w-4" /> Volver a facturas
      </button>

      <h1 className="mb-6 text-xl font-bold text-gray-900">{id ? 'Editar factura' : 'Nueva factura'}</h1>

      <div className="space-y-6">
        {/* Type selector */}
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <h3 className={sectionTitleClass}>Tipo de comprobante</h3>
          <div className="flex gap-3">
            {[{ value: 'I', label: 'Ingreso (Factura)' }, { value: 'E', label: 'Egreso (Nota de credito)' }].map((opt) => (
              <button
                key={opt.value}
                onClick={() => { setInvoiceType(opt.value as 'I' | 'E'); setSeries(opt.value === 'I' ? 'FA' : 'NC') }}
                className={`flex-1 rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${invoiceType === opt.value ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                type="button"
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Customer selection */}
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <h3 className={sectionTitleClass}>Receptor</h3>
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar cliente por nombre o RFC..."
              value={customerSearch}
              onChange={(e) => { setCustomerSearch(e.target.value); setCustomerId('') }}
              className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-4 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            />
            {customers.length > 0 && !customerId && (
              <div className="absolute z-20 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg max-h-60 overflow-auto">
                {customers.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => selectCustomer(c)}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50"
                    type="button"
                  >
                    <span className="font-medium text-gray-900">{c.razonSocial || c.name}</span>
                    {c.rfc && <span className="ml-2 text-xs text-gray-500">{c.rfc}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
          {customerId && (
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span className="text-sm text-green-700">Cliente seleccionado</span>
              {customerRfc && <span className="text-xs text-gray-500">RFC: {customerRfc}</span>}
            </div>
          )}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <label className={labelClass}>RFC</label>
              <input type="text" value={customerRfc} onChange={(e) => setCustomerRfc(e.target.value)} className={inputClass} placeholder="RFC" />
            </div>
            <div>
              <label className={labelClass}>Regimen fiscal</label>
              <input type="text" value={customerRegimen} onChange={(e) => setCustomerRegimen(e.target.value)} className={inputClass} placeholder="Ej: 601" />
            </div>
            <div>
              <label className={labelClass}>Uso CFDI</label>
              <select value={useCfdi} onChange={(e) => setUseCfdi(e.target.value)} className={selectClass}>
                {cfdiUses.length > 0 ? cfdiUses.map((u) => (
                  <option key={u.code} value={u.code}>{u.code} - {u.description}</option>
                )) : (
                  <>
                    <option value="G01">G01 - Adquisicion de mercancias</option>
                    <option value="G03">G03 - Gastos en general</option>
                    <option value="S01">S01 - Sin efectos fiscales</option>
                  </>
                )}
              </select>
            </div>
            <div>
              <label className={labelClass}>Codigo postal</label>
              <input type="text" value={customerCp} onChange={(e) => setCustomerCp(e.target.value)} className={inputClass} placeholder="CP" />
            </div>
          </div>
        </div>

        {/* Payment & fiscal data */}
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <h3 className={sectionTitleClass}>Datos fiscales</h3>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
            <div>
              <label className={labelClass}>Serie</label>
              <input type="text" value={series} onChange={(e) => setSeries(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Metodo de pago</label>
              <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className={selectClass}>
                <option value="PUE">PUE - Una sola exhibicion</option>
                <option value="PPD">PPD - Parcialidades o diferido</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Forma de pago</label>
              <select value={paymentForm} onChange={(e) => setPaymentForm(e.target.value)} className={selectClass} disabled={paymentMethod === 'PPD'}>
                {paymentForms.length > 0 ? paymentForms.map((f) => (
                  <option key={f.code} value={f.code}>{f.code} - {f.description}</option>
                )) : (
                  <>
                    <option value="01">01 - Efectivo</option>
                    <option value="02">02 - Cheque nominativo</option>
                    <option value="03">03 - Transferencia</option>
                    <option value="04">04 - Tarjeta de credito</option>
                    <option value="28">28 - Tarjeta de debito</option>
                    <option value="99">99 - Por definir</option>
                  </>
                )}
              </select>
            </div>
            <div>
              <label className={labelClass}>Moneda</label>
              <select value={currency} onChange={(e) => setCurrency(e.target.value)} className={selectClass}>
                <option value="MXN">MXN</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
              </select>
            </div>
            {currency !== 'MXN' && (
              <div>
                <label className={labelClass}>Tipo de cambio</label>
                <input type="number" step="0.0001" value={exchangeRate} onChange={(e) => setExchangeRate(e.target.value)} className={inputClass} />
              </div>
            )}
          </div>
        </div>

        {/* Items */}
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className={sectionTitleClass}>Conceptos</h3>
            <button onClick={addItem} className={btnOutline} type="button">
              <Plus className="h-3 w-3" /> Agregar
            </button>
          </div>
          <div className="space-y-3">
            {items.map((item) => (
              <div key={item.id} className="rounded-lg border border-gray-200 p-3">
                <div className="mb-2 flex gap-2">
                  <input
                    type="text"
                    value={item.description}
                    onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                    placeholder="Descripcion del concepto"
                    className="flex-1 rounded border border-gray-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
                  />
                  {items.length > 1 && (
                    <button onClick={() => removeItem(item.id)} className="text-red-400 hover:text-red-600" type="button">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-7">
                  <div>
                    <label className="mb-1 block text-xs text-gray-500">Cantidad</label>
                    <input type="number" step="0.01" min="0" value={item.quantity} onChange={(e) => updateItem(item.id, 'quantity', e.target.value)} className="w-full rounded border border-gray-200 px-2 py-1.5 text-right text-sm focus:border-primary-500 focus:outline-none" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-gray-500">Precio unitario</label>
                    <input type="number" step="0.01" min="0" value={item.unitPrice} onChange={(e) => updateItem(item.id, 'unitPrice', e.target.value)} className="w-full rounded border border-gray-200 px-2 py-1.5 text-right text-sm focus:border-primary-500 focus:outline-none" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-gray-500">Descuento</label>
                    <input type="number" step="0.01" min="0" value={item.discount} onChange={(e) => updateItem(item.id, 'discount', e.target.value)} className="w-full rounded border border-gray-200 px-2 py-1.5 text-right text-sm focus:border-primary-500 focus:outline-none" />
                  </div>
                  <div className="relative">
                    <label className="mb-1 block text-xs text-gray-500">Clave SAT</label>
                    <input
                      type="text"
                      value={satCodeSearch[item.id] !== undefined ? satCodeSearch[item.id] : item.satCode}
                      onChange={(e) => { handleSatCodeSearch(item.id, e.target.value); updateItem(item.id, 'satCode', e.target.value) }}
                      onFocus={() => setActiveSatDropdown(item.id)}
                      onBlur={() => setTimeout(() => setActiveSatDropdown(null), 200)}
                      className="w-full rounded border border-gray-200 px-2 py-1.5 text-sm focus:border-primary-500 focus:outline-none"
                    />
                    {activeSatDropdown === item.id && productCodes.length > 0 && (
                      <div className="absolute z-20 mt-1 w-64 max-h-40 overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                        {productCodes.map((pc) => (
                          <button
                            key={pc.code}
                            onMouseDown={() => { updateItem(item.id, 'satCode', pc.code); setSatCodeSearch((prev) => ({ ...prev, [item.id]: pc.code })); setActiveSatDropdown(null) }}
                            className="w-full px-3 py-1.5 text-left text-xs hover:bg-gray-50"
                            type="button"
                          >
                            <span className="font-mono font-medium">{pc.code}</span> — {pc.description.slice(0, 40)}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-gray-500">Unidad SAT</label>
                    <select value={item.satUnit} onChange={(e) => updateItem(item.id, 'satUnit', e.target.value)} className="w-full rounded border border-gray-200 px-2 py-1.5 text-sm focus:border-primary-500 focus:outline-none">
                      {unitCodes.length > 0 ? unitCodes.map((u) => (
                        <option key={u.code} value={u.code}>{u.code} - {u.description.slice(0, 20)}</option>
                      )) : (
                        <>
                          <option value="H87">H87 - Pieza</option>
                          <option value="E48">E48 - Servicio</option>
                          <option value="KGM">KGM - Kilogramo</option>
                          <option value="LTR">LTR - Litro</option>
                          <option value="XBX">XBX - Caja</option>
                        </>
                      )}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-gray-500">IVA</label>
                    <select value={item.taxRate} onChange={(e) => updateItem(item.id, 'taxRate', e.target.value)} className="w-full rounded border border-gray-200 px-2 py-1.5 text-sm focus:border-primary-500 focus:outline-none">
                      <option value="0.16">16%</option>
                      <option value="0.08">8%</option>
                      <option value="0">0%</option>
                      <option value="exempt">Exento</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-gray-500">Retencion</label>
                    <select value={item.retentionType} onChange={(e) => updateItem(item.id, 'retentionType', e.target.value)} className="w-full rounded border border-gray-200 px-2 py-1.5 text-sm focus:border-primary-500 focus:outline-none">
                      <option value="none">Ninguna</option>
                      <option value="iva_ret">IVA ret 2/3</option>
                      <option value="isr">ISR 10%</option>
                      <option value="iva_isr">Ambas</option>
                    </select>
                  </div>
                </div>
                <div className="mt-2 text-right text-xs text-gray-500">
                  Importe: {formatCurrency(calcItemAmount(item))} | IVA: {formatCurrency(calcItemTax(item))}
                  {calcItemRetention(item) > 0 && <> | Ret: {formatCurrency(calcItemRetention(item))}</>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CFDI Relations (optional) */}
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <h3 className={sectionTitleClass}>Relaciones CFDI (opcional)</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Tipo de relacion</label>
              <select value={relationType} onChange={(e) => setRelationType(e.target.value)} className={selectClass}>
                <option value="">Sin relacion</option>
                <option value="01">01 - Nota de credito</option>
                <option value="02">02 - Nota de debito</option>
                <option value="03">03 - Devolucion de mercancia</option>
                <option value="04">04 - Sustitucion de CFDI</option>
                <option value="07">07 - CFDI por aplicacion de anticipo</option>
              </select>
            </div>
            {relationType && (
              <div>
                <label className={labelClass}>UUID(s) relacionados</label>
                <input type="text" value={relatedUuids} onChange={(e) => setRelatedUuids(e.target.value)} placeholder="UUID separados por coma" className={inputClass} />
              </div>
            )}
          </div>
        </div>

        {/* Totals */}
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-1 text-sm">
              <div className="flex justify-between gap-8"><span className="text-gray-500">Subtotal:</span><span className="font-medium text-gray-700">{formatCurrency(subtotal)}</span></div>
              {totalDiscount > 0 && <div className="flex justify-between gap-8"><span className="text-gray-500">Descuento:</span><span className="font-medium text-red-600">-{formatCurrency(totalDiscount)}</span></div>}
              {iva16 > 0 && <div className="flex justify-between gap-8"><span className="text-gray-500">IVA 16%:</span><span className="font-medium text-gray-700">{formatCurrency(iva16)}</span></div>}
              {iva8 > 0 && <div className="flex justify-between gap-8"><span className="text-gray-500">IVA 8%:</span><span className="font-medium text-gray-700">{formatCurrency(iva8)}</span></div>}
              {totalRetentions > 0 && <div className="flex justify-between gap-8"><span className="text-gray-500">Retenciones:</span><span className="font-medium text-red-600">-{formatCurrency(totalRetentions)}</span></div>}
              <div className="flex justify-between gap-8 border-t border-gray-200 pt-1 text-lg font-bold">
                <span className="text-gray-900">Total:</span>
                <span className="text-primary-600">{formatCurrency(total)}</span>
              </div>
              <p className="text-xs text-gray-400 italic">{numberToLetters(total)}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => navigate('/invoicing')} className={btnOutline} type="button">Cancelar</button>
              <button onClick={handleSaveDraft} disabled={!canSave || saving} className={btnOutline} type="button">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                Guardar borrador
              </button>
              <button onClick={handleSaveAndStamp} disabled={!canSave || saving} className={btnPrimary} type="button">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Stamp className="h-4 w-4" />}
                Guardar y timbrar
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Stamp confirm modal */}
      {showStampModal && (
        <StampConfirmModal
          invoiceType={invoiceType}
          customerName={customerSearch}
          customerRfc={customerRfc}
          total={total}
          paymentMethod={paymentMethod}
          onConfirm={confirmStamp}
          onCancel={() => setShowStampModal(false)}
          loading={saving}
        />
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════
// InvoiceDetail — View stamped/draft invoice detail
// ══════════════════════════════════════════════════════════

function InvoiceDetail({ id }: { id: string }) {
  const toast = useToast()
  const navigate = useNavigate()
  const { currentInvoice, loading, fetchById, stamp, deleteInvoice, downloadXml, downloadPdf } = useInvoiceStore()
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [stamping, setStamping] = useState(false)
  const [showSellos, setShowSellos] = useState(false)

  useEffect(() => {
    fetchById(id).catch(() => toast.error('Error al cargar factura'))
  }, [id, fetchById, toast])

  const handleStamp = async () => {
    setStamping(true)
    try {
      await stamp(id)
      toast.success('Factura timbrada exitosamente')
      fetchById(id)
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Error al timbrar')
    } finally {
      setStamping(false)
    }
  }

  const handleDelete = async () => {
    try {
      await deleteInvoice(id)
      toast.success('Borrador eliminado')
      navigate('/invoicing')
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Error al eliminar')
    }
  }

  const handleCancelDone = () => {
    setShowCancelModal(false)
    fetchById(id)
  }

  if (loading || !currentInvoice) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    )
  }

  const inv = currentInvoice

  return (
    <div>
      <button onClick={() => navigate('/invoicing')} className="mb-4 flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900" type="button">
        <ArrowLeft className="h-4 w-4" /> Volver a facturas
      </button>

      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">
            {inv.series || 'FA'}{inv.folio || ''} {typeBadge(inv.type)}
          </h2>
          <p className="text-sm text-gray-500">
            {inv.customerRazonSocial || inv.customerName || 'Sin cliente'}
            {inv.customerRfc && ` (${inv.customerRfc})`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {statusBadge(inv.status)}
        </div>
      </div>

      {/* UUID card */}
      {inv.uuidFiscal && (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-3">
          <p className="text-xs text-green-600">UUID Fiscal</p>
          <div className="flex items-center gap-2">
            <p className="font-mono text-sm text-green-800">{inv.uuidFiscal}</p>
            <button
              onClick={() => { navigator.clipboard.writeText(inv.uuidFiscal!); toast.success('UUID copiado') }}
              className="text-green-600 hover:text-green-800"
              type="button"
              title="Copiar UUID"
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
          </div>
          {inv.stampedAt && <p className="text-xs text-green-500 mt-1">Timbrada: {formatDate(inv.stampedAt)}</p>}
        </div>
      )}

      {/* Error message */}
      {inv.status === 'error' && inv.errorMessage && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <p className="text-sm font-medium text-red-700">Error de timbrado</p>
          </div>
          <p className="mt-1 text-xs text-red-600">{inv.errorMessage}</p>
        </div>
      )}

      {/* Info cards */}
      <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-5">
        <div className="rounded-lg border border-gray-200 bg-white p-3">
          <p className="text-xs text-gray-500">Total</p>
          <p className="text-lg font-bold text-gray-900">{formatCurrency(inv.total)}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-3">
          <p className="text-xs text-gray-500">Metodo de pago</p>
          <p className="text-sm font-medium text-gray-700">{inv.paymentMethod || '-'}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-3">
          <p className="text-xs text-gray-500">Forma de pago</p>
          <p className="text-sm font-medium text-gray-700">{inv.paymentForm || '-'}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-3">
          <p className="text-xs text-gray-500">Uso CFDI</p>
          <p className="text-sm font-medium text-gray-700">{inv.useCfdi || '-'}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-3">
          <p className="text-xs text-gray-500">Moneda</p>
          <p className="text-sm font-medium text-gray-700">{inv.currency || 'MXN'}{inv.exchangeRate && inv.currency !== 'MXN' ? ` (TC: ${inv.exchangeRate})` : ''}</p>
        </div>
      </div>

      {/* Items table */}
      <h3 className="mb-2 text-sm font-semibold text-gray-700">Conceptos</h3>
      <div className="mb-4 overflow-hidden rounded-lg border border-gray-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="px-3 py-2 font-medium text-gray-600">Descripcion</th>
              <th className="px-3 py-2 font-medium text-gray-600">Clave SAT</th>
              <th className="px-3 py-2 text-right font-medium text-gray-600">Cant.</th>
              <th className="px-3 py-2 text-right font-medium text-gray-600">P.U.</th>
              <th className="px-3 py-2 text-right font-medium text-gray-600">Desc.</th>
              <th className="px-3 py-2 text-right font-medium text-gray-600">IVA</th>
              <th className="px-3 py-2 text-right font-medium text-gray-600">Importe</th>
            </tr>
          </thead>
          <tbody>
            {(inv.items || []).map((item: any, i: number) => (
              <tr key={item.id || i} className="border-b border-gray-100">
                <td className="px-3 py-2 text-gray-700">{item.description}</td>
                <td className="px-3 py-2 font-mono text-xs text-gray-500">{item.satCode || '-'}</td>
                <td className="px-3 py-2 text-right text-gray-600">{parseFloat(item.quantity)}</td>
                <td className="px-3 py-2 text-right text-gray-600">{formatCurrency(item.unitPrice)}</td>
                <td className="px-3 py-2 text-right text-gray-500">{parseFloat(item.discount || '0') > 0 ? formatCurrency(item.discount) : '-'}</td>
                <td className="px-3 py-2 text-right text-gray-500">{formatCurrency(item.taxAmount || 0)}</td>
                <td className="px-3 py-2 text-right font-medium text-gray-900">{formatCurrency(item.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Totals breakdown */}
      <div className="mb-4 rounded-lg border border-gray-200 bg-white p-4">
        <div className="space-y-1 text-sm">
          <div className="flex justify-between"><span className="text-gray-500">Subtotal:</span><span className="font-medium">{formatCurrency(inv.subtotal)}</span></div>
          <div className="flex justify-between"><span className="text-gray-500">IVA:</span><span className="font-medium">{formatCurrency(inv.tax)}</span></div>
          <div className="flex justify-between border-t border-gray-200 pt-1 text-lg font-bold">
            <span>Total:</span><span className="text-primary-600">{formatCurrency(inv.total)}</span>
          </div>
          <p className="text-xs text-gray-400 italic">{numberToLetters(parseFloat(inv.total || '0'))}</p>
        </div>
      </div>

      {/* CFDI Relations */}
      {inv.relations && inv.relations.length > 0 && (
        <div className="mb-4 rounded-lg border border-gray-200 bg-white p-4">
          <h3 className="mb-2 text-sm font-semibold text-gray-700">Relaciones CFDI</h3>
          {inv.relations.map((rel: any, i: number) => (
            <div key={i} className="flex items-center gap-2 text-sm text-gray-600">
              <span className="font-medium">Tipo {rel.relationType}:</span>
              <span className="font-mono text-xs">{rel.relatedUuid}</span>
            </div>
          ))}
        </div>
      )}

      {/* Digital seals (collapsible) */}
      {inv.uuidFiscal && inv.xmlContent && (
        <div className="mb-4 rounded-lg border border-gray-200 bg-white">
          <button
            onClick={() => setShowSellos(!showSellos)}
            className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
            type="button"
          >
            Sellos digitales
            <ChevronDown className={`h-4 w-4 transition-transform ${showSellos ? 'rotate-180' : ''}`} />
          </button>
          {showSellos && (
            <div className="border-t border-gray-200 px-4 py-3 text-xs text-gray-500 break-all space-y-2">
              <p><span className="font-medium text-gray-600">UUID:</span> {inv.uuidFiscal}</p>
              <p><span className="font-medium text-gray-600">XML disponible:</span> Si</p>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        {inv.status === 'draft' && (
          <>
            <button onClick={() => navigate(`/invoicing/${inv.id}?mode=edit`)} className={btnOutline} type="button">
              <FileText className="h-4 w-4" /> Editar
            </button>
            <button onClick={handleStamp} disabled={stamping} className={btnPrimary} type="button">
              {stamping ? <Loader2 className="h-4 w-4 animate-spin" /> : <Stamp className="h-4 w-4" />}
              Timbrar
            </button>
            <button onClick={handleDelete} className={btnDanger} type="button">
              <Trash2 className="h-4 w-4" /> Eliminar borrador
            </button>
          </>
        )}
        {inv.status === 'stamped' && (
          <>
            <button onClick={() => downloadXml(inv.id)} className={btnOutline} type="button">
              <Download className="h-4 w-4" /> XML
            </button>
            <button onClick={() => downloadPdf(inv.id)} className={btnOutline} type="button">
              <Download className="h-4 w-4" /> PDF
            </button>
            <button onClick={() => setShowCancelModal(true)} className={btnDanger} type="button">
              <XCircle className="h-4 w-4" /> Cancelar factura
            </button>
          </>
        )}
        {inv.status === 'error' && (
          <>
            <button onClick={() => navigate(`/invoicing/${inv.id}?mode=edit`)} className={btnOutline} type="button">
              <FileText className="h-4 w-4" /> Editar y reintentar
            </button>
            <button onClick={handleDelete} className={btnDanger} type="button">
              <Trash2 className="h-4 w-4" /> Eliminar
            </button>
          </>
        )}
      </div>

      {/* Cancel modal */}
      {showCancelModal && (
        <CancelInvoiceModal
          invoiceId={inv.id}
          onDone={handleCancelDone}
          onClose={() => setShowCancelModal(false)}
        />
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════
// StampConfirmModal
// ══════════════════════════════════════════════════════════

function StampConfirmModal({
  invoiceType, customerName, customerRfc, total, paymentMethod,
  onConfirm, onCancel, loading,
}: {
  invoiceType: string
  customerName: string
  customerRfc: string
  total: number
  paymentMethod: string
  onConfirm: () => void
  onCancel: () => void
  loading: boolean
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-yellow-100">
            <AlertTriangle className="h-5 w-5 text-yellow-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900">Confirmar timbrado</h3>
        </div>

        <div className="mb-4 rounded-lg bg-yellow-50 border border-yellow-200 p-3">
          <p className="text-sm text-yellow-800">
            Esta accion tiene consecuencias fiscales. Una vez timbrada, la factura solo puede cancelarse ante el SAT.
          </p>
        </div>

        <div className="mb-4 space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-gray-500">Tipo:</span><span className="font-medium">{invoiceType === 'I' ? 'Ingreso' : 'Egreso'}</span></div>
          <div className="flex justify-between"><span className="text-gray-500">Receptor:</span><span className="font-medium">{customerName}</span></div>
          <div className="flex justify-between"><span className="text-gray-500">RFC:</span><span className="font-mono">{customerRfc}</span></div>
          <div className="flex justify-between"><span className="text-gray-500">Total:</span><span className="font-bold text-primary-600">{formatCurrency(total)}</span></div>
          <div className="flex justify-between"><span className="text-gray-500">Metodo:</span><span>{paymentMethod}</span></div>
        </div>

        <div className="flex justify-end gap-3">
          <button onClick={onCancel} className={btnOutline} type="button">Cancelar</button>
          <button onClick={onConfirm} disabled={loading} className={btnPrimary} type="button">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Stamp className="h-4 w-4" />}
            Confirmar timbrado
          </button>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════
// CancelInvoiceModal
// ══════════════════════════════════════════════════════════

function CancelInvoiceModal({
  invoiceId, onDone, onClose,
}: {
  invoiceId: string
  onDone: () => void
  onClose: () => void
}) {
  const toast = useToast()
  const { cancel } = useInvoiceStore()
  const [motivo, setMotivo] = useState('02')
  const [folioSustitucion, setFolioSustitucion] = useState('')
  const [cancelling, setCancelling] = useState(false)

  const motivos = [
    { code: '01', label: 'Comprobante emitido con errores con relacion', needsUuid: true },
    { code: '02', label: 'Comprobante emitido con errores sin relacion' },
    { code: '03', label: 'No se llevo a cabo la operacion' },
    { code: '04', label: 'Operacion nominativa relacionada en factura global' },
  ]

  const handleCancel = async () => {
    if (motivo === '01' && !folioSustitucion) {
      toast.error('Debe ingresar el UUID del comprobante sustituto')
      return
    }
    setCancelling(true)
    try {
      await cancel(invoiceId, motivo, motivo === '01' ? folioSustitucion : undefined)
      toast.success('Solicitud de cancelacion enviada')
      onDone()
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Error al cancelar')
    } finally {
      setCancelling(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
        <h3 className="mb-4 text-lg font-semibold text-gray-900">Cancelar factura</h3>

        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3">
          <p className="text-sm text-red-700">
            Facturas con monto mayor a $1,000 MXN requieren aceptacion del receptor para ser canceladas.
          </p>
        </div>

        <div className="mb-4 space-y-3">
          <label className={labelClass}>Motivo de cancelacion</label>
          {motivos.map((m) => (
            <label key={m.code} className="flex items-start gap-2 cursor-pointer">
              <input
                type="radio"
                name="motivo"
                value={m.code}
                checked={motivo === m.code}
                onChange={(e) => setMotivo(e.target.value)}
                className="mt-1 border-gray-300"
              />
              <span className="text-sm text-gray-700"><span className="font-medium">{m.code}</span> — {m.label}</span>
            </label>
          ))}
        </div>

        {motivo === '01' && (
          <div className="mb-4">
            <label className={labelClass}>UUID del comprobante sustituto</label>
            <input
              type="text"
              value={folioSustitucion}
              onChange={(e) => setFolioSustitucion(e.target.value)}
              placeholder="UUID del CFDI que sustituye"
              className={inputClass}
            />
          </div>
        )}

        <div className="flex justify-end gap-3">
          <button onClick={onClose} className={btnOutline} type="button">Volver</button>
          <button onClick={handleCancel} disabled={cancelling} className={btnDanger} type="button">
            {cancelling ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
            Cancelar factura
          </button>
        </div>
      </div>
    </div>
  )
}
