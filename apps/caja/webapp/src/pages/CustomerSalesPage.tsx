import { useEffect, useState } from 'react'
import { api, useToast } from '@enlocal/react-hooks'
import { BarChart3, DollarSign, Loader2, TrendingUp, Users } from 'lucide-react'

interface CustomerRow {
  customerId: string
  name: string
  totalOrders: number
  totalSpent: number
  avgTicket: number
  lastOrder: string
}

const formatCurrency = (amount: number): string =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amount)

const formatDateOnly = (dateStr: string): string => {
  try {
    const d = new Date(dateStr)
    return d.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' })
  } catch {
    return dateStr
  }
}

export default function CustomerSalesPage() {
  const toast = useToast()

  const [dateFrom, setDateFrom] = useState(() => {
    const firstOfMonth = new Date(); firstOfMonth.setDate(1)
    return firstOfMonth.toISOString().split('T')[0]
  })
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0])
  const [loading, setLoading] = useState(false)
  const [customers, setCustomers] = useState<CustomerRow[]>([])

  const handleSearch = async () => {
    setLoading(true)
    try {
      const { data: res } = await api.get('/api/reports/customers', {
        params: { from: dateFrom, to: dateTo },
      })
      const rows = res?.data || res || []
      setCustomers(
        Array.isArray(rows)
          ? rows.map((r: any) => ({
              customerId: r.customerId ?? r.customer_id ?? '',
              name: r.name ?? '',
              totalOrders: parseInt(String(r.totalOrders ?? r.total_orders ?? 0), 10),
              totalSpent: parseFloat(String(r.totalSpent ?? r.total_spent ?? 0)),
              avgTicket: parseFloat(String(r.avgTicket ?? r.avg_ticket ?? 0)),
              lastOrder: r.lastOrder ?? r.last_order ?? '',
            }))
          : []
      )
    } catch {
      toast.error('Error al cargar reporte de clientes')
      setCustomers([])
    } finally {
      setLoading(false)
    }
  }

  const totalSpentAll = customers.reduce((s, c) => s + c.totalSpent, 0)
  const totalClients = customers.length
  const avgTicketGlobal = totalClients > 0
    ? customers.reduce((s, c) => s + c.totalSpent, 0) / customers.reduce((s, c) => s + c.totalOrders, 0)
    : 0

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Ventas por Cliente</h1>
        <p className="mt-1 text-sm text-gray-500">Analisis de ventas por cliente</p>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 bg-white p-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Desde</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Hasta</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
          />
        </div>
        <button
          onClick={handleSearch}
          disabled={loading}
          className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
          type="button"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <BarChart3 className="h-4 w-4" />}
          Consultar
        </button>
      </div>

      {/* Summary Cards */}
      {customers.length > 0 && (
        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-gray-500">Total clientes</p>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-100">
                <Users className="h-4 w-4 text-primary-600" />
              </div>
            </div>
            <p className="mt-2 text-xl font-bold text-gray-900">{totalClients}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-gray-500">Venta total</p>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-100">
                <DollarSign className="h-4 w-4 text-green-600" />
              </div>
            </div>
            <p className="mt-2 text-xl font-bold text-gray-900">{formatCurrency(totalSpentAll)}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-gray-500">Ticket promedio global</p>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100">
                <TrendingUp className="h-4 w-4 text-amber-600" />
              </div>
            </div>
            <p className="mt-2 text-xl font-bold text-gray-900">
              {isFinite(avgTicketGlobal) ? formatCurrency(avgTicketGlobal) : '$0.00'}
            </p>
          </div>
        </div>
      )}

      {/* Customers Table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-5 py-4">
          <h2 className="text-sm font-semibold text-gray-900">Detalle por cliente</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-3 text-xs font-medium text-gray-600">#</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-600">Cliente</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-600">Compras</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-600">Total Gastado</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-600">Ticket Promedio</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-600">Ultima Compra</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-600">% del Total</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-gray-400" />
                    <p className="mt-2 text-sm text-gray-500">Cargando clientes...</p>
                  </td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <Users className="mx-auto h-8 w-8 text-gray-300" />
                    <p className="mt-2 text-sm text-gray-500">Selecciona un rango de fechas y consulta</p>
                  </td>
                </tr>
              ) : (
                customers.map((customer, idx) => {
                  const pct = totalSpentAll > 0 ? ((customer.totalSpent / totalSpentAll) * 100).toFixed(1) : '0.0'
                  return (
                    <tr key={customer.customerId || idx} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3 text-xs text-gray-400">{idx + 1}</td>
                      <td className="px-4 py-3 font-medium text-gray-900">{customer.name}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{customer.totalOrders}</td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900">{formatCurrency(customer.totalSpent)}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{formatCurrency(customer.avgTicket)}</td>
                      <td className="px-4 py-3 text-right text-gray-500">
                        {customer.lastOrder ? formatDateOnly(customer.lastOrder) : '-'}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-500">{pct}%</td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
