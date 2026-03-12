import { useEffect, useState } from 'react'
import { api, useToast } from '@enlocal/react-hooks'
import { BarChart3, DollarSign, Loader2, Package, ShoppingCart } from 'lucide-react'

interface ProductRow {
  productId: string
  name: string
  quantity: number
  total: number
  avgPrice: number
}

const formatCurrency = (amount: number): string =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amount)

export default function ProductPerformancePage() {
  const toast = useToast()

  const [dateFrom, setDateFrom] = useState(() => {
    const firstOfMonth = new Date(); firstOfMonth.setDate(1)
    return firstOfMonth.toISOString().split('T')[0]
  })
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0])
  const [loading, setLoading] = useState(false)
  const [products, setProducts] = useState<ProductRow[]>([])

  const handleSearch = async () => {
    setLoading(true)
    try {
      const { data: res } = await api.get('/api/reports/products', {
        params: { from: dateFrom, to: dateTo },
      })
      const rows = res?.data || res || []
      setProducts(
        Array.isArray(rows)
          ? rows.slice(0, 50).map((r: any) => ({
              productId: r.productId ?? r.product_id ?? '',
              name: r.name ?? '',
              quantity: parseFloat(String(r.quantity ?? 0)),
              total: parseFloat(String(r.total ?? 0)),
              avgPrice: parseFloat(String(r.avgPrice ?? r.avg_price ?? 0)),
            }))
          : []
      )
    } catch {
      toast.error('Error al cargar reporte de productos')
      setProducts([])
    } finally {
      setLoading(false)
    }
  }

  const totalUnits = products.reduce((s, p) => s + p.quantity, 0)
  const totalRevenue = products.reduce((s, p) => s + p.total, 0)
  const uniqueProducts = products.length

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Rendimiento de Productos</h1>
        <p className="mt-1 text-sm text-gray-500">Analisis de ventas por producto</p>
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
      {products.length > 0 && (
        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-gray-500">Total productos vendidos</p>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-100">
                <Package className="h-4 w-4 text-primary-600" />
              </div>
            </div>
            <p className="mt-2 text-xl font-bold text-gray-900">{uniqueProducts}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-gray-500">Unidades vendidas</p>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100">
                <ShoppingCart className="h-4 w-4 text-blue-600" />
              </div>
            </div>
            <p className="mt-2 text-xl font-bold text-gray-900">
              {new Intl.NumberFormat('es-MX').format(totalUnits)}
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-gray-500">Ingreso total</p>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-100">
                <DollarSign className="h-4 w-4 text-green-600" />
              </div>
            </div>
            <p className="mt-2 text-xl font-bold text-gray-900">{formatCurrency(totalRevenue)}</p>
          </div>
        </div>
      )}

      {/* Products Table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-5 py-4">
          <h2 className="text-sm font-semibold text-gray-900">Top productos por ingreso</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-3 text-xs font-medium text-gray-600">#</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-600">Producto</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-600">Unidades</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-600">Precio Promedio</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-600">Total</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-600">% del Total</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-gray-400" />
                    <p className="mt-2 text-sm text-gray-500">Cargando productos...</p>
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center">
                    <Package className="mx-auto h-8 w-8 text-gray-300" />
                    <p className="mt-2 text-sm text-gray-500">Selecciona un rango de fechas y consulta</p>
                  </td>
                </tr>
              ) : (
                products.map((product, idx) => {
                  const pct = totalRevenue > 0 ? ((product.total / totalRevenue) * 100).toFixed(1) : '0.0'
                  return (
                    <tr key={product.productId || idx} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3 text-xs text-gray-400">{idx + 1}</td>
                      <td className="px-4 py-3 font-medium text-gray-900">{product.name}</td>
                      <td className="px-4 py-3 text-right text-gray-600">
                        {new Intl.NumberFormat('es-MX').format(product.quantity)}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600">{formatCurrency(product.avgPrice)}</td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900">{formatCurrency(product.total)}</td>
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
