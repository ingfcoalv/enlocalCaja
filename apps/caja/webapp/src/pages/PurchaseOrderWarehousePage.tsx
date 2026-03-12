import { useEffect, useState, useCallback } from 'react'
import {
  Warehouse, Loader2, X, Package, AlertTriangle, Lock, RotateCcw,
} from 'lucide-react'
import { api, useToast } from '@enlocal/react-hooks'
import { usePurchaseOrderStore, type PurchaseOrder } from '../stores/usePurchaseOrderStore'

const fmtMoney = (v: string | number) => {
  const n = typeof v === 'string' ? parseFloat(v) : v
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n || 0)
}
const fmtDate = (d: string) => {
  if (!d) return ''
  return new Date(d).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function PurchaseOrderWarehousePage() {
  const toast = useToast()
  const { warehousePending: pendingOrders, loading, fetchWarehousePending } = usePurchaseOrderStore()
  const [selectedOrder, setSelectedOrder] = useState<PurchaseOrder | null>(null)
  const [closingOrder, setClosingOrder] = useState<PurchaseOrder | null>(null)
  const [pendingReturns, setPendingReturns] = useState<any[]>([])
  const [loadingReturns, setLoadingReturns] = useState(false)

  useEffect(() => {
    fetchWarehousePending()
    // Fetch pending returns (sent status = waiting for warehouse to process)
    setLoadingReturns(true)
    api.get('/api/purchase-returns', { params: { status: 'sent', limit: 50 } })
      .then(({ data }) => setPendingReturns(data.data || []))
      .catch(() => {})
      .finally(() => setLoadingReturns(false))
  }, [fetchWarehousePending])

  const handleCompleteReturn = async (ret: any) => {
    try {
      await api.post(`/api/purchase-returns/${ret.id}/complete`, { notes: '' })
      toast.success('Devolucion completada')
      setPendingReturns((prev) => prev.filter((r) => r.id !== ret.id))
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Error al completar devolucion')
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <Warehouse className="h-6 w-6 text-gray-500" />
          <h1 className="text-2xl font-bold text-gray-900">Recepcion de Mercancia</h1>
        </div>
        <p className="mt-2 text-sm text-gray-500">
          Ordenes pendientes de recibir en almacen
        </p>
      </div>

      {/* Pending orders list */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          <div className="col-span-full flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : pendingOrders.length === 0 ? (
          <div className="col-span-full rounded-xl border border-gray-200 bg-white py-20 text-center text-sm text-gray-500">
            No hay ordenes pendientes de recibir
          </div>
        ) : (
          pendingOrders.map((order) => (
            <div
              key={order.id}
              onClick={() => setSelectedOrder(order)}
              className="cursor-pointer rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-all hover:shadow-md hover:border-primary-300"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium text-gray-900">
                    OC-{String(order.folio).padStart(4, '0')}
                  </p>
                  <p className="text-sm text-gray-600">{order.supplierName || '—'}</p>
                </div>
                <Package className="h-5 w-5 text-gray-400" />
              </div>
              <div className="mt-3 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Total:</span>
                  <span className="font-medium text-gray-900">{fmtMoney(order.total)}</span>
                </div>
                {order.expectedDate && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Fecha esperada:</span>
                    <span className="text-gray-700">{fmtDate(order.expectedDate)}</span>
                  </div>
                )}
                {order.status === 'partial_received' && (
                  <div className="mt-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-700">
                      <span className="h-1.5 w-1.5 rounded-full bg-yellow-500" />
                      Recepcion parcial
                    </span>
                  </div>
                )}
              </div>
              <div className="mt-3 pt-3 border-t border-gray-100">
                <button
                  onClick={(e) => { e.stopPropagation(); setClosingOrder(order) }}
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-800"
                >
                  <Lock className="h-3.5 w-3.5" />
                  Cerrar Orden
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pending Returns Section */}
      {(pendingReturns.length > 0 || loadingReturns) && (
        <div className="mt-8">
          <div className="mb-4 flex items-center gap-2">
            <RotateCcw className="h-5 w-5 text-orange-500" />
            <h2 className="text-lg font-bold text-gray-900">Devoluciones Pendientes</h2>
            <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">
              {pendingReturns.length}
            </span>
          </div>
          {loadingReturns ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {pendingReturns.map((ret) => (
                <div key={ret.id} className="rounded-xl border border-orange-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-gray-900">DPR-{String(ret.folio).padStart(4, '0')}</p>
                      <p className="text-sm text-gray-600">{ret.returnType || '—'}</p>
                    </div>
                    <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">
                      Enviada
                    </span>
                  </div>
                  <div className="mt-2 space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Total devolucion:</span>
                      <span className="font-medium text-gray-900">{fmtMoney(ret.totalReturned || 0)}</span>
                    </div>
                    <p className="text-xs text-gray-500">Motivo: {ret.reason || '—'}</p>
                  </div>
                  <div className="mt-3 pt-3 border-t border-orange-100">
                    <button
                      onClick={() => handleCompleteReturn(ret)}
                      className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-orange-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-orange-700"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Confirmar devolucion recibida
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Receive modal */}
      {selectedOrder && (
        <ReceiveModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onSuccess={() => {
            setSelectedOrder(null)
            fetchWarehousePending()
          }}
        />
      )}

      {/* Close order modal */}
      {closingOrder && (
        <CloseOrderModal
          order={closingOrder}
          onClose={() => setClosingOrder(null)}
          onSuccess={() => {
            setClosingOrder(null)
            fetchWarehousePending()
          }}
        />
      )}
    </div>
  )
}

function ReceiveModal({ order, onClose, onSuccess }: {
  order: PurchaseOrder; onClose: () => void; onSuccess: () => void
}) {
  const toast = useToast()
  const { receive } = usePurchaseOrderStore()

  // Calculate remaining qty for each item
  const orderItems = order.items || []
  const remainingQtys = orderItems.map((item) => {
    const received = Number(item.quantityReceived) || 0
    return Math.max(0, Number(item.quantity) - received)
  })

  // Default quantity_received = remaining (expected)
  const [items, setItems] = useState<Array<{ order_item_id: string; quantity_received: number; quantity_rejected: number; condition: string; condition_notes: string }>>(
    orderItems.map((item, idx) => ({
      order_item_id: item.id || '',
      quantity_received: remainingQtys[idx],
      quantity_rejected: 0,
      condition: 'good',
      condition_notes: '',
    }))
  )
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [discrepancies, setDiscrepancies] = useState<Array<{ name: string; expected: number; received: number }>>([])

  const handleItemChange = (idx: number, field: string, value: any) => {
    const newItems = [...items]
    ;(newItems[idx] as any)[field] = value
    // Auto-adjust: if rejected changes, cap received so received + rejected <= remaining
    if (field === 'quantity_rejected') {
      const maxReceived = remainingQtys[idx] - (value || 0)
      if (newItems[idx].quantity_received > maxReceived) {
        newItems[idx].quantity_received = Math.max(0, maxReceived)
      }
    }
    if (field === 'quantity_received') {
      const maxRejected = remainingQtys[idx] - (value || 0)
      if (newItems[idx].quantity_rejected > maxRejected) {
        newItems[idx].quantity_rejected = Math.max(0, maxRejected)
      }
    }
    setItems(newItems)
  }

  const doSubmit = async () => {
    const receivedItems = items.filter((i) => i.quantity_received > 0 || i.quantity_rejected > 0)
    if (receivedItems.length === 0) {
      return toast.warning('Debes recibir al menos un articulo')
    }
    setSubmitting(true)
    setShowConfirm(false)
    try {
      const payload = receivedItems.map((i) => ({
        order_item_id: i.order_item_id,
        quantity_received: i.quantity_received,
        quantity_rejected: i.quantity_rejected || 0,
        condition: i.condition,
        condition_notes: i.condition_notes || undefined,
      }))
      await receive(order.id, { items: payload, notes: notes || null })
      toast.success('Recepcion registrada exitosamente')
      onSuccess()
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Error al registrar recepcion')
    } finally {
      setSubmitting(false)
    }
  }

  const handleSubmit = () => {
    // Check for discrepancies (0 or less than expected)
    const issues: Array<{ name: string; expected: number; received: number }> = []
    for (let i = 0; i < items.length; i++) {
      const expected = remainingQtys[i]
      const received = items[i].quantity_received
      if (expected > 0 && received < expected) {
        issues.push({
          name: orderItems[i].productName || `Articulo ${i + 1}`,
          expected,
          received,
        })
      }
    }

    if (issues.length > 0) {
      setDiscrepancies(issues)
      setShowConfirm(true)
    } else {
      doSubmit()
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <div className="mx-4 w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
            <h2 className="text-lg font-semibold text-gray-900">
              Recibir Orden — OC-{String(order.folio).padStart(4, '0')}
            </h2>
            <button onClick={onClose} className="rounded p-1 hover:bg-gray-100"><X className="h-5 w-5 text-gray-500" /></button>
          </div>
          <div className="p-6 space-y-4">
            <div className="rounded-lg bg-gray-50 p-3">
              <p className="text-xs text-gray-500">Proveedor</p>
              <p className="font-medium text-gray-900">{order.supplierName || '—'}</p>
            </div>

            {/* Items */}
            <div>
              <h3 className="mb-2 text-sm font-semibold text-gray-900">Articulos a recibir</h3>
              <div className="space-y-3">
                {orderItems.map((item, idx) => {
                  const alreadyReceived = Number(item.quantityReceived) || 0
                  const remaining = remainingQtys[idx]
                  const currentQty = items[idx]?.quantity_received ?? 0
                  const currentRejected = items[idx]?.quantity_rejected ?? 0
                  const isShort = currentQty < remaining
                  const hasRejected = currentRejected > 0
                  return (
                    <div key={idx} className={`rounded-lg border p-3 ${hasRejected ? 'border-red-300 bg-red-50/30' : isShort ? 'border-amber-300 bg-amber-50/30' : 'border-gray-200'}`}>
                      <div className="mb-2">
                        <p className="font-medium text-gray-900">{item.productName || '—'}</p>
                        <div className="mt-1 flex gap-4 text-sm text-gray-600">
                          <span>Ordenado: {item.quantity}</span>
                          {alreadyReceived > 0 && <span className="text-green-700">Recibido: {alreadyReceived}</span>}
                          <span className="font-medium">Pendiente: {remaining}</span>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="mb-1 block text-xs font-medium text-gray-700">Aceptados</label>
                          <input
                            type="number"
                            min="0"
                            max={remaining - currentRejected}
                            value={currentQty}
                            onChange={(e) => handleItemChange(idx, 'quantity_received', parseInt(e.target.value) || 0)}
                            className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
                              isShort
                                ? 'border-amber-400 focus:border-amber-500 focus:ring-amber-500/20'
                                : 'border-gray-300 focus:border-primary-500 focus:ring-primary-500/20'
                            }`}
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium text-red-700">Rechazados</label>
                          <input
                            type="number"
                            min="0"
                            max={remaining - currentQty}
                            value={currentRejected}
                            onChange={(e) => handleItemChange(idx, 'quantity_rejected', parseInt(e.target.value) || 0)}
                            className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
                              hasRejected
                                ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20'
                                : 'border-gray-300 focus:border-primary-500 focus:ring-primary-500/20'
                            }`}
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium text-gray-700">Condicion</label>
                          <select
                            value={items[idx]?.condition || 'good'}
                            onChange={(e) => handleItemChange(idx, 'condition', e.target.value)}
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                          >
                            <option value="good">Buena</option>
                            <option value="damaged">Dañada</option>
                            <option value="partial">Parcial</option>
                          </select>
                        </div>
                      </div>
                      {hasRejected && (
                        <div className="mt-2">
                          <label className="mb-1 block text-xs font-medium text-red-700">Motivo del rechazo</label>
                          <input
                            type="text"
                            value={items[idx]?.condition_notes || ''}
                            onChange={(e) => handleItemChange(idx, 'condition_notes', e.target.value)}
                            className="w-full rounded-lg border border-red-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20"
                            placeholder="Ej: Empaque roto, producto caducado..."
                          />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Notas</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                placeholder="Observaciones sobre la recepcion..."
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
              Registrar recepcion
            </button>
          </div>
        </div>
      </div>

      {/* Discrepancy confirmation modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-md rounded-xl border border-gray-200 bg-white shadow-2xl">
            <div className="flex items-center gap-3 border-b border-gray-200 px-6 py-4">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              <h3 className="text-lg font-semibold text-gray-900">Cantidades incompletas</h3>
            </div>
            <div className="p-6">
              <p className="mb-3 text-sm text-gray-600">
                Los siguientes articulos tienen una cantidad menor a la esperada:
              </p>
              <div className="rounded-lg border border-amber-200 bg-amber-50 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-amber-200">
                      <th className="px-3 py-2 text-left font-medium text-gray-700">Articulo</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-700">Esperado</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-700">Recibido</th>
                    </tr>
                  </thead>
                  <tbody>
                    {discrepancies.map((d, i) => (
                      <tr key={i} className="border-b border-amber-100 last:border-0">
                        <td className="px-3 py-2 text-gray-900">{d.name}</td>
                        <td className="px-3 py-2 text-right text-gray-600">{d.expected}</td>
                        <td className="px-3 py-2 text-right font-medium text-amber-700">{d.received}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-sm text-gray-500">
                ¿Deseas continuar con la recepcion parcial?
              </p>
            </div>
            <div className="flex justify-end gap-3 border-t border-gray-200 px-6 py-4">
              <button
                onClick={() => setShowConfirm(false)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Corregir cantidades
              </button>
              <button
                onClick={doSubmit}
                disabled={submitting}
                className="flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Confirmar recepcion parcial
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

const CLOSE_REASONS = [
  'Proveedor sin stock',
  'Proveedor no cumple especificaciones',
  'Cambio de proveedor',
  'Mercancia descontinuada',
  'Orden duplicada',
  'Otro',
]

function CloseOrderModal({ order, onClose, onSuccess }: {
  order: PurchaseOrder; onClose: () => void; onSuccess: () => void
}) {
  const toast = useToast()
  const { closeOrder } = usePurchaseOrderStore()
  const [selectedReason, setSelectedReason] = useState('')
  const [customReason, setCustomReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const finalReason = selectedReason === 'Otro' ? customReason : selectedReason

  const handleSubmit = async () => {
    if (!finalReason.trim()) {
      return toast.warning('Selecciona o escribe un motivo de cierre')
    }
    setSubmitting(true)
    try {
      await closeOrder(order.id, finalReason.trim())
      toast.success('Orden cerrada exitosamente')
      onSuccess()
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Error al cerrar la orden')
    } finally {
      setSubmitting(false)
    }
  }

  // Calculate received summary
  const orderItems = order.items || []
  const receivedSummary = orderItems.map((item) => {
    const ordered = Number(item.quantity) || 0
    const received = Number(item.quantityReceived) || 0
    return { name: item.productName, ordered, received }
  }).filter((i) => i.ordered > 0)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-lg rounded-xl border border-gray-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-gray-500" />
            <h2 className="text-lg font-semibold text-gray-900">
              Cerrar Orden — OC-{String(order.folio).padStart(4, '0')}
            </h2>
          </div>
          <button onClick={onClose} className="rounded p-1 hover:bg-gray-100"><X className="h-5 w-5 text-gray-500" /></button>
        </div>

        <div className="p-6 space-y-4">
          {/* Received summary */}
          {receivedSummary.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-medium text-gray-700">Resumen de recepcion</p>
              <div className="rounded-lg border border-gray-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="px-3 py-2 text-left font-medium text-gray-600">Articulo</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-600">Ordenado</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-600">Recibido</th>
                    </tr>
                  </thead>
                  <tbody>
                    {receivedSummary.map((item, idx) => (
                      <tr key={idx} className="border-b border-gray-100 last:border-0">
                        <td className="px-3 py-2 text-gray-900">{item.name}</td>
                        <td className="px-3 py-2 text-right text-gray-600">{item.ordered}</td>
                        <td className={`px-3 py-2 text-right font-medium ${item.received < item.ordered ? 'text-amber-700' : 'text-green-700'}`}>
                          {item.received}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Close reason */}
          <div>
            <p className="mb-2 text-sm font-medium text-gray-700">Motivo de cierre *</p>
            <div className="space-y-2">
              {CLOSE_REASONS.map((reason) => (
                <label
                  key={reason}
                  className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors ${
                    selectedReason === reason
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="closeReason"
                    value={reason}
                    checked={selectedReason === reason}
                    onChange={() => setSelectedReason(reason)}
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-sm text-gray-900">{reason}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Custom reason text */}
          {selectedReason === 'Otro' && (
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Especifica el motivo</label>
              <textarea
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                placeholder="Describe el motivo de cierre..."
              />
            </div>
          )}

          <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
            <p className="text-sm text-amber-800">
              Al cerrar esta orden ya no se podran registrar mas recepciones de mercancia.
              {order.paymentTerms === 'credit' && ' Se generara la cuenta por pagar con base en lo recibido.'}
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-gray-200 px-6 py-4">
          <button onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !finalReason.trim()}
            className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            <Lock className="h-4 w-4" />
            Cerrar Orden
          </button>
        </div>
      </div>
    </div>
  )
}
