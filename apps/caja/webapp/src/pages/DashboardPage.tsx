import { useEffect, useState } from 'react'
import { api } from '@enlocal/react-hooks'
import { DollarSign, ShoppingBag, TrendingUp, ArrowUpRight, ArrowDownRight } from 'lucide-react'

interface DashboardData {
  totalSales: number
  orderCount: number
  averageTicket: number
  comparisonSales?: number
  comparisonOrders?: number
  comparisonTicket?: number
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchDashboard = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await api.get('/api/sales/dashboard', {
          params: { date: 'today' },
        })
        const d = res.data?.data || res.data
        setData({
          totalSales: d.totalSales ?? d.total_sales ?? 0,
          orderCount: d.orderCount ?? d.order_count ?? 0,
          averageTicket: d.averageTicket ?? d.average_ticket ?? 0,
          comparisonSales: d.comparisonSales ?? d.comparison_sales,
          comparisonOrders: d.comparisonOrders ?? d.comparison_orders,
          comparisonTicket: d.comparisonTicket ?? d.comparison_ticket,
        })
      } catch {
        setError('No se pudieron cargar los datos del dashboard')
        setData({
          totalSales: 0,
          orderCount: 0,
          averageTicket: 0,
        })
      } finally {
        setLoading(false)
      }
    }

    fetchDashboard()
  }, [])

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
    }).format(amount)
  }

  const getChangeIndicator = (current: number, comparison?: number) => {
    if (comparison === undefined || comparison === 0) return null
    const pct = ((current - comparison) / comparison) * 100
    const isPositive = pct >= 0
    return (
      <span
        className={`flex items-center gap-0.5 text-xs font-medium ${
          isPositive ? 'text-green-600' : 'text-red-600'
        }`}
      >
        {isPositive ? (
          <ArrowUpRight className="h-3 w-3" />
        ) : (
          <ArrowDownRight className="h-3 w-3" />
        )}
        {Math.abs(pct).toFixed(1)}%
      </span>
    )
  }

  const cards = data
    ? [
        {
          title: 'Total Ventas',
          value: formatCurrency(data.totalSales),
          icon: DollarSign,
          color: 'bg-primary-100 text-primary-700',
          iconColor: 'text-primary-600',
          comparison: data.comparisonSales,
          current: data.totalSales,
        },
        {
          title: 'Ordenes',
          value: data.orderCount.toString(),
          icon: ShoppingBag,
          color: 'bg-blue-100 text-blue-700',
          iconColor: 'text-blue-600',
          comparison: data.comparisonOrders,
          current: data.orderCount,
        },
        {
          title: 'Ticket Promedio',
          value: formatCurrency(data.averageTicket),
          icon: TrendingUp,
          color: 'bg-amber-100 text-amber-700',
          iconColor: 'text-amber-600',
          comparison: data.comparisonTicket,
          current: data.averageTicket,
        },
      ]
    : []

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">
          Resumen de ventas del dia
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="animate-pulse rounded-xl border border-gray-200 bg-white p-6"
            >
              <div className="mb-4 h-4 w-24 rounded bg-gray-200" />
              <div className="h-8 w-32 rounded bg-gray-200" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((card) => (
            <div
              key={card.title}
              className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-500">
                  {card.title}
                </p>
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-lg ${card.color}`}
                >
                  <card.icon className={`h-5 w-5 ${card.iconColor}`} />
                </div>
              </div>
              <div className="mt-3 flex items-end gap-2">
                <p className="text-2xl font-bold text-gray-900">
                  {card.value}
                </p>
                {getChangeIndicator(card.current, card.comparison)}
              </div>
              <p className="mt-1 text-xs text-gray-400">vs. dia anterior</p>
            </div>
          ))}
        </div>
      )}

      {/* Quick actions */}
      <div className="mt-8">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          Accesos rapidos
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <a
            href="/pos"
            className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-colors hover:border-primary-300 hover:bg-primary-50"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-100">
              <ShoppingBag className="h-5 w-5 text-primary-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">Nueva venta</p>
              <p className="text-xs text-gray-500">Abrir punto de venta</p>
            </div>
          </a>
          <a
            href="/products"
            className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-colors hover:border-primary-300 hover:bg-primary-50"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
              <DollarSign className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">Productos</p>
              <p className="text-xs text-gray-500">Gestionar catalogo</p>
            </div>
          </a>
        </div>
      </div>
    </div>
  )
}
