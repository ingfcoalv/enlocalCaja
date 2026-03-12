import { useEffect, useState } from 'react'
import {
  Loader2, Package, Truck, RotateCcw, X, AlertTriangle, Check,
} from 'lucide-react'
import { api, useToast } from '@enlocal/react-hooks'
import { useRemissionStore } from '../stores/useRemissionStore'
import { useReturnStore } from '../stores/useReturnStore'

const fmtMoney = (v: string | number) => {
  const n = typeof v === 'string' ? parseFloat(v) : v
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n || 0)
}

const timeAgo = (d: string) => {
  if (!d) return ''
  const diff = Date.now() - new Date(d).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `hace ${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `hace ${hrs}h`
  return `hace ${Math.floor(hrs / 24)}d`
}

export default function WarehousePage() {
  const toast = useToast()
  const [pendingNotes, setPendingNotes] = useState<any[]>([])
  const { warehousePending, fetchWarehousePending } = useReturnStore()
  const [loading, setLoading] = useState(true)
  const [showPrepare, setShowPrepare] = useState<any>(null)
  const [showDeliver, setShowDeliver] = useState<any>(null)

  const loadAll = async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/api/remissions/warehouse/pending')
      setPendingNotes(data.data || [])
      await fetchWarehousePending()
    } catch { /* ignore */ }
    setLoading(false)
  }

  useEffect(() => { loadAll() }, [])

  const toPrepare = pendingNotes.filter((n) => n.status === 'confirmed')
  const toDeliver = pendingNotes.filter((n) => n.status === 'prepared')

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-gray-400" /></div>
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Almacen — Notas Pendientes</h1>
        <p className="mt-1 text-sm text-gray-500">
          {toPrepare.length} por surtir, {toDeliver.length} por entregar, {warehousePending.length} devoluciones
        </p>
      </div>

      {/* Pending to prepare */}
      <Section
        title={`Pendientes de Surtir (${toPrepare.length})`}
        icon={<Package className="h-5 w-5 text-blue-600" />}
        color="blue"
        empty={toPrepare.length === 0}
        emptyText="No hay notas pendientes de surtir"
      >
        {toPrepare.map((note) => (
          <NoteCard key={note.id} note={note} actionLabel="Surtir" onAction={() => setShowPrepare(note)} />
        ))}
      </Section>

      {/* Ready to deliver */}
      <Section
        title={`Surtidas — Listas para Entregar (${toDeliver.length})`}
        icon={<Truck className="h-5 w-5 text-green-600" />}
        color="green"
        empty={toDeliver.length === 0}
        emptyText="No hay notas listas para entregar"
      >
        {toDeliver.map((note) => (
          <NoteCard key={note.id} note={note} actionLabel="Entregar" onAction={() => setShowDeliver(note)} />
        ))}
      </Section>

      {/* Pending returns */}
      <Section
        title={`Devoluciones Pendientes (${warehousePending.length})`}
        icon={<RotateCcw className="h-5 w-5 text-orange-600" />}
        color="orange"
        empty={warehousePending.length === 0}
        emptyText="No hay devoluciones pendientes"
      >
        {warehousePending.map((ret: any) => (
          <div key={ret.id} className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4">
            <div>
              <p className="font-medium text-gray-900">
                DEV-{String(ret.folio).padStart(4, '0')} | NR-{String(ret.remissionFolio || '?').padStart(4, '0')}
              </p>
              <p className="text-sm text-gray-600">{ret.returnType === 'partial' ? 'Parcial' : 'Total'} — {ret.reasonCategory}</p>
            </div>
            <a
              href={`/returns/${ret.id}/process`}
              className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700"
            >
              Revisar
            </a>
          </div>
        ))}
      </Section>

      {/* Prepare Modal */}
      {showPrepare && (
        <PrepareModal
          note={showPrepare}
          onClose={() => setShowPrepare(null)}
          onSuccess={() => { setShowPrepare(null); loadAll() }}
        />
      )}

      {/* Deliver Modal */}
      {showDeliver && (
        <DeliverModal
          note={showDeliver}
          onClose={() => setShowDeliver(null)}
          onSuccess={() => { setShowDeliver(null); loadAll() }}
        />
      )}
    </div>
  )
}

function Section({ title, icon, color, empty, emptyText, children }: {
  title: string; icon: React.ReactNode; color: string; empty: boolean; emptyText: string; children: React.ReactNode
}) {
  return (
    <div className="mb-6">
      <div className="mb-3 flex items-center gap-2">
        {icon}
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
      </div>
      {empty ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 py-8 text-center text-sm text-gray-500">
          {emptyText}
        </div>
      ) : (
        <div className="space-y-3">{children}</div>
      )}
    </div>
  )
}

function NoteCard({ note, actionLabel, onAction }: { note: any; actionLabel: string; onAction: () => void }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex-1">
        <div className="flex items-center gap-3">
          <span className="font-medium text-gray-900">
            {note.series}-{String(note.folio).padStart(4, '0')}
          </span>
          <span className="text-gray-600">|</span>
          <span className="text-gray-700">{note.customerName}</span>
          <span className="text-gray-600">|</span>
          <span className="font-medium text-gray-900">{fmtMoney(note.total)}</span>
        </div>
        <p className="mt-1 text-sm text-gray-500">
          {note.status === 'confirmed' ? 'Confirmada' : 'Surtida'} {timeAgo(note.confirmedAt || note.preparedAt || note.createdAt)}
        </p>
      </div>
      <button
        onClick={onAction}
        className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
      >
        {actionLabel}
      </button>
    </div>
  )
}

// ─── PREPARE MODAL ──────────────────────────────────────────

function PrepareModal({ note, onClose, onSuccess }: { note: any; onClose: () => void; onSuccess: () => void }) {
  const toast = useToast()
  const { prepare } = useRemissionStore()
  const [items, setItems] = useState<any[]>([])
  const [loadingItems, setLoadingItems] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await api.get(`/api/remissions/${note.id}`)
        const detail = data.data || data
        setItems((detail.items || []).map((it: any) => ({
          ...it,
          quantityToPrepare: parseFloat(it.quantity),
        })))
      } catch { /* ignore */ }
      setLoadingItems(false)
    }
    load()
  }, [note.id])

  const handleSubmit = async () => {
    setSubmitting(true)
    try {
      await prepare(note.id, items.map((it) => ({
        remission_item_id: it.id,
        quantity_prepared: it.quantityToPrepare,
      })))
      toast.success('Nota surtida exitosamente')
      onSuccess()
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Error al surtir')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Surtir {note.series}-{String(note.folio).padStart(4, '0')} — {note.customerName}
          </h2>
          <button onClick={onClose} className="rounded p-1 hover:bg-gray-100"><X className="h-5 w-5 text-gray-500" /></button>
        </div>

        {loadingItems ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
        ) : (
          <>
            <div className="p-6">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="px-3 py-2 text-left font-medium text-gray-600">Producto</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-600">Solicitado</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-600">A surtir</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, i) => (
                    <tr key={i} className="border-b border-gray-100">
                      <td className="px-3 py-3">
                        <p className="font-medium text-gray-900">{it.productName}</p>
                        {it.productSku && <p className="text-xs text-gray-500">SKU: {it.productSku}</p>}
                      </td>
                      <td className="px-3 py-3 text-right text-gray-700">{parseFloat(it.quantity)}</td>
                      <td className="px-3 py-3 text-right">
                        <input
                          type="number"
                          min="0"
                          max={parseFloat(it.quantity)}
                          step="0.01"
                          value={it.quantityToPrepare}
                          onChange={(e) => {
                            const val = Math.min(parseFloat(e.target.value) || 0, parseFloat(it.quantity))
                            setItems((prev) => prev.map((p, j) => j === i ? { ...p, quantityToPrepare: val } : p))
                          }}
                          className="w-24 rounded border border-gray-300 px-2 py-1 text-right text-sm focus:border-primary-500 focus:outline-none"
                        />
                        {it.quantityToPrepare < parseFloat(it.quantity) && (
                          <p className="mt-1 text-xs text-yellow-600 flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" /> Surtido parcial
                          </p>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end gap-3 border-t border-gray-200 px-6 py-4">
              <button onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                Cancelar
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Confirmar surtido
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ─── DELIVER MODAL ──────────────────────────────────────────

function DeliverModal({ note, onClose, onSuccess }: { note: any; onClose: () => void; onSuccess: () => void }) {
  const toast = useToast()
  const { deliver } = useRemissionStore()
  const [items, setItems] = useState<any[]>([])
  const [loadingItems, setLoadingItems] = useState(true)
  const [receivedBy, setReceivedBy] = useState('')
  const [receivedIdDoc, setReceivedIdDoc] = useState('')
  const [deliveryNotes, setDeliveryNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await api.get(`/api/remissions/${note.id}`)
        const detail = data.data || data
        setItems((detail.items || []).map((it: any) => ({
          ...it,
          quantityToDeliver: parseFloat(it.quantityPrepared || it.quantity),
        })))
      } catch { /* ignore */ }
      setLoadingItems(false)
    }
    load()
  }, [note.id])

  const handleSubmit = async () => {
    if (!receivedBy.trim()) return toast.warning('Ingresa quien recibe')
    setSubmitting(true)
    try {
      await deliver(note.id, {
        received_by: receivedBy,
        received_id_doc: receivedIdDoc || undefined,
        delivery_notes: deliveryNotes || undefined,
        items: items.map((it) => ({
          remission_item_id: it.id,
          quantity_delivered: it.quantityToDeliver,
        })),
      })
      toast.success('Nota entregada exitosamente')

      // Auto-abrir PDF para imprimir
      try {
        const resp = await api.get(`/api/remissions/${note.id}/pdf`, { responseType: 'blob' })
        const url = URL.createObjectURL(resp.data)
        window.open(url, '_blank')
      } catch { /* silently ignore print errors */ }

      onSuccess()
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Error al entregar')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Entregar {note.series}-{String(note.folio).padStart(4, '0')} — {note.customerName}
          </h2>
          <button onClick={onClose} className="rounded p-1 hover:bg-gray-100"><X className="h-5 w-5 text-gray-500" /></button>
        </div>

        {loadingItems ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
        ) : (
          <>
            <div className="p-6 space-y-4">
              {/* Items */}
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="px-3 py-2 text-left font-medium text-gray-600">Producto</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-600">Surtido</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-600">A entregar</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, i) => (
                    <tr key={i} className="border-b border-gray-100">
                      <td className="px-3 py-3 font-medium text-gray-900">{it.productName}</td>
                      <td className="px-3 py-3 text-right text-gray-700">{parseFloat(it.quantityPrepared || it.quantity)}</td>
                      <td className="px-3 py-3 text-right">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={it.quantityToDeliver}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0
                            setItems((prev) => prev.map((p, j) => j === i ? { ...p, quantityToDeliver: val } : p))
                          }}
                          className="w-24 rounded border border-gray-300 px-2 py-1 text-right text-sm focus:border-primary-500 focus:outline-none"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Reception data */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Nombre de quien recibe *</label>
                <input
                  type="text"
                  value={receivedBy}
                  onChange={(e) => setReceivedBy(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                  placeholder="Nombre completo"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Identificacion</label>
                <input
                  type="text"
                  value={receivedIdDoc}
                  onChange={(e) => setReceivedIdDoc(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                  placeholder="INE: 1234567890"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Notas de entrega</label>
                <textarea
                  value={deliveryNotes}
                  onChange={(e) => setDeliveryNotes(e.target.value)}
                  rows={2}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                />
              </div>
              <div className="flex items-center gap-2 rounded-lg bg-yellow-50 border border-yellow-200 p-3 text-sm text-yellow-700">
                <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                Se descontara el inventario al confirmar la entrega
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
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Truck className="h-4 w-4" />}
                Confirmar entrega
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
