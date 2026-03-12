import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search, Loader2, ChevronLeft, ChevronRight, RotateCcw,
} from 'lucide-react'
import { useReturnStore } from '../stores/useReturnStore'

const fmtMoney = (v: string | number) => {
  const n = typeof v === 'string' ? parseFloat(v) : v
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n || 0)
}

const fmtDate = (d: string) => {
  if (!d) return ''
  return new Date(d).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
}

const statusConfig: Record<string, { label: string; color: string; dot: string }> = {
  requested: { label: 'Solicitada', color: 'bg-yellow-100 text-yellow-700', dot: 'bg-yellow-500' },
  reviewing: { label: 'En revision', color: 'bg-blue-100 text-blue-700', dot: 'bg-blue-500' },
  completed: { label: 'Completada', color: 'bg-green-100 text-green-700', dot: 'bg-green-500' },
  rejected: { label: 'Rechazada', color: 'bg-red-100 text-red-700', dot: 'bg-red-600' },
}

function StatusBadge({ status }: { status: string }) {
  const cfg = statusConfig[status] || statusConfig.requested
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.color}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  )
}

export default function ReturnsPage() {
  const navigate = useNavigate()
  const { returns, loading, pagination, fetchReturns } = useReturnStore()
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)

  const load = useCallback(() => {
    fetchReturns({
      status: statusFilter || undefined,
      page,
      limit: 20,
    })
  }, [fetchReturns, statusFilter, page])

  useEffect(() => { load() }, [load])

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <RotateCcw className="h-6 w-6 text-gray-500" />
          <h1 className="text-2xl font-bold text-gray-900">Devoluciones</h1>
        </div>
        <p className="mt-1 text-sm text-gray-500">{pagination.total} devoluciones</p>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
          className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
        >
          <option value="">Todos los status</option>
          <option value="requested">Solicitada</option>
          <option value="reviewing">En revision</option>
          <option value="completed">Completada</option>
          <option value="rejected">Rechazada</option>
        </select>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : returns.length === 0 ? (
          <div className="py-20 text-center text-sm text-gray-500">No hay devoluciones</div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-3 font-medium text-gray-600">Folio</th>
                <th className="px-4 py-3 font-medium text-gray-600">Nota</th>
                <th className="px-4 py-3 font-medium text-gray-600">Tipo</th>
                <th className="px-4 py-3 font-medium text-gray-600">Motivo</th>
                <th className="px-4 py-3 font-medium text-gray-600 text-right">Total</th>
                <th className="px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="px-4 py-3 font-medium text-gray-600">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {returns.map((r) => (
                <tr
                  key={r.id}
                  onClick={() => navigate(`/returns/${r.id}/process`)}
                  className="cursor-pointer border-b border-gray-100 transition-colors hover:bg-gray-50"
                >
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {r.series}-{String(r.folio).padStart(4, '0')}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    NR-{String((r as any).remissionFolio || '?').padStart(4, '0')}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {r.returnType === 'partial' ? 'Parcial' : 'Total'}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{r.reasonCategory}</td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900">{fmtMoney(r.totalReturned)}</td>
                  <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                  <td className="px-4 py-3 text-gray-500">{fmtDate(r.requestedAt)}</td>
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
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 hover:bg-gray-50 disabled:opacity-50"
            >
              <ChevronLeft className="h-4 w-4" /> Anterior
            </button>
            <button
              onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))}
              disabled={page >= pagination.pages}
              className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 hover:bg-gray-50 disabled:opacity-50"
            >
              Siguiente <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
