import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Loader2, ChevronLeft, Check, X, Ban, AlertTriangle,
} from 'lucide-react'
import { api, useToast } from '@enlocal/react-hooks'
import { useReturnStore } from '../stores/useReturnStore'

const fmtMoney = (v: string | number) => {
  const n = typeof v === 'string' ? parseFloat(v) : v
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n || 0)
}

interface ReviewItem {
  returnItemId: string
  productId: string
  productName: string
  quantityRequested: number
  unitPrice: number
  decision: 'accept_all' | 'partial' | 'reject'
  quantityAccepted: number
  quantityRejected: number
  condition: 'good' | 'damaged' | 'expired'
  restock: boolean
  rejectReason: string
  conditionNotes: string
}

export default function ProcessReturnPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const { currentReturn, fetchById, review, process, reject } = useReturnStore()
  const [items, setItems] = useState<ReviewItem[]>([])
  const [warehouseNotes, setWarehouseNotes] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [showRejectAll, setShowRejectAll] = useState(false)
  const [rejectAllReason, setRejectAllReason] = useState('')

  useEffect(() => {
    if (!id) return
    const load = async () => {
      try {
        const ret = await fetchById(id)
        // Auto-review if still in requested state
        if (ret.status === 'requested') {
          await review(id)
        }
        setItems((ret.items || []).map((it: any) => ({
          returnItemId: it.id,
          productId: it.productId,
          productName: it.productName,
          quantityRequested: parseFloat(it.quantityRequested),
          unitPrice: parseFloat(it.unitPrice),
          decision: 'accept_all',
          quantityAccepted: parseFloat(it.quantityRequested),
          quantityRejected: 0,
          condition: 'good',
          restock: true,
          rejectReason: '',
          conditionNotes: '',
        })))
      } catch { /* handled by store */ }
      setLoading(false)
    }
    load()
  }, [id, fetchById, review])

  const updateItem = (idx: number, updates: Partial<ReviewItem>) => {
    setItems((prev) => prev.map((it, i) => {
      if (i !== idx) return it
      const updated = { ...it, ...updates }
      // Sync quantities based on decision
      if (updates.decision) {
        if (updates.decision === 'accept_all') {
          updated.quantityAccepted = it.quantityRequested
          updated.quantityRejected = 0
        } else if (updates.decision === 'reject') {
          updated.quantityAccepted = 0
          updated.quantityRejected = it.quantityRequested
        }
      }
      if (updates.quantityAccepted !== undefined) {
        updated.quantityRejected = it.quantityRequested - updated.quantityAccepted
      }
      return updated
    }))
  }

  const totalAccepted = items.reduce((sum, it) => sum + it.quantityAccepted, 0)
  const totalRejected = items.reduce((sum, it) => sum + it.quantityRejected, 0)
  const totalRefund = items.reduce((sum, it) => sum + it.quantityAccepted * it.unitPrice, 0)
  const totalRestock = items.filter((it) => it.restock).reduce((sum, it) => sum + it.quantityAccepted, 0)

  const handleProcess = async () => {
    setSubmitting(true)
    try {
      await process(id!, {
        items: items.map((it) => ({
          return_item_id: it.returnItemId,
          quantity_accepted: it.quantityAccepted,
          quantity_rejected: it.quantityRejected,
          item_status: it.decision === 'accept_all' ? 'accepted' : it.decision === 'reject' ? 'rejected' : 'partial',
          product_condition: it.condition,
          restock: it.restock,
          reject_reason: it.rejectReason || undefined,
          condition_notes: it.conditionNotes || undefined,
        })),
        review_notes: warehouseNotes || undefined,
      })
      toast.success('Devolucion procesada exitosamente')
      navigate('/returns')
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Error al procesar')
    } finally {
      setSubmitting(false)
    }
  }

  const handleRejectAll = async () => {
    if (!rejectAllReason.trim()) return toast.warning('Ingresa un motivo')
    setSubmitting(true)
    try {
      await reject(id!, rejectAllReason)
      toast.success('Devolucion rechazada')
      navigate('/returns')
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Error al rechazar')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-gray-400" /></div>
  }

  const ret = currentReturn
  if (!ret) return <div className="py-20 text-center text-gray-500">Devolucion no encontrada</div>

  return (
    <div className="mx-auto max-w-4xl">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <button onClick={() => navigate('/returns')} className="rounded-lg p-2 hover:bg-gray-100">
          <ChevronLeft className="h-5 w-5 text-gray-500" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Procesar Devolucion {ret.series}-{String(ret.folio).padStart(4, '0')}
          </h1>
          <p className="text-sm text-gray-500">
            {ret.returnType === 'partial' ? 'Parcial' : 'Total'} — Motivo: {ret.reasonCategory}
          </p>
        </div>
      </div>

      {/* Reason detail */}
      <div className="mb-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="mb-1 text-xs font-semibold uppercase text-gray-500">Detalle del motivo</h3>
        <p className="text-sm text-gray-700">{ret.reason}</p>
      </div>

      {/* Items review */}
      <div className="mb-6 space-y-4">
        {items.map((it, i) => (
          <div key={i} className="rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <div>
                <p className="font-medium text-gray-900">{it.productName}</p>
                <p className="text-sm text-gray-500">{it.quantityRequested} solicitados — {fmtMoney(it.unitPrice)}/u</p>
              </div>
            </div>
            <div className="p-6 space-y-3">
              {/* Decision */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Decision</label>
                <div className="flex gap-4">
                  {(['accept_all', 'partial', 'reject'] as const).map((d) => (
                    <label key={d} className="flex items-center gap-2 text-sm">
                      <input type="radio" checked={it.decision === d} onChange={() => updateItem(i, { decision: d })} className="accent-primary-600" />
                      {d === 'accept_all' ? 'Aceptar todo' : d === 'partial' ? 'Parcial' : 'Rechazar'}
                    </label>
                  ))}
                </div>
              </div>

              {/* Partial quantities */}
              {it.decision === 'partial' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1 block text-sm text-gray-600">Aceptados</label>
                    <input
                      type="number"
                      min="0"
                      max={it.quantityRequested}
                      value={it.quantityAccepted}
                      onChange={(e) => updateItem(i, { quantityAccepted: Math.min(parseFloat(e.target.value) || 0, it.quantityRequested) })}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm text-gray-600">Rechazados</label>
                    <input type="number" readOnly value={it.quantityRejected} className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm" />
                  </div>
                </div>
              )}

              {/* Condition + Restock (for accepted items) */}
              {it.quantityAccepted > 0 && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1 block text-sm text-gray-600">Condicion</label>
                    <select
                      value={it.condition}
                      onChange={(e) => updateItem(i, { condition: e.target.value as any })}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
                    >
                      <option value="good">Bueno</option>
                      <option value="damaged">Danado</option>
                      <option value="expired">Caducado</option>
                    </select>
                  </div>
                  <div className="flex items-end">
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={it.restock} onChange={(e) => updateItem(i, { restock: e.target.checked })} className="accent-primary-600" />
                      Reingresar a inventario
                    </label>
                  </div>
                </div>
              )}

              {/* Reject reason (for rejected items) */}
              {it.quantityRejected > 0 && (
                <div>
                  <label className="mb-1 block text-sm text-gray-600">Motivo de rechazo</label>
                  <input
                    type="text"
                    value={it.rejectReason}
                    onChange={(e) => updateItem(i, { rejectReason: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
                    placeholder="Razon del rechazo..."
                  />
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="mb-1 block text-sm text-gray-600">Notas</label>
                <input
                  type="text"
                  value={it.conditionNotes}
                  onChange={(e) => updateItem(i, { conditionNotes: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
                  placeholder="Observaciones del producto..."
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Summary */}
      <div className="mb-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold text-gray-900">Resumen</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-600">Productos aceptados: <span className="font-medium text-gray-900">{totalAccepted} unidades</span></p>
            <p className="text-gray-600">Reingresan a inventario: <span className="font-medium text-gray-900">{totalRestock} unidades</span></p>
          </div>
          <div>
            <p className="text-gray-600">Productos rechazados: <span className="font-medium text-gray-900">{totalRejected} unidades</span></p>
            <p className="text-gray-600">Total a acreditar: <span className="font-bold text-gray-900">{fmtMoney(totalRefund)}</span></p>
          </div>
        </div>
      </div>

      {/* Warehouse notes */}
      <div className="mb-6">
        <label className="mb-1.5 block text-sm font-medium text-gray-700">Notas del almacenista</label>
        <textarea
          value={warehouseNotes}
          onChange={(e) => setWarehouseNotes(e.target.value)}
          rows={2}
          className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
          placeholder="Observaciones generales..."
        />
      </div>

      {/* Actions */}
      <div className="flex justify-between">
        <button
          onClick={() => setShowRejectAll(true)}
          className="flex items-center gap-2 rounded-lg border border-red-300 px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50"
        >
          <Ban className="h-4 w-4" /> Rechazar todo
        </button>
        <button
          onClick={handleProcess}
          disabled={submitting}
          className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Procesar devolucion
        </button>
      </div>

      {/* Reject all modal */}
      {showRejectAll && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-2xl">
            <h3 className="mb-4 text-lg font-semibold text-gray-900">Rechazar Devolucion Completa</h3>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Motivo *</label>
            <textarea
              value={rejectAllReason}
              onChange={(e) => setRejectAllReason(e.target.value)}
              rows={3}
              className="mb-4 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            />
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowRejectAll(false)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                Cancelar
              </button>
              <button
                onClick={handleRejectAll}
                disabled={submitting}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                Rechazar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
