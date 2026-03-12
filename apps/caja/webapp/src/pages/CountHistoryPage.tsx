import { useEffect, useState, useMemo } from 'react'
import { ChevronLeft, ChevronRight, Eye, Loader2, X, TrendingDown, TrendingUp, Minus } from 'lucide-react'
import { useToast, useAuth } from '@enlocal/react-hooks'
import { useInventoryStore, type InventoryCount } from '../stores/useInventoryStore'

const fmtDate = (d: string) => {
  if (!d) return ''
  return new Date(d).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
}

const fmtMoney = (v: number) =>
  isNaN(v) ? '$0.00' : v.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })

export default function CountHistoryPage() {
  const { user } = useAuth()
  const toast = useToast()
  const { counts, countsPagination, currentCount, articles, fetchCounts, fetchCountById, fetchArticles } = useInventoryStore()
  const [page, setPage] = useState(1)
  const [showDetail, setShowDetail] = useState(false)
  const [loadingDetail, setLoadingDetail] = useState(false)

  const allowedRoles = ['admin', 'owner', 'manager']
  const hasPermission = allowedRoles.includes(user?.role || '')

  // Build cost map from articles
  const costMap = useMemo(() => {
    const map: Record<string, number> = {}
    for (const a of articles) {
      map[a.id] = typeof a.cost === 'string' ? parseFloat(a.cost) || 0 : a.cost || 0
    }
    return map
  }, [articles])

  // Compute summary for the currently open count
  const countSummary = useMemo(() => {
    if (!currentCount?.items || currentCount.items.length === 0) return null

    let lossQty = 0
    let surplusQty = 0
    let lossCost = 0
    let surplusCost = 0
    let matchCount = 0
    const lossItems: { name: string; qty: number; cost: number }[] = []
    const surplusItems: { name: string; qty: number; cost: number }[] = []

    for (const item of currentCount.items) {
      const diff = typeof item.difference === 'string' ? parseFloat(item.difference) : item.difference
      const unitCost = costMap[item.ingredient_id] || 0

      if (diff < 0) {
        const absQty = Math.abs(diff)
        lossQty += absQty
        lossCost += absQty * unitCost
        lossItems.push({ name: item.ingredient_name || '—', qty: absQty, cost: absQty * unitCost })
      } else if (diff > 0) {
        surplusQty += diff
        surplusCost += diff * unitCost
        surplusItems.push({ name: item.ingredient_name || '—', qty: diff, cost: diff * unitCost })
      } else {
        matchCount++
      }
    }

    return { lossQty, surplusQty, lossCost, surplusCost, matchCount, lossItems, surplusItems }
  }, [currentCount, costMap])

  useEffect(() => {
    if (hasPermission) {
      fetchCounts({ page, limit: 20 })
      fetchArticles({ active: true, limit: 5000 })
    }
  }, [page, hasPermission])

  const handleViewDetail = async (id: string) => {
    setLoadingDetail(true)
    try {
      await fetchCountById(id)
      setShowDetail(true)
    } catch {
      toast.error('Error al cargar el detalle del conteo')
    }
    setLoadingDetail(false)
  }

  const closeDetail = () => {
    setShowDetail(false)
  }

  if (!hasPermission) {
    return (
      <div className="p-8 text-center text-gray-500">No tienes permisos para ver esta pagina.</div>
    )
  }

  return (
    <div>
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Historial de Conteos</h1>
          <p className="mt-1 text-sm text-gray-500">{countsPagination.total} conteos registrados</p>
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          {counts.length === 0 ? (
            <div className="py-20 text-center text-sm text-gray-500">
              No hay conteos registrados
            </div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-4 py-3 font-medium text-gray-600">Fecha</th>
                  <th className="px-4 py-3 font-medium text-gray-600"># Articulos</th>
                  <th className="px-4 py-3 font-medium text-gray-600">Estado</th>
                  <th className="px-4 py-3 font-medium text-gray-600">Notas</th>
                  <th className="px-4 py-3 font-medium text-gray-600">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {counts.map((count) => (
                  <tr key={count.id} className="border-b border-gray-100">
                    <td className="px-4 py-3 text-gray-900">{fmtDate(count.count_date)}</td>
                    <td className="px-4 py-3 text-gray-700">{count.item_count ?? 0}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={count.status} />
                    </td>
                    <td className="px-4 py-3 text-gray-500 max-w-[200px] truncate">
                      {count.notes || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleViewDetail(count.id)}
                        disabled={loadingDetail}
                        className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                      >
                        {loadingDetail ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Eye className="h-3.5 w-3.5" />
                        )}
                        Ver detalle
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {countsPagination.pages > 1 && (
          <div className="mt-4 flex items-center justify-between text-sm text-gray-500">
            <span>Pagina {countsPagination.page} de {countsPagination.pages}</span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 hover:bg-gray-50 disabled:opacity-50"
              >
                <ChevronLeft className="h-4 w-4" /> Anterior
              </button>
              <button
                onClick={() => setPage((p) => Math.min(countsPagination.pages, p + 1))}
                disabled={page >= countsPagination.pages}
                className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 hover:bg-gray-50 disabled:opacity-50"
              >
                Siguiente <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Detail Modal */}
        {showDetail && currentCount && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="w-full max-w-3xl rounded-xl bg-white p-6 shadow-xl max-h-[80vh] overflow-y-auto">
              {/* Modal Header */}
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">
                  Detalle del Conteo - {fmtDate(currentCount.count_date)}
                </h2>
                <button
                  onClick={closeDetail}
                  className="rounded p-1 hover:bg-gray-100"
                >
                  <X className="h-5 w-5 text-gray-500" />
                </button>
              </div>

              {/* Count Info */}
              <div className="mb-4 grid grid-cols-1 gap-3 rounded-lg bg-gray-50 p-4 sm:grid-cols-3">
                <div>
                  <p className="text-xs font-medium uppercase text-gray-500">Fecha</p>
                  <p className="text-sm text-gray-900">{fmtDate(currentCount.count_date)}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase text-gray-500">Estado</p>
                  <div className="mt-0.5">
                    <StatusBadge status={currentCount.status} />
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase text-gray-500">Notas</p>
                  <p className="text-sm text-gray-900">{currentCount.notes || '—'}</p>
                </div>
              </div>

              {/* Items Table */}
              {currentCount.items && currentCount.items.length > 0 ? (
                <div className="overflow-hidden rounded-lg border border-gray-200">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 bg-gray-50">
                        <th className="px-4 py-3 font-medium text-gray-600">Articulo</th>
                        <th className="px-4 py-3 font-medium text-gray-600 text-right">Stock Sistema</th>
                        <th className="px-4 py-3 font-medium text-gray-600 text-right">Conteo Fisico</th>
                        <th className="px-4 py-3 font-medium text-gray-600 text-right">Diferencia</th>
                        <th className="px-4 py-3 font-medium text-gray-600">Notas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentCount.items.map((item) => {
                        const diff = typeof item.difference === 'string'
                          ? parseFloat(item.difference)
                          : item.difference
                        return (
                          <tr key={item.id} className="border-b border-gray-100">
                            <td className="px-4 py-3 text-gray-900">{item.ingredient_name || '—'}</td>
                            <td className="px-4 py-3 text-right text-gray-700">
                              {typeof item.expected_qty === 'string' ? parseFloat(item.expected_qty) : item.expected_qty}
                            </td>
                            <td className="px-4 py-3 text-right text-gray-700">
                              {typeof item.counted_qty === 'string' ? parseFloat(item.counted_qty) : item.counted_qty}
                            </td>
                            <td className={`px-4 py-3 text-right font-medium ${
                              diff < 0 ? 'text-red-600' : diff > 0 ? 'text-green-600' : 'text-gray-700'
                            }`}>
                              {diff > 0 ? '+' : ''}{diff}
                            </td>
                            <td className="px-4 py-3 text-gray-500">{item.notes || '—'}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="py-8 text-center text-sm text-gray-500">
                  No hay articulos en este conteo
                </div>
              )}

              {/* Resultados del conteo */}
              {countSummary && (
                <div className="mt-6">
                  <h3 className="mb-3 text-sm font-semibold uppercase text-gray-500">Resultados</h3>

                  {/* Summary cards */}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                      <div className="mb-1 flex items-center gap-2 text-red-700">
                        <TrendingDown className="h-4 w-4" />
                        <span className="text-xs font-medium uppercase">Pérdida</span>
                      </div>
                      <p className="text-lg font-bold text-red-700">{fmtMoney(countSummary.lossCost)}</p>
                      <p className="text-xs text-red-600">
                        {countSummary.lossItems.length} artículo{countSummary.lossItems.length !== 1 ? 's' : ''} · {countSummary.lossQty} unidades faltantes
                      </p>
                    </div>

                    <div className="rounded-lg border border-green-200 bg-green-50 p-4">
                      <div className="mb-1 flex items-center gap-2 text-green-700">
                        <TrendingUp className="h-4 w-4" />
                        <span className="text-xs font-medium uppercase">Sobrante</span>
                      </div>
                      <p className="text-lg font-bold text-green-700">{fmtMoney(countSummary.surplusCost)}</p>
                      <p className="text-xs text-green-600">
                        {countSummary.surplusItems.length} artículo{countSummary.surplusItems.length !== 1 ? 's' : ''} · {countSummary.surplusQty} unidades extra
                      </p>
                    </div>

                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                      <div className="mb-1 flex items-center gap-2 text-gray-600">
                        <Minus className="h-4 w-4" />
                        <span className="text-xs font-medium uppercase">Sin diferencia</span>
                      </div>
                      <p className="text-lg font-bold text-gray-700">{countSummary.matchCount}</p>
                      <p className="text-xs text-gray-500">artículos coinciden con el sistema</p>
                    </div>
                  </div>

                  {/* Loss detail breakdown */}
                  {countSummary.lossItems.length > 0 && (
                    <div className="mt-4 overflow-hidden rounded-lg border border-red-200">
                      <div className="border-b border-red-200 bg-red-50 px-4 py-2">
                        <h4 className="text-xs font-semibold uppercase text-red-700">Desglose de Pérdida</h4>
                      </div>
                      <table className="w-full text-left text-sm">
                        <thead>
                          <tr className="border-b border-red-100 bg-red-50/50">
                            <th className="px-4 py-2 font-medium text-red-700">Artículo</th>
                            <th className="px-4 py-2 font-medium text-red-700 text-right">Faltante</th>
                            <th className="px-4 py-2 font-medium text-red-700 text-right">Costo Unit.</th>
                            <th className="px-4 py-2 font-medium text-red-700 text-right">Pérdida</th>
                          </tr>
                        </thead>
                        <tbody>
                          {countSummary.lossItems.map((li, idx) => {
                            const unitCost = li.qty > 0 ? li.cost / li.qty : 0
                            return (
                              <tr key={idx} className="border-b border-red-50">
                                <td className="px-4 py-2 text-gray-900">{li.name}</td>
                                <td className="px-4 py-2 text-right text-red-600">-{li.qty}</td>
                                <td className="px-4 py-2 text-right text-gray-600">{fmtMoney(unitCost)}</td>
                                <td className="px-4 py-2 text-right font-semibold text-red-700">{fmtMoney(li.cost)}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                        <tfoot>
                          <tr className="bg-red-50">
                            <td colSpan={3} className="px-4 py-2 font-bold text-red-800">Total Pérdida</td>
                            <td className="px-4 py-2 text-right font-bold text-red-800">{fmtMoney(countSummary.lossCost)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}

                  {/* Surplus detail breakdown */}
                  {countSummary.surplusItems.length > 0 && (
                    <div className="mt-4 overflow-hidden rounded-lg border border-green-200">
                      <div className="border-b border-green-200 bg-green-50 px-4 py-2">
                        <h4 className="text-xs font-semibold uppercase text-green-700">Desglose de Sobrante</h4>
                      </div>
                      <table className="w-full text-left text-sm">
                        <thead>
                          <tr className="border-b border-green-100 bg-green-50/50">
                            <th className="px-4 py-2 font-medium text-green-700">Artículo</th>
                            <th className="px-4 py-2 font-medium text-green-700 text-right">Sobrante</th>
                            <th className="px-4 py-2 font-medium text-green-700 text-right">Costo Unit.</th>
                            <th className="px-4 py-2 font-medium text-green-700 text-right">Valor</th>
                          </tr>
                        </thead>
                        <tbody>
                          {countSummary.surplusItems.map((si, idx) => {
                            const unitCost = si.qty > 0 ? si.cost / si.qty : 0
                            return (
                              <tr key={idx} className="border-b border-green-50">
                                <td className="px-4 py-2 text-gray-900">{si.name}</td>
                                <td className="px-4 py-2 text-right text-green-600">+{si.qty}</td>
                                <td className="px-4 py-2 text-right text-gray-600">{fmtMoney(unitCost)}</td>
                                <td className="px-4 py-2 text-right font-semibold text-green-700">{fmtMoney(si.cost)}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                        <tfoot>
                          <tr className="bg-green-50">
                            <td colSpan={3} className="px-4 py-2 font-bold text-green-800">Total Sobrante</td>
                            <td className="px-4 py-2 text-right font-bold text-green-800">{fmtMoney(countSummary.surplusCost)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Close Button */}
              <div className="mt-4 flex justify-end">
                <button
                  onClick={closeDetail}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        )}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; color: string; dot: string }> = {
    completed: { label: 'Completado', color: 'bg-green-100 text-green-700', dot: 'bg-green-500' },
    draft: { label: 'Borrador', color: 'bg-yellow-100 text-yellow-700', dot: 'bg-yellow-500' },
  }
  const cfg = config[status] || { label: status, color: 'bg-gray-100 text-gray-700', dot: 'bg-gray-400' }
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.color}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  )
}
