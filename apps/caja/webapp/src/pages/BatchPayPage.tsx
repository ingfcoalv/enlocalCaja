import { useEffect, useState, useCallback } from 'react'
import {
  DollarSign, Loader2, X, CheckCircle, ChevronLeft,
} from 'lucide-react'
import { api, useToast } from '@enlocal/react-hooks'
import { usePayableStore, type Payable } from '../stores/usePayableStore'
import { useNavigate } from 'react-router-dom'

const fmtMoney = (v: string | number) => {
  const n = typeof v === 'string' ? parseFloat(v) : v
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n || 0)
}
const fmtDate = (d: string) => {
  if (!d) return ''
  return new Date(d).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
}

const PAYMENT_METHODS = [
  { value: 'transfer', label: 'Transferencia / SPEI' },
  { value: 'cash', label: 'Efectivo' },
  { value: 'check', label: 'Cheque' },
  { value: 'credit_card', label: 'Tarjeta de credito' },
  { value: 'debit_card', label: 'Tarjeta de debito' },
  { value: 'spei', label: 'SPEI' },
]

export default function BatchPayPage() {
  const toast = useToast()
  const navigate = useNavigate()
  const { payables, loading, fetchPayables, batchPay } = usePayableStore()
  const [selected, setSelected] = useState<Record<string, number>>({})
  const [paymentMethod, setPaymentMethod] = useState('transfer')
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  useEffect(() => {
    fetchPayables({ status: 'current', limit: 100 })
  }, [fetchPayables])

  const pendingPayables = payables.filter((p) => parseFloat(p.balance) > 0)

  const toggleSelect = (p: Payable) => {
    setSelected((prev) => {
      const copy = { ...prev }
      if (copy[p.id]) {
        delete copy[p.id]
      } else {
        copy[p.id] = parseFloat(p.balance)
      }
      return copy
    })
  }

  const selectAll = () => {
    if (Object.keys(selected).length === pendingPayables.length) {
      setSelected({})
    } else {
      const all: Record<string, number> = {}
      for (const p of pendingPayables) all[p.id] = parseFloat(p.balance)
      setSelected(all)
    }
  }

  const updateAmount = (id: string, amount: number) => {
    setSelected((prev) => ({ ...prev, [id]: amount }))
  }

  const selectedCount = Object.keys(selected).length
  const totalToPay = Object.values(selected).reduce((s, v) => s + v, 0)

  const handleSubmit = async () => {
    if (selectedCount === 0) return toast.warning('Selecciona al menos una CxP para pagar')
    setShowConfirm(false)
    setSubmitting(true)
    try {
      const payments = Object.entries(selected).map(([payable_id, amount]) => ({
        payable_id,
        amount,
      }))
      await batchPay({
        payments,
        payment_method: paymentMethod,
        reference: reference || null,
        notes: notes || null,
      })
      toast.success(`${selectedCount} pagos registrados exitosamente`)
      setSelected({})
      fetchPayables({ status: 'current', limit: 100 })
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Error al procesar pagos')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate('/payables')}
          className="mb-3 flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <ChevronLeft className="h-4 w-4" /> Volver a CxP
        </button>
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <DollarSign className="h-6 w-6 text-green-600" />
              <h1 className="text-2xl font-bold text-gray-900">Pago Masivo de CxP</h1>
            </div>
            <p className="mt-1 text-sm text-gray-500">
              Selecciona las cuentas a pagar y registra el pago en lote
            </p>
          </div>
          {selectedCount > 0 && (
            <div className="text-right">
              <p className="text-sm text-gray-500">{selectedCount} seleccionadas</p>
              <p className="text-xl font-bold text-green-700">{fmtMoney(totalToPay)}</p>
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left: Payables list */}
        <div className="lg:col-span-2">
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            {/* Select all header */}
            <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-4 py-3">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedCount === pendingPayables.length && pendingPayables.length > 0}
                  onChange={selectAll}
                  className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                />
                Seleccionar todas
              </label>
              <span className="text-xs text-gray-500">{pendingPayables.length} cuentas pendientes</span>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            ) : pendingPayables.length === 0 ? (
              <div className="py-20 text-center text-sm text-gray-500">No hay cuentas pendientes de pago</div>
            ) : (
              <div className="divide-y divide-gray-100">
                {pendingPayables.map((p) => {
                  const isSelected = !!selected[p.id]
                  const balance = parseFloat(p.balance)
                  return (
                    <div
                      key={p.id}
                      className={`flex items-center gap-4 px-4 py-3 transition-colors ${isSelected ? 'bg-green-50' : 'hover:bg-gray-50'}`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(p)}
                        className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">{p.supplierName || '—'}</p>
                        <div className="flex gap-3 text-xs text-gray-500">
                          <span>Vence: {fmtDate(p.dueDate)}</span>
                          {p.daysOverdue > 0 && (
                            <span className="text-red-600 font-medium">Vencida {p.daysOverdue}d</span>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-gray-900">Saldo: {fmtMoney(balance)}</p>
                        {isSelected && (
                          <input
                            type="number"
                            min="0.01"
                            max={balance}
                            step="0.01"
                            value={selected[p.id] || ''}
                            onChange={(e) => updateAmount(p.id, parseFloat(e.target.value) || 0)}
                            className="mt-1 w-28 rounded border border-green-300 px-2 py-1 text-right text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500/30"
                          />
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right: Payment details */}
        <div>
          <div className="sticky top-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-semibold text-gray-900">Datos del pago</h3>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Metodo de pago *</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500/20"
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Referencia</label>
              <input
                type="text"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500/20"
                placeholder="No. cheque, ref SPEI..."
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Notas</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500/20"
                placeholder="Notas del pago..."
              />
            </div>

            {/* Summary */}
            <div className="rounded-lg bg-green-50 border border-green-200 p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-green-700">Cuentas a pagar:</span>
                <span className="font-medium text-green-900">{selectedCount}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-green-700">Total a pagar:</span>
                <span className="text-lg font-bold text-green-900">{fmtMoney(totalToPay)}</span>
              </div>
            </div>

            <button
              onClick={() => selectedCount > 0 ? setShowConfirm(true) : toast.warning('Selecciona al menos una CxP')}
              disabled={submitting || selectedCount === 0}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-3 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
              Procesar {selectedCount} pagos
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-md rounded-xl border border-gray-200 bg-white shadow-2xl">
            <div className="flex items-center gap-3 border-b border-gray-200 px-6 py-4">
              <DollarSign className="h-5 w-5 text-green-600" />
              <h3 className="text-lg font-semibold text-gray-900">Confirmar Pago Masivo</h3>
            </div>
            <div className="p-6 space-y-3">
              <p className="text-sm text-gray-600">
                Estas a punto de registrar <strong>{selectedCount} pagos</strong> por un total de:
              </p>
              <p className="text-2xl font-bold text-green-700 text-center">{fmtMoney(totalToPay)}</p>
              <div className="text-sm text-gray-500">
                <p>Metodo: {PAYMENT_METHODS.find((m) => m.value === paymentMethod)?.label}</p>
                {reference && <p>Referencia: {reference}</p>}
              </div>
            </div>
            <div className="flex justify-end gap-3 border-t border-gray-200 px-6 py-4">
              <button
                onClick={() => setShowConfirm(false)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Confirmar pagos
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
