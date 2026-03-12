import { useEffect, useState, useCallback } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  Plus, Search, Loader2, ChevronLeft, ChevronRight, FileText, Printer,
  RotateCcw, X, Trash2, AlertTriangle, Check, Ban, DollarSign,
} from 'lucide-react'
import { api, useToast } from '@enlocal/react-hooks'
import { PinAuthModal } from '@enlocal/react-components'
import { useRemissionStore, type RemissionNote, type RemissionItem } from '../stores/useRemissionStore'
import { useCreditStore } from '../stores/useCreditStore'

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
  confirmed: { label: 'Confirmada', color: 'bg-blue-100 text-blue-700', dot: 'bg-blue-500' },
  prepared: { label: 'Surtida', color: 'bg-yellow-100 text-yellow-700', dot: 'bg-yellow-500' },
  delivered: { label: 'Entregada', color: 'bg-green-100 text-green-700', dot: 'bg-green-500' },
  returned_partial: { label: 'Dev. parcial', color: 'bg-orange-100 text-orange-700', dot: 'bg-orange-500' },
  returned_full: { label: 'Dev. total', color: 'bg-red-100 text-red-600', dot: 'bg-red-400' },
  cancelled: { label: 'Cancelada', color: 'bg-red-100 text-red-700', dot: 'bg-red-600' },
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

export default function RemissionsPage() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const mode = searchParams.get('mode') // 'new' | 'edit' | null
  const navigate = useNavigate()

  if (id && !mode) return <RemissionDetail id={id} />
  if (mode === 'new' || (id && mode === 'edit')) return <RemissionForm id={id} />
  return <RemissionList />
}

// ─── LIST VIEW ─────────────────────────────────────────────

function RemissionList() {
  const toast = useToast()
  const navigate = useNavigate()
  const { remissions, loading, pagination, fetchRemissions } = useRemissionStore()
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [paymentFilter, setPaymentFilter] = useState('')
  const [page, setPage] = useState(1)

  const load = useCallback(() => {
    fetchRemissions({
      q: query || undefined,
      status: statusFilter || undefined,
      payment_type: paymentFilter || undefined,
      page,
      limit: 20,
    })
  }, [fetchRemissions, query, statusFilter, paymentFilter, page])

  useEffect(() => { load() }, [load])

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notas de Remision</h1>
          <p className="mt-1 text-sm text-gray-500">{pagination.total} notas</p>
        </div>
        <button
          onClick={() => navigate('/remissions/new?mode=new')}
          className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700"
        >
          <Plus className="h-4 w-4" />
          Nueva Nota
        </button>
      </div>

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
          <option value="confirmed">Confirmada</option>
          <option value="prepared">Surtida</option>
          <option value="delivered">Entregada</option>
          <option value="cancelled">Cancelada</option>
        </select>
        <select
          value={paymentFilter}
          onChange={(e) => { setPaymentFilter(e.target.value); setPage(1) }}
          className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
        >
          <option value="">Tipo de pago</option>
          <option value="cash">Contado</option>
          <option value="credit">Credito</option>
        </select>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : remissions.length === 0 ? (
          <div className="py-20 text-center text-sm text-gray-500">
            No hay notas de remision
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-3 font-medium text-gray-600">Folio</th>
                <th className="px-4 py-3 font-medium text-gray-600">Cliente</th>
                <th className="px-4 py-3 font-medium text-gray-600">Tipo</th>
                <th className="px-4 py-3 font-medium text-gray-600 text-right">Total</th>
                <th className="px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="px-4 py-3 font-medium text-gray-600">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {remissions.map((r) => (
                <tr
                  key={r.id}
                  onClick={() => navigate(`/remissions/${r.id}`)}
                  className="cursor-pointer border-b border-gray-100 transition-colors hover:bg-gray-50"
                >
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {r.series}-{String(r.folio).padStart(4, '0')}
                  </td>
                  <td className="px-4 py-3 text-gray-700">{r.customerName}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {r.paymentType === 'credit' ? 'Credito' : 'Contado'}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900">
                    {fmtMoney(r.total)}
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                  <td className="px-4 py-3 text-gray-500">{fmtDate(r.createdAt)}</td>
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
            Mostrando pagina {pagination.page} de {pagination.pages} ({pagination.total} notas)
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

function RemissionDetail({ id }: { id: string }) {
  const toast = useToast()
  const navigate = useNavigate()
  const { currentRemission, fetchById, confirm, cancel, loading } = useRemissionStore()
  const { checkCredit, creditCheck, clearCheck } = useCreditStore()
  const [showCancel, setShowCancel] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [showReturnModal, setShowReturnModal] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [showPinAuth, setShowPinAuth] = useState(false)
  const [pinAuthAction, setPinAuthAction] = useState<'confirm' | 'cancel'>('confirm')

  useEffect(() => { fetchById(id) }, [id, fetchById])

  const r = currentRemission

  // Check credit when viewing a credit remission in draft
  useEffect(() => {
    if (r && r.paymentType === 'credit' && r.status === 'draft') {
      checkCredit(r.customerId, parseFloat(r.total))
    } else {
      clearCheck()
    }
  }, [r?.id, r?.status])

  if (loading || !r) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    )
  }

  const handleConfirm = async () => {
    // If credit warning, require PIN auth
    if (r.paymentType === 'credit' && creditCheck?.status === 'warning') {
      setPinAuthAction('confirm')
      setShowPinAuth(true)
      return
    }
    await doConfirm()
  }

  const doConfirm = async (authorizedPin?: string) => {
    try {
      if (authorizedPin) {
        // Send with authorized_pin to backend
        await api.post(`/api/remissions/${r.id}/confirm`, { authorized_pin: authorizedPin })
        useRemissionStore.setState((s) => ({
          remissions: s.remissions.map((rem) => (rem.id === r.id ? { ...rem, status: 'confirmed' } : rem)),
          currentRemission: s.currentRemission?.id === r.id ? { ...s.currentRemission, status: 'confirmed' } : s.currentRemission,
        }))
      } else {
        await confirm(r.id)
      }
      toast.success('Nota confirmada exitosamente')
      fetchById(id)
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Error al confirmar')
    }
  }

  const handleCancelClick = () => {
    // If prepared, require PIN auth before showing cancel modal
    if (r.status === 'prepared') {
      setPinAuthAction('cancel')
      setShowPinAuth(true)
      return
    }
    setShowCancel(true)
  }

  const handleCancel = async () => {
    if (!cancelReason.trim()) return toast.warning('Ingresa un motivo de cancelacion')
    try {
      await cancel(r.id, cancelReason)
      toast.success('Nota cancelada')
      setShowCancel(false)
      fetchById(id)
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Error al cancelar')
    }
  }

  const handlePinAuthorized = (_pin: string, authorizer: { id: string; name: string; role: string }) => {
    setShowPinAuth(false)
    if (pinAuthAction === 'confirm') {
      doConfirm(_pin)
    } else {
      toast.info(`Autorizado por ${authorizer.name}`)
      setShowCancel(true)
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/remissions')} className="rounded-lg p-2 hover:bg-gray-100">
            <ChevronLeft className="h-5 w-5 text-gray-500" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {r.series}-{String(r.folio).padStart(4, '0')}
            </h1>
            <p className="text-sm text-gray-500">Creada {fmtDateTime(r.createdAt)}</p>
          </div>
        </div>
        <StatusBadge status={r.status} />
      </div>

      {/* Info cards */}
      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="mb-2 text-xs font-semibold uppercase text-gray-500">Cliente</h3>
          <p className="font-medium text-gray-900">{r.customerName}</p>
          {r.customerRfc && <p className="text-sm text-gray-600">RFC: {r.customerRfc}</p>}
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="mb-2 text-xs font-semibold uppercase text-gray-500">Pago</h3>
          <p className="font-medium text-gray-900">
            {r.paymentType === 'credit' ? `Credito ${r.creditDays || 0} dias` : 'Contado'}
          </p>
          {r.dueDate && <p className="text-sm text-gray-600">Vence: {fmtDate(r.dueDate)}</p>}
          <p className="mt-1 text-lg font-bold text-gray-900">{fmtMoney(r.total)}</p>
        </div>
      </div>

      {/* Items table */}
      <div className="mb-6 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-gray-200 px-6 py-4">
          <FileText className="h-4 w-4 text-gray-500" />
          <h2 className="text-sm font-semibold text-gray-900">Productos</h2>
        </div>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="px-4 py-3 font-medium text-gray-600">Producto</th>
              <th className="px-4 py-3 font-medium text-gray-600 text-right">Cant</th>
              <th className="px-4 py-3 font-medium text-gray-600 text-right">Surtido</th>
              <th className="px-4 py-3 font-medium text-gray-600 text-right">Entregado</th>
              <th className="px-4 py-3 font-medium text-gray-600 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {(r.items || []).map((item: any, i: number) => (
              <tr key={item.id || i} className="border-b border-gray-100">
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-900">{item.productName}</p>
                  {item.productSku && <p className="text-xs text-gray-500">SKU: {item.productSku}</p>}
                </td>
                <td className="px-4 py-3 text-right text-gray-700">{parseFloat(item.quantity)}</td>
                <td className="px-4 py-3 text-right text-gray-700">{parseFloat(item.quantityPrepared || 0)}</td>
                <td className="px-4 py-3 text-right text-gray-700">{parseFloat(item.quantityDelivered || 0)}</td>
                <td className="px-4 py-3 text-right font-medium text-gray-900">{fmtMoney(item.total)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-gray-50">
              <td colSpan={4} className="px-4 py-3 text-right text-sm font-medium text-gray-600">Subtotal:</td>
              <td className="px-4 py-3 text-right font-medium text-gray-900">{fmtMoney(r.subtotal)}</td>
            </tr>
            {parseFloat(r.discountAmount) > 0 && (
              <tr className="bg-gray-50">
                <td colSpan={4} className="px-4 py-3 text-right text-sm font-medium text-gray-600">Descuento:</td>
                <td className="px-4 py-3 text-right font-medium text-red-600">-{fmtMoney(r.discountAmount)}</td>
              </tr>
            )}
            <tr className="bg-gray-50">
              <td colSpan={4} className="px-4 py-3 text-right text-sm font-medium text-gray-600">IVA:</td>
              <td className="px-4 py-3 text-right font-medium text-gray-900">{fmtMoney(r.taxAmount)}</td>
            </tr>
            <tr className="bg-gray-50 border-t border-gray-200">
              <td colSpan={4} className="px-4 py-3 text-right text-sm font-bold text-gray-900">Total:</td>
              <td className="px-4 py-3 text-right text-lg font-bold text-gray-900">{fmtMoney(r.total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Delivery info */}
      {(r.deliveredAt || r.deliveryAddress) && (
        <div className="mb-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="mb-2 text-xs font-semibold uppercase text-gray-500">Entrega</h3>
          {r.deliveryAddress && <p className="text-sm text-gray-700">{r.deliveryAddress}</p>}
          {r.deliveredAt && <p className="mt-1 text-sm text-gray-600">Entregado: {fmtDateTime(r.deliveredAt)}</p>}
          {r.receivedBy && <p className="text-sm text-gray-600">Recibio: {r.receivedBy}</p>}
          {r.receivedIdDoc && <p className="text-sm text-gray-600">ID: {r.receivedIdDoc}</p>}
        </div>
      )}

      {/* History */}
      {r.history && r.history.length > 0 && (
        <div className="mb-6 rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-6 py-4">
            <h3 className="text-sm font-semibold text-gray-900">Historial</h3>
          </div>
          <div className="p-4">
            {r.history.map((h: any, i: number) => (
              <div key={i} className="flex items-start gap-3 py-2 text-sm">
                <span className="min-w-[110px] text-gray-500">{fmtDateTime(h.createdAt)}</span>
                <span className="text-gray-700">{h.changedByName} ({h.changedByRole})</span>
                <span className="text-gray-500">{h.fromStatus || '—'} → {h.toStatus}</span>
                {h.notes && <span className="text-gray-400 italic">— {h.notes}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        {r.status === 'draft' && (
          <>
            <button
              onClick={() => navigate(`/remissions/${r.id}?mode=edit`)}
              className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Editar
            </button>
            <button
              onClick={handleConfirm}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
            >
              <Check className="h-4 w-4" /> Confirmar
            </button>
          </>
        )}
        {['draft', 'confirmed', 'prepared'].includes(r.status) && (
          <button
            onClick={handleCancelClick}
            className="flex items-center gap-2 rounded-lg border border-red-300 px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50"
          >
            <Ban className="h-4 w-4" /> Cancelar
          </button>
        )}
        {r.status === 'delivered' && (
          <button
            onClick={() => setShowReturnModal(true)}
            className="flex items-center gap-2 rounded-lg border border-orange-300 px-4 py-2.5 text-sm font-medium text-orange-600 hover:bg-orange-50"
          >
            <RotateCcw className="h-4 w-4" /> Solicitar devolucion
          </button>
        )}
        {r.paymentType === 'credit' && ['confirmed', 'prepared', 'delivered'].includes(r.status) && (
          <button
            onClick={() => setShowPaymentModal(true)}
            className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-700"
          >
            <DollarSign className="h-4 w-4" /> Registrar cobro
          </button>
        )}
        {r.status !== 'draft' && (
          <button
            onClick={async () => {
              try {
                const resp = await api.get(`/api/remissions/${r.id}/pdf`, { responseType: 'blob' })
                const url = URL.createObjectURL(resp.data)
                window.open(url, '_blank')
              } catch {
                toast.error('Error al generar PDF')
              }
            }}
            className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <Printer className="h-4 w-4" /> Imprimir PDF
          </button>
        )}
      </div>

      {/* Cancel modal */}
      {showCancel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-2xl">
            <h3 className="mb-4 text-lg font-semibold text-gray-900">Cancelar Nota</h3>
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
              <button onClick={() => setShowCancel(false)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                Cerrar
              </button>
              <button onClick={handleCancel} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700">
                Cancelar Nota
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Return request modal */}
      {showReturnModal && (
        <ReturnRequestModal
          remission={r}
          onClose={() => setShowReturnModal(false)}
          onSuccess={() => { setShowReturnModal(false); fetchById(id) }}
        />
      )}

      {/* PIN authorization modal */}
      <PinAuthModal
        isOpen={showPinAuth}
        onClose={() => setShowPinAuth(false)}
        onAuthorize={handlePinAuthorized}
        reason={
          pinAuthAction === 'confirm'
            ? 'Se requiere autorizacion para confirmar esta nota con credito excedido'
            : 'Se requiere autorizacion para cancelar una nota ya surtida'
        }
      />

      {/* Quick payment modal */}
      {showPaymentModal && r.ticketId && (
        <QuickPaymentModal
          remission={r}
          onClose={() => setShowPaymentModal(false)}
          onSuccess={() => { setShowPaymentModal(false); fetchById(id) }}
        />
      )}
    </div>
  )
}

// ─── QUICK PAYMENT MODAL ──────────────────────────────────

function QuickPaymentModal({ remission, onClose, onSuccess }: {
  remission: RemissionNote
  onClose: () => void
  onSuccess: () => void
}) {
  const toast = useToast()
  const [receivable, setReceivable] = useState<any>(null)
  const [loadingRec, setLoadingRec] = useState(true)
  const [amount, setAmount] = useState(0)
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await api.get('/api/receivables', { params: { customer_id: remission.customerId, limit: 50 } })
        const items = data.data || data.items || []
        // Find the receivable linked to this remission
        const rec = items.find((r: any) => r.remissionNoteId === remission.id)
        if (rec) {
          setReceivable(rec)
          setAmount(parseFloat(rec.balance))
        } else {
          toast.error('No se encontro cuenta por cobrar para esta remision')
        }
      } catch {
        toast.error('Error al cargar cuenta por cobrar')
      }
      setLoadingRec(false)
    }
    load()
  }, [remission.id])

  const balance = receivable ? parseFloat(receivable.balance) : 0

  const handleSubmit = async () => {
    if (!receivable) return
    if (amount <= 0) return toast.warning('El monto debe ser mayor a 0')
    if (amount > balance) return toast.warning('El monto no puede ser mayor al saldo')
    setSubmitting(true)
    try {
      await api.post(`/api/receivables/${receivable.id}/payment`, {
        amount,
        payment_method: paymentMethod,
        reference: reference || undefined,
        notes: notes || undefined,
        emit_complement: false,
      })
      toast.success('Cobro registrado exitosamente')
      onSuccess()
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Error al registrar cobro')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-md rounded-xl border border-gray-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Registrar Cobro</h2>
          <button onClick={onClose} className="rounded p-1 hover:bg-gray-100"><X className="h-5 w-5 text-gray-500" /></button>
        </div>

        {loadingRec ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : !receivable ? (
          <div className="p-6 text-center text-sm text-gray-500">
            No hay cuenta por cobrar asociada a esta remision
          </div>
        ) : (
          <>
            <div className="p-6 space-y-4">
              <div className="rounded-lg bg-gray-50 p-3 text-center">
                <p className="text-xs text-gray-500">Saldo pendiente</p>
                <p className="text-xl font-bold text-gray-900">{fmtMoney(balance)}</p>
                <p className="text-xs text-gray-400 mt-1">
                  {remission.series}-{String(remission.folio).padStart(4, '0')} — {remission.customerName}
                </p>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Monto a cobrar *</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min="0.01"
                    max={balance}
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                    className="flex-1 rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                  />
                  <button
                    onClick={() => setAmount(balance)}
                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    Todo
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Metodo de pago *</label>
                <div className="space-y-2">
                  {[
                    { value: 'cash', label: 'Efectivo' },
                    { value: 'transfer', label: 'SPEI / Transferencia' },
                    { value: 'debit_card', label: 'Tarjeta debito' },
                    { value: 'credit_card', label: 'Tarjeta credito' },
                    { value: 'check', label: 'Cheque' },
                  ].map((m) => (
                    <label key={m.value} className="flex items-center gap-2 text-sm">
                      <input type="radio" checked={paymentMethod === m.value} onChange={() => setPaymentMethod(m.value)} className="accent-primary-600" />
                      {m.label}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Referencia</label>
                <input
                  type="text"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                  placeholder="No. de transferencia, cheque, etc."
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Notas</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-gray-200 px-6 py-4">
              <button onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                Cancelar
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                <DollarSign className="h-4 w-4" /> Registrar cobro
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ─── RETURN REQUEST MODAL ──────────────────────────────────

function ReturnRequestModal({ remission, onClose, onSuccess }: {
  remission: RemissionNote
  onClose: () => void
  onSuccess: () => void
}) {
  const toast = useToast()
  const [returnType, setReturnType] = useState<'partial' | 'total'>('partial')
  const [reasonCategory, setReasonCategory] = useState('defective')
  const [reason, setReason] = useState('')
  const [items, setItems] = useState<{ remissionItemId: string; productId: string; productName: string; quantityDelivered: number; quantityRequested: number; unitPrice: number; selected: boolean }[]>(
    (remission.items || []).map((it: any) => ({
      remissionItemId: it.id,
      productId: it.productId,
      productName: it.productName,
      quantityDelivered: parseFloat(it.quantityDelivered || it.quantity),
      quantityRequested: 0,
      unitPrice: parseFloat(it.unitPrice),
      selected: false,
    }))
  )
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!reason.trim()) return toast.warning('Ingresa el detalle del motivo')
    const selected = items.filter((it) => it.selected && it.quantityRequested > 0)
    if (selected.length === 0) return toast.warning('Selecciona al menos un producto')

    setSubmitting(true)
    try {
      await api.post('/api/returns', {
        remissionNoteId: remission.id,
        returnType,
        reasonCategory,
        reason,
        items: selected.map((it) => ({
          remissionItemId: it.remissionItemId,
          productId: it.productId,
          productName: it.productName,
          quantityRequested: it.quantityRequested,
          unitPrice: it.unitPrice,
        })),
      })
      toast.success('Solicitud de devolucion enviada')
      onSuccess()
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Error al solicitar devolucion')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Solicitar Devolucion — {remission.series}-{String(remission.folio).padStart(4, '0')}
          </h2>
          <button onClick={onClose} className="rounded p-1 hover:bg-gray-100"><X className="h-5 w-5 text-gray-500" /></button>
        </div>
        <div className="p-6 space-y-4">
          {/* Type */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Tipo</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" checked={returnType === 'partial'} onChange={() => setReturnType('partial')} className="accent-primary-600" />
                Parcial
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" checked={returnType === 'total'} onChange={() => setReturnType('total')} className="accent-primary-600" />
                Total
              </label>
            </div>
          </div>

          {/* Reason */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Motivo</label>
            <select
              value={reasonCategory}
              onChange={(e) => setReasonCategory(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            >
              <option value="defective">Producto defectuoso</option>
              <option value="wrong_product">Producto equivocado</option>
              <option value="excess">Excedente</option>
              <option value="client_cancellation">Cancelacion del cliente</option>
              <option value="other">Otro</option>
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Detalle *</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              placeholder="Describe el motivo..."
            />
          </div>

          {/* Items */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Productos a devolver</label>
            <div className="rounded-lg border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="px-3 py-2 text-left font-medium text-gray-600">Producto</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-600">Entregado</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-600">A devolver</th>
                    <th className="px-3 py-2 text-center font-medium text-gray-600 w-10" />
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, i) => (
                    <tr key={i} className="border-b border-gray-100">
                      <td className="px-3 py-2 text-gray-700">{it.productName}</td>
                      <td className="px-3 py-2 text-right text-gray-600">{it.quantityDelivered}</td>
                      <td className="px-3 py-2 text-right">
                        <input
                          type="number"
                          min="0"
                          max={it.quantityDelivered}
                          value={it.quantityRequested}
                          onChange={(e) => {
                            const val = Math.min(parseFloat(e.target.value) || 0, it.quantityDelivered)
                            setItems((prev) => prev.map((p, j) => j === i ? { ...p, quantityRequested: val, selected: val > 0 } : p))
                          }}
                          className="w-20 rounded border border-gray-300 px-2 py-1 text-right text-sm focus:border-primary-500 focus:outline-none"
                        />
                      </td>
                      <td className="px-3 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={it.selected}
                          onChange={(e) => setItems((prev) => prev.map((p, j) => j === i ? { ...p, selected: e.target.checked, quantityRequested: e.target.checked ? it.quantityDelivered : 0 } : p))}
                          className="accent-primary-600"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-3 border-t border-gray-200 px-6 py-4">
          <button onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-50"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Enviar solicitud
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── FORM (CREATE / EDIT) ──────────────────────────────────

interface FormItem {
  productId: string
  productName: string
  productSku: string
  quantity: number
  unitPrice: number
  discount: number
  taxRate: number
  satCode: string
  satUnit: string
}

function RemissionForm({ id }: { id?: string }) {
  const toast = useToast()
  const navigate = useNavigate()
  const { create, update, fetchById } = useRemissionStore()
  const { checkCredit, creditCheck, clearCheck } = useCreditStore()

  // Customer search
  const [customerQuery, setCustomerQuery] = useState('')
  const [customerResults, setCustomerResults] = useState<any[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null)
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false)

  // Product search
  const [productQuery, setProductQuery] = useState('')
  const [productResults, setProductResults] = useState<any[]>([])
  const [showProductDropdown, setShowProductDropdown] = useState(false)

  // Form fields
  const [paymentType, setPaymentType] = useState<'cash' | 'credit'>('cash')
  const [items, setItems] = useState<FormItem[]>([])
  const [deliveryAddress, setDeliveryAddress] = useState('')
  const [deliveryNotes, setDeliveryNotes] = useState('')
  const [internalNotes, setInternalNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [loadingForm, setLoadingForm] = useState(!!id)
  const [showFormPinAuth, setShowFormPinAuth] = useState(false)
  const [pendingNoteId, setPendingNoteId] = useState<string | null>(null)

  // Load existing for edit
  useEffect(() => {
    if (!id) return
    const load = async () => {
      try {
        const note = await fetchById(id)
        setSelectedCustomer({ id: note.customerId, name: note.customerName, rfc: note.customerRfc })
        setPaymentType(note.paymentType === 'credit' ? 'credit' : 'cash')
        setItems((note.items || []).map((it: any) => ({
          productId: it.productId,
          productName: it.productName,
          productSku: it.productSku || '',
          quantity: parseFloat(it.quantity),
          unitPrice: parseFloat(it.unitPrice),
          discount: parseFloat(it.discount || 0),
          taxRate: parseFloat(it.taxRate),
          satCode: it.satCode || '',
          satUnit: it.satUnit || 'E48',
        })))
        setDeliveryAddress(note.deliveryAddress || '')
        setDeliveryNotes(note.deliveryNotes || '')
        setInternalNotes(note.internalNotes || '')
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

  // Credit check when customer selected + payment type credit
  useEffect(() => {
    if (selectedCustomer && paymentType === 'credit') {
      const total = calcTotal()
      checkCredit(selectedCustomer.id, total)
    } else {
      clearCheck()
    }
  }, [selectedCustomer?.id, paymentType])

  const selectCustomer = (c: any) => {
    setSelectedCustomer(c)
    setCustomerQuery('')
    setShowCustomerDropdown(false)
    if (c.creditEnabled && c.creditDays > 0) {
      setPaymentType('credit')
    }
  }

  const addProduct = (p: any) => {
    const existing = items.find((it) => it.productId === p.id)
    if (existing) {
      setItems(items.map((it) => it.productId === p.id ? { ...it, quantity: it.quantity + 1 } : it))
    } else {
      // Prices in DB are NET (tax-inclusive). Decompose into base price.
      const netPrice = parseFloat(p.price) || 0
      const prodTaxRate = parseFloat(p.taxRate) || 0
      const basePrice = prodTaxRate > 0 ? netPrice / (1 + prodTaxRate) : netPrice
      setItems([...items, {
        productId: p.id,
        productName: p.name,
        productSku: p.sku || '',
        quantity: 1,
        unitPrice: Math.round(basePrice * 100) / 100,
        discount: 0,
        taxRate: prodTaxRate,
        satCode: p.satCode || '01010101',
        satUnit: p.satUnit || 'E48',
      }])
    }
    setProductQuery('')
    setShowProductDropdown(false)
  }

  const updateItem = (idx: number, field: keyof FormItem, value: any) => {
    setItems(items.map((it, i) => i === idx ? { ...it, [field]: value } : it))
  }

  const removeItem = (idx: number) => {
    setItems(items.filter((_, i) => i !== idx))
  }

  const calcSubtotal = () => items.reduce((acc, it) => acc + (it.quantity * it.unitPrice - it.discount), 0)
  const calcTax = () => items.reduce((acc, it) => acc + (it.quantity * it.unitPrice - it.discount) * it.taxRate, 0)
  const calcTotal = () => calcSubtotal() + calcTax()

  const handleSave = async (andConfirm: boolean) => {
    if (!selectedCustomer) return toast.warning('Selecciona un cliente')
    if (items.length === 0) return toast.warning('Agrega al menos un producto')

    if (andConfirm && creditCheck?.status === 'blocked') {
      return toast.error(creditCheck.message || 'Credito bloqueado')
    }

    setSubmitting(true)
    try {
      const payload = {
        customer_id: selectedCustomer.id,
        payment_type: paymentType,
        delivery_address: deliveryAddress || undefined,
        delivery_notes: deliveryNotes || undefined,
        internal_notes: internalNotes || undefined,
        items: items.map((it) => ({
          product_id: it.productId,
          quantity: it.quantity,
          unit_price: it.unitPrice,
          discount: it.discount,
        })),
      }

      let note: RemissionNote
      if (id) {
        note = await update(id, payload)
      } else {
        note = await create(payload)
      }

      if (andConfirm) {
        // If credit warning, require PIN auth before confirming
        if (creditCheck?.status === 'warning') {
          setPendingNoteId(note.id)
          setShowFormPinAuth(true)
          setSubmitting(false)
          return
        }
        const { confirm } = useRemissionStore.getState()
        await confirm(note.id)
        toast.success('Nota confirmada exitosamente')
      } else {
        toast.success(id ? 'Nota actualizada' : 'Borrador guardado')
      }
      navigate(`/remissions/${note.id}`)
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
        <button onClick={() => navigate('/remissions')} className="rounded-lg p-2 hover:bg-gray-100">
          <ChevronLeft className="h-5 w-5 text-gray-500" />
        </button>
        <h1 className="text-2xl font-bold text-gray-900">
          {id ? 'Editar Nota de Remision' : 'Nueva Nota de Remision'}
        </h1>
      </div>

      {/* Customer */}
      <div className="mb-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <label className="mb-1.5 block text-sm font-medium text-gray-700">Cliente *</label>
        {selectedCustomer ? (
          <div className="flex items-start justify-between rounded-lg border border-primary-200 bg-primary-50 p-4">
            <div>
              <p className="font-medium text-gray-900">{selectedCustomer.name}</p>
              {selectedCustomer.rfc && <p className="text-sm text-gray-600">RFC: {selectedCustomer.rfc}</p>}
              {selectedCustomer.phone && <p className="text-sm text-gray-600">Tel: {selectedCustomer.phone}</p>}
              {selectedCustomer.creditEnabled && (
                <p className="mt-1 text-sm text-green-700">
                  Credito: Habilitado | Limite: {fmtMoney(selectedCustomer.creditLimit || 0)} | Dias: {selectedCustomer.creditDays || 0}
                </p>
              )}
            </div>
            <button onClick={() => { setSelectedCustomer(null); clearCheck() }} className="rounded p-1 hover:bg-primary-100">
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
                    <p className="text-xs text-gray-500">{c.rfc || 'Sin RFC'} {c.phone ? `| ${c.phone}` : ''}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Payment type */}
      <div className="mb-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <label className="mb-1.5 block text-sm font-medium text-gray-700">Tipo de Pago *</label>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" checked={paymentType === 'cash'} onChange={() => setPaymentType('cash')} className="accent-primary-600" />
            Contado
          </label>
          {selectedCustomer?.creditEnabled && (
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" checked={paymentType === 'credit'} onChange={() => setPaymentType('credit')} className="accent-primary-600" />
              Credito {selectedCustomer.creditDays || 30} dias
            </label>
          )}
        </div>
        {paymentType === 'credit' && creditCheck && (
          <div className={`mt-3 rounded-lg p-3 text-sm ${
            creditCheck.status === 'blocked' ? 'bg-red-50 text-red-700 border border-red-200' :
            creditCheck.status === 'warning' ? 'bg-yellow-50 text-yellow-700 border border-yellow-200' :
            'bg-green-50 text-green-700 border border-green-200'
          }`}>
            {creditCheck.status === 'blocked' && <AlertTriangle className="inline h-4 w-4 mr-1" />}
            Credito disponible: {fmtMoney(creditCheck.available)}
            {creditCheck.message && <span className="ml-2">— {creditCheck.message}</span>}
          </div>
        )}
      </div>

      {/* Products */}
      <div className="mb-6 rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-6 py-4">
          <label className="text-sm font-medium text-gray-700">Productos *</label>
          <div className="relative mt-2">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={productQuery}
              onChange={(e) => setProductQuery(e.target.value)}
              onFocus={() => productResults.length > 0 && setShowProductDropdown(true)}
              placeholder="Buscar producto..."
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
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-4 py-3 text-left font-medium text-gray-600">#</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Producto</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">Cant</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">P.Unit</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">Desc</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">Total</th>
                  <th className="px-4 py-3 w-10" />
                </tr>
              </thead>
              <tbody>
                {items.map((it, i) => {
                  const lineTotal = it.quantity * it.unitPrice - it.discount
                  return (
                    <tr key={i} className="border-b border-gray-100">
                      <td className="px-4 py-2 text-gray-500">{i + 1}</td>
                      <td className="px-4 py-2 text-gray-700">{it.productName}</td>
                      <td className="px-4 py-2 text-right">
                        <input
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={it.quantity}
                          onChange={(e) => updateItem(i, 'quantity', parseFloat(e.target.value) || 0)}
                          className="w-20 rounded border border-gray-300 px-2 py-1 text-right text-sm focus:border-primary-500 focus:outline-none"
                        />
                      </td>
                      <td className="px-4 py-2 text-right">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={it.unitPrice}
                          onChange={(e) => updateItem(i, 'unitPrice', parseFloat(e.target.value) || 0)}
                          className="w-24 rounded border border-gray-300 px-2 py-1 text-right text-sm focus:border-primary-500 focus:outline-none"
                        />
                      </td>
                      <td className="px-4 py-2 text-right">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={it.discount}
                          onChange={(e) => updateItem(i, 'discount', parseFloat(e.target.value) || 0)}
                          className="w-20 rounded border border-gray-300 px-2 py-1 text-right text-sm focus:border-primary-500 focus:outline-none"
                        />
                      </td>
                      <td className="px-4 py-2 text-right font-medium text-gray-900">{fmtMoney(lineTotal)}</td>
                      <td className="px-4 py-2">
                        <button onClick={() => removeItem(i)} className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {items.length > 0 && (
          <div className="border-t border-gray-200 px-6 py-4 text-right space-y-1">
            <p className="text-sm text-gray-600">Subtotal: <span className="font-medium text-gray-900">{fmtMoney(calcSubtotal())}</span></p>
            <p className="text-sm text-gray-600">IVA: <span className="font-medium text-gray-900">{fmtMoney(calcTax())}</span></p>
            <p className="text-lg font-bold text-gray-900">Total: {fmtMoney(calcTotal())}</p>
          </div>
        )}
      </div>

      {/* Additional fields */}
      <div className="mb-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">Direccion de entrega</label>
          <input
            type="text"
            value={deliveryAddress}
            onChange={(e) => setDeliveryAddress(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            placeholder="Calle, colonia, ciudad..."
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">Notas de entrega</label>
          <textarea
            value={deliveryNotes}
            onChange={(e) => setDeliveryNotes(e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            placeholder="Instrucciones de entrega..."
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">Notas internas (no visibles al cliente)</label>
          <textarea
            value={internalNotes}
            onChange={(e) => setInternalNotes(e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            placeholder="Notas internas..."
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-between">
        <button
          onClick={() => navigate('/remissions')}
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
            disabled={submitting || (paymentType === 'credit' && creditCheck?.status === 'blocked')}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            <Check className="h-4 w-4" /> Confirmar
          </button>
        </div>
      </div>

      {/* PIN auth for credit warning confirm */}
      <PinAuthModal
        isOpen={showFormPinAuth}
        onClose={() => { setShowFormPinAuth(false); setPendingNoteId(null) }}
        onAuthorize={async (pin) => {
          setShowFormPinAuth(false)
          if (pendingNoteId) {
            try {
              await api.post(`/api/remissions/${pendingNoteId}/confirm`, { authorized_pin: pin })
              toast.success('Nota confirmada exitosamente')
              navigate(`/remissions/${pendingNoteId}`)
            } catch (err: any) {
              toast.error(err?.response?.data?.error || 'Error al confirmar')
            }
          }
          setPendingNoteId(null)
        }}
        reason="Se requiere autorizacion para confirmar nota con credito excedido"
      />
    </div>
  )
}
