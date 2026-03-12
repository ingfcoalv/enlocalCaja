import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import {
  ShoppingCart, Loader2, ChevronLeft, ChevronRight, X, Search, CheckCircle, XCircle,
  Plus, Trash2, Clock, Download, Mail,
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

const inputClass = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20'

function StatusBadge({ status }: { status: string }) {
  if (status === 'draft') return <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700"><span className="h-1.5 w-1.5 rounded-full bg-gray-500" />Borrador</span>
  if (status === 'approved') return <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700"><span className="h-1.5 w-1.5 rounded-full bg-blue-500" />Aprobada</span>
  if (status === 'partial_received') return <span className="inline-flex items-center gap-1.5 rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-700"><span className="h-1.5 w-1.5 rounded-full bg-yellow-500" />Parcial</span>
  if (status === 'received') return <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700"><span className="h-1.5 w-1.5 rounded-full bg-green-500" />Recibida</span>
  if (status === 'cancelled') return <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700"><span className="h-1.5 w-1.5 rounded-full bg-red-600" />Cancelada</span>
  if (status === 'closed') return <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-medium text-purple-700"><span className="h-1.5 w-1.5 rounded-full bg-purple-500" />Cerrada</span>
  return <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">{status}</span>
}

interface OrderLineItem {
  product_id: string
  productName: string
  quantity: number
  unit_cost: number
  discount: number
}

interface SupplierOption {
  id: string
  name: string
  rfc?: string
  paymentTerms?: string
}

interface ProductOption {
  id: string
  name: string
  sku?: string
  cost?: number | string
}

export default function PurchaseOrdersPage() {
  const toast = useToast()
  const { orders: purchaseOrders, loading, pagination, fetchOrders, create: createOrder } = usePurchaseOrderStore()
  const [statusFilter, setStatusFilter] = useState('')
  const [supplierSearch, setSupplierSearch] = useState('')
  const [page, setPage] = useState(1)
  const [selectedOrder, setSelectedOrder] = useState<PurchaseOrder | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)

  // Summary
  const totalAmount = purchaseOrders.reduce((s, o) => s + parseFloat(o.total), 0)

  const load = useCallback(() => {
    fetchOrders({
      status: statusFilter || undefined,
      q: supplierSearch || undefined,
      page,
      limit: 20,
    })
  }, [fetchOrders, statusFilter, supplierSearch, page])

  useEffect(() => { load() }, [load])

  const handleRowClick = async (order: PurchaseOrder) => {
    try {
      const { data } = await api.get(`/api/purchase-orders/${order.id}`)
      setSelectedOrder(data.data || data)
    } catch { setSelectedOrder(order) }
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-6 w-6 text-gray-500" />
            <h1 className="text-2xl font-bold text-gray-900">Ordenes de Compra</h1>
          </div>
          <div className="mt-2 flex gap-6 text-sm">
            <span className="text-gray-600">Total: <span className="font-bold text-gray-900">{fmtMoney(totalAmount)}</span></span>
            <span className="text-gray-500">{pagination.total} ordenes</span>
          </div>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700"
          type="button"
        >
          <Plus className="h-4 w-4" />
          Nueva Orden
        </button>
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
          <option value="approved">Aprobada</option>
          <option value="partial_received">Recepcion parcial</option>
          <option value="received">Recibida</option>
          <option value="cancelled">Cancelada</option>
          <option value="closed">Cerrada</option>
        </select>
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={supplierSearch}
            onChange={(e) => { setSupplierSearch(e.target.value); setPage(1) }}
            placeholder="Buscar proveedor..."
            className="w-full rounded-lg border border-gray-300 pl-9 pr-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-gray-400" /></div>
        ) : purchaseOrders.length === 0 ? (
          <div className="py-20 text-center text-sm text-gray-500">No hay ordenes de compra</div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-3 font-medium text-gray-600">Folio</th>
                <th className="px-4 py-3 font-medium text-gray-600">Proveedor</th>
                <th className="px-4 py-3 font-medium text-gray-600 text-right">Total</th>
                <th className="px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="px-4 py-3 font-medium text-gray-600">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {purchaseOrders.map((o) => (
                <tr
                  key={o.id}
                  onClick={() => handleRowClick(o)}
                  className="cursor-pointer border-b border-gray-100 transition-colors hover:bg-gray-50"
                >
                  <td className="px-4 py-3 font-medium text-gray-900">
                    OC-{String(o.folio).padStart(4, '0')}
                  </td>
                  <td className="px-4 py-3 text-gray-700">{o.supplierName || '—'}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{fmtMoney(o.total)}</td>
                  <td className="px-4 py-3"><StatusBadge status={o.status} /></td>
                  <td className="px-4 py-3 text-gray-500">{fmtDate(o.createdAt)}</td>
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
      {selectedOrder && (
        <OrderDetail
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onRefresh={() => { load(); setSelectedOrder(null) }}
        />
      )}

      {/* Create modal */}
      {showCreateModal && (
        <CreateOrderModal
          onClose={() => setShowCreateModal(false)}
          onCreate={async (payload) => {
            try {
              await createOrder(payload)
              toast.success('Orden de compra creada')
              setShowCreateModal(false)
              load()
            } catch (err: any) {
              toast.error(err?.response?.data?.error || 'Error al crear la orden')
            }
          }}
        />
      )}
    </div>
  )
}

/* ───────────────────── Create Order Modal ───────────────────── */

function CreateOrderModal({ onClose, onCreate }: {
  onClose: () => void
  onCreate: (payload: any) => Promise<void>
}) {
  const toast = useToast()
  const [saving, setSaving] = useState(false)

  // Supplier search
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([])
  const [supplierQuery, setSupplierQuery] = useState('')
  const [supplierDropdownOpen, setSupplierDropdownOpen] = useState(false)
  const [selectedSupplier, setSelectedSupplier] = useState<SupplierOption | null>(null)
  const supplierInputRef = useRef<HTMLInputElement>(null)
  const supplierDropdownRef = useRef<HTMLDivElement>(null)

  // Products cache
  const [products, setProducts] = useState<ProductOption[]>([])

  // Order fields
  const [paymentTerms, setPaymentTerms] = useState('cash')
  const [expectedDate, setExpectedDate] = useState('')
  const [deliveryAddress, setDeliveryAddress] = useState('')
  const [deliveryNotes, setDeliveryNotes] = useState('')
  const [internalNotes, setInternalNotes] = useState('')
  const [items, setItems] = useState<OrderLineItem[]>([])

  // Fetch suppliers and products on mount
  useEffect(() => {
    api.get('/api/suppliers?active=true&limit=500')
      .then(({ data }) => setSuppliers(data.data || []))
      .catch(() => {})
    api.get('/api/products?active=true&limit=500')
      .then(({ data }) => setProducts(data.data || []))
      .catch(() => {})
  }, [])

  // Close supplier dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        supplierDropdownRef.current &&
        !supplierDropdownRef.current.contains(e.target as Node) &&
        supplierInputRef.current &&
        !supplierInputRef.current.contains(e.target as Node)
      ) {
        setSupplierDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filteredSuppliers = useMemo(() => {
    if (!supplierQuery.trim()) return suppliers
    const q = supplierQuery.toLowerCase()
    return suppliers.filter(
      (s) => s.name.toLowerCase().includes(q) || s.rfc?.toLowerCase().includes(q)
    )
  }, [suppliers, supplierQuery])

  const selectSupplier = (s: SupplierOption) => {
    setSelectedSupplier(s)
    setSupplierQuery(s.name)
    setSupplierDropdownOpen(false)
    if (s.paymentTerms) setPaymentTerms(s.paymentTerms)
  }

  // Item management
  const addItem = () => {
    setItems((prev) => [
      ...prev,
      { product_id: '', productName: '', quantity: 1, unit_cost: 0, discount: 0 },
    ])
  }

  const removeItem = (idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx))
  }

  const updateItem = (idx: number, field: keyof OrderLineItem, value: any) => {
    setItems((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, [field]: value } : item))
    )
  }

  const lineTotal = (item: OrderLineItem) => {
    const sub = item.quantity * item.unit_cost
    return sub - (sub * (item.discount / 100))
  }

  const grandTotal = items.reduce((sum, item) => sum + lineTotal(item), 0)

  const handleSave = async () => {
    if (!selectedSupplier) {
      toast.error('Selecciona un proveedor')
      return
    }
    if (items.length === 0) {
      toast.error('Agrega al menos un articulo')
      return
    }
    for (const item of items) {
      if (!item.product_id) {
        toast.error('Todos los articulos deben tener un producto seleccionado')
        return
      }
      if (item.quantity <= 0) {
        toast.error('La cantidad debe ser mayor a 0')
        return
      }
    }

    setSaving(true)
    try {
      await onCreate({
        supplier_id: selectedSupplier.id,
        payment_terms: paymentTerms,
        expected_date: expectedDate || undefined,
        delivery_address: deliveryAddress || undefined,
        delivery_notes: deliveryNotes || undefined,
        internal_notes: internalNotes || undefined,
        items: items.map((it) => ({
          product_id: it.product_id,
          quantity: it.quantity,
          unit_cost: it.unit_cost,
          discount: it.discount,
        })),
      })
    } catch {
      // error handled by parent
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="relative mx-4 w-full max-w-3xl rounded-xl border border-gray-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h3 className="text-lg font-semibold text-gray-900">Nueva Orden de Compra</h3>
          <button
            onClick={onClose}
            disabled={saving}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            type="button"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto p-6 space-y-5">
          {/* Supplier selector */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Proveedor *</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                ref={supplierInputRef}
                type="text"
                value={supplierQuery}
                onChange={(e) => {
                  setSupplierQuery(e.target.value)
                  setSupplierDropdownOpen(true)
                  if (selectedSupplier && e.target.value !== selectedSupplier.name) {
                    setSelectedSupplier(null)
                  }
                }}
                onFocus={() => setSupplierDropdownOpen(true)}
                placeholder="Buscar proveedor por nombre o RFC..."
                className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              />
              {supplierDropdownOpen && (
                <div
                  ref={supplierDropdownRef}
                  className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg"
                >
                  {filteredSuppliers.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-gray-500">Sin resultados</div>
                  ) : (
                    filteredSuppliers.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => selectSupplier(s)}
                        className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-gray-50"
                      >
                        <span className="font-medium text-gray-900">{s.name}</span>
                        {s.rfc && <span className="text-xs text-gray-400">{s.rfc}</span>}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Payment terms + expected date */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Terminos de Pago</label>
              <select
                value={paymentTerms}
                onChange={(e) => setPaymentTerms(e.target.value)}
                className={inputClass}
              >
                <option value="cash">Contado</option>
                <option value="credit">Credito</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Fecha Esperada</label>
              <input
                type="date"
                value={expectedDate}
                onChange={(e) => setExpectedDate(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          {/* Items */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700">Articulos *</label>
              <button
                type="button"
                onClick={addItem}
                className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                <Plus className="h-3.5 w-3.5" /> Agregar articulo
              </button>
            </div>

            {items.length === 0 ? (
              <div className="rounded-lg border border-dashed border-gray-300 py-8 text-center text-sm text-gray-400">
                Agrega articulos a la orden
              </div>
            ) : (
              <div className="rounded-lg border border-gray-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="px-3 py-2 text-left font-medium text-gray-600">Producto</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-600 w-20">Cant.</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-600 w-28">Costo Unit.</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-600 w-20">Desc.%</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-600 w-28">Subtotal</th>
                      <th className="px-3 py-2 w-10" />
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, idx) => (
                      <ItemRow
                        key={idx}
                        item={item}
                        products={products}
                        onUpdate={(field, value) => updateItem(idx, field, value)}
                        onRemove={() => removeItem(idx)}
                        lineTotal={lineTotal(item)}
                      />
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-gray-200 bg-gray-50">
                      <td colSpan={4} className="px-3 py-2 text-right text-sm font-semibold text-gray-700">Total</td>
                      <td className="px-3 py-2 text-right text-sm font-bold text-gray-900">{fmtMoney(grandTotal)}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Direccion de Entrega</label>
              <input
                type="text"
                value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)}
                className={inputClass}
                placeholder="Direccion donde se entregara la mercancia"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Notas de Entrega</label>
                <textarea
                  value={deliveryNotes}
                  onChange={(e) => setDeliveryNotes(e.target.value)}
                  rows={2}
                  className={inputClass}
                  placeholder="Instrucciones de entrega..."
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Notas Internas</label>
                <textarea
                  value={internalNotes}
                  onChange={(e) => setInternalNotes(e.target.value)}
                  rows={2}
                  className={inputClass}
                  placeholder="Notas internas..."
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-gray-200 px-6 py-4">
          <button
            onClick={onClose}
            disabled={saving}
            className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            type="button"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
            type="button"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Guardar borrador
          </button>
        </div>
      </div>
    </div>
  )
}

/* ───────────────────── Item Row with product search ───────────────────── */

function ItemRow({ item, products, onUpdate, onRemove, lineTotal }: {
  item: OrderLineItem
  products: ProductOption[]
  onUpdate: (field: keyof OrderLineItem, value: any) => void
  onRemove: () => void
  lineTotal: number
}) {
  const [productQuery, setProductQuery] = useState(item.productName || '')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filtered = useMemo(() => {
    if (!productQuery.trim()) return products.slice(0, 50)
    const q = productQuery.toLowerCase()
    return products.filter(
      (p) => p.name.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q)
    ).slice(0, 50)
  }, [products, productQuery])

  const selectProduct = (p: ProductOption) => {
    onUpdate('product_id', p.id)
    onUpdate('productName', p.name)
    const cost = typeof p.cost === 'string' ? parseFloat(p.cost) : (p.cost || 0)
    onUpdate('unit_cost', cost)
    setProductQuery(p.name)
    setDropdownOpen(false)
  }

  return (
    <tr className="border-b border-gray-100">
      <td className="px-3 py-2">
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={productQuery}
            onChange={(e) => {
              setProductQuery(e.target.value)
              setDropdownOpen(true)
              if (item.product_id && e.target.value !== item.productName) {
                onUpdate('product_id', '')
                onUpdate('productName', '')
              }
            }}
            onFocus={() => setDropdownOpen(true)}
            placeholder="Buscar producto..."
            className="w-full rounded border border-gray-200 px-2 py-1.5 text-sm focus:border-primary-500 focus:outline-none"
          />
          {dropdownOpen && (
            <div
              ref={dropdownRef}
              className="absolute z-20 mt-1 max-h-40 w-64 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg"
            >
              {filtered.length === 0 ? (
                <div className="px-3 py-2 text-xs text-gray-500">Sin resultados</div>
              ) : (
                filtered.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => selectProduct(p)}
                    className="flex w-full items-center justify-between px-3 py-1.5 text-left text-sm hover:bg-gray-50"
                  >
                    <div>
                      <span className="font-medium text-gray-900">{p.name}</span>
                      {p.sku && <span className="ml-2 text-xs text-gray-400">{p.sku}</span>}
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </td>
      <td className="px-3 py-2">
        <input
          type="number"
          min="1"
          step="1"
          value={item.quantity}
          onChange={(e) => onUpdate('quantity', parseFloat(e.target.value) || 0)}
          className="w-full rounded border border-gray-200 px-2 py-1.5 text-right text-sm focus:border-primary-500 focus:outline-none"
        />
      </td>
      <td className="px-3 py-2">
        <input
          type="number"
          min="0"
          step="0.01"
          value={item.unit_cost}
          onChange={(e) => onUpdate('unit_cost', parseFloat(e.target.value) || 0)}
          className="w-full rounded border border-gray-200 px-2 py-1.5 text-right text-sm focus:border-primary-500 focus:outline-none"
        />
      </td>
      <td className="px-3 py-2">
        <input
          type="number"
          min="0"
          max="100"
          step="0.5"
          value={item.discount}
          onChange={(e) => onUpdate('discount', parseFloat(e.target.value) || 0)}
          className="w-full rounded border border-gray-200 px-2 py-1.5 text-right text-sm focus:border-primary-500 focus:outline-none"
        />
      </td>
      <td className="px-3 py-2 text-right text-sm font-medium text-gray-900">
        {fmtMoney(lineTotal)}
      </td>
      <td className="px-3 py-2">
        <button
          type="button"
          onClick={onRemove}
          className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </td>
    </tr>
  )
}

/* ───────────────────── Order Detail ───────────────────── */

function OrderDetail({ order, onClose, onRefresh }: {
  order: PurchaseOrder; onClose: () => void; onRefresh: () => void
}) {
  const toast = useToast()
  const { approve, cancel } = usePurchaseOrderStore()
  const [submitting, setSubmitting] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [emailing, setEmailing] = useState(false)

  const handleDownloadPdf = async () => {
    setDownloading(true)
    try {
      const res = await api.get(`/api/purchase-orders/${order.id}/pdf`, { responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
      const a = document.createElement('a')
      a.href = url
      a.download = `OC-${order.series || ''}-${String(order.folio).padStart(4, '0')}.pdf`
      a.click()
      window.URL.revokeObjectURL(url)
    } catch (err: any) {
      toast.error('Error al descargar PDF')
    } finally {
      setDownloading(false)
    }
  }

  const handleSendEmail = async () => {
    if (!order.supplier?.email) {
      toast.warning('El proveedor no tiene email registrado')
      return
    }
    setEmailing(true)
    try {
      await api.post(`/api/purchase-orders/${order.id}/send-email`)
      toast.success('Orden enviada por email exitosamente')
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Error al enviar email')
    } finally {
      setEmailing(false)
    }
  }

  const handleApprove = async () => {
    setSubmitting(true)
    try {
      await approve(order.id)
      toast.success('Orden aprobada exitosamente')
      onRefresh()
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Error al aprobar orden')
    } finally {
      setSubmitting(false)
    }
  }

  const handleCancel = async () => {
    if (!confirm('¿Seguro que deseas cancelar esta orden?')) return
    setSubmitting(true)
    try {
      await cancel(order.id, 'Cancelada por usuario')
      toast.success('Orden cancelada exitosamente')
      onRefresh()
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Error al cancelar orden')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Detalle Orden — OC-{String(order.folio).padStart(4, '0')}
          </h2>
          <button onClick={onClose} className="rounded p-1 hover:bg-gray-100"><X className="h-5 w-5 text-gray-500" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-500">Proveedor</p>
              <p className="font-medium text-gray-900">{order.supplierName || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Status</p>
              <StatusBadge status={order.status} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-gray-500">Fecha</p>
              <p className="font-medium text-gray-900">{fmtDate(order.createdAt)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Fecha esperada</p>
              <p className="font-medium text-gray-900">{order.expectedDate ? fmtDate(order.expectedDate) : '—'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Total</p>
              <p className="text-lg font-bold text-gray-900">{fmtMoney(order.total)}</p>
            </div>
          </div>

          {/* Items list */}
          {order.items && order.items.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-semibold text-gray-900">Articulos</h3>
              <div className="rounded-lg border border-gray-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="px-3 py-2 text-left font-medium text-gray-600">Producto</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-600">Cant.</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-600">Recibido</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-600">Pendiente</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-600">Precio</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-600">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {order.items.map((item, idx) => {
                      const qty = Number(item.quantity) || 0
                      const received = Number(item.quantityReceived) || 0
                      const pending = Math.max(0, qty - received)
                      return (
                        <tr key={idx} className="border-b border-gray-100">
                          <td className="px-3 py-2 text-gray-700">{item.productName || '—'}</td>
                          <td className="px-3 py-2 text-right text-gray-600">{qty}</td>
                          <td className="px-3 py-2 text-right">
                            <span className={received >= qty ? 'text-green-700 font-medium' : received > 0 ? 'text-yellow-700' : 'text-gray-400'}>
                              {received}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right">
                            <span className={pending > 0 ? 'text-red-600 font-medium' : 'text-green-700'}>
                              {pending}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right text-gray-600">{fmtMoney(item.unitCost)}</td>
                          <td className="px-3 py-2 text-right font-medium text-gray-900">{fmtMoney(item.total)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Receipts list */}
          {order.receipts && order.receipts.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-semibold text-gray-900">Recepciones</h3>
              <div className="rounded-lg border border-gray-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="px-3 py-2 text-left font-medium text-gray-600">Fecha</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-600">Nota</th>
                    </tr>
                  </thead>
                  <tbody>
                    {order.receipts.map((r) => (
                      <tr key={r.id} className="border-b border-gray-100">
                        <td className="px-3 py-2 text-gray-600">{fmtDate(r.createdAt)}</td>
                        <td className="px-3 py-2 text-gray-500">{r.notes || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Status history */}
          {order.statusHistory && order.statusHistory.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-semibold text-gray-900">Historial</h3>
              <div className="space-y-2">
                {order.statusHistory.map((h: any, idx: number) => (
                  <div key={idx} className="flex items-start gap-3">
                    <Clock className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-400" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-medium text-gray-900">{h.changedByName || 'Sistema'}</span>
                        <span className="text-xs text-gray-400">({h.changedByRole})</span>
                      </div>
                      <p className="text-xs text-gray-600">
                        {h.fromStatus ? `${h.fromStatus} → ` : ''}{h.toStatus}
                        {h.notes && <span className="ml-1 text-gray-400">— {h.notes}</span>}
                      </p>
                      <p className="text-xs text-gray-400">{fmtDate(h.createdAt)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Close reason */}
          {order.status === 'closed' && order.closeReason && (
            <div className="rounded-lg border border-purple-200 bg-purple-50 p-4">
              <p className="text-xs font-medium text-purple-700 mb-1">Motivo de cierre</p>
              <p className="text-sm text-purple-900">{order.closeReason}</p>
              {order.closedAt && (
                <p className="mt-1 text-xs text-purple-500">Cerrada el {fmtDate(order.closedAt)}</p>
              )}
            </div>
          )}

          {/* Cancel reason */}
          {order.status === 'cancelled' && order.cancelReason && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4">
              <p className="text-xs font-medium text-red-700 mb-1">Motivo de cancelacion</p>
              <p className="text-sm text-red-900">{order.cancelReason}</p>
              {order.cancelledAt && (
                <p className="mt-1 text-xs text-red-500">Cancelada el {fmtDate(order.cancelledAt)}</p>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center justify-between border-t border-gray-200 px-6 py-4">
          <div className="flex gap-2">
            <button
              onClick={handleDownloadPdf}
              disabled={downloading}
              className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              PDF
            </button>
            <button
              onClick={handleSendEmail}
              disabled={emailing}
              className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {emailing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
              Enviar
            </button>
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
              Cerrar
            </button>
            {order.status === 'draft' && (
              <>
                <button
                  onClick={handleCancel}
                  disabled={submitting}
                  className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  <XCircle className="h-4 w-4" /> Cancelar
                </button>
                <button
                  onClick={handleApprove}
                  disabled={submitting}
                  className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                >
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  <CheckCircle className="h-4 w-4" /> Aprobar
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
