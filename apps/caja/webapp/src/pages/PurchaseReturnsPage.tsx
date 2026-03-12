import { useEffect, useState, useCallback } from 'react'
import {
  RotateCcw, Loader2, ChevronLeft, ChevronRight, X, Send, CheckCircle, XCircle,
} from 'lucide-react'
import { api, useToast } from '@enlocal/react-hooks'
import { usePurchaseReturnStore, type PurchaseReturn } from '../stores/usePurchaseReturnStore'

const fmtMoney = (v: string | number) => {
  const n = typeof v === 'string' ? parseFloat(v) : v
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n || 0)
}
const fmtDate = (d: string) => {
  if (!d) return ''
  return new Date(d).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'draft') return <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700"><span className="h-1.5 w-1.5 rounded-full bg-gray-500" />Borrador</span>
  if (status === 'sent') return <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700"><span className="h-1.5 w-1.5 rounded-full bg-blue-500" />Enviada</span>
  if (status === 'completed') return <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700"><span className="h-1.5 w-1.5 rounded-full bg-green-500" />Completada</span>
  if (status === 'rejected') return <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700"><span className="h-1.5 w-1.5 rounded-full bg-red-600" />Rechazada</span>
  return <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">{status}</span>
}

function TypeBadge({ type }: { type: string }) {
  if (type === 'defective') return <span className="inline-flex items-center rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">Defectuoso</span>
  if (type === 'wrong_item') return <span className="inline-flex items-center rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">Articulo incorrecto</span>
  if (type === 'excess') return <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">Excedente</span>
  if (type === 'other') return <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">Otro</span>
  return <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">{type}</span>
}

export default function PurchaseReturnsPage() {
  const toast = useToast()
  const { returns: purchaseReturns, loading, pagination, fetchReturns } = usePurchaseReturnStore()
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)
  const [selectedReturn, setSelectedReturn] = useState<PurchaseReturn | null>(null)

  // Summary
  const totalAmount = purchaseReturns.reduce((s, r) => s + parseFloat(r.totalReturned || '0'), 0)

  const load = useCallback(() => {
    fetchReturns({
      status: statusFilter || undefined,
      page,
      limit: 20,
    })
  }, [fetchReturns, statusFilter, page])

  useEffect(() => { load() }, [load])

  const handleRowClick = async (ret: PurchaseReturn) => {
    try {
      const { data } = await api.get(`/api/purchase-returns/${ret.id}`)
      setSelectedReturn(data.data || data)
    } catch { setSelectedReturn(ret) }
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <RotateCcw className="h-6 w-6 text-gray-500" />
          <h1 className="text-2xl font-bold text-gray-900">Devoluciones a Proveedor</h1>
        </div>
        <div className="mt-2 flex gap-6 text-sm">
          <span className="text-gray-600">Total: <span className="font-bold text-gray-900">{fmtMoney(totalAmount)}</span></span>
          <span className="text-gray-500">{pagination.total} devoluciones</span>
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
          <option value="draft">Borrador</option>
          <option value="sent">Enviada</option>
          <option value="completed">Completada</option>
          <option value="rejected">Rechazada</option>
        </select>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-gray-400" /></div>
        ) : purchaseReturns.length === 0 ? (
          <div className="py-20 text-center text-sm text-gray-500">No hay devoluciones a proveedor</div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-3 font-medium text-gray-600">Folio</th>
                <th className="px-4 py-3 font-medium text-gray-600">Orden de Compra</th>
                <th className="px-4 py-3 font-medium text-gray-600">Tipo</th>
                <th className="px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="px-4 py-3 font-medium text-gray-600 text-right">Total</th>
                <th className="px-4 py-3 font-medium text-gray-600">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {purchaseReturns.map((r) => (
                <tr
                  key={r.id}
                  onClick={() => handleRowClick(r)}
                  className="cursor-pointer border-b border-gray-100 transition-colors hover:bg-gray-50"
                >
                  <td className="px-4 py-3 font-medium text-gray-900">
                    DPR-{String(r.folio).padStart(4, '0')}
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {r.purchaseOrderId ? `OC-${String(r.purchaseOrderId).padStart(4, '0')}` : '—'}
                  </td>
                  <td className="px-4 py-3"><TypeBadge type={r.returnType} /></td>
                  <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                  <td className="px-4 py-3 text-right text-gray-700">{fmtMoney(r.totalReturned)}</td>
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
      {selectedReturn && (
        <ReturnDetail
          purchaseReturn={selectedReturn}
          onClose={() => setSelectedReturn(null)}
          onRefresh={() => { load(); setSelectedReturn(null) }}
        />
      )}
    </div>
  )
}

function ReturnDetail({ purchaseReturn, onClose, onRefresh }: {
  purchaseReturn: PurchaseReturn; onClose: () => void; onRefresh: () => void
}) {
  const toast = useToast()
  const { send: sendReturn, complete: completeReturn, reject: rejectReturn } = usePurchaseReturnStore()
  const [submitting, setSubmitting] = useState(false)

  const handleSend = async () => {
    setSubmitting(true)
    try {
      await sendReturn(purchaseReturn.id)
      toast.success('Devolucion enviada exitosamente')
      onRefresh()
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Error al enviar devolucion')
    } finally {
      setSubmitting(false)
    }
  }

  const handleComplete = async () => {
    setSubmitting(true)
    try {
      await completeReturn(purchaseReturn.id)
      toast.success('Devolucion completada exitosamente')
      onRefresh()
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Error al completar devolucion')
    } finally {
      setSubmitting(false)
    }
  }

  const handleReject = async () => {
    if (!confirm('¿Seguro que deseas rechazar esta devolucion?')) return
    setSubmitting(true)
    try {
      await rejectReturn(purchaseReturn.id, 'Rechazada por usuario')
      toast.success('Devolucion rechazada')
      onRefresh()
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Error al rechazar devolucion')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Detalle Devolucion — DPR-{String(purchaseReturn.folio).padStart(4, '0')}
          </h2>
          <button onClick={onClose} className="rounded p-1 hover:bg-gray-100"><X className="h-5 w-5 text-gray-500" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-500">Orden de compra</p>
              <p className="font-medium text-gray-900">
                {purchaseReturn.purchaseOrderId ? `OC-${String(purchaseReturn.purchaseOrderId).padStart(4, '0')}` : '—'}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Status</p>
              <StatusBadge status={purchaseReturn.status} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-gray-500">Tipo</p>
              <TypeBadge type={purchaseReturn.returnType} />
            </div>
            <div>
              <p className="text-xs text-gray-500">Fecha</p>
              <p className="font-medium text-gray-900">{fmtDate(purchaseReturn.createdAt)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Total</p>
              <p className="text-lg font-bold text-gray-900">{fmtMoney(purchaseReturn.totalReturned)}</p>
            </div>
          </div>

          {purchaseReturn.reason && (
            <div>
              <p className="text-xs text-gray-500">Razon</p>
              <p className="text-sm text-gray-700">{purchaseReturn.reason}</p>
            </div>
          )}

          {/* Items list */}
          {purchaseReturn.items && purchaseReturn.items.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-semibold text-gray-900">Articulos devueltos</h3>
              <div className="rounded-lg border border-gray-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="px-3 py-2 text-left font-medium text-gray-600">Producto</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-600">Cantidad</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-600">Precio</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-600">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {purchaseReturn.items.map((item, idx) => (
                      <tr key={idx} className="border-b border-gray-100">
                        <td className="px-3 py-2 text-gray-700">{item.productName || '—'}</td>
                        <td className="px-3 py-2 text-right text-gray-600">{item.quantityReturned}</td>
                        <td className="px-3 py-2 text-right text-gray-600">{fmtMoney(item.unitCost)}</td>
                        <td className="px-3 py-2 text-right font-medium text-gray-900">{fmtMoney(item.totalRefund)}</td>
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
          {purchaseReturn.status === 'draft' && (
            <>
              <button
                onClick={handleReject}
                disabled={submitting}
                className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                <XCircle className="h-4 w-4" /> Rechazar
              </button>
              <button
                onClick={handleSend}
                disabled={submitting}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                <Send className="h-4 w-4" /> Enviar
              </button>
            </>
          )}
          {purchaseReturn.status === 'sent' && (
            <button
              onClick={handleComplete}
              disabled={submitting}
              className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              <CheckCircle className="h-4 w-4" /> Completar
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
