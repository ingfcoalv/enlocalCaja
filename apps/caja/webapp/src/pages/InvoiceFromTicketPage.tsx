import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search, Loader2, FileText, ArrowLeft, Receipt, CheckCircle2, Stamp, AlertTriangle, ChevronRight, ChevronLeft,
} from 'lucide-react'
import { api, useToast } from '@enlocal/react-hooks'
import { useInvoiceStore } from '../stores/useInvoiceStore'
import { useSatCatalogStore } from '../stores/useSatCatalogStore'

const inputClass = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20'
const selectClass = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none'
const labelClass = 'mb-1 block text-xs font-medium text-gray-600'
const btnPrimary = 'flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50'
const btnOutline = 'flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50'

function formatCurrency(amount: number | string): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(num || 0)
}

function formatDate(dateStr: string): string {
  try { return new Date(dateStr).toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric' }) }
  catch { return dateStr }
}

interface SaleTicket {
  id: string
  folio: number | null
  series: string | null
  customerId: string | null
  customerName: string | null
  status: string
  paymentMethod: string | null
  subtotal: number
  tax: number
  total: number
  createdAt: string
  items?: any[]
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

export default function InvoiceFromTicketPage() {
  const toast = useToast()
  const navigate = useNavigate()
  const { createFromTicket, stamp } = useInvoiceStore()
  const { cfdiUses, paymentForms, fetchAll } = useSatCatalogStore()

  const [step, setStep] = useState(1)

  // Step 1: Tickets
  const [tickets, setTickets] = useState<SaleTicket[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Step 2: Customer data
  const [customers, setCustomers] = useState<CustomerOption[]>([])
  const [customerSearch, setCustomerSearch] = useState('')
  const [customerId, setCustomerId] = useState('')
  const [customerRfc, setCustomerRfc] = useState('')
  const [customerRegimen, setCustomerRegimen] = useState('')
  const [useCfdi, setUseCfdi] = useState('G03')
  const [customerCp, setCustomerCp] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('PUE')
  const [paymentForm, setPaymentForm] = useState('01')
  const [series, setSeries] = useState('FA')

  // Step 3: Review
  const [saving, setSaving] = useState(false)
  const [showStampModal, setShowStampModal] = useState(false)
  const [createdInvoiceId, setCreatedInvoiceId] = useState<string | null>(null)

  useEffect(() => { fetchAll() }, [fetchAll])

  const fetchTickets = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/api/invoices/sales-available')
      setTickets(data?.data || [])
    } catch {
      toast.error('Error al cargar tickets disponibles')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { fetchTickets() }, [fetchTickets])

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

  const toggleTicket = (id: string) => {
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id); else next.add(id)
    setSelectedIds(next)
  }

  const toggleAll = () => {
    if (selectedIds.size === tickets.length) setSelectedIds(new Set())
    else setSelectedIds(new Set(tickets.map((t) => t.id)))
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

  const selectedTickets = tickets.filter((t) => selectedIds.has(t.id))
  const selectedTotal = selectedTickets.reduce((sum, t) => sum + t.total, 0)
  const selectedTax = selectedTickets.reduce((sum, t) => sum + t.tax, 0)
  const selectedSubtotal = selectedTickets.reduce((sum, t) => sum + t.subtotal, 0)

  // Auto-detect PPD if any ticket is credit
  useEffect(() => {
    const hasCredit = selectedTickets.some((t) => t.status === 'credit' || t.paymentMethod === 'credit')
    if (hasCredit) {
      setPaymentMethod('PPD')
      setPaymentForm('99')
    }
  }, [selectedIds, tickets])

  const handleSaveDraft = async () => {
    if (!customerId || selectedIds.size === 0) return
    setSaving(true)
    try {
      const created = await createFromTicket([...selectedIds], { customerId, useCfdi, series, paymentMethod, paymentForm })
      toast.success('Factura creada como borrador')
      navigate(`/invoicing/${created.id}`)
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Error al crear factura')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveAndStamp = async () => {
    if (!customerId || selectedIds.size === 0) return
    setSaving(true)
    try {
      const created = await createFromTicket([...selectedIds], { customerId, useCfdi, series, paymentMethod, paymentForm })
      setCreatedInvoiceId(created.id)
      setShowStampModal(true)
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Error al crear factura')
    } finally {
      setSaving(false)
    }
  }

  const confirmStamp = async () => {
    if (!createdInvoiceId) return
    setSaving(true)
    setShowStampModal(false)
    try {
      await stamp(createdInvoiceId)
      toast.success('Factura timbrada exitosamente')
      navigate(`/invoicing/${createdInvoiceId}`)
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Error al timbrar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <button onClick={() => navigate('/invoicing')} className="mb-4 flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900" type="button">
        <ArrowLeft className="h-4 w-4" /> Volver a facturas
      </button>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Facturar Tickets</h1>
        <p className="mt-1 text-sm text-gray-500">Genera un CFDI a partir de tickets de venta</p>
      </div>

      {/* Stepper */}
      <div className="mb-6 flex items-center gap-2">
        {[{ n: 1, label: 'Seleccionar tickets' }, { n: 2, label: 'Datos fiscales' }, { n: 3, label: 'Revisar y generar' }].map(({ n, label }) => (
          <div key={n} className="flex items-center gap-2">
            <button
              onClick={() => n < step && setStep(n)}
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${step >= n ? 'bg-primary-600 text-white' : 'bg-gray-200 text-gray-500'}`}
              type="button"
            >
              {n}
            </button>
            <span className={`text-sm ${step >= n ? 'font-medium text-gray-900' : 'text-gray-400'}`}>{label}</span>
            {n < 3 && <ChevronRight className="h-4 w-4 text-gray-300" />}
          </div>
        ))}
      </div>

      {/* Step 1: Select tickets */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-4 py-3">
                    <input type="checkbox" checked={tickets.length > 0 && selectedIds.size === tickets.length} onChange={toggleAll} className="rounded border-gray-300" />
                  </th>
                  <th className="px-4 py-3 font-medium text-gray-600">Folio</th>
                  <th className="px-4 py-3 font-medium text-gray-600">Cliente</th>
                  <th className="px-4 py-3 font-medium text-gray-600">Estado</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">Total</th>
                  <th className="px-4 py-3 font-medium text-gray-600">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} className="px-4 py-12 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-gray-400" /></td></tr>
                ) : tickets.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-12 text-center"><Receipt className="mx-auto h-8 w-8 text-gray-300" /><p className="mt-2 text-sm text-gray-500">No hay tickets sin facturar</p></td></tr>
                ) : tickets.map((t) => (
                  <tr key={t.id} className={`border-b border-gray-100 cursor-pointer hover:bg-gray-50 ${selectedIds.has(t.id) ? 'bg-primary-50' : ''}`} onClick={() => toggleTicket(t.id)}>
                    <td className="px-4 py-3"><input type="checkbox" checked={selectedIds.has(t.id)} onChange={() => toggleTicket(t.id)} className="rounded border-gray-300" /></td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-700">{t.folio || t.id.slice(0, 8)}</td>
                    <td className="px-4 py-3 text-gray-700">{t.customerName || 'Publico general'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${t.status === 'paid' ? 'bg-green-100 text-green-700' : t.status === 'partial' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                        {t.status === 'paid' ? 'Pagada' : t.status === 'partial' ? 'Parcial' : 'Credito'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatCurrency(t.total)}</td>
                    <td className="px-4 py-3 text-gray-500">{formatDate(t.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {selectedIds.size > 0 && (
            <div className="flex items-center justify-between rounded-xl border border-primary-200 bg-primary-50 p-4">
              <div className="text-sm">
                <span className="font-medium text-primary-700">{selectedIds.size} ticket(s) seleccionado(s)</span>
                <span className="ml-3 text-lg font-bold text-primary-800">{formatCurrency(selectedTotal)}</span>
              </div>
              <button onClick={() => setStep(2)} className={btnPrimary} type="button">
                Siguiente <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Step 2: Customer fiscal data */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <h3 className="mb-3 text-sm font-semibold text-gray-700">Receptor</h3>
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input type="text" placeholder="Buscar cliente por nombre o RFC..." value={customerSearch} onChange={(e) => { setCustomerSearch(e.target.value); setCustomerId('') }}
                className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-4 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20" />
              {customers.length > 0 && !customerId && (
                <div className="absolute z-20 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg max-h-60 overflow-auto">
                  {customers.map((c) => (
                    <button key={c.id} onClick={() => selectCustomer(c)} className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50" type="button">
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
              <div><label className={labelClass}>RFC</label><input type="text" value={customerRfc} onChange={(e) => setCustomerRfc(e.target.value)} className={inputClass} /></div>
              <div><label className={labelClass}>Regimen fiscal</label><input type="text" value={customerRegimen} onChange={(e) => setCustomerRegimen(e.target.value)} className={inputClass} /></div>
              <div>
                <label className={labelClass}>Uso CFDI</label>
                <select value={useCfdi} onChange={(e) => setUseCfdi(e.target.value)} className={selectClass}>
                  {cfdiUses.length > 0 ? cfdiUses.map((u) => <option key={u.code} value={u.code}>{u.code} - {u.description}</option>) : (
                    <><option value="G01">G01 - Adquisicion de mercancias</option><option value="G03">G03 - Gastos en general</option><option value="S01">S01 - Sin efectos fiscales</option></>
                  )}
                </select>
              </div>
              <div><label className={labelClass}>Codigo postal</label><input type="text" value={customerCp} onChange={(e) => setCustomerCp(e.target.value)} className={inputClass} /></div>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <h3 className="mb-3 text-sm font-semibold text-gray-700">Datos de pago</h3>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <div>
                <label className={labelClass}>Serie</label>
                <input type="text" value={series} onChange={(e) => setSeries(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Metodo de pago</label>
                <select value={paymentMethod} onChange={(e) => { setPaymentMethod(e.target.value); if (e.target.value === 'PPD') setPaymentForm('99') }} className={selectClass}>
                  <option value="PUE">PUE - Una sola exhibicion</option>
                  <option value="PPD">PPD - Parcialidades o diferido</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Forma de pago</label>
                <select value={paymentForm} onChange={(e) => setPaymentForm(e.target.value)} className={selectClass} disabled={paymentMethod === 'PPD'}>
                  {paymentForms.length > 0 ? paymentForms.map((f) => <option key={f.code} value={f.code}>{f.code} - {f.description}</option>) : (
                    <><option value="01">01 - Efectivo</option><option value="03">03 - Transferencia</option><option value="04">04 - Tarjeta credito</option><option value="99">99 - Por definir</option></>
                  )}
                </select>
              </div>
            </div>
          </div>

          <div className="flex justify-between">
            <button onClick={() => setStep(1)} className={btnOutline} type="button"><ChevronLeft className="h-4 w-4" /> Anterior</button>
            <button onClick={() => setStep(3)} disabled={!customerId} className={btnPrimary} type="button">Siguiente <ChevronRight className="h-4 w-4" /></button>
          </div>
        </div>
      )}

      {/* Step 3: Review and generate */}
      {step === 3 && (
        <div className="space-y-4">
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <h3 className="mb-3 text-sm font-semibold text-gray-700">Resumen</h3>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 mb-4">
              <div><p className="text-xs text-gray-500">Tickets</p><p className="text-lg font-bold text-gray-900">{selectedIds.size}</p></div>
              <div><p className="text-xs text-gray-500">Subtotal</p><p className="text-lg font-bold text-gray-900">{formatCurrency(selectedSubtotal)}</p></div>
              <div><p className="text-xs text-gray-500">IVA</p><p className="text-lg font-bold text-gray-900">{formatCurrency(selectedTax)}</p></div>
              <div><p className="text-xs text-gray-500">Total</p><p className="text-lg font-bold text-primary-600">{formatCurrency(selectedTotal)}</p></div>
            </div>
            <div className="space-y-1 text-sm text-gray-600">
              <p><span className="font-medium">Receptor:</span> {customerSearch} ({customerRfc})</p>
              <p><span className="font-medium">Uso CFDI:</span> {useCfdi}</p>
              <p><span className="font-medium">Metodo:</span> {paymentMethod} | <span className="font-medium">Forma:</span> {paymentForm}</p>
              <p><span className="font-medium">Serie:</span> {series}</p>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-4 py-3 font-medium text-gray-600">Folio</th>
                  <th className="px-4 py-3 font-medium text-gray-600">Cliente</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">Total</th>
                </tr>
              </thead>
              <tbody>
                {selectedTickets.map((t) => (
                  <tr key={t.id} className="border-b border-gray-100">
                    <td className="px-4 py-3 font-mono text-xs text-gray-700">{t.folio || t.id.slice(0, 8)}</td>
                    <td className="px-4 py-3 text-gray-700">{t.customerName || 'Publico general'}</td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatCurrency(t.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-between">
            <button onClick={() => setStep(2)} className={btnOutline} type="button"><ChevronLeft className="h-4 w-4" /> Anterior</button>
            <div className="flex gap-2">
              <button onClick={handleSaveDraft} disabled={saving} className={btnOutline} type="button">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />} Guardar borrador
              </button>
              <button onClick={handleSaveAndStamp} disabled={saving} className={btnPrimary} type="button">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Stamp className="h-4 w-4" />} Guardar y timbrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stamp modal */}
      {showStampModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-yellow-100"><AlertTriangle className="h-5 w-5 text-yellow-600" /></div>
              <h3 className="text-lg font-semibold text-gray-900">Confirmar timbrado</h3>
            </div>
            <div className="mb-4 rounded-lg bg-yellow-50 border border-yellow-200 p-3">
              <p className="text-sm text-yellow-800">Esta accion tiene consecuencias fiscales.</p>
            </div>
            <div className="mb-4 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Tickets:</span><span className="font-medium">{selectedIds.size}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Total:</span><span className="font-bold text-primary-600">{formatCurrency(selectedTotal)}</span></div>
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => { setShowStampModal(false); if (createdInvoiceId) navigate(`/invoicing/${createdInvoiceId}`) }} className={btnOutline} type="button">Cancelar</button>
              <button onClick={confirmStamp} disabled={saving} className={btnPrimary} type="button">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Stamp className="h-4 w-4" />} Confirmar timbrado
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
