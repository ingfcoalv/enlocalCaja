import { useEffect, useState } from 'react'
import { AlertTriangle, Download, Loader2, Filter, Package } from 'lucide-react'
import { useAuth, useToast } from '@enlocal/react-hooks'

interface LowStockItem {
  id: string
  name: string
  sku: string
  category: string
  currentStock: number
  minStock: number
  deficit: number
  price: number
  cost: number
}

function downloadExcel(rows: LowStockItem[], filename: string) {
  if (!rows.length) return

  const headers = [
    'Producto',
    'SKU',
    'Categoria',
    'Stock Actual',
    'Stock Minimo',
    'Faltante',
    'Precio',
    'Costo',
    'Valor Faltante (Costo)',
  ]

  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
  xml += '<?mso-application progid="Excel.Sheet"?>\n'
  xml += '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"\n'
  xml += ' xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">\n'
  xml += '<Styles>\n'
  xml += '  <Style ss:ID="header"><Font ss:Bold="1"/><Interior ss:Color="#F3F4F6" ss:Pattern="Solid"/></Style>\n'
  xml += '  <Style ss:ID="num"><NumberFormat ss:Format="#,##0.00"/></Style>\n'
  xml += '  <Style ss:ID="int"><NumberFormat ss:Format="#,##0"/></Style>\n'
  xml += '  <Style ss:ID="deficit"><Font ss:Color="#DC2626" ss:Bold="1"/><NumberFormat ss:Format="#,##0"/></Style>\n'
  xml += '</Styles>\n'
  xml += '<Worksheet ss:Name="Existencias Bajas">\n'
  xml += '<Table>\n'

  // Column widths
  xml += '<Column ss:Width="200"/><Column ss:Width="100"/><Column ss:Width="120"/>'
  xml += '<Column ss:Width="90"/><Column ss:Width="90"/><Column ss:Width="80"/>'
  xml += '<Column ss:Width="90"/><Column ss:Width="90"/><Column ss:Width="120"/>\n'

  // Header row
  xml += '<Row>'
  for (const h of headers) {
    xml += `<Cell ss:StyleID="header"><Data ss:Type="String">${h}</Data></Cell>`
  }
  xml += '</Row>\n'

  // Data rows
  for (const row of rows) {
    const valorFaltante = row.deficit > 0 ? row.deficit * row.cost : 0
    xml += '<Row>'
    xml += `<Cell><Data ss:Type="String">${escapeXml(row.name)}</Data></Cell>`
    xml += `<Cell><Data ss:Type="String">${escapeXml(row.sku)}</Data></Cell>`
    xml += `<Cell><Data ss:Type="String">${escapeXml(row.category)}</Data></Cell>`
    xml += `<Cell ss:StyleID="int"><Data ss:Type="Number">${row.currentStock}</Data></Cell>`
    xml += `<Cell ss:StyleID="int"><Data ss:Type="Number">${row.minStock}</Data></Cell>`
    xml += `<Cell ss:StyleID="deficit"><Data ss:Type="Number">${row.deficit}</Data></Cell>`
    xml += `<Cell ss:StyleID="num"><Data ss:Type="Number">${row.price}</Data></Cell>`
    xml += `<Cell ss:StyleID="num"><Data ss:Type="Number">${row.cost}</Data></Cell>`
    xml += `<Cell ss:StyleID="num"><Data ss:Type="Number">${valorFaltante.toFixed(2)}</Data></Cell>`
    xml += '</Row>\n'
  }

  xml += '</Table>\n</Worksheet>\n</Workbook>'

  const blob = new Blob([xml], { type: 'application/vnd.ms-excel' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function escapeXml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export default function LowStockReportPage() {
  const { token } = useAuth()
  const toast = useToast()
  const [data, setData] = useState<LowStockItem[]>([])
  const [loading, setLoading] = useState(true)
  const [categoryFilter, setCategoryFilter] = useState('')
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([])

  useEffect(() => {
    const h = { Authorization: `Bearer ${token}` }
    fetch('/api/categories?active=true', { headers: h })
      .then((r) => r.json())
      .then((json) => setCategories(json.data || []))
      .catch(() => {})
  }, [token])

  useEffect(() => {
    setLoading(true)
    const h = { Authorization: `Bearer ${token}` }
    const params = new URLSearchParams()
    if (categoryFilter) params.set('categoryId', categoryFilter)

    fetch(`/api/reports/low-stock?${params}`, { headers: h })
      .then((r) => r.json())
      .then((json) => {
        setData(Array.isArray(json) ? json : [])
      })
      .catch(() => toast.error('Error al cargar reporte'))
      .finally(() => setLoading(false))
  }, [token, categoryFilter, toast])

  const formatCurrency = (amount: number): string =>
    new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amount)

  const totalDeficit = data.reduce((sum, r) => sum + r.deficit, 0)
  const totalValorFaltante = data.reduce((sum, r) => sum + (r.deficit > 0 ? r.deficit * r.cost : 0), 0)

  const handleExport = () => {
    if (!data.length) {
      toast.error('No hay datos para exportar')
      return
    }
    const fecha = new Date().toISOString().slice(0, 10)
    downloadExcel(data, `existencias-bajas-${fecha}.xls`)
    toast.success('Excel exportado')
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Existencias Bajas</h1>
          <p className="mt-1 text-sm text-gray-500">
            Productos cuyo stock actual esta por debajo del minimo configurado
          </p>
        </div>
        <button
          onClick={handleExport}
          disabled={!data.length}
          className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
          type="button"
        >
          <Download className="h-4 w-4" />
          Exportar Excel
        </button>
      </div>

      {/* Summary cards */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-medium text-red-600">Productos con stock bajo</p>
          <p className="mt-1 text-2xl font-bold text-red-700">{data.length}</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-medium text-amber-600">Unidades faltantes</p>
          <p className="mt-1 text-2xl font-bold text-amber-700">{totalDeficit.toLocaleString('es-MX')}</p>
        </div>
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
          <p className="text-sm font-medium text-blue-600">Valor faltante (costo)</p>
          <p className="mt-1 text-2xl font-bold text-blue-700">{formatCurrency(totalValorFaltante)}</p>
        </div>
      </div>

      {/* Filter */}
      <div className="mb-4">
        <div className="relative inline-block">
          <Filter className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="rounded-lg border border-gray-300 py-2.5 pl-10 pr-8 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
          >
            <option value="">Todas las categorias</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-3 font-medium text-gray-600">Producto</th>
                <th className="px-4 py-3 font-medium text-gray-600">SKU</th>
                <th className="px-4 py-3 font-medium text-gray-600">Categoria</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">Stock Actual</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">Stock Minimo</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">Faltante</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">Precio</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">Costo</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">Valor Faltante</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-gray-400" />
                    <p className="mt-2 text-sm text-gray-500">Cargando reporte...</p>
                  </td>
                </tr>
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center">
                    <Package className="mx-auto h-8 w-8 text-gray-300" />
                    <p className="mt-2 text-sm text-gray-500">
                      No hay productos con existencias bajas
                    </p>
                    <p className="mt-1 text-xs text-gray-400">
                      Configura el stock minimo en cada producto para ver alertas aqui
                    </p>
                  </td>
                </tr>
              ) : (
                data.map((item) => {
                  const valorFaltante = item.deficit > 0 ? item.deficit * item.cost : 0
                  const severity = item.currentStock === 0 ? 'bg-red-50' : 'bg-amber-50/50'
                  return (
                    <tr key={item.id} className={`border-b border-gray-100 ${severity}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {item.currentStock === 0 && (
                            <AlertTriangle className="h-4 w-4 flex-shrink-0 text-red-500" />
                          )}
                          <span className="font-medium text-gray-900">{item.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{item.sku || '-'}</td>
                      <td className="px-4 py-3 text-gray-600">{item.category}</td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900">
                        {item.currentStock}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600">{item.minStock}</td>
                      <td className="px-4 py-3 text-right font-bold text-red-600">
                        {item.deficit}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600">
                        {formatCurrency(item.price)}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600">
                        {formatCurrency(item.cost)}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-blue-700">
                        {formatCurrency(valorFaltante)}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
            {data.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-gray-300 bg-gray-50 font-semibold">
                  <td colSpan={5} className="px-4 py-3 text-gray-700">
                    Total ({data.length} productos)
                  </td>
                  <td className="px-4 py-3 text-right text-red-700">{totalDeficit}</td>
                  <td colSpan={2} />
                  <td className="px-4 py-3 text-right text-blue-700">
                    {formatCurrency(totalValorFaltante)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  )
}
