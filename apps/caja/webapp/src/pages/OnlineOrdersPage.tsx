import { useEffect, useState } from 'react'
import { Globe, Maximize, Minimize, RefreshCw, Package, Truck, Clock, X, ChevronRight } from 'lucide-react'
import { useOnlineOrderStore } from '../stores/useOnlineOrderStore'
import type { OnlineOrder } from '../stores/useOnlineOrderStore'
import { useToast } from '@enlocal/react-hooks'

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  new: { label: 'Nuevo', color: 'bg-blue-500' },
  pending: { label: 'Pendiente', color: 'bg-blue-500' },
  preparing: { label: 'En preparacion', color: 'bg-yellow-500' },
  ready: { label: 'Listo', color: 'bg-green-500' },
  ready_for_pickup: { label: 'Listo para recoleccion', color: 'bg-green-500' },
  waiting_driver: { label: 'Esperando chofer', color: 'bg-purple-500' },
  in_transit: { label: 'En camino', color: 'bg-indigo-500' },
  delivered: { label: 'Entregado', color: 'bg-gray-500' },
  delivery_failed: { label: 'Entrega fallida', color: 'bg-red-600' },
  cancelled: { label: 'Cancelado', color: 'bg-red-500' },
}

interface StatusAction {
  status: string
  label: string
  color: string
}

function getNextActions(deliveryType: string, currentStatus: string): StatusAction[] {
  const dt = deliveryType || 'pickup'
  const s = currentStatus || 'new'

  if (s === 'delivered' || s === 'cancelled') return []

  if (dt === 'pickup') {
    if (s === 'new' || s === 'pending') return [{ status: 'preparing', label: 'En Preparacion', color: 'bg-yellow-600 hover:bg-yellow-500' }]
    if (s === 'preparing') return [{ status: 'ready_for_pickup', label: 'Listo para Recoleccion', color: 'bg-green-600 hover:bg-green-500' }]
    if (s === 'ready_for_pickup') return [{ status: 'delivered', label: 'Entregado', color: 'bg-gray-600 hover:bg-gray-500' }]
  } else {
    if (s === 'new' || s === 'pending') return [{ status: 'preparing', label: 'En Preparacion', color: 'bg-yellow-600 hover:bg-yellow-500' }]
    if (s === 'preparing') return [{ status: 'ready', label: 'Listo', color: 'bg-green-600 hover:bg-green-500' }]
    if (s === 'ready') return [{ status: 'waiting_driver', label: 'Esperando Chofer', color: 'bg-purple-600 hover:bg-purple-500' }]
    // in_transit and waiting_driver are updated by drivers via WebSocket — no manual action needed
    if (s === 'waiting_driver' || s === 'in_transit') return []
  }

  // delivery_failed: allow re-preparing
  if (s === 'delivery_failed') return [{ status: 'preparing', label: 'Re-preparar', color: 'bg-yellow-600 hover:bg-yellow-500' }]

  return []
}

function timeAgo(dateStr: string | null) {
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Ahora'
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  return `${hours}h ${mins % 60}m`
}

function formatCurrency(value: number | string) {
  const num = typeof value === 'string' ? parseFloat(value) : value
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(num || 0)
}

function OrderCard({ order, onUpdateStatus }: { order: OnlineOrder; onUpdateStatus: (id: string, status: string) => Promise<void> }) {
  const [updating, setUpdating] = useState(false)
  const toast = useToast()
  const deliveryType = order.delivery_type_cloud || 'pickup'
  const cloudStatus = order.cloud_status || 'new'
  const statusInfo = STATUS_CONFIG[cloudStatus] || STATUS_CONFIG.new
  const actions = getNextActions(deliveryType, cloudStatus)
  const isPickup = deliveryType === 'pickup'

  const handleAction = async (newStatus: string) => {
    setUpdating(true)
    try {
      await onUpdateStatus(order.id, newStatus)
    } catch {
      toast.error('Error al actualizar estado')
    }
    setUpdating(false)
  }

  const items = order.items || []

  return (
    <div className={`rounded-2xl border ${
      cloudStatus === 'new' || cloudStatus === 'pending'
        ? 'border-blue-500/50 bg-gray-800/80'
        : 'border-gray-700 bg-gray-800'
    } flex flex-col overflow-hidden transition-all`}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-white font-bold text-lg">#{order.cloud_id?.slice(-6) || '---'}</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider text-white ${
            isPickup ? 'bg-orange-600' : 'bg-emerald-600'
          }`}>
            {isPickup ? <><Package size={10} className="inline mr-1" />Pickup</> : <><Truck size={10} className="inline mr-1" />Delivery</>}
          </span>
        </div>
        <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold text-white ${statusInfo.color}`}>
          {statusInfo.label}
        </span>
      </div>

      {/* Customer + Timer */}
      <div className="px-4 py-2 flex items-center justify-between border-b border-gray-700/50">
        <div className="min-w-0">
          <div className="text-sm font-medium text-white truncate">{order.customer_name || 'Cliente'}</div>
          {order.customer_phone && (
            <div className="text-xs text-gray-400">{order.customer_phone}</div>
          )}
        </div>
        <div className="flex items-center gap-1 text-xs text-gray-400 flex-shrink-0">
          <Clock size={12} />
          <span>{timeAgo(order.created_at)}</span>
        </div>
      </div>

      {/* Items */}
      <div className="px-4 py-2 flex-1 overflow-auto max-h-48 space-y-1">
        {items.map((item) => (
          <div key={item.id} className="flex justify-between text-sm">
            <div className="text-gray-300">
              <span className="text-white font-medium">{item.quantity}x</span>{' '}
              {item.product_name || item.description}
            </div>
          </div>
        ))}
        {order.observations && order.observations !== 'Pedido Online' && (
          <div className="text-xs text-yellow-400/80 mt-1 italic">Nota: {order.observations}</div>
        )}
      </div>

      {/* Total */}
      <div className="px-4 py-2 border-t border-gray-700/50 flex items-center justify-between">
        <span className="text-sm text-gray-400">Total</span>
        <span className="text-lg font-bold text-white">{formatCurrency(order.total)}</span>
      </div>

      {/* Actions */}
      {(actions.length > 0 || (cloudStatus !== 'delivered' && cloudStatus !== 'cancelled')) && (
        <div className="px-4 py-3 border-t border-gray-700 flex gap-2">
          {actions.map((action) => (
            <button
              key={action.status}
              disabled={updating}
              onClick={() => handleAction(action.status)}
              className={`flex-1 px-3 py-2.5 rounded-xl text-sm font-semibold text-white transition-colors flex items-center justify-center gap-1 ${action.color} disabled:opacity-50`}
            >
              {action.label}
              <ChevronRight size={14} />
            </button>
          ))}
          {cloudStatus !== 'delivered' && cloudStatus !== 'cancelled' && (
            <button
              disabled={updating}
              onClick={() => handleAction('cancelled')}
              className="px-3 py-2.5 rounded-xl text-sm font-semibold text-red-400 border border-red-500/30 hover:bg-red-500/20 transition-colors disabled:opacity-50"
              title="Cancelar pedido"
            >
              <X size={16} />
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export default function OnlineOrdersPage() {
  const orders = useOnlineOrderStore((s) => s.orders)
  const loading = useOnlineOrderStore((s) => s.loading)
  const fetchOrders = useOnlineOrderStore((s) => s.fetchOrders)
  const updateCloudStatus = useOnlineOrderStore((s) => s.updateCloudStatus)

  const [isFullscreen, setIsFullscreen] = useState(false)
  const [clock, setClock] = useState('')

  useEffect(() => {
    fetchOrders()
  }, [fetchOrders])

  // Clock
  useEffect(() => {
    const update = () => setClock(new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }))
    update()
    const i = setInterval(update, 30000)
    return () => clearInterval(i)
  }, [])

  // F11 fullscreen
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'F11') {
        e.preventDefault()
        if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {})
        else document.exitFullscreen().catch(() => {})
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', handler)
    return () => document.removeEventListener('fullscreenchange', handler)
  }, [])

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {})
    else document.exitFullscreen().catch(() => {})
  }

  // Stats
  const newCount = orders.filter((o) => (o.cloud_status || 'new') === 'new' || o.cloud_status === 'pending').length
  const preparingCount = orders.filter((o) => o.cloud_status === 'preparing').length
  const readyCount = orders.filter((o) => ['ready', 'ready_for_pickup', 'waiting_driver', 'in_transit'].includes(o.cloud_status)).length
  const failedCount = orders.filter((o) => o.cloud_status === 'delivery_failed').length

  return (
    <div className="h-full bg-gray-900 text-white flex flex-col -m-4 lg:-m-6">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-800 border-b border-gray-700 flex-shrink-0">
        <div className="flex items-center gap-3">
          <Globe size={22} className="text-blue-400" />
          <h1 className="text-lg font-bold">PEDIDOS ONLINE</h1>
          <span className="text-sm text-gray-400 ml-2">
            Nuevos: <span className="text-blue-400 font-medium">{newCount}</span>
            {' | '}
            Preparando: <span className="text-yellow-400 font-medium">{preparingCount}</span>
            {' | '}
            Listos/En camino: <span className="text-green-400 font-medium">{readyCount}</span>
            {failedCount > 0 && (<>{' | '}Fallidos: <span className="text-red-400 font-medium">{failedCount}</span></>)}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchOrders()}
            className="p-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 transition-colors"
            title="Actualizar"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          <span className="text-lg font-mono text-gray-400">{clock}</span>
          <button
            onClick={toggleFullscreen}
            className="p-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 transition-colors"
            title="Pantalla completa (F11)"
          >
            {isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
          </button>
        </div>
      </div>

      {/* Orders grid */}
      <div className="flex-1 overflow-auto p-4">
        {orders.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-gray-500">
              <Globe size={56} className="mx-auto mb-3 opacity-30" />
              <div className="text-lg">No hay pedidos online activos</div>
              <div className="text-sm mt-1">Los nuevos pedidos apareceran aqui en tiempo real</div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {orders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                onUpdateStatus={updateCloudStatus}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
