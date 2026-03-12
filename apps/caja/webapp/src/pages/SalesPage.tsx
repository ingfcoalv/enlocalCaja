import { useEffect, useState, useCallback } from 'react'
import {
  Search,
  Calendar,
  Eye,
  X,
  Loader2,
  Receipt,
  Banknote,
  CreditCard,
  ArrowRightLeft,
  Landmark,
  FileText,
  Printer,
  RotateCcw,
} from 'lucide-react'
import { api, useToast } from '@enlocal/react-hooks'

interface Sale {
  id: string
  ticketNumber?: string
  series?: string
  folio?: number
  status: string
  paymentMethod: string
  customerName?: string
  subtotal: number
  tax: number
  total: number
  observations?: string
  createdAt: string
}

interface SaleDetail {
  id: string
  ticketNumber?: string
  series?: string
  folio?: number
  status: string
  paymentMethod: string
  paymentForm: string
  customerName?: string
  subtotal: string
  tax: string
  total: string
  observations?: string
  createdAt: string
  items: {
    id: string
    description: string
    quantity: string
    unitPrice: string
    amount: string
    productId?: string
  }[]
  payments: {
    id: string
    method: string
    amount: number
    reference?: string
    isAbono: boolean
    createdAt: string
  }[]
  abonos: {
    id: string
    method: string
    amount: number
    reference?: string
    createdAt: string
  }[]
  totalPaid: number
  balance: number
  linkedInvoices: {
    id: string
    series?: string
    folio?: number
    status: string
    type: string
    uuidFiscal?: string
    total: number
  }[]
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amount)
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('es-MX', {
      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    })
  } catch { return dateStr }
}

function getPaymentIcon(method: string) {
  switch (method) {
    case 'cash': return <Banknote className="h-4 w-4" />
    case 'card': return <CreditCard className="h-4 w-4" />
    case 'transfer': return <ArrowRightLeft className="h-4 w-4" />
    case 'credit': return <Landmark className="h-4 w-4" />
    default: return <Receipt className="h-4 w-4" />
  }
}

function getPaymentLabel(method: string): string {
  switch (method) {
    case 'cash': return 'Efectivo'
    case 'card': return 'Tarjeta'
    case 'transfer': return 'Transferencia'
    case 'credit': return 'Credito'
    case 'PUE': return 'PUE'
    case 'PPD': return 'PPD'
    default: return method
  }
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'paid':
      return <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">Pagada</span>
    case 'partial':
      return <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700">Parcial</span>
    case 'credit':
      return <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">Credito</span>
    case 'draft':
      return <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">Borrador</span>
    case 'stamped':
      return <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">Timbrada</span>
    default:
      return <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">{status}</span>
  }
}

export default function SalesPage() {
  const toast = useToast()
  const [sales, setSales] = useState<Sale[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 7)
    return d.toISOString().split('T')[0]
  })
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0])
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')

  const [selectedSale, setSelectedSale] = useState<SaleDetail | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  // Return modal state
  const [showReturnModal, setShowReturnModal] = useState(false)
  const [returnSale, setReturnSale] = useState<SaleDetail | null>(null)
  const [returnItems, setReturnItems] = useState<Record<string, number>>({})
  const [returnReason, setReturnReason] = useState('')
  const [returnNotes, setReturnNotes] = useState('')
  const [submittingReturn, setSubmittingReturn] = useState(false)

  const fetchSales = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data } = await api.get('/api/sales', {
        params: {
          from: dateFrom,
          to: dateTo,
          q: searchQuery || undefined,
          status: statusFilter || undefined,
        },
      })
      const items = data?.data || data?.items || data || []
      setSales(Array.isArray(items) ? items : [])
    } catch {
      setError('Error al cargar las ventas')
      toast.error('Error al cargar las ventas')
    } finally {
      setLoading(false)
    }
  }, [dateFrom, dateTo, searchQuery, statusFilter, toast])

  useEffect(() => { fetchSales() }, [fetchSales])

  const handleViewDetail = async (saleId: string) => {
    setLoadingDetail(true)
    try {
      const { data } = await api.get(`/api/sales/${saleId}`)
      setSelectedSale(data)
    } catch {
      toast.error('Error al cargar detalle de venta')
    } finally {
      setLoadingDetail(false)
    }
  }

  const handleReprint = async (saleId: string) => {
    try {
      const { data } = await api.get(`/api/receipts/${saleId}/preview`)
      const preview = data?.data || data
      // Open print window with ticket content
      const printWindow = window.open('', '_blank', 'width=350,height=600')
      if (!printWindow) {
        toast.error('No se pudo abrir la ventana de impresion')
        return
      }
      const ticketLabel = preview.invoice?.ticketNumber || `${preview.invoice?.series || ''}-${preview.invoice?.folio || ''}`
      const itemsHtml = (preview.items || []).map((item: any) =>
        `<tr>
          <td style="padding:2px 0">${item.description}</td>
          <td style="text-align:right;padding:2px 4px">${item.quantity}</td>
          <td style="text-align:right;padding:2px 0">$${item.amount.toFixed(2)}</td>
        </tr>`
      ).join('')
      const paymentsHtml = (preview.payments || []).map((p: any) =>
        `<div style="display:flex;justify-content:space-between">
          <span>${getPaymentLabel(p.method)}</span>
          <span>$${p.amount.toFixed(2)}</span>
        </div>`
      ).join('')
      printWindow.document.write(`<!DOCTYPE html><html><head><title>Ticket ${ticketLabel}</title>
        <style>body{font-family:monospace;font-size:12px;width:280px;margin:0 auto;padding:10px}
        .center{text-align:center}.sep{border-top:1px dashed #000;margin:6px 0}
        table{width:100%;border-collapse:collapse}th{text-align:left;font-size:11px}
        .total{font-weight:bold;font-size:14px}
        @media print{body{margin:0;padding:5px}}</style></head><body>
        <div class="center"><b>TICKET DE VENTA</b></div>
        <div class="sep"></div>
        <div>Ticket: ${ticketLabel}</div>
        <div>Fecha: ${new Date(preview.invoice?.createdAt).toLocaleString('es-MX')}</div>
        ${preview.registerName ? `<div>Caja: ${preview.registerName}</div>` : ''}
        ${preview.cashierName ? `<div>Cajero: ${preview.cashierName}</div>` : ''}
        ${preview.customer ? `<div>Cliente: ${preview.customer.name}</div>` : ''}
        <div class="sep"></div>
        <table><thead><tr><th>Desc.</th><th style="text-align:right">Cant</th><th style="text-align:right">Importe</th></tr></thead>
        <tbody>${itemsHtml}</tbody></table>
        <div class="sep"></div>
        <div style="display:flex;justify-content:space-between"><span>Subtotal</span><span>$${preview.subtotal.toFixed(2)}</span></div>
        <div style="display:flex;justify-content:space-between"><span>IVA</span><span>$${preview.tax.toFixed(2)}</span></div>
        <div class="sep"></div>
        <div class="total" style="display:flex;justify-content:space-between"><span>TOTAL</span><span>$${preview.total.toFixed(2)}</span></div>
        <div class="sep"></div>
        ${paymentsHtml}
        ${preview.change > 0 ? `<div style="display:flex;justify-content:space-between"><span>Cambio</span><span>$${preview.change.toFixed(2)}</span></div>` : ''}
        <div class="sep"></div>
        <div class="center">Gracias por su compra</div>
        <script>setTimeout(()=>{window.print()},300)</script>
        </body></html>`)
      printWindow.document.close()
      toast.success('Ticket listo para imprimir')
    } catch {
      toast.error('Error al generar ticket')
    }
  }

  const handleOpenReturn = (sale: SaleDetail) => {
    setReturnSale(sale)
    setReturnItems({})
    setReturnReason('')
    setReturnNotes('')
    setShowReturnModal(true)
  }

  const handleToggleReturnItem = (itemId: string, maxQty: number) => {
    setReturnItems((prev) => {
      if (prev[itemId] !== undefined) {
        const next = { ...prev }
        delete next[itemId]
        return next
      }
      return { ...prev, [itemId]: maxQty }
    })
  }

  const handleReturnQtyChange = (itemId: string, qty: number) => {
    setReturnItems((prev) => ({ ...prev, [itemId]: qty }))
  }

  const handleSubmitReturn = async () => {
    if (!returnSale) return
    const itemsToReturn = returnSale.items
      .filter((item) => returnItems[item.id] !== undefined && returnItems[item.id] > 0)
      .map((item) => ({
        invoiceItemId: item.id,
        productId: item.productId || null,
        productName: item.description,
        quantity: returnItems[item.id],
        unitPrice: parseFloat(item.unitPrice),
      }))

    if (itemsToReturn.length === 0) {
      toast.error('Selecciona al menos un articulo para devolver')
      return
    }
    if (!returnReason.trim()) {
      toast.error('Ingresa una razon para la devolucion')
      return
    }

    setSubmittingReturn(true)
    try {
      await api.post(`/api/sales/${returnSale.id}/return`, {
        items: itemsToReturn,
        reason: returnReason,
        notes: returnNotes || undefined,
      })
      toast.success('Devolucion procesada exitosamente')
      setShowReturnModal(false)
      setSelectedSale(null)
      fetchSales()
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Error al procesar devolucion')
    } finally {
      setSubmittingReturn(false)
    }
  }

  const returnTotal = returnSale
    ? returnSale.items
        .filter((item) => returnItems[item.id] !== undefined)
        .reduce((sum, item) => sum + returnItems[item.id] * parseFloat(item.unitPrice), 0)
    : 0

  const totalRevenue = sales.reduce((sum, s) => sum + (parseFloat(String(s.total)) || 0), 0)

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Ventas</h1>
        <p className="mt-1 text-sm text-gray-500">Historial de ventas realizadas</p>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div>
          <label htmlFor="date-from" className="mb-1 block text-xs font-medium text-gray-600">Desde</label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input id="date-from" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
              className="rounded-lg border border-gray-300 py-2.5 pl-10 pr-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20" />
          </div>
        </div>
        <div>
          <label htmlFor="date-to" className="mb-1 block text-xs font-medium text-gray-600">Hasta</label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input id="date-to" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
              className="rounded-lg border border-gray-300 py-2.5 pl-10 pr-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20" />
          </div>
        </div>
        <div>
          <label htmlFor="status-filter" className="mb-1 block text-xs font-medium text-gray-600">Estado</label>
          <select id="status-filter" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-gray-300 py-2.5 px-3 text-sm focus:border-primary-500 focus:outline-none">
            <option value="">Todos</option>
            <option value="paid">Pagada</option>
            <option value="partial">Parcial</option>
            <option value="credit">Credito</option>
          </select>
        </div>
        <div className="flex-1">
          <label htmlFor="sale-search" className="mb-1 block text-xs font-medium text-gray-600">Buscar</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input id="sale-search" type="text" placeholder="Buscar por ticket, cliente..." value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-4 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20" />
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="mb-4 flex items-center gap-4 rounded-lg border border-gray-200 bg-white px-4 py-3">
        <div className="text-sm text-gray-500">
          <span className="font-medium text-gray-900">{sales.length}</span> ventas
        </div>
        <div className="h-4 w-px bg-gray-200" />
        <div className="text-sm text-gray-500">
          Total: <span className="font-bold text-primary-600">{formatCurrency(totalRevenue)}</span>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-3 font-medium text-gray-600">Fecha</th>
                <th className="px-4 py-3 font-medium text-gray-600">Ticket</th>
                <th className="px-4 py-3 font-medium text-gray-600">Cliente</th>
                <th className="px-4 py-3 font-medium text-gray-600">Estado</th>
                <th className="px-4 py-3 font-medium text-gray-600">Metodo</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">Total</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-gray-400" />
                    <p className="mt-2 text-sm text-gray-500">Cargando ventas...</p>
                  </td>
                </tr>
              ) : sales.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <Receipt className="mx-auto h-8 w-8 text-gray-300" />
                    <p className="mt-2 text-sm text-gray-500">No se encontraron ventas</p>
                  </td>
                </tr>
              ) : (
                sales.map((sale) => (
                  <tr key={sale.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-600">{formatDate(sale.createdAt)}</td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs font-medium text-primary-700">
                        {sale.ticketNumber || sale.id.slice(0, 8)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{sale.customerName || '-'}</td>
                    <td className="px-4 py-3">{getStatusBadge(sale.status)}</td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1.5 text-gray-600">
                        {getPaymentIcon(sale.paymentMethod)}
                        <span className="text-xs">{getPaymentLabel(sale.paymentMethod)}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">
                      {formatCurrency(parseFloat(String(sale.total)))}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleReprint(sale.id)}
                          className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-primary-600"
                          title="Reimprimir ticket"
                          type="button"
                        >
                          <Printer className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleViewDetail(sale.id)}
                          className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-primary-600"
                          title="Ver detalle"
                          type="button"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sale Detail Modal */}
      {(selectedSale || loadingDetail) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="relative mx-4 w-full max-w-lg rounded-xl border border-gray-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Detalle de venta
                {selectedSale?.ticketNumber && (
                  <span className="ml-2 font-mono text-sm text-primary-600">{selectedSale.ticketNumber}</span>
                )}
              </h3>
              <button
                onClick={() => { setSelectedSale(null) }}
                className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                type="button"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {loadingDetail ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : selectedSale && (
              <div className="max-h-[70vh] overflow-y-auto p-6">
                {/* Status + Info */}
                <div className="mb-4 grid grid-cols-2 gap-4 rounded-lg bg-gray-50 p-4">
                  <div>
                    <p className="text-xs text-gray-500">Fecha</p>
                    <p className="text-sm font-medium text-gray-900">{formatDate(selectedSale.createdAt)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Estado</p>
                    <div className="mt-0.5">{getStatusBadge(selectedSale.status)}</div>
                  </div>
                  {selectedSale.customerName && (
                    <div>
                      <p className="text-xs text-gray-500">Cliente</p>
                      <p className="text-sm font-medium text-gray-900">{selectedSale.customerName}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs text-gray-500">Metodo pago</p>
                    <p className="text-sm font-medium text-gray-900">{getPaymentLabel(selectedSale.paymentMethod)}</p>
                  </div>
                </div>

                {selectedSale.observations && (
                  <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
                    <p className="text-xs font-medium text-amber-700">Observaciones</p>
                    <p className="text-sm text-amber-800">{selectedSale.observations}</p>
                  </div>
                )}

                {/* Items */}
                <h4 className="mb-2 text-sm font-semibold text-gray-700">Articulos</h4>
                <div className="mb-4 space-y-2">
                  {selectedSale.items?.map((item) => (
                    <div key={item.id} className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                      <div>
                        <p className="text-sm font-medium text-gray-800">{item.description}</p>
                        <p className="text-xs text-gray-500">{parseFloat(item.quantity)} x {formatCurrency(parseFloat(item.unitPrice))}</p>
                      </div>
                      <p className="text-sm font-medium text-gray-900">{formatCurrency(parseFloat(item.amount))}</p>
                    </div>
                  ))}
                </div>

                {/* Payments breakdown */}
                <h4 className="mb-2 text-sm font-semibold text-gray-700">Pagos</h4>
                <div className="mb-4 space-y-2">
                  {selectedSale.payments?.filter((p) => !p.isAbono).map((payment) => (
                    <div key={payment.id} className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                      <div className="flex items-center gap-2">
                        {getPaymentIcon(payment.method)}
                        <span className="text-sm text-gray-700">{getPaymentLabel(payment.method)}</span>
                        {payment.reference && <span className="text-xs text-gray-400">Ref: {payment.reference}</span>}
                      </div>
                      <span className={`text-sm font-medium ${payment.amount < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                        {formatCurrency(payment.amount)}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Abonos */}
                {selectedSale.abonos && selectedSale.abonos.length > 0 && (
                  <>
                    <h4 className="mb-2 text-sm font-semibold text-gray-700">Abonos</h4>
                    <div className="mb-4 space-y-2">
                      {selectedSale.abonos.map((abono) => (
                        <div key={abono.id} className="flex items-center justify-between rounded-lg border border-green-100 bg-green-50 px-3 py-2">
                          <div className="flex items-center gap-2">
                            {getPaymentIcon(abono.method)}
                            <span className="text-sm text-green-700">{getPaymentLabel(abono.method)}</span>
                            <span className="text-xs text-green-500">{formatDate(abono.createdAt)}</span>
                          </div>
                          <span className="text-sm font-medium text-green-700">{formatCurrency(abono.amount)}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {/* Totals */}
                <div className="space-y-1.5 rounded-lg border border-gray-200 p-4">
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>Subtotal</span>
                    <span>{formatCurrency(parseFloat(selectedSale.subtotal))}</span>
                  </div>
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>IVA</span>
                    <span>{formatCurrency(parseFloat(selectedSale.tax))}</span>
                  </div>
                  <div className="flex justify-between border-t border-gray-200 pt-1.5 text-base font-bold text-gray-900">
                    <span>Total</span>
                    <span className="text-primary-600">{formatCurrency(parseFloat(selectedSale.total))}</span>
                  </div>
                  {selectedSale.balance > 0 && (
                    <div className="flex justify-between text-sm font-semibold text-red-600">
                      <span>Saldo pendiente</span>
                      <span>{formatCurrency(selectedSale.balance)}</span>
                    </div>
                  )}
                </div>

                {/* Linked CFDI invoices */}
                {selectedSale.linkedInvoices && selectedSale.linkedInvoices.length > 0 && (
                  <div className="mt-4">
                    <h4 className="mb-2 text-sm font-semibold text-gray-700">Facturas CFDI</h4>
                    <div className="space-y-2">
                      {selectedSale.linkedInvoices.map((inv) => (
                        <div key={inv.id} className="flex items-center justify-between rounded-lg border border-blue-100 bg-blue-50 px-3 py-2">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-blue-600" />
                            <span className="text-sm text-blue-700">
                              {inv.series}-{inv.folio} ({inv.type})
                            </span>
                            {getStatusBadge(inv.status)}
                          </div>
                          <span className="text-sm font-medium text-blue-700">{formatCurrency(inv.total)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center justify-between border-t border-gray-200 px-6 py-4">
              <div className="flex gap-2">
                {selectedSale && (
                  <>
                    <button
                      onClick={() => handleReprint(selectedSale.id)}
                      className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                      type="button"
                    >
                      <Printer className="h-4 w-4" />
                      Reimprimir
                    </button>
                    <button
                      onClick={() => handleOpenReturn(selectedSale)}
                      className="flex items-center gap-1.5 rounded-lg border border-red-300 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
                      type="button"
                    >
                      <RotateCcw className="h-4 w-4" />
                      Devolucion
                    </button>
                  </>
                )}
              </div>
              <button
                onClick={() => setSelectedSale(null)}
                className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                type="button"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Return Modal */}
      {showReturnModal && returnSale && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="relative mx-4 w-full max-w-lg rounded-xl border border-gray-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Devolucion de venta</h3>
                <p className="text-xs text-gray-500">
                  Ticket: {returnSale.ticketNumber || returnSale.id.slice(0, 8)}
                </p>
              </div>
              <button
                onClick={() => setShowReturnModal(false)}
                disabled={submittingReturn}
                className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                type="button"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto p-6">
              <p className="mb-3 text-sm text-gray-600">Selecciona los articulos a devolver:</p>

              <div className="mb-4 space-y-2">
                {returnSale.items?.map((item) => {
                  const maxQty = parseFloat(item.quantity)
                  const selected = returnItems[item.id] !== undefined
                  return (
                    <div
                      key={item.id}
                      className={`rounded-lg border p-3 transition-colors ${
                        selected ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => handleToggleReturnItem(item.id, maxQty)}
                          className="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
                        />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-800">{item.description}</p>
                          <p className="text-xs text-gray-500">
                            {maxQty} x {formatCurrency(parseFloat(item.unitPrice))} = {formatCurrency(parseFloat(item.amount))}
                          </p>
                        </div>
                        {selected && (
                          <div className="flex items-center gap-2">
                            <label className="text-xs text-gray-500">Cant:</label>
                            <input
                              type="number"
                              min="0.01"
                              max={maxQty}
                              step="0.01"
                              value={returnItems[item.id] ?? maxQty}
                              onChange={(e) => {
                                const val = Math.min(parseFloat(e.target.value) || 0, maxQty)
                                handleReturnQtyChange(item.id, val)
                              }}
                              className="w-20 rounded border border-gray-300 px-2 py-1 text-right text-sm font-mono"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="mb-4">
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Razon de devolucion <span className="text-red-500">*</span>
                </label>
                <select
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm"
                >
                  <option value="">Selecciona una razon</option>
                  <option value="Producto defectuoso">Producto defectuoso</option>
                  <option value="Producto equivocado">Producto equivocado</option>
                  <option value="Cliente cambio de opinion">Cliente cambio de opinion</option>
                  <option value="Error en venta">Error en venta</option>
                  <option value="Otro">Otro</option>
                </select>
              </div>

              <div className="mb-4">
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Notas (opcional)</label>
                <textarea
                  value={returnNotes}
                  onChange={(e) => setReturnNotes(e.target.value)}
                  placeholder="Detalles adicionales..."
                  rows={2}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>

              {/* Return total */}
              <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-red-700">Total a devolver</span>
                  <span className="text-lg font-bold text-red-700">{formatCurrency(returnTotal)}</span>
                </div>
                <p className="mt-1 text-xs text-red-500">
                  El inventario se repondra automaticamente
                </p>
              </div>
            </div>

            <div className="flex gap-3 border-t border-gray-200 px-6 py-4">
              <button
                onClick={() => setShowReturnModal(false)}
                disabled={submittingReturn}
                className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                type="button"
              >
                Cancelar
              </button>
              <button
                onClick={handleSubmitReturn}
                disabled={submittingReturn || returnTotal <= 0 || !returnReason}
                className="flex-1 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                type="button"
              >
                {submittingReturn ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Procesando...
                  </span>
                ) : (
                  'Procesar devolucion'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
