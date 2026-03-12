import { useEffect, useState } from 'react'
import {
  Search,
  Download,
  Loader2,
} from 'lucide-react'
import { useToast } from '@enlocal/react-hooks'
import { useInventoryStore } from '../stores/useInventoryStore'
type Tab = 'kardex' | 'valuacion' | 'merma'

const formatCurrency = (val: number | string): string =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(val) || 0)

const formatDate = (dateStr: string): string => {
  try {
    return new Date(dateStr).toLocaleDateString('es-MX')
  } catch {
    return dateStr
  }
}

function downloadCSV(rows: Record<string, any>[], filename: string) {
  if (!rows.length) return
  const headers = Object.keys(rows[0])
  const csv = [
    headers.join(','),
    ...rows.map(row => headers.map(h => {
      const val = String(row[h] ?? '')
      return val.includes(',') || val.includes('"') ? `"${val.replace(/"/g, '""')}"` : val
    }).join(','))
  ].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export default function InventoryReportsPage() {
  const toast = useToast()
  const {
    articles,
    valuation,
    movements,
    kardex,
    fetchArticles,
    fetchValuation,
    fetchMovements,
    fetchKardex,
  } = useInventoryStore()

  const [activeTab, setActiveTab] = useState<Tab>('kardex')

  // Kardex state
  const [kardexArticleId, setKardexArticleId] = useState('')
  const [kardexFrom, setKardexFrom] = useState('')
  const [kardexTo, setKardexTo] = useState('')
  const [kardexLoading, setKardexLoading] = useState(false)

  // Merma state
  const [mermaArticleId, setMermaArticleId] = useState('')
  const [mermaFrom, setMermaFrom] = useState('')
  const [mermaTo, setMermaTo] = useState('')
  const [mermaLoading, setMermaLoading] = useState(false)

  // Valuacion state
  const [valuacionLoading, setValuacionLoading] = useState(false)

  useEffect(() => {
    fetchArticles({ active: true, limit: 500 })
  }, [])

  useEffect(() => {
    if (activeTab === 'valuacion') {
      setValuacionLoading(true)
      fetchValuation().finally(() => setValuacionLoading(false))
    }
  }, [activeTab])

  const handleKardexSearch = async () => {
    if (!kardexArticleId) {
      toast.error('Selecciona un articulo')
      return
    }
    setKardexLoading(true)
    try {
      await fetchKardex(kardexArticleId, kardexFrom || undefined, kardexTo || undefined)
    } catch {
      toast.error('Error al cargar kardex')
    } finally {
      setKardexLoading(false)
    }
  }

  const handleMermaSearch = async () => {
    setMermaLoading(true)
    try {
      await fetchMovements({
        type: 'out',
        ingredient_id: mermaArticleId || undefined,
        from: mermaFrom || undefined,
        to: mermaTo || undefined,
        limit: 500,
      })
    } catch {
      toast.error('Error al cargar salidas')
    } finally {
      setMermaLoading(false)
    }
  }

  const exportKardexCSV = () => {
    const rows = kardex.map(entry => ({
      Fecha: formatDate(entry.created_at),
      Tipo: entry.type === 'in' ? 'Entrada' : entry.type === 'out' ? 'Salida' : 'Ajuste',
      Cantidad: Number(entry.quantity),
      Balance: entry.running_balance,
      Referencia: entry.reference ?? '',
      Notas: entry.notes ?? '',
    }))
    downloadCSV(rows, 'kardex.csv')
    if (rows.length) toast.success('CSV exportado')
  }

  const exportValuacionCSV = () => {
    if (!valuation) return
    const rows = valuation.items.map(item => ({
      Articulo: item.name,
      Unidad: item.unit,
      Stock: Number(item.current_stock),
      'Costo Unitario': Number(item.cost),
      'Valor Total': item.value,
    }))
    downloadCSV(rows, 'valuacion.csv')
    if (rows.length) toast.success('CSV exportado')
  }

  const exportMermaCSV = () => {
    const rows = movements.map(mov => ({
      Articulo: mov.ingredient_name ?? '',
      Cantidad: Number(mov.quantity),
      Referencia: mov.reference ?? '',
      Notas: mov.notes ?? '',
      Fecha: formatDate(mov.created_at),
    }))
    downloadCSV(rows, 'salidas.csv')
    if (rows.length) toast.success('CSV exportado')
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'kardex', label: 'Kardex' },
    { key: 'valuacion', label: 'Valuacion' },
    { key: 'merma', label: 'Merma' },
  ]

  const typeBadge = (type: string) => {
    switch (type) {
      case 'in':
        return <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">Entrada</span>
      case 'out':
        return <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">Salida</span>
      case 'adjustment':
        return <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700">Ajuste</span>
      default:
        return <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">{type}</span>
    }
  }

  return (
    <div>
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Reportes de Inventario</h1>
          <p className="mt-1 text-sm text-gray-500">
            Kardex, valuacion y salidas de inventario
          </p>
        </div>

        {/* Tabs */}
        <div className="mb-6 border-b border-gray-200">
          <div className="flex gap-6">
            {tabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`pb-3 text-sm transition-colors ${
                  activeTab === tab.key
                    ? 'border-b-2 border-primary-600 text-primary-600 font-medium'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab 1: Kardex */}
        {activeTab === 'kardex' && (
          <div>
            {/* Filters */}
            <div className="mb-4 flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-[200px]">
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Articulo</label>
                <select
                  value={kardexArticleId}
                  onChange={e => setKardexArticleId(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                >
                  <option value="">Seleccionar articulo</option>
                  {articles.map(a => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Desde</label>
                <input
                  type="date"
                  value={kardexFrom}
                  onChange={e => setKardexFrom(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Hasta</label>
                <input
                  type="date"
                  value={kardexTo}
                  onChange={e => setKardexTo(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                />
              </div>
              <button
                onClick={handleKardexSearch}
                disabled={kardexLoading}
                className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700"
              >
                {kardexLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                Buscar
              </button>
            </div>

            {/* Kardex Table */}
            {kardex.length > 0 && (
              <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3">
                  <h2 className="text-sm font-semibold text-gray-900">
                    Kardex — {kardex.length} registros
                  </h2>
                  <button
                    onClick={exportKardexCSV}
                    className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <Download className="h-4 w-4" />
                    Exportar CSV
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="px-4 py-3 font-medium text-gray-600">Fecha</th>
                        <th className="px-4 py-3 font-medium text-gray-600">Tipo</th>
                        <th className="px-4 py-3 text-right font-medium text-gray-600">Cantidad</th>
                        <th className="px-4 py-3 text-right font-medium text-gray-600">Balance</th>
                        <th className="px-4 py-3 font-medium text-gray-600">Referencia</th>
                        <th className="px-4 py-3 font-medium text-gray-600">Notas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {kardex.map(entry => (
                        <tr key={entry.id} className="border-t border-gray-100 hover:bg-gray-50">
                          <td className="px-4 py-3 text-gray-700">{formatDate(entry.created_at)}</td>
                          <td className="px-4 py-3">{typeBadge(entry.type)}</td>
                          <td className="px-4 py-3 text-right text-gray-900">{Number(entry.quantity)}</td>
                          <td className="px-4 py-3 text-right font-medium text-gray-900">{entry.running_balance}</td>
                          <td className="px-4 py-3 text-gray-600">{entry.reference ?? '-'}</td>
                          <td className="px-4 py-3 text-gray-600">{entry.notes ?? '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {!kardexLoading && kardex.length === 0 && kardexArticleId && (
              <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 py-12 text-center text-sm text-gray-500">
                Sin registros de kardex para este articulo
              </div>
            )}

            {!kardexArticleId && (
              <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 py-12 text-center text-sm text-gray-500">
                Selecciona un articulo y haz clic en Buscar para ver el kardex
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Valuacion */}
        {activeTab === 'valuacion' && (
          <div>
            {valuacionLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            ) : valuation && valuation.items.length > 0 ? (
              <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3">
                  <h2 className="text-sm font-semibold text-gray-900">
                    Valuacion de Inventario — {valuation.items.length} articulos
                  </h2>
                  <button
                    onClick={exportValuacionCSV}
                    className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <Download className="h-4 w-4" />
                    Exportar CSV
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="px-4 py-3 font-medium text-gray-600">Articulo</th>
                        <th className="px-4 py-3 font-medium text-gray-600">Unidad</th>
                        <th className="px-4 py-3 text-right font-medium text-gray-600">Stock</th>
                        <th className="px-4 py-3 text-right font-medium text-gray-600">Costo Unitario</th>
                        <th className="px-4 py-3 text-right font-medium text-gray-600">Valor Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {valuation.items.map(item => (
                        <tr key={item.id} className="border-t border-gray-100 hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium text-gray-900">{item.name}</td>
                          <td className="px-4 py-3 text-gray-600">{item.unit}</td>
                          <td className="px-4 py-3 text-right text-gray-900">{Number(item.current_stock)}</td>
                          <td className="px-4 py-3 text-right text-gray-700">{formatCurrency(item.cost)}</td>
                          <td className="px-4 py-3 text-right font-medium text-gray-900">{formatCurrency(item.value)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-gray-200 bg-gray-50">
                        <td colSpan={4} className="px-4 py-3 text-right text-sm font-bold text-gray-900">
                          Total
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-bold text-gray-900">
                          {formatCurrency(valuation.total)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 py-12 text-center text-sm text-gray-500">
                No hay datos de valuacion disponibles
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Merma */}
        {activeTab === 'merma' && (
          <div>
            {/* Filters */}
            <div className="mb-4 flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-[200px]">
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Articulo (opcional)</label>
                <select
                  value={mermaArticleId}
                  onChange={e => setMermaArticleId(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                >
                  <option value="">Todos los articulos</option>
                  {articles.map(a => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Desde</label>
                <input
                  type="date"
                  value={mermaFrom}
                  onChange={e => setMermaFrom(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Hasta</label>
                <input
                  type="date"
                  value={mermaTo}
                  onChange={e => setMermaTo(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                />
              </div>
              <button
                onClick={handleMermaSearch}
                disabled={mermaLoading}
                className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700"
              >
                {mermaLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                Buscar
              </button>
            </div>

            {/* Merma Table */}
            {mermaLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            ) : movements.length > 0 ? (
              <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3">
                  <h2 className="text-sm font-semibold text-gray-900">
                    Salidas — {movements.length} registros
                  </h2>
                  <button
                    onClick={exportMermaCSV}
                    className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <Download className="h-4 w-4" />
                    Exportar CSV
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="px-4 py-3 font-medium text-gray-600">Articulo</th>
                        <th className="px-4 py-3 text-right font-medium text-gray-600">Cantidad</th>
                        <th className="px-4 py-3 font-medium text-gray-600">Referencia</th>
                        <th className="px-4 py-3 font-medium text-gray-600">Notas</th>
                        <th className="px-4 py-3 font-medium text-gray-600">Fecha</th>
                      </tr>
                    </thead>
                    <tbody>
                      {movements.map(mov => (
                        <tr key={mov.id} className="border-t border-gray-100 hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium text-gray-900">{mov.ingredient_name ?? '-'}</td>
                          <td className="px-4 py-3 text-right text-gray-900">{Number(mov.quantity)}</td>
                          <td className="px-4 py-3 text-gray-600">{mov.reference ?? '-'}</td>
                          <td className="px-4 py-3 text-gray-600">{mov.notes ?? '-'}</td>
                          <td className="px-4 py-3 text-gray-700">{formatDate(mov.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 py-12 text-center text-sm text-gray-500">
                Haz clic en Buscar para ver las salidas de inventario
              </div>
            )}
          </div>
        )}
    </div>
  )
}
