import { useEffect, useState, useCallback, useRef } from 'react'
import {
  DollarSign, Loader2, ChevronLeft, ChevronRight, X,
} from 'lucide-react'
import { api, useToast } from '@enlocal/react-hooks'
import { usePayableStore, type Payable } from '../stores/usePayableStore'

const fmtMoney = (v: string | number) => {
  const n = typeof v === 'string' ? parseFloat(v) : v
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n || 0)
}
const fmtDate = (d: string) => {
  if (!d) return ''
  return new Date(d).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
}

function StatusBadge({ payable }: { payable: Payable }) {
  const balance = parseFloat(payable.balance)
  const paid = parseFloat(payable.amountPaid)
  if (payable.status === 'paid') return <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700"><span className="h-1.5 w-1.5 rounded-full bg-green-500" />Pagada</span>
  if (payable.daysOverdue > 0) return <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700"><span className="h-1.5 w-1.5 rounded-full bg-red-600" />Vencida {payable.daysOverdue}d</span>
  if (paid > 0 && balance > 0) return <span className="inline-flex items-center gap-1.5 rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-700"><span className="h-1.5 w-1.5 rounded-full bg-yellow-500" />Parcial</span>
  return <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700"><span className="h-1.5 w-1.5 rounded-full bg-blue-500" />Vigente</span>
}

const PRIORITY_OPTIONS = [
  { value: 0, label: 'Normal', color: 'bg-gray-100 text-gray-700' },
  { value: 1, label: 'Baja', color: 'bg-blue-100 text-blue-700' },
  { value: 2, label: 'Media', color: 'bg-yellow-100 text-yellow-700' },
  { value: 3, label: 'Alta', color: 'bg-red-100 text-red-700' },
  { value: 4, label: 'Urgente', color: 'bg-red-200 text-red-800' },
]

function getPriorityOption(p: number) {
  if (p >= 4) return PRIORITY_OPTIONS[4]
  if (p >= 3) return PRIORITY_OPTIONS[3]
  if (p >= 2) return PRIORITY_OPTIONS[2]
  if (p >= 1) return PRIORITY_OPTIONS[1]
  return PRIORITY_OPTIONS[0]
}

function PriorityDropdown({ payableId, priority, onUpdated }: { payableId: string; priority: number; onUpdated: () => void }) {
  const toast = useToast()
  const { updatePriority } = usePayableStore()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const opt = getPriorityOption(priority)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleSelect = async (value: number) => {
    setOpen(false)
    try {
      await updatePriority(payableId, value)
      onUpdated()
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Error al actualizar prioridad')
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(!open) }}
        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${opt.color} cursor-pointer hover:opacity-80`}
      >
        {opt.label}
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-1 w-32 rounded-lg border border-gray-200 bg-white shadow-lg">
          {PRIORITY_OPTIONS.map((o) => (
            <button
              key={o.value}
              onClick={(e) => { e.stopPropagation(); handleSelect(o.value) }}
              className={`flex w-full items-center gap-2 px-3 py-1.5 text-xs hover:bg-gray-50 ${o.value === priority ? 'font-bold' : ''}`}
            >
              <span className={`h-2 w-2 rounded-full ${o.color.split(' ')[0]}`} />
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function PayablesPage() {
  const toast = useToast()
  const { payables, loading, pagination, fetchPayables } = usePayableStore()
  const [statusFilter, setStatusFilter] = useState('')
  const [overdueOnly, setOverdueOnly] = useState(false)
  const [page, setPage] = useState(1)
  const [selectedPayable, setSelectedPayable] = useState<Payable | null>(null)
  const [showPayment, setShowPayment] = useState(false)

  // Summary
  const totalBalance = payables.reduce((s, p) => s + parseFloat(p.balance), 0)
  const totalOverdue = payables.filter((p) => p.daysOverdue > 0).reduce((s, p) => s + parseFloat(p.balance), 0)

  const load = useCallback(() => {
    fetchPayables({
      status: statusFilter || undefined,
      overdue_only: overdueOnly ? 'true' : undefined,
      page,
      limit: 20,
    })
  }, [fetchPayables, statusFilter, overdueOnly, page])

  useEffect(() => { load() }, [load])

  const handleRowClick = async (payable: Payable) => {
    try {
      const { data } = await api.get(`/api/payables/${payable.id}`)
      setSelectedPayable(data.data || data)
    } catch { setSelectedPayable(payable) }
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <DollarSign className="h-6 w-6 text-gray-500" />
          <h1 className="text-2xl font-bold text-gray-900">Cuentas por Pagar</h1>
        </div>
        <div className="mt-2 flex gap-6 text-sm">
          <span className="text-gray-600">Total: <span className="font-bold text-gray-900">{fmtMoney(totalBalance)}</span></span>
          {totalOverdue > 0 && (
            <span className="text-red-600">Vencido: <span className="font-bold">{fmtMoney(totalOverdue)}</span></span>
          )}
          <span className="text-gray-500">{pagination.total} cuentas</span>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
          className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
        >
          <option value="">Todos los status</option>
          <option value="current">Vigente</option>
          <option value="overdue">Vencida</option>
          <option value="paid">Pagada</option>
        </select>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={overdueOnly} onChange={(e) => { setOverdueOnly(e.target.checked); setPage(1) }} className="accent-primary-600" />
          Solo vencidas
        </label>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-gray-400" /></div>
        ) : payables.length === 0 ? (
          <div className="py-20 text-center text-sm text-gray-500">No hay cuentas por pagar</div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-3 font-medium text-gray-600">Proveedor</th>
                <th className="px-4 py-3 font-medium text-gray-600 text-right">Total</th>
                <th className="px-4 py-3 font-medium text-gray-600 text-right">Pagado</th>
                <th className="px-4 py-3 font-medium text-gray-600 text-right">Saldo</th>
                <th className="px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="px-4 py-3 font-medium text-gray-600">Vence</th>
                <th className="px-4 py-3 font-medium text-gray-600">Prioridad</th>
              </tr>
            </thead>
            <tbody>
              {payables.map((p) => (
                <tr
                  key={p.id}
                  onClick={() => handleRowClick(p)}
                  className="cursor-pointer border-b border-gray-100 transition-colors hover:bg-gray-50"
                >
                  <td className="px-4 py-3 font-medium text-gray-900">{p.supplierName || '—'}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{fmtMoney(p.originalAmount)}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{fmtMoney(p.amountPaid)}</td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900">{fmtMoney(p.balance)}</td>
                  <td className="px-4 py-3"><StatusBadge payable={p} /></td>
                  <td className="px-4 py-3 text-gray-500">{fmtDate(p.dueDate)}</td>
                  <td className="px-4 py-3">
                    <PriorityDropdown payableId={p.id} priority={Number(p.priority) || 0} onUpdated={load} />
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
          <span>Pagina {pagination.page} de {pagination.pages}</span>
          <div className="flex gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 hover:bg-gray-50 disabled:opacity-50">
              <ChevronLeft className="h-4 w-4" /> Anterior
            </button>
            <button onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))} disabled={page >= pagination.pages} className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 hover:bg-gray-50 disabled:opacity-50">
              Siguiente <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Detail panel */}
      {selectedPayable && (
        <PayableDetail
          payable={selectedPayable}
          onClose={() => setSelectedPayable(null)}
          onPayment={() => { setShowPayment(true) }}
          onRefresh={() => { load(); setSelectedPayable(null) }}
        />
      )}

      {/* Payment modal */}
      {showPayment && selectedPayable && (
        <PaymentModal
          payable={selectedPayable}
          onClose={() => setShowPayment(false)}
          onSuccess={() => { setShowPayment(false); setSelectedPayable(null); load() }}
        />
      )}
    </div>
  )
}

function PayableDetail({ payable, onClose, onPayment, onRefresh }: {
  payable: Payable; onClose: () => void; onPayment: () => void; onRefresh: () => void
}) {
  const balance = parseFloat(payable.balance)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Detalle CxP — {payable.supplierName || 'N/A'}
          </h2>
          <button onClick={onClose} className="rounded p-1 hover:bg-gray-100"><X className="h-5 w-5 text-gray-500" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-500">Proveedor</p>
              <p className="font-medium text-gray-900">{payable.supplierName || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Status</p>
              <StatusBadge payable={payable} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-gray-500">Total original</p>
              <p className="font-medium text-gray-900">{fmtMoney(payable.originalAmount)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Pagado</p>
              <p className="font-medium text-green-700">{fmtMoney(payable.amountPaid)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Saldo pendiente</p>
              <p className="text-lg font-bold text-gray-900">{fmtMoney(payable.balance)}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-500">Fecha emision</p>
              <p className="text-sm text-gray-700">{fmtDate(payable.issuedDate)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Fecha vencimiento</p>
              <p className="text-sm text-gray-700">{fmtDate(payable.dueDate)}</p>
            </div>
          </div>
          <div>
            <p className="text-xs text-gray-500">Prioridad</p>
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${getPriorityOption(Number(payable.priority) || 0).color}`}>
              {getPriorityOption(Number(payable.priority) || 0).label}
            </span>
          </div>

          {/* Payments list */}
          {payable.payments && payable.payments.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-semibold text-gray-900">Historial de pagos</h3>
              <div className="rounded-lg border border-gray-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="px-3 py-2 text-left font-medium text-gray-600">Fecha</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-600">Monto</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-600">Metodo</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-600">Referencia</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payable.payments.map((p) => (
                      <tr key={p.id} className="border-b border-gray-100">
                        <td className="px-3 py-2 text-gray-600">{fmtDate(p.createdAt)}</td>
                        <td className="px-3 py-2 text-right font-medium text-green-700">{fmtMoney(p.amount)}</td>
                        <td className="px-3 py-2 text-gray-600">{p.paymentMethod}</td>
                        <td className="px-3 py-2 text-gray-500">{p.reference || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-3 border-t border-gray-200 px-6 py-4">
          <button onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
            Cerrar
          </button>
          {balance > 0 && (
            <button
              onClick={onPayment}
              className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
            >
              <DollarSign className="h-4 w-4" /> Registrar pago
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function PaymentModal({ payable, onClose, onSuccess }: {
  payable: Payable; onClose: () => void; onSuccess: () => void
}) {
  const toast = useToast()
  const { pay } = usePayableStore()
  const balance = parseFloat(payable.balance)
  const [amount, setAmount] = useState(balance)
  const [paymentMethod, setPaymentMethod] = useState('transfer')
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (amount <= 0) return toast.warning('El monto debe ser mayor a 0')
    if (amount > balance) return toast.warning('El monto no puede ser mayor al saldo')
    setSubmitting(true)
    try {
      await pay(payable.id, { amount, payment_method: paymentMethod, reference: reference || null, notes: notes || null })
      toast.success('Pago registrado exitosamente')
      onSuccess()
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Error al registrar pago')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-md rounded-xl border border-gray-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Registrar Pago</h2>
          <button onClick={onClose} className="rounded p-1 hover:bg-gray-100"><X className="h-5 w-5 text-gray-500" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="rounded-lg bg-gray-50 p-3 text-center">
            <p className="text-xs text-gray-500">Saldo pendiente</p>
            <p className="text-xl font-bold text-gray-900">{fmtMoney(balance)}</p>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Monto a pagar *</label>
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
                Pagar todo
              </button>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Metodo de pago *</label>
            <div className="space-y-2">
              {[
                { value: 'transfer', label: 'SPEI / Transferencia' },
                { value: 'cash', label: 'Efectivo' },
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
            Registrar pago
          </button>
        </div>
      </div>
    </div>
  )
}
