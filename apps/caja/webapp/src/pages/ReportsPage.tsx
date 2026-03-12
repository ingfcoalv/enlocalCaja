import { useEffect, useState } from 'react'
import {
  DollarSign,
  ShoppingBag,
  TrendingUp,
  Users,
  Loader2,
  Calendar,
  BarChart3,
} from 'lucide-react'
import { api } from '@enlocal/react-hooks'

interface DashboardReport {
  totalSales: number
  orderCount: number
  averageTicket: number
  customerCount: number
  topProducts: Array<{ name: string; quantity: number; revenue: number }>
  paymentMethods: Array<{ method: string; count: number; total: number }>
}

interface SalesRow {
  date: string
  sales: number
  orders: number
  average: number
}

export default function ReportsPage() {
  const [dashboard, setDashboard] = useState<DashboardReport | null>(null)
  const [salesData, setSalesData] = useState<SalesRow[]>([])
  const [loadingDashboard, setLoadingDashboard] = useState(true)
  const [loadingSales, setLoadingSales] = useState(true)
  const [period, setPeriod] = useState('week')

  useEffect(() => {
    const fetchDashboard = async () => {
      setLoadingDashboard(true)
      try {
        const { data } = await api.get('/api/reports/dashboard', {
          params: { period },
        })
        const d = data?.data || data
        setDashboard({
          totalSales: d.totalSales ?? d.total_sales ?? 0,
          orderCount: d.orderCount ?? d.order_count ?? 0,
          averageTicket: d.averageTicket ?? d.average_ticket ?? 0,
          customerCount: d.customerCount ?? d.customer_count ?? 0,
          topProducts: d.topProducts ?? d.top_products ?? [],
          paymentMethods: d.paymentMethods ?? d.payment_methods ?? [],
        })
      } catch {
        setDashboard({
          totalSales: 0,
          orderCount: 0,
          averageTicket: 0,
          customerCount: 0,
          topProducts: [],
          paymentMethods: [],
        })
      } finally {
        setLoadingDashboard(false)
      }
    }

    fetchDashboard()
  }, [period])

  useEffect(() => {
    const fetchSales = async () => {
      setLoadingSales(true)
      try {
        const { data } = await api.get('/api/reports/sales', {
          params: { group_by: 'day', period },
        })
        const rows = data?.data || data || []
        setSalesData(
          Array.isArray(rows)
            ? rows.map((r: Record<string, unknown>) => ({
                date: (r.date ?? r.period ?? '') as string,
                sales: (r.sales ?? r.total ?? r.totalSales ?? 0) as number,
                orders: (r.orders ?? r.orderCount ?? r.order_count ?? 0) as number,
                average: (r.average ?? r.averageTicket ?? r.average_ticket ?? 0) as number,
              }))
            : []
        )
      } catch {
        setSalesData([])
      } finally {
        setLoadingSales(false)
      }
    }

    fetchSales()
  }, [period])

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
    }).format(amount)
  }

  const formatDateShort = (dateStr: string): string => {
    try {
      return new Date(dateStr).toLocaleDateString('es-MX', {
        month: 'short',
        day: 'numeric',
      })
    } catch {
      return dateStr
    }
  }

  const getPaymentLabel = (method: string): string => {
    switch (method) {
      case 'cash':
        return 'Efectivo'
      case 'card':
        return 'Tarjeta'
      case 'transfer':
        return 'Transferencia'
      default:
        return method
    }
  }

  const maxSales = salesData.length > 0 ? Math.max(...salesData.map((r) => r.sales)) : 0

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reportes</h1>
          <p className="mt-1 text-sm text-gray-500">
            Analisis de ventas y rendimiento
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-gray-400" />
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
          >
            <option value="today">Hoy</option>
            <option value="week">Esta semana</option>
            <option value="month">Este mes</option>
            <option value="year">Este anio</option>
          </select>
        </div>
      </div>

      {/* Summary Cards */}
      {loadingDashboard ? (
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="animate-pulse rounded-xl border border-gray-200 bg-white p-5"
            >
              <div className="mb-3 h-3 w-16 rounded bg-gray-200" />
              <div className="h-7 w-24 rounded bg-gray-200" />
            </div>
          ))}
        </div>
      ) : dashboard ? (
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-gray-500">Total Ventas</p>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-100">
                <DollarSign className="h-4 w-4 text-primary-600" />
              </div>
            </div>
            <p className="mt-2 text-xl font-bold text-gray-900">
              {formatCurrency(dashboard.totalSales)}
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-gray-500">Ordenes</p>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100">
                <ShoppingBag className="h-4 w-4 text-blue-600" />
              </div>
            </div>
            <p className="mt-2 text-xl font-bold text-gray-900">
              {dashboard.orderCount}
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-gray-500">
                Ticket Promedio
              </p>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100">
                <TrendingUp className="h-4 w-4 text-amber-600" />
              </div>
            </div>
            <p className="mt-2 text-xl font-bold text-gray-900">
              {formatCurrency(dashboard.averageTicket)}
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-gray-500">Clientes</p>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-100">
                <Users className="h-4 w-4 text-violet-600" />
              </div>
            </div>
            <p className="mt-2 text-xl font-bold text-gray-900">
              {dashboard.customerCount}
            </p>
          </div>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Sales Chart (Table View) */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-5 py-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-gray-500" />
              <h2 className="text-sm font-semibold text-gray-900">
                Ventas por dia
              </h2>
            </div>
          </div>
          {loadingSales ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : salesData.length === 0 ? (
            <div className="py-12 text-center">
              <BarChart3 className="mx-auto h-8 w-8 text-gray-300" />
              <p className="mt-2 text-sm text-gray-500">
                Sin datos para este periodo
              </p>
            </div>
          ) : (
            <div className="p-5">
              {/* Simple bar chart */}
              <div className="space-y-3">
                {salesData.map((row, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    <span className="w-16 flex-shrink-0 text-right text-xs text-gray-500">
                      {formatDateShort(row.date)}
                    </span>
                    <div className="flex-1">
                      <div className="relative h-6 overflow-hidden rounded-full bg-gray-100">
                        <div
                          className="absolute inset-y-0 left-0 rounded-full bg-primary-500 transition-all"
                          style={{
                            width: maxSales > 0 ? `${(row.sales / maxSales) * 100}%` : '0%',
                          }}
                        />
                      </div>
                    </div>
                    <span className="w-24 flex-shrink-0 text-right text-xs font-medium text-gray-700">
                      {formatCurrency(row.sales)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Table below chart */}
              <div className="mt-4 overflow-x-auto rounded-lg border border-gray-100">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="px-3 py-2 text-left font-medium text-gray-600">
                        Fecha
                      </th>
                      <th className="px-3 py-2 text-right font-medium text-gray-600">
                        Ventas
                      </th>
                      <th className="px-3 py-2 text-right font-medium text-gray-600">
                        Ordenes
                      </th>
                      <th className="px-3 py-2 text-right font-medium text-gray-600">
                        Promedio
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {salesData.map((row, idx) => (
                      <tr
                        key={idx}
                        className="border-t border-gray-50 hover:bg-gray-50"
                      >
                        <td className="px-3 py-2 text-gray-600">
                          {formatDateShort(row.date)}
                        </td>
                        <td className="px-3 py-2 text-right font-medium text-gray-900">
                          {formatCurrency(row.sales)}
                        </td>
                        <td className="px-3 py-2 text-right text-gray-600">
                          {row.orders}
                        </td>
                        <td className="px-3 py-2 text-right text-gray-600">
                          {formatCurrency(row.average)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Right side: Top products + Payment methods */}
        <div className="space-y-6">
          {/* Top Products */}
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-200 px-5 py-4">
              <h2 className="text-sm font-semibold text-gray-900">
                Productos mas vendidos
              </h2>
            </div>
            {loadingDashboard ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
              </div>
            ) : dashboard && dashboard.topProducts.length > 0 ? (
              <div className="p-4">
                <div className="space-y-3">
                  {dashboard.topProducts.slice(0, 10).map((product, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-50 text-xs font-bold text-primary-700">
                          {idx + 1}
                        </span>
                        <span className="text-sm text-gray-800">
                          {product.name}
                        </span>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-gray-900">
                          {formatCurrency(product.revenue)}
                        </p>
                        <p className="text-xs text-gray-400">
                          {product.quantity} uds
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="py-8 text-center">
                <p className="text-sm text-gray-400">Sin datos</p>
              </div>
            )}
          </div>

          {/* Payment Methods Breakdown */}
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-200 px-5 py-4">
              <h2 className="text-sm font-semibold text-gray-900">
                Metodos de pago
              </h2>
            </div>
            {loadingDashboard ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
              </div>
            ) : dashboard && dashboard.paymentMethods.length > 0 ? (
              <div className="p-4">
                <div className="space-y-3">
                  {dashboard.paymentMethods.map((pm, idx) => {
                    const totalPm = dashboard.paymentMethods.reduce(
                      (s, p) => s + p.total,
                      0
                    )
                    const pct =
                      totalPm > 0 ? ((pm.total / totalPm) * 100).toFixed(1) : '0'
                    return (
                      <div key={idx}>
                        <div className="mb-1 flex items-center justify-between">
                          <span className="text-sm text-gray-700">
                            {getPaymentLabel(pm.method)}
                          </span>
                          <span className="text-sm font-medium text-gray-900">
                            {formatCurrency(pm.total)}{' '}
                            <span className="text-xs text-gray-400">
                              ({pct}%)
                            </span>
                          </span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                          <div
                            className="h-full rounded-full bg-primary-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : (
              <div className="py-8 text-center">
                <p className="text-sm text-gray-400">Sin datos</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
