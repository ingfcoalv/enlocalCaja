import { useEffect, useState, useCallback } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  Plus, Search, Loader2, ChevronLeft, ChevronRight, FileText, Printer,
  X, Trash2, Check, Ban, Send, Mail, Clock, RefreshCw, Copy,
  ArrowRightLeft, Calendar, MessageSquare, Eye, Edit3, ChevronDown,
} from 'lucide-react'
import { api, useToast } from '@enlocal/react-hooks'
import { useQuoteStore, type Quote, type QuoteItem } from '../stores/useQuoteStore'

// ─── Helpers ──────────────────────────────────────────────

const fmtMoney = (v: string | number) => {
  const n = typeof v === 'string' ? parseFloat(v) : v
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n || 0)
}

const fmtDate = (d: string) => {
  if (!d) return ''
  return new Date(d).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
}

const fmtDateTime = (d: string) => {
  if (!d) return ''
  return new Date(d).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

const statusConfig: Record<string, { label: string; color: string; dot: string }> = {
  draft: { label: 'Borrador', color: 'bg-gray-100 text-gray-700', dot: 'bg-gray-400' },
  sent: { label: 'Enviada', color: 'bg-blue-100 text-blue-700', dot: 'bg-blue-500' },
  accepted: { label: 'Aceptada', color: 'bg-green-100 text-green-700', dot: 'bg-green-500' },
  rejected: { label: 'Rechazada', color: 'bg-red-100 text-red-600', dot: 'bg-red-400' },
  expired: { label: 'Expirada', color: 'bg-yellow-100 text-yellow-700', dot: 'bg-yellow-500' },
  superseded: { label: 'Reemplazada', color: 'bg-purple-100 text-purple-700', dot: 'bg-purple-500' },
  cancelled: { label: 'Cancelada', color: 'bg-red-100 text-red-700', dot: 'bg-red-600' },
  converted: { label: 'Convertida', color: 'bg-indigo-100 text-indigo-700', dot: 'bg-indigo-500' },
}

const pipelineColors: Record<string, string> = {
  draft: 'bg-gray-400',
  sent: 'bg-blue-500',
  accepted: 'bg-green-500',
  rejected: 'bg-red-400',
  expired: 'bg-yellow-500',
  converted: 'bg-indigo-500',
  cancelled: 'bg-red-600',
}

function StatusBadge({ status }: { status: string }) {
  const cfg = statusConfig[status] || statusConfig.draft
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.color}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  )
}

// ─── Main Component ────────────────────────────────────────

export default function QuotesPage() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const mode = searchParams.get('mode')

  if (id && !mode) return <QuoteDetail id={id} />
  if (mode === 'new' || (id && mode === 'edit')) return <QuoteForm id={id} />
  return <QuoteList />
}

// ─── LIST VIEW ─────────────────────────────────────────────

function QuoteList() {
  const toast = useToast()
  const navigate = useNavigate()
  const { quotes, loading, pagination, pipeline, fetchQuotes, fetchPipeline } = useQuoteStore()
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)

  const load = useCallback(() => {
    fetchQuotes({
      q: query || undefined,
      status: statusFilter || undefined,
      page,
      limit: 20,
    })
  }, [fetchQuotes, query, statusFilter, page])

  useEffect(() => { load() }, [load])
  useEffect(() => { fetchPipeline() }, [fetchPipeline])

  const pipelineTotal = (Array.isArray(pipeline) ? pipeline : []).reduce((acc: number, p: any) => acc + (p.total || 0), 0)

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cotizaciones</h1>
          <p className="mt-1 text-sm text-gray-500">{pagination.total} cotizaciones</p>
        </div>
        <button
          onClick={() => navigate('/quotes/new?mode=new')}
          className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700"
        >
          <Plus className="h-4 w-4" />
          Nueva Cotizacion
        </button>
      </div>

      {/* Pipeline bar */}
      {pipeline.length > 0 && (
        <div className="mb-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">Pipeline</h3>
            <span className="text-sm font-medium text-gray-600">{fmtMoney(pipelineTotal)}</span>
          </div>
          <div className="mb-3 flex h-3 overflow-hidden rounded-full bg-gray-100">
            {pipeline.filter((p) => p.count > 0).map((p) => {
              const pct = pipelineTotal > 0 ? (p.total / pipelineTotal) * 100 : 0
              return (
                <div
                  key={p.status}
                  className={`${pipelineColors[p.status] || 'bg-gray-400'} transition-all`}
                  style={{ width: `${Math.max(pct, 1)}%` }}
                  title={`${statusConfig[p.status]?.label || p.status}: ${p.count} — ${fmtMoney(p.total)}`}
                />
              )
            })}
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-gray-600">
            {pipeline.filter((p) => p.count > 0).map((p) => (
              <button
                key={p.status}
                onClick={() => { setStatusFilter(p.status); setPage(1) }}
                className="flex items-center gap-1.5 hover:text-gray-900"
              >
                <span className={`h-2 w-2 rounded-full ${pipelineColors[p.status] || 'bg-gray-400'}`} />
                {statusConfig[p.status]?.label || p.status}: {p.count} ({fmtMoney(p.total)})
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setPage(1) }}
            placeholder="Buscar por folio o cliente..."
            className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
          className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
        >
          <option value="">Todos los status</option>
          <option value="draft">Borrador</option>
          <option value="sent">Enviada</option>
          <option value="accepted">Aceptada</option>
          <option value="rejected">Rechazada</option>
          <option value="expired">Expirada</option>
          <option value="converted">Convertida</option>
          <option value="cancelled">Cancelada</option>
        </select>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : quotes.length === 0 ? (
          <div className="py-20 text-center text-sm text-gray-500">
            No hay cotizaciones
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-3 font-medium text-gray-600">Folio</th>
                <th className="px-4 py-3 font-medium text-gray-600">Cliente</th>
                <th className="px-4 py-3 font-medium text-gray-600 text-right">Total</th>
                <th className="px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="px-4 py-3 font-medium text-gray-600">Vigencia</th>
                <th className="px-4 py-3 font-medium text-gray-600">Fecha</th>
                <th className="px-4 py-3 font-medium text-gray-600">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {quotes.map((q) => (
                <tr
                  key={q.id}
                  onClick={() => navigate(`/quotes/${q.id}`)}
                  className="cursor-pointer border-b border-gray-100 transition-colors hover:bg-gray-50"
                >
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {q.series}-{String(q.folio).padStart(4, '0')}
                    {q.version > 1 && <span className="ml-1 text-xs text-gray-400">v{q.version}</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-700">{q.customerName}</td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900">
                    {fmtMoney(q.total)}
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={q.status} /></td>
                  <td className="px-4 py-3 text-gray-500">
                    {q.validUntil ? fmtDate(q.validUntil) : `${q.validDays} dias`}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{fmtDate(q.createdAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => navigate(`/quotes/${q.id}`)}
                        className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                        title="Ver"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      {q.status === 'draft' && (
                        <button
                          onClick={() => navigate(`/quotes/${q.id}?mode=edit`)}
                          className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                          title="Editar"
                        >
                          <Edit3 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-gray-500">
          <span>
            Mostrando pagina {pagination.page} de {pagination.pages} ({pagination.total} cotizaciones)
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 hover:bg-gray-50 disabled:opacity-50"
            >
              <ChevronLeft className="h-4 w-4" /> Anterior
            </button>
            <button
              onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))}
              disabled={page >= pagination.pages}
              className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 hover:bg-gray-50 disabled:opacity-50"
            >
              Siguiente <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── DETAIL VIEW ────────────────────────────────────────────

function QuoteDetail({ id }: { id: string }) {
  const toast = useToast()
  const navigate = useNavigate()
  const {
    currentQuote, fetchById, accept, reject, cancel, newVersion, send, convert,
    addActivity, downloadPdf, loading,
  } = useQuoteStore()

  const [showSendModal, setShowSendModal] = useState(false)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [showConvertModal, setShowConvertModal] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [cancelReason, setCancelReason] = useState('')
  const [activityText, setActivityText] = useState('')
  const [submittingActivity, setSubmittingActivity] = useState(false)

  useEffect(() => { fetchById(id) }, [id, fetchById])

  const q = currentQuote

  if (loading || !q) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    )
  }

  const handleAccept = async () => {
    try {
      await accept(q.id)
      toast.success('Cotizacion aceptada')
      fetchById(id)
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Error al aceptar')
    }
  }

  const handleReject = async () => {
    if (!rejectReason.trim()) return toast.warning('Ingresa un motivo de rechazo')
    try {
      await reject(q.id, rejectReason)
      toast.success('Cotizacion rechazada')
      setShowRejectModal(false)
      fetchById(id)
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Error al rechazar')
    }
  }

  const handleCancel = async () => {
    if (!cancelReason.trim()) return toast.warning('Ingresa un motivo de cancelacion')
    try {
      await cancel(q.id, cancelReason)
      toast.success('Cotizacion cancelada')
      setShowCancelModal(false)
      fetchById(id)
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Error al cancelar')
    }
  }

  const handleNewVersion = async () => {
    try {
      const nv = await newVersion(q.id)
      toast.success('Nueva version creada')
      navigate(`/quotes/${nv.id}?mode=edit`)
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Error al crear nueva version')
    }
  }

  const handleAddActivity = async () => {
    if (!activityText.trim()) return
    setSubmittingActivity(true)
    try {
      await addActivity(q.id, { activityType: 'note', description: activityText })
      setActivityText('')
      toast.success('Actividad registrada')
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Error al registrar actividad')
    } finally {
      setSubmittingActivity(false)
    }
  }

  const handlePdf = async () => {
    try {
      await downloadPdf(q.id)
    } catch {
      toast.error('Error al generar PDF')
    }
  }

  // Group items
  const groups: Record<string, QuoteItem[]> = {}
  const optionals: QuoteItem[] = []
  ;(q.items || []).forEach((item) => {
    if (item.isOptional) {
      optionals.push(item)
    } else {
      const g = item.groupName || 'General'
      if (!groups[g]) groups[g] = []
      groups[g].push(item)
    }
  })

  return (
    <div className="mx-auto max-w-4xl">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/quotes')} className="rounded-lg p-2 hover:bg-gray-100">
            <ChevronLeft className="h-5 w-5 text-gray-500" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-gray-900">
                {q.series}-{String(q.folio).padStart(4, '0')}
              </h1>
              {q.version > 1 && (
                <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">
                  v{q.version}
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500">Creada {fmtDateTime(q.createdAt)}</p>
          </div>
        </div>
        <StatusBadge status={q.status} />
      </div>

      {/* Info cards */}
      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="mb-2 text-xs font-semibold uppercase text-gray-500">Cliente</h3>
          <p className="font-medium text-gray-900">{q.customerName}</p>
          {q.customerRfc && <p className="text-sm text-gray-600">RFC: {q.customerRfc}</p>}
          {q.customerEmail && <p className="text-sm text-gray-600">Email: {q.customerEmail}</p>}
          {q.customerPhone && <p className="text-sm text-gray-600">Tel: {q.customerPhone}</p>}
          {q.customerAddress && <p className="mt-1 text-sm text-gray-500">{q.customerAddress}</p>}
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="mb-2 text-xs font-semibold uppercase text-gray-500">Resumen</h3>
          <p className="text-2xl font-bold text-gray-900">{fmtMoney(q.total)}</p>
          <div className="mt-2 space-y-1 text-sm text-gray-600">
            <p>Vigencia: {q.validDays} dias {q.validUntil && <span>({fmtDate(q.validUntil)})</span>}</p>
            {q.salesPersonName && <p>Vendedor: {q.salesPersonName}</p>}
            {q.followUpDate && (
              <p className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                Seguimiento: {fmtDate(q.followUpDate)}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Items table */}
      <div className="mb-6 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-gray-200 px-6 py-4">
          <FileText className="h-4 w-4 text-gray-500" />
          <h2 className="text-sm font-semibold text-gray-900">Partidas</h2>
        </div>

        {Object.entries(groups).map(([groupName, groupItems]) => (
          <div key={groupName}>
            {Object.keys(groups).length > 1 && (
              <div className="border-b border-gray-100 bg-gray-50/50 px-4 py-2">
                <span className="text-xs font-semibold uppercase text-gray-500">{groupName}</span>
              </div>
            )}
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-4 py-3 font-medium text-gray-600">Concepto</th>
                  <th className="px-4 py-3 font-medium text-gray-600 text-right">Cant</th>
                  <th className="px-4 py-3 font-medium text-gray-600 text-right">P.Unit</th>
                  <th className="px-4 py-3 font-medium text-gray-600 text-right">Desc</th>
                  <th className="px-4 py-3 font-medium text-gray-600 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {groupItems.map((item, i) => (
                  <tr key={item.id || i} className="border-b border-gray-100">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{item.itemName}</p>
                      {item.itemDescription && <p className="text-xs text-gray-500">{item.itemDescription}</p>}
                      {item.itemSku && <p className="text-xs text-gray-400">SKU: {item.itemSku}</p>}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">{item.quantity}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{fmtMoney(item.unitPrice)}</td>
                    <td className="px-4 py-3 text-right text-gray-500">
                      {item.discount > 0 ? fmtMoney(item.discount) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">{fmtMoney(item.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}

        {/* Optional items */}
        {optionals.length > 0 && (
          <div>
            <div className="border-b border-gray-100 border-t bg-yellow-50/50 px-4 py-2">
              <span className="text-xs font-semibold uppercase text-yellow-700">Opcionales</span>
            </div>
            <table className="w-full text-left text-sm">
              <tbody>
                {optionals.map((item, i) => (
                  <tr key={item.id || `opt-${i}`} className="border-b border-gray-100">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-700">{item.itemName}</p>
                      {item.itemDescription && <p className="text-xs text-gray-500">{item.itemDescription}</p>}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">{item.quantity}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{fmtMoney(item.unitPrice)}</td>
                    <td className="px-4 py-3 text-right text-gray-500">
                      {item.discount > 0 ? fmtMoney(item.discount) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-700">{fmtMoney(item.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Totals */}
        <div className="bg-gray-50">
          <div className="flex justify-end px-4 py-2 text-sm">
            <span className="w-32 text-right text-gray-600">Subtotal:</span>
            <span className="w-32 text-right font-medium text-gray-900">{fmtMoney(q.subtotal)}</span>
          </div>
          {parseFloat(q.discountAmount) > 0 && (
            <div className="flex justify-end px-4 py-2 text-sm">
              <span className="w-32 text-right text-gray-600">Descuento:</span>
              <span className="w-32 text-right font-medium text-red-600">-{fmtMoney(q.discountAmount)}</span>
            </div>
          )}
          <div className="flex justify-end px-4 py-2 text-sm">
            <span className="w-32 text-right text-gray-600">IVA:</span>
            <span className="w-32 text-right font-medium text-gray-900">{fmtMoney(q.taxAmount)}</span>
          </div>
          <div className="flex justify-end border-t border-gray-200 px-4 py-3 text-sm">
            <span className="w-32 text-right font-bold text-gray-900">Total:</span>
            <span className="w-32 text-right text-lg font-bold text-gray-900">{fmtMoney(q.total)}</span>
          </div>
        </div>
      </div>

      {/* Conditions / Notes */}
      {(q.conditions || q.notes || q.termsAndConditions) && (
        <div className="mb-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
          {q.conditions && (
            <div>
              <h3 className="mb-1 text-xs font-semibold uppercase text-gray-500">Condiciones</h3>
              <p className="whitespace-pre-wrap text-sm text-gray-700">{q.conditions}</p>
            </div>
          )}
          {q.notes && (
            <div>
              <h3 className="mb-1 text-xs font-semibold uppercase text-gray-500">Notas</h3>
              <p className="whitespace-pre-wrap text-sm text-gray-700">{q.notes}</p>
            </div>
          )}
          {q.termsAndConditions && (
            <div>
              <h3 className="mb-1 text-xs font-semibold uppercase text-gray-500">Terminos y Condiciones</h3>
              <p className="whitespace-pre-wrap text-sm text-gray-700">{q.termsAndConditions}</p>
            </div>
          )}
        </div>
      )}

      {/* Versions */}
      {q.versions && q.versions.length > 0 && (
        <div className="mb-6 rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-6 py-4">
            <h3 className="text-sm font-semibold text-gray-900">Versiones</h3>
          </div>
          <div className="divide-y divide-gray-100">
            {q.versions.map((v) => (
              <button
                key={v.id}
                onClick={() => navigate(`/quotes/${v.id}`)}
                className={`flex w-full items-center justify-between px-6 py-3 text-left text-sm hover:bg-gray-50 ${
                  v.id === q.id ? 'bg-primary-50' : ''
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="font-medium text-gray-900">v{v.version}</span>
                  <StatusBadge status={v.status} />
                  <span className="text-gray-500">{fmtMoney(v.total)}</span>
                </div>
                <span className="text-gray-400">{fmtDate(v.createdAt)}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Email history */}
      {q.emails && q.emails.length > 0 && (
        <div className="mb-6 rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-6 py-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
              <Mail className="h-4 w-4 text-gray-500" />
              Correos Enviados
            </h3>
          </div>
          <div className="divide-y divide-gray-100">
            {q.emails.map((email) => (
              <div key={email.id} className="px-6 py-3 text-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">{email.subject}</p>
                    <p className="text-gray-500">Para: {email.sentTo} {email.sentCc && `| CC: ${email.sentCc}`}</p>
                  </div>
                  <div className="text-right">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      email.status === 'sent' || email.status === 'delivered'
                        ? 'bg-green-100 text-green-700'
                        : email.status === 'failed'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-gray-100 text-gray-700'
                    }`}>
                      {email.status === 'sent' || email.status === 'delivered' ? 'Enviado' :
                       email.status === 'failed' ? 'Error' : email.status}
                    </span>
                    <p className="mt-0.5 text-xs text-gray-400">{fmtDateTime(email.sentAt)}</p>
                  </div>
                </div>
                {email.errorMessage && (
                  <p className="mt-1 text-xs text-red-500">{email.errorMessage}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Activity timeline */}
      <div className="mb-6 rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-6 py-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
            <Clock className="h-4 w-4 text-gray-500" />
            Actividad
          </h3>
        </div>
        <div className="p-4">
          {/* Add activity */}
          <div className="mb-4 flex gap-2">
            <input
              type="text"
              value={activityText}
              onChange={(e) => setActivityText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddActivity()}
              placeholder="Agregar nota de seguimiento..."
              className="flex-1 rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            />
            <button
              onClick={handleAddActivity}
              disabled={submittingActivity || !activityText.trim()}
              className="flex items-center gap-1 rounded-lg bg-primary-600 px-3 py-2.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
            >
              {submittingActivity ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquare className="h-4 w-4" />}
              Agregar
            </button>
          </div>

          {/* Timeline */}
          {q.activities && q.activities.length > 0 ? (
            <div className="space-y-3">
              {q.activities.map((a) => (
                <div key={a.id} className="flex items-start gap-3 text-sm">
                  <div className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-gray-300" />
                  <div className="flex-1">
                    <p className="text-gray-700">{a.description}</p>
                    <p className="mt-0.5 text-xs text-gray-400">
                      {a.createdBy} — {fmtDateTime(a.createdAt)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-sm text-gray-400">Sin actividad registrada</p>
          )}
        </div>
      </div>

      {/* Conversion info */}
      {q.status === 'converted' && (q.convertedToTicketId || q.convertedToRemissionId) && (
        <div className="mb-6 rounded-xl border border-indigo-200 bg-indigo-50 p-5 shadow-sm">
          <h3 className="mb-1 text-xs font-semibold uppercase text-indigo-600">Convertida</h3>
          <p className="text-sm text-indigo-700">
            {q.convertedToTicketId && <>Ticket: {q.convertedToTicketId}</>}
            {q.convertedToRemissionId && <>Remision: {q.convertedToRemissionId}</>}
            {q.convertedAt && <> — {fmtDateTime(q.convertedAt)}</>}
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        {/* Draft actions */}
        {q.status === 'draft' && (
          <>
            <button
              onClick={() => navigate(`/quotes/${q.id}?mode=edit`)}
              className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <Edit3 className="h-4 w-4" /> Editar
            </button>
            <button
              onClick={() => setShowSendModal(true)}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
            >
              <Send className="h-4 w-4" /> Enviar
            </button>
            <button
              onClick={handleAccept}
              className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-700"
            >
              <Check className="h-4 w-4" /> Aceptar
            </button>
            <button
              onClick={() => setShowCancelModal(true)}
              className="flex items-center gap-2 rounded-lg border border-red-300 px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4" /> Eliminar
            </button>
          </>
        )}

        {/* Sent actions */}
        {q.status === 'sent' && (
          <>
            <button
              onClick={() => setShowSendModal(true)}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
            >
              <RefreshCw className="h-4 w-4" /> Reenviar
            </button>
            <button
              onClick={handleAccept}
              className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-700"
            >
              <Check className="h-4 w-4" /> Aceptar
            </button>
            <button
              onClick={() => setShowRejectModal(true)}
              className="flex items-center gap-2 rounded-lg border border-red-300 px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50"
            >
              <Ban className="h-4 w-4" /> Rechazar
            </button>
            <button
              onClick={handleNewVersion}
              className="flex items-center gap-2 rounded-lg border border-purple-300 px-4 py-2.5 text-sm font-medium text-purple-600 hover:bg-purple-50"
            >
              <Copy className="h-4 w-4" /> Nueva Version
            </button>
          </>
        )}

        {/* Accepted actions */}
        {q.status === 'accepted' && (
          <>
            <button
              onClick={() => setShowConvertModal(true)}
              className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700"
            >
              <ArrowRightLeft className="h-4 w-4" /> Convertir
            </button>
          </>
        )}

        {/* Rejected actions */}
        {q.status === 'rejected' && (
          <button
            onClick={handleNewVersion}
            className="flex items-center gap-2 rounded-lg border border-purple-300 px-4 py-2.5 text-sm font-medium text-purple-600 hover:bg-purple-50"
          >
            <Copy className="h-4 w-4" /> Nueva Version
          </button>
        )}

        {/* PDF always available except draft */}
        <button
          onClick={handlePdf}
          className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <Printer className="h-4 w-4" /> PDF
        </button>
      </div>

      {/* Send email modal */}
      {showSendModal && (
        <SendEmailModal
          quote={q}
          onClose={() => setShowSendModal(false)}
          onSuccess={() => { setShowSendModal(false); fetchById(id) }}
        />
      )}

      {/* Reject modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-2xl">
            <h3 className="mb-4 text-lg font-semibold text-gray-900">Rechazar Cotizacion</h3>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Motivo del rechazo *</label>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              className="mb-4 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              placeholder="Describe el motivo..."
            />
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowRejectModal(false)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                Cerrar
              </button>
              <button onClick={handleReject} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700">
                Rechazar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-2xl">
            <h3 className="mb-4 text-lg font-semibold text-gray-900">Cancelar Cotizacion</h3>
            <p className="mb-4 text-sm text-gray-600">Esta accion no se puede deshacer.</p>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Motivo de cancelacion *</label>
            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              rows={3}
              className="mb-4 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              placeholder="Describe el motivo..."
            />
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowCancelModal(false)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                Cerrar
              </button>
              <button onClick={handleCancel} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700">
                Cancelar Cotizacion
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Convert modal */}
      {showConvertModal && (
        <ConvertModal
          quote={q}
          onClose={() => setShowConvertModal(false)}
          onSuccess={() => { setShowConvertModal(false); fetchById(id) }}
        />
      )}
    </div>
  )
}

// ─── SEND EMAIL MODAL ───────────────────────────────────────

function SendEmailModal({ quote, onClose, onSuccess }: {
  quote: Quote
  onClose: () => void
  onSuccess: () => void
}) {
  const toast = useToast()
  const { send } = useQuoteStore()
  const [to, setTo] = useState(quote.customerEmail || '')
  const [cc, setCc] = useState('')
  const [subject, setSubject] = useState(`Cotizacion ${quote.series}-${String(quote.folio).padStart(4, '0')} v${quote.version}`)
  const [body, setBody] = useState(
    `Estimado(a) ${quote.customerName},\n\nAdjunto encontrara nuestra cotizacion por un total de ${fmtMoney(quote.total)}.\n\nQuedamos a sus ordenes para cualquier duda.\n\nSaludos cordiales.`
  )
  const [attachPdf, setAttachPdf] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const handleSend = async () => {
    if (!to.trim()) return toast.warning('Ingresa un destinatario')
    setSubmitting(true)
    try {
      await send(quote.id, {
        to: to.trim(),
        cc: cc.trim() || undefined,
        subject: subject.trim(),
        body: body.trim(),
        attachPdf,
      })
      toast.success('Cotizacion enviada por correo')
      onSuccess()
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Error al enviar')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-lg rounded-xl border border-gray-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Enviar Cotizacion</h2>
          <button onClick={onClose} className="rounded p-1 hover:bg-gray-100"><X className="h-5 w-5 text-gray-500" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Para *</label>
            <input
              type="email"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              placeholder="email@ejemplo.com"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">CC</label>
            <input
              type="text"
              value={cc}
              onChange={(e) => setCc(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              placeholder="otro@ejemplo.com (separar con comas)"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Asunto *</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Mensaje</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={5}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={attachPdf} onChange={(e) => setAttachPdf(e.target.checked)} className="accent-primary-600" />
            Adjuntar PDF
          </label>
        </div>
        <div className="flex justify-end gap-3 border-t border-gray-200 px-6 py-4">
          <button onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
            Cancelar
          </button>
          <button
            onClick={handleSend}
            disabled={submitting}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Enviar
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── CONVERT MODAL ──────────────────────────────────────────

function ConvertModal({ quote, onClose, onSuccess }: {
  quote: Quote
  onClose: () => void
  onSuccess: () => void
}) {
  const toast = useToast()
  const navigate = useNavigate()
  const { convert } = useQuoteStore()
  const [target, setTarget] = useState<'ticket' | 'remission'>('ticket')
  const [paymentType, setPaymentType] = useState<'cash' | 'credit'>('cash')
  const [submitting, setSubmitting] = useState(false)

  const handleConvert = async () => {
    setSubmitting(true)
    try {
      const result = await convert(quote.id, target, paymentType)
      toast.success(`Cotizacion convertida a ${target === 'ticket' ? 'ticket' : 'remision'}`)
      onSuccess()
      if (result?.id) {
        if (target === 'ticket') {
          navigate(`/sales`)
        } else {
          navigate(`/remissions/${result.id}`)
        }
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Error al convertir')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-md rounded-xl border border-gray-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Convertir Cotizacion</h2>
          <button onClick={onClose} className="rounded p-1 hover:bg-gray-100"><X className="h-5 w-5 text-gray-500" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="rounded-lg bg-gray-50 p-3 text-center">
            <p className="text-xs text-gray-500">Cotizacion</p>
            <p className="font-bold text-gray-900">
              {quote.series}-{String(quote.folio).padStart(4, '0')} v{quote.version}
            </p>
            <p className="text-lg font-bold text-gray-900">{fmtMoney(quote.total)}</p>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Convertir a *</label>
            <div className="space-y-2">
              <label className="flex items-center gap-2 rounded-lg border border-gray-200 p-3 text-sm cursor-pointer hover:bg-gray-50">
                <input type="radio" checked={target === 'ticket'} onChange={() => setTarget('ticket')} className="accent-primary-600" />
                <div>
                  <p className="font-medium text-gray-900">Ticket de Venta</p>
                  <p className="text-xs text-gray-500">Generar un ticket de venta con los productos de esta cotizacion</p>
                </div>
              </label>
              <label className="flex items-center gap-2 rounded-lg border border-gray-200 p-3 text-sm cursor-pointer hover:bg-gray-50">
                <input type="radio" checked={target === 'remission'} onChange={() => setTarget('remission')} className="accent-primary-600" />
                <div>
                  <p className="font-medium text-gray-900">Nota de Remision</p>
                  <p className="text-xs text-gray-500">Generar una nota de remision con los productos de esta cotizacion</p>
                </div>
              </label>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Tipo de pago *</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" checked={paymentType === 'cash'} onChange={() => setPaymentType('cash')} className="accent-primary-600" />
                Contado
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" checked={paymentType === 'credit'} onChange={() => setPaymentType('credit')} className="accent-primary-600" />
                Credito
              </label>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-3 border-t border-gray-200 px-6 py-4">
          <button onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
            Cancelar
          </button>
          <button
            onClick={handleConvert}
            disabled={submitting}
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRightLeft className="h-4 w-4" />}
            Convertir
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── FORM (CREATE / EDIT) ──────────────────────────────────

interface FormItem {
  itemType: string
  productId?: string
  serviceId?: string
  itemName: string
  itemDescription: string
  itemSku: string
  quantity: number
  unitPrice: number
  discount: number
  taxRate: number
  groupName: string
  isOptional: boolean
  satCode: string
  satUnit: string
  notes: string
  sortOrder: number
}

const emptyItem = (): FormItem => ({
  itemType: 'product',
  itemName: '',
  itemDescription: '',
  itemSku: '',
  quantity: 1,
  unitPrice: 0,
  discount: 0,
  taxRate: 0,
  groupName: '',
  isOptional: false,
  satCode: '01010101',
  satUnit: 'E48',
  notes: '',
  sortOrder: 0,
})

function QuoteForm({ id }: { id?: string }) {
  const toast = useToast()
  const navigate = useNavigate()
  const { create, update, fetchById } = useQuoteStore()

  // Customer search
  const [customerQuery, setCustomerQuery] = useState('')
  const [customerResults, setCustomerResults] = useState<any[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null)
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false)
  const [manualCustomer, setManualCustomer] = useState(false)

  // Manual customer fields
  const [manualName, setManualName] = useState('')
  const [manualEmail, setManualEmail] = useState('')
  const [manualPhone, setManualPhone] = useState('')
  const [manualRfc, setManualRfc] = useState('')
  const [manualAddress, setManualAddress] = useState('')

  // Product search
  const [productQuery, setProductQuery] = useState('')
  const [productResults, setProductResults] = useState<any[]>([])
  const [showProductDropdown, setShowProductDropdown] = useState(false)

  // Form fields
  const [items, setItems] = useState<FormItem[]>([])
  const [conditions, setConditions] = useState('')
  const [notes, setNotes] = useState('')
  const [termsAndConditions, setTermsAndConditions] = useState('')
  const [validDays, setValidDays] = useState(30)
  const [salesPersonName, setSalesPersonName] = useState('')
  const [followUpDate, setFollowUpDate] = useState('')
  const [isTemplate, setIsTemplate] = useState(false)
  const [templateName, setTemplateName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [loadingForm, setLoadingForm] = useState(!!id)

  // Load existing for edit
  useEffect(() => {
    if (!id) return
    const load = async () => {
      try {
        const quote = await fetchById(id)
        if (quote.customerId) {
          setSelectedCustomer({
            id: quote.customerId,
            name: quote.customerName,
            email: quote.customerEmail,
            phone: quote.customerPhone,
            rfc: quote.customerRfc,
            address: quote.customerAddress,
          })
        } else {
          setManualCustomer(true)
          setManualName(quote.customerName || '')
          setManualEmail(quote.customerEmail || '')
          setManualPhone(quote.customerPhone || '')
          setManualRfc(quote.customerRfc || '')
          setManualAddress(quote.customerAddress || '')
        }
        setItems((quote.items || []).map((it: any) => ({
          itemType: it.itemType || 'product',
          productId: it.productId || undefined,
          serviceId: it.serviceId || undefined,
          itemName: it.itemName || '',
          itemDescription: it.itemDescription || '',
          itemSku: it.itemSku || '',
          quantity: parseFloat(it.quantity) || 1,
          unitPrice: parseFloat(it.unitPrice) || 0,
          discount: parseFloat(it.discount) || 0,
          taxRate: parseFloat(it.taxRate) ?? 0,
          groupName: it.groupName || '',
          isOptional: it.isOptional || false,
          satCode: it.satCode || '01010101',
          satUnit: it.satUnit || 'E48',
          notes: it.notes || '',
          sortOrder: it.sortOrder || 0,
        })))
        setConditions(quote.conditions || '')
        setNotes(quote.notes || '')
        setTermsAndConditions(quote.termsAndConditions || '')
        setValidDays(quote.validDays || 30)
        setSalesPersonName(quote.salesPersonName || '')
        setFollowUpDate(quote.followUpDate ? quote.followUpDate.slice(0, 10) : '')
        setIsTemplate(quote.isTemplate || false)
        setTemplateName(quote.templateName || '')
      } catch { /* handled by store */ }
      setLoadingForm(false)
    }
    load()
  }, [id, fetchById])

  // Customer search debounce
  useEffect(() => {
    if (customerQuery.length < 2) { setCustomerResults([]); return }
    const t = setTimeout(async () => {
      try {
        const { data } = await api.get('/api/customers', { params: { q: customerQuery, limit: 10 } })
        setCustomerResults(data.data || data || [])
        setShowCustomerDropdown(true)
      } catch { setCustomerResults([]) }
    }, 300)
    return () => clearTimeout(t)
  }, [customerQuery])

  // Product search debounce
  useEffect(() => {
    if (productQuery.length < 2) { setProductResults([]); return }
    const t = setTimeout(async () => {
      try {
        const { data } = await api.get('/api/products', { params: { q: productQuery, limit: 10 } })
        setProductResults(data.data || data || [])
        setShowProductDropdown(true)
      } catch { setProductResults([]) }
    }, 300)
    return () => clearTimeout(t)
  }, [productQuery])

  const selectCustomer = (c: any) => {
    setSelectedCustomer(c)
    setCustomerQuery('')
    setShowCustomerDropdown(false)
    setManualCustomer(false)
  }

  const addProduct = (p: any) => {
    const existing = items.findIndex((it) => it.productId === p.id)
    if (existing >= 0) {
      setItems(items.map((it, i) => i === existing ? { ...it, quantity: it.quantity + 1 } : it))
    } else {
      // Prices in DB are NET (tax-inclusive). Decompose into base price.
      const netPrice = parseFloat(p.price) || 0
      const prodTaxRate = parseFloat(p.taxRate) || 0
      const basePrice = prodTaxRate > 0 ? netPrice / (1 + prodTaxRate) : netPrice
      setItems([...items, {
        ...emptyItem(),
        itemType: 'product',
        productId: p.id,
        itemName: p.name,
        itemSku: p.sku || '',
        unitPrice: Math.round(basePrice * 100) / 100,
        taxRate: prodTaxRate,
        satCode: p.satCode || '01010101',
        satUnit: p.satUnit || 'E48',
        sortOrder: items.length,
      }])
    }
    setProductQuery('')
    setShowProductDropdown(false)
  }

  const addCustomItem = () => {
    setItems([...items, {
      ...emptyItem(),
      itemType: 'custom',
      sortOrder: items.length,
    }])
  }

  const updateItem = (idx: number, field: keyof FormItem, value: any) => {
    setItems(items.map((it, i) => i === idx ? { ...it, [field]: value } : it))
  }

  const removeItem = (idx: number) => {
    setItems(items.filter((_, i) => i !== idx))
  }

  const calcLineTotal = (it: FormItem) => it.quantity * it.unitPrice - it.discount
  const calcSubtotal = () => items.filter((it) => !it.isOptional).reduce((acc, it) => acc + calcLineTotal(it), 0)
  const calcTax = () => items.filter((it) => !it.isOptional).reduce((acc, it) => acc + calcLineTotal(it) * it.taxRate, 0)
  const calcTotal = () => calcSubtotal() + calcTax()

  const handleSave = async (andSend: boolean) => {
    const customerName = manualCustomer ? manualName : selectedCustomer?.name
    if (!customerName?.trim()) return toast.warning('Ingresa un cliente')
    if (items.length === 0) return toast.warning('Agrega al menos una partida')
    for (let i = 0; i < items.length; i++) {
      if (!items[i].itemName.trim()) return toast.warning(`La partida ${i + 1} requiere un nombre`)
    }

    setSubmitting(true)
    try {
      const payload: any = {
        customer_id: manualCustomer ? undefined : selectedCustomer?.id,
        customer_name: customerName,
        customer_email: (manualCustomer ? manualEmail : selectedCustomer?.email) || undefined,
        customer_phone: (manualCustomer ? manualPhone : selectedCustomer?.phone) || undefined,
        customer_rfc: (manualCustomer ? manualRfc : selectedCustomer?.rfc) || undefined,
        customer_address: (manualCustomer ? manualAddress : selectedCustomer?.address) || undefined,
        valid_days: validDays,
        conditions: conditions || undefined,
        notes: notes || undefined,
        terms_and_conditions: termsAndConditions || undefined,
        sales_person_name: salesPersonName || undefined,
        follow_up_date: followUpDate || undefined,
        is_template: isTemplate,
        template_name: isTemplate ? templateName || undefined : undefined,
        items: items.map((it, idx) => ({
          item_type: it.itemType,
          product_id: it.productId || undefined,
          service_id: it.serviceId || undefined,
          item_name: it.itemName,
          item_description: it.itemDescription || undefined,
          item_sku: it.itemSku || undefined,
          quantity: it.quantity,
          unit_price: it.unitPrice,
          discount: it.discount,
          tax_rate: it.taxRate,
          group_name: it.groupName || undefined,
          is_optional: it.isOptional,
          sat_code: it.satCode || undefined,
          sat_unit: it.satUnit || 'E48',
          notes: it.notes || undefined,
          sort_order: idx,
        })),
      }

      let quote: Quote
      if (id) {
        quote = await update(id, payload)
      } else {
        quote = await create(payload)
      }

      if (andSend) {
        toast.success(id ? 'Cotizacion actualizada' : 'Cotizacion creada')
        // Navigate to detail to use the send modal
        navigate(`/quotes/${quote.id}`)
      } else {
        toast.success(id ? 'Cotizacion actualizada' : 'Borrador guardado')
        navigate(`/quotes/${quote.id}`)
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Error al guardar')
    } finally {
      setSubmitting(false)
    }
  }

  if (loadingForm) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-gray-400" /></div>
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex items-center gap-3">
        <button onClick={() => navigate('/quotes')} className="rounded-lg p-2 hover:bg-gray-100">
          <ChevronLeft className="h-5 w-5 text-gray-500" />
        </button>
        <h1 className="text-2xl font-bold text-gray-900">
          {id ? 'Editar Cotizacion' : 'Nueva Cotizacion'}
        </h1>
      </div>

      {/* Customer */}
      <div className="mb-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <label className="text-sm font-medium text-gray-700">Cliente *</label>
          <button
            onClick={() => {
              setManualCustomer(!manualCustomer)
              setSelectedCustomer(null)
              setCustomerQuery('')
            }}
            className="text-xs text-primary-600 hover:text-primary-700"
          >
            {manualCustomer ? 'Buscar cliente existente' : 'Capturar manualmente'}
          </button>
        </div>

        {manualCustomer ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-gray-500">Nombre *</label>
              <input
                type="text"
                value={manualName}
                onChange={(e) => setManualName(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                placeholder="Nombre del cliente"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-500">Email</label>
              <input
                type="email"
                value={manualEmail}
                onChange={(e) => setManualEmail(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                placeholder="email@ejemplo.com"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-500">Telefono</label>
              <input
                type="text"
                value={manualPhone}
                onChange={(e) => setManualPhone(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                placeholder="(000) 000-0000"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-500">RFC</label>
              <input
                type="text"
                value={manualRfc}
                onChange={(e) => setManualRfc(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                placeholder="XAXX010101000"
              />
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-xs text-gray-500">Direccion</label>
              <input
                type="text"
                value={manualAddress}
                onChange={(e) => setManualAddress(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                placeholder="Calle, colonia, ciudad..."
              />
            </div>
          </div>
        ) : selectedCustomer ? (
          <div className="flex items-start justify-between rounded-lg border border-primary-200 bg-primary-50 p-4">
            <div>
              <p className="font-medium text-gray-900">{selectedCustomer.name}</p>
              {selectedCustomer.rfc && <p className="text-sm text-gray-600">RFC: {selectedCustomer.rfc}</p>}
              {selectedCustomer.email && <p className="text-sm text-gray-600">Email: {selectedCustomer.email}</p>}
              {selectedCustomer.phone && <p className="text-sm text-gray-600">Tel: {selectedCustomer.phone}</p>}
            </div>
            <button onClick={() => setSelectedCustomer(null)} className="rounded p-1 hover:bg-primary-100">
              <X className="h-4 w-4 text-gray-500" />
            </button>
          </div>
        ) : (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={customerQuery}
              onChange={(e) => setCustomerQuery(e.target.value)}
              onFocus={() => customerResults.length > 0 && setShowCustomerDropdown(true)}
              placeholder="Buscar cliente..."
              className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            />
            {showCustomerDropdown && customerResults.length > 0 && (
              <div className="absolute z-20 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg max-h-60 overflow-y-auto">
                {customerResults.map((c: any) => (
                  <button
                    key={c.id}
                    onClick={() => selectCustomer(c)}
                    className="w-full px-4 py-3 text-left text-sm hover:bg-gray-50 border-b border-gray-100 last:border-0"
                  >
                    <p className="font-medium text-gray-900">{c.name}</p>
                    <p className="text-xs text-gray-500">{c.rfc || 'Sin RFC'} {c.email ? `| ${c.email}` : ''}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Items */}
      <div className="mb-6 rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700">Partidas *</label>
            <button
              onClick={addCustomItem}
              className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700"
            >
              <Plus className="h-3.5 w-3.5" /> Partida personalizada
            </button>
          </div>
          <div className="relative mt-2">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={productQuery}
              onChange={(e) => setProductQuery(e.target.value)}
              onFocus={() => productResults.length > 0 && setShowProductDropdown(true)}
              placeholder="Buscar producto o servicio..."
              className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            />
            {showProductDropdown && productResults.length > 0 && (
              <div className="absolute z-20 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg max-h-60 overflow-y-auto">
                {productResults.map((p: any) => (
                  <button
                    key={p.id}
                    onClick={() => addProduct(p)}
                    className="w-full px-4 py-3 text-left text-sm hover:bg-gray-50 border-b border-gray-100 last:border-0"
                  >
                    <p className="font-medium text-gray-900">{p.name}</p>
                    <p className="text-xs text-gray-500">{p.sku || 'Sin SKU'} | {fmtMoney(p.price)}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {items.length > 0 && (
          <div className="divide-y divide-gray-100">
            {items.map((it, i) => (
              <div key={i} className="px-4 py-4">
                <div className="flex items-start gap-3">
                  <span className="mt-2 flex-shrink-0 text-xs text-gray-400">{i + 1}</span>
                  <div className="flex-1 space-y-3">
                    {/* Row 1: Name and type */}
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
                      <div className="md:col-span-6">
                        <input
                          type="text"
                          value={it.itemName}
                          onChange={(e) => updateItem(i, 'itemName', e.target.value)}
                          placeholder="Nombre del concepto *"
                          className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                        />
                      </div>
                      <div className="md:col-span-3">
                        <input
                          type="text"
                          value={it.groupName}
                          onChange={(e) => updateItem(i, 'groupName', e.target.value)}
                          placeholder="Grupo"
                          className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                        />
                      </div>
                      <div className="md:col-span-3 flex items-center">
                        <label className="flex items-center gap-2 text-sm text-gray-600">
                          <input
                            type="checkbox"
                            checked={it.isOptional}
                            onChange={(e) => updateItem(i, 'isOptional', e.target.checked)}
                            className="accent-primary-600"
                          />
                          Opcional
                        </label>
                      </div>
                    </div>

                    {/* Row 2: Quantity, Price, Discount */}
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                      <div>
                        <label className="mb-1 block text-xs text-gray-500">Cantidad</label>
                        <input
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={it.quantity}
                          onChange={(e) => updateItem(i, 'quantity', parseFloat(e.target.value) || 0)}
                          className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-right focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-gray-500">Precio unitario</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={it.unitPrice}
                          onChange={(e) => updateItem(i, 'unitPrice', parseFloat(e.target.value) || 0)}
                          className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-right focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-gray-500">Descuento</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={it.discount}
                          onChange={(e) => updateItem(i, 'discount', parseFloat(e.target.value) || 0)}
                          className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-right focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-gray-500">Total linea</label>
                        <div className="flex h-[42px] items-center justify-end rounded-lg bg-gray-50 px-3 text-sm font-medium text-gray-900">
                          {fmtMoney(calcLineTotal(it))}
                        </div>
                      </div>
                    </div>

                    {/* Row 3: Description (collapsible) */}
                    <div>
                      <input
                        type="text"
                        value={it.itemDescription}
                        onChange={(e) => updateItem(i, 'itemDescription', e.target.value)}
                        placeholder="Descripcion (opcional)"
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                      />
                    </div>
                  </div>
                  <button onClick={() => removeItem(i)} className="mt-2 flex-shrink-0 rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {items.length > 0 && (
          <div className="border-t border-gray-200 px-6 py-4 text-right space-y-1">
            <p className="text-sm text-gray-600">Subtotal: <span className="font-medium text-gray-900">{fmtMoney(calcSubtotal())}</span></p>
            <p className="text-sm text-gray-600">IVA: <span className="font-medium text-gray-900">{fmtMoney(calcTax())}</span></p>
            <p className="text-lg font-bold text-gray-900">Total: {fmtMoney(calcTotal())}</p>
            {items.some((it) => it.isOptional) && (
              <p className="text-xs text-yellow-600">
                * Las partidas opcionales no se incluyen en el total
              </p>
            )}
          </div>
        )}
      </div>

      {/* Conditions, Notes, Terms */}
      <div className="mb-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Dias de vigencia</label>
            <input
              type="number"
              min="1"
              value={validDays}
              onChange={(e) => setValidDays(parseInt(e.target.value) || 30)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Vendedor</label>
            <input
              type="text"
              value={salesPersonName}
              onChange={(e) => setSalesPersonName(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              placeholder="Nombre del vendedor"
            />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">Fecha de seguimiento</label>
          <input
            type="date"
            value={followUpDate}
            onChange={(e) => setFollowUpDate(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">Condiciones</label>
          <textarea
            value={conditions}
            onChange={(e) => setConditions(e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            placeholder="Condiciones comerciales..."
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">Notas</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            placeholder="Notas adicionales..."
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">Terminos y Condiciones</label>
          <textarea
            value={termsAndConditions}
            onChange={(e) => setTermsAndConditions(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            placeholder="Terminos y condiciones legales..."
          />
        </div>

        {/* Template */}
        <div className="border-t border-gray-200 pt-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isTemplate}
              onChange={(e) => setIsTemplate(e.target.checked)}
              className="accent-primary-600"
            />
            <span className="font-medium text-gray-700">Guardar como plantilla</span>
          </label>
          {isTemplate && (
            <input
              type="text"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="Nombre de la plantilla"
              className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            />
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-between">
        <button
          onClick={() => navigate('/quotes')}
          className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Cancelar
        </button>
        <div className="flex gap-3">
          <button
            onClick={() => handleSave(false)}
            disabled={submitting}
            className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Guardar borrador
          </button>
          <button
            onClick={() => handleSave(true)}
            disabled={submitting}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            <Send className="h-4 w-4" /> Guardar y Enviar
          </button>
        </div>
      </div>
    </div>
  )
}
