import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Loader2, ChevronLeft, Search, FileText, Check,
} from 'lucide-react'
import { api, useToast } from '@enlocal/react-hooks'

const fmtMoney = (v: string | number) => {
  const n = typeof v === 'string' ? parseFloat(v) : v
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n || 0)
}

const fmtDate = (d: string) => {
  if (!d) return ''
  return new Date(d).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
}

interface Candidate {
  ticketId: string
  remissionNoteId: string | null
  folio: number | null
  series: string | null
  total: string
  date: string
  customerName: string
}

export default function ConsolidateInvoicePage() {
  const navigate = useNavigate()
  const toast = useToast()

  // Customer search
  const [customerQuery, setCustomerQuery] = useState('')
  const [customerResults, setCustomerResults] = useState<any[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null)
  const [showDropdown, setShowDropdown] = useState(false)

  // Candidates
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loadingCandidates, setLoadingCandidates] = useState(false)

  // CFDI config
  const [useCfdi, setUseCfdi] = useState('G03')
  const [paymentForm, setPaymentForm] = useState('99')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Customer search debounce
  useEffect(() => {
    if (customerQuery.length < 2) { setCustomerResults([]); return }
    const t = setTimeout(async () => {
      try {
        const { data } = await api.get('/api/customers', { params: { q: customerQuery, limit: 10 } })
        setCustomerResults(data.data || data || [])
        setShowDropdown(true)
      } catch { setCustomerResults([]) }
    }, 300)
    return () => clearTimeout(t)
  }, [customerQuery])

  // Load candidates when customer selected
  useEffect(() => {
    if (!selectedCustomer) { setCandidates([]); return }
    setLoadingCandidates(true)
    api.get(`/api/invoices/consolidation-candidates/${selectedCustomer.id}`)
      .then(({ data }) => {
        setCandidates(data.data || [])
        setSelected(new Set())
      })
      .catch(() => setCandidates([]))
      .finally(() => setLoadingCandidates(false))
  }, [selectedCustomer?.id])

  const toggleTicket = (ticketId: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(ticketId)) next.delete(ticketId)
      else next.add(ticketId)
      return next
    })
  }

  const toggleAll = () => {
    if (selected.size === candidates.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(candidates.map((c) => c.ticketId)))
    }
  }

  const selectedTotal = candidates
    .filter((c) => selected.has(c.ticketId))
    .reduce((s, c) => s + parseFloat(c.total), 0)

  const handleConsolidate = async () => {
    if (selected.size === 0) return toast.warning('Selecciona al menos un ticket')
    if (!selectedCustomer) return toast.warning('Selecciona un cliente')

    setSubmitting(true)
    try {
      await api.post('/api/invoices/consolidate', {
        customer_id: selectedCustomer.id,
        ticket_ids: Array.from(selected),
        use_cfdi: useCfdi,
        payment_form: paymentForm,
        notes: notes || undefined,
      })
      toast.success(`Factura consolidada generada (${selected.size} tickets)`)
      navigate('/invoicing')
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Error al consolidar')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <button onClick={() => navigate('/receivables')} className="rounded-lg p-2 hover:bg-gray-100">
          <ChevronLeft className="h-5 w-5 text-gray-500" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Consolidar Factura</h1>
          <p className="text-sm text-gray-500">Genera un CFDI a partir de multiples tickets</p>
        </div>
      </div>

      {/* Customer search */}
      <div className="mb-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <label className="mb-1.5 block text-sm font-medium text-gray-700">Cliente *</label>
        {selectedCustomer ? (
          <div className="flex items-center justify-between rounded-lg border border-primary-200 bg-primary-50 p-4">
            <div>
              <p className="font-medium text-gray-900">{selectedCustomer.name}</p>
              {selectedCustomer.rfc && <p className="text-sm text-gray-600">RFC: {selectedCustomer.rfc}</p>}
            </div>
            <button
              onClick={() => { setSelectedCustomer(null); setCandidates([]); setSelected(new Set()) }}
              className="rounded p-1 text-gray-400 hover:bg-primary-100 hover:text-gray-600"
            >
              &times;
            </button>
          </div>
        ) : (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={customerQuery}
              onChange={(e) => setCustomerQuery(e.target.value)}
              onFocus={() => customerResults.length > 0 && setShowDropdown(true)}
              placeholder="Buscar cliente..."
              className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            />
            {showDropdown && customerResults.length > 0 && (
              <div className="absolute z-20 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg max-h-60 overflow-y-auto">
                {customerResults.map((c: any) => (
                  <button
                    key={c.id}
                    onClick={() => {
                      setSelectedCustomer(c)
                      setCustomerQuery('')
                      setShowDropdown(false)
                    }}
                    className="w-full px-4 py-3 text-left text-sm hover:bg-gray-50 border-b border-gray-100 last:border-0"
                  >
                    <p className="font-medium text-gray-900">{c.name}</p>
                    <p className="text-xs text-gray-500">{c.rfc || 'Sin RFC'}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Tickets table */}
      {selectedCustomer && (
        <div className="mb-6 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-gray-500" />
              <h2 className="text-sm font-semibold text-gray-900">
                Tickets disponibles ({candidates.length})
              </h2>
            </div>
            {candidates.length > 0 && (
              <button onClick={toggleAll} className="text-xs font-medium text-primary-600 hover:text-primary-700">
                {selected.size === candidates.length ? 'Deseleccionar todos' : 'Seleccionar todos'}
              </button>
            )}
          </div>

          {loadingCandidates ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : candidates.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-500">
              No hay tickets pendientes de facturar para este cliente
            </div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-4 py-3 w-10" />
                  <th className="px-4 py-3 font-medium text-gray-600">Folio</th>
                  <th className="px-4 py-3 font-medium text-gray-600">Fecha</th>
                  <th className="px-4 py-3 font-medium text-gray-600 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {candidates.map((c) => (
                  <tr
                    key={c.ticketId}
                    onClick={() => toggleTicket(c.ticketId)}
                    className={`cursor-pointer border-b border-gray-100 transition-colors ${selected.has(c.ticketId) ? 'bg-primary-50' : 'hover:bg-gray-50'}`}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selected.has(c.ticketId)}
                        onChange={() => toggleTicket(c.ticketId)}
                        className="accent-primary-600"
                      />
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {c.remissionNoteId
                        ? `${c.series}-${String(c.folio).padStart(4, '0')}`
                        : `POS-${c.ticketId.slice(0, 8)}`}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{fmtDate(c.date)}</td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">{fmtMoney(c.total)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50 border-t border-gray-200">
                  <td colSpan={3} className="px-4 py-3 text-right text-sm font-bold text-gray-900">
                    Total seleccionado ({selected.size} tickets):
                  </td>
                  <td className="px-4 py-3 text-right text-lg font-bold text-gray-900">
                    {fmtMoney(selectedTotal)}
                  </td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      )}

      {/* CFDI Config */}
      {selectedCustomer && selected.size > 0 && (
        <div className="mb-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
          <h3 className="text-sm font-semibold text-gray-900">Configuracion CFDI</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Uso CFDI</label>
              <select
                value={useCfdi}
                onChange={(e) => setUseCfdi(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none"
              >
                <option value="G01">Adquisicion de mercancias</option>
                <option value="G03">Gastos en general</option>
                <option value="P01">Por definir</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Forma de pago</label>
              <select
                value={paymentForm}
                onChange={(e) => setPaymentForm(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none"
              >
                <option value="01">Efectivo</option>
                <option value="02">Cheque</option>
                <option value="03">Transferencia</option>
                <option value="04">Tarjeta de credito</option>
                <option value="99">Por definir</option>
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Observaciones</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none"
              placeholder="Observaciones opcionales..."
            />
          </div>
        </div>
      )}

      {/* Actions */}
      {selectedCustomer && selected.size > 0 && (
        <div className="flex justify-end gap-3">
          <button
            onClick={() => navigate('/receivables')}
            className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleConsolidate}
            disabled={submitting}
            className="flex items-center gap-2 rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Generar Factura
          </button>
        </div>
      )}
    </div>
  )
}
