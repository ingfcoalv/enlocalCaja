import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Loader2, FileText, Stamp, Globe, Search, AlertTriangle } from 'lucide-react'
import { api, useToast } from '@enlocal/react-hooks'
import { useInvoiceStore } from '../stores/useInvoiceStore'

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

const PERIODICITIES = [
  { code: '01', label: 'Diario' },
  { code: '02', label: 'Semanal' },
  { code: '03', label: 'Quincenal' },
  { code: '04', label: 'Mensual' },
  { code: '05', label: 'Bimestral' },
]

const MONTHS = [
  { code: '01', label: 'Enero' }, { code: '02', label: 'Febrero' }, { code: '03', label: 'Marzo' },
  { code: '04', label: 'Abril' }, { code: '05', label: 'Mayo' }, { code: '06', label: 'Junio' },
  { code: '07', label: 'Julio' }, { code: '08', label: 'Agosto' }, { code: '09', label: 'Septiembre' },
  { code: '10', label: 'Octubre' }, { code: '11', label: 'Noviembre' }, { code: '12', label: 'Diciembre' },
  { code: '13', label: 'Ene-Feb' }, { code: '14', label: 'Mar-Abr' }, { code: '15', label: 'May-Jun' },
  { code: '16', label: 'Jul-Ago' }, { code: '17', label: 'Sep-Oct' }, { code: '18', label: 'Nov-Dic' },
]

interface CandidateTicket {
  id: string
  folio: number | null
  customerName: string | null
  total: number
  tax: number
  subtotal: number
  createdAt: string
}

export default function GlobalInvoicePage() {
  const toast = useToast()
  const navigate = useNavigate()
  const { stamp } = useInvoiceStore()

  const [periodicity, setPeriodicity] = useState('04')
  const [month, setMonth] = useState(String(new Date().getMonth() + 1).padStart(2, '0'))
  const [year, setYear] = useState(String(new Date().getFullYear()))
  const [grouping, setGrouping] = useState('sat_code')

  const [candidates, setCandidates] = useState<CandidateTicket[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)

  const [saving, setSaving] = useState(false)
  const [showStampModal, setShowStampModal] = useState(false)
  const [createdId, setCreatedId] = useState<string | null>(null)

  const searchCandidates = async () => {
    setLoading(true)
    setSearched(true)
    try {
      const { data } = await api.get('/api/invoices/sales-available', {
        params: { month, year },
      })
      setCandidates(data?.data || [])
    } catch {
      toast.error('Error al buscar candidatos')
    } finally {
      setLoading(false)
    }
  }

  const totalAmount = candidates.reduce((sum, c) => sum + c.total, 0)
  const totalTax = candidates.reduce((sum, c) => sum + c.tax, 0)
  const totalSubtotal = candidates.reduce((sum, c) => sum + c.subtotal, 0)

  const handleGenerate = async (andStamp: boolean) => {
    if (candidates.length === 0) return
    setSaving(true)
    try {
      const { data } = await api.post('/api/invoices/from-sales', {
        saleIds: candidates.map((c) => c.id),
        customerId: null,
        isGlobal: true,
        globalPeriodicity: periodicity,
        globalMonth: month,
        globalYear: year,
        grouping,
        series: 'FA',
        useCfdi: 'S01',
        paymentMethod: 'PUE',
        paymentForm: '01',
      })
      const created = data.data || data
      if (andStamp) {
        setCreatedId(created.id)
        setShowStampModal(true)
      } else {
        toast.success('Factura global creada como borrador')
        navigate(`/invoicing/${created.id}`)
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Error al generar factura global')
    } finally {
      setSaving(false)
    }
  }

  const confirmStamp = async () => {
    if (!createdId) return
    setSaving(true)
    setShowStampModal(false)
    try {
      await stamp(createdId)
      toast.success('Factura global timbrada')
      navigate(`/invoicing/${createdId}`)
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
        <h1 className="text-2xl font-bold text-gray-900">Factura Global</h1>
        <p className="mt-1 text-sm text-gray-500">Genera un CFDI global para ventas al publico en general</p>
      </div>

      {/* Period config */}
      <div className="mb-6 rounded-xl border border-gray-200 bg-white p-4">
        <h3 className="mb-3 text-sm font-semibold text-gray-700">Configuracion del periodo</h3>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <label className={labelClass}>Periodicidad</label>
            <select value={periodicity} onChange={(e) => setPeriodicity(e.target.value)} className={selectClass}>
              {PERIODICITIES.map((p) => <option key={p.code} value={p.code}>{p.code} - {p.label}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Mes</label>
            <select value={month} onChange={(e) => setMonth(e.target.value)} className={selectClass}>
              {MONTHS.map((m) => <option key={m.code} value={m.code}>{m.code} - {m.label}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Anio</label>
            <input type="number" value={year} onChange={(e) => setYear(e.target.value)} className={inputClass} min="2020" max="2030" />
          </div>
          <div>
            <label className={labelClass}>Agrupacion</label>
            <select value={grouping} onChange={(e) => setGrouping(e.target.value)} className={selectClass}>
              <option value="sat_code">Por clave SAT</option>
              <option value="individual">Individual</option>
              <option value="general">General</option>
            </select>
          </div>
        </div>
        <button onClick={searchCandidates} disabled={loading} className={`mt-4 ${btnPrimary}`} type="button">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          Buscar candidatos
        </button>
      </div>

      {/* Fixed receptor info */}
      <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-3">
        <p className="text-xs font-medium text-blue-600">Receptor fijo</p>
        <p className="text-sm text-blue-800">PUBLICO EN GENERAL — RFC: XAXX010101000 — Regimen: 616 — Uso CFDI: S01</p>
      </div>

      {/* Results */}
      {searched && (
        <>
          {/* Summary cards */}
          <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <p className="text-xs font-medium text-gray-500">Tickets</p>
              <p className="text-2xl font-bold text-gray-700">{candidates.length}</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <p className="text-xs font-medium text-gray-500">Subtotal</p>
              <p className="text-lg font-bold text-gray-700">{formatCurrency(totalSubtotal)}</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <p className="text-xs font-medium text-gray-500">IVA estimado</p>
              <p className="text-lg font-bold text-gray-700">{formatCurrency(totalTax)}</p>
            </div>
            <div className="rounded-xl border border-primary-200 bg-primary-50 p-4">
              <p className="text-xs font-medium text-primary-600">Total estimado</p>
              <p className="text-2xl font-bold text-primary-700">{formatCurrency(totalAmount)}</p>
            </div>
          </div>

          {/* Candidate list */}
          <div className="mb-4 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-4 py-3 font-medium text-gray-600">Folio</th>
                  <th className="px-4 py-3 font-medium text-gray-600">Cliente</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">Subtotal</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">IVA</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">Total</th>
                  <th className="px-4 py-3 font-medium text-gray-600">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} className="px-4 py-12 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-gray-400" /></td></tr>
                ) : candidates.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-12 text-center"><Globe className="mx-auto h-8 w-8 text-gray-300" /><p className="mt-2 text-sm text-gray-500">No hay tickets disponibles para este periodo</p></td></tr>
                ) : candidates.map((c) => (
                  <tr key={c.id} className="border-b border-gray-100">
                    <td className="px-4 py-3 font-mono text-xs text-gray-700">{c.folio || c.id.slice(0, 8)}</td>
                    <td className="px-4 py-3 text-gray-700">{c.customerName || 'Publico general'}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{formatCurrency(c.subtotal)}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{formatCurrency(c.tax)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatCurrency(c.total)}</td>
                    <td className="px-4 py-3 text-gray-500">{formatDate(c.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {candidates.length > 0 && (
            <div className="flex justify-end gap-3">
              <button onClick={() => handleGenerate(false)} disabled={saving} className={btnOutline} type="button">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />} Generar borrador
              </button>
              <button onClick={() => handleGenerate(true)} disabled={saving} className={btnPrimary} type="button">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Stamp className="h-4 w-4" />} Generar y timbrar
              </button>
            </div>
          )}
        </>
      )}

      {/* Stamp modal */}
      {showStampModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-yellow-100"><AlertTriangle className="h-5 w-5 text-yellow-600" /></div>
              <h3 className="text-lg font-semibold text-gray-900">Confirmar timbrado global</h3>
            </div>
            <div className="mb-4 rounded-lg bg-yellow-50 border border-yellow-200 p-3">
              <p className="text-sm text-yellow-800">Se timbrara una factura global con {candidates.length} tickets por {formatCurrency(totalAmount)}.</p>
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => { setShowStampModal(false); if (createdId) navigate(`/invoicing/${createdId}`) }} className={btnOutline} type="button">Cancelar</button>
              <button onClick={confirmStamp} disabled={saving} className={btnPrimary} type="button">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Stamp className="h-4 w-4" />} Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
