import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search, Loader2, DollarSign, Users, AlertTriangle, TrendingUp, ExternalLink,
} from 'lucide-react'
import { api, useToast } from '@enlocal/react-hooks'

const fmtMoney = (v: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(v || 0)

const statusConfig: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  active:    { label: 'Activo',     color: 'text-green-700',  bg: 'bg-green-100',  dot: 'bg-green-500' },
  pending:   { label: 'Pendiente',  color: 'text-yellow-700', bg: 'bg-yellow-100', dot: 'bg-yellow-500' },
  warning:   { label: 'Alerta',     color: 'text-orange-700', bg: 'bg-orange-100', dot: 'bg-orange-500' },
  suspended: { label: 'Suspendido', color: 'text-red-700',    bg: 'bg-red-100',    dot: 'bg-red-600' },
  rejected:  { label: 'Rechazado',  color: 'text-gray-700',   bg: 'bg-gray-100',   dot: 'bg-gray-500' },
}

interface DashboardRow {
  customerId: string
  customerName: string
  phone: string
  creditEnabled: boolean
  creditLimit: number
  creditDays: number
  creditStatus: string
  totalBalance: number
  currentBalance: number
  overdueBalance: number
  overdueCount: number
  maxDaysOverdue: number
  availableCredit: number
  lastPaymentDate: string | null
}

interface Totals {
  totalBalance: number
  currentBalance: number
  overdueBalance: number
  customerCount: number
}

function CreditStatusBadge({ status }: { status: string }) {
  const st = statusConfig[status] || statusConfig.pending
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full ${st.bg} px-2.5 py-0.5 text-xs font-medium ${st.color}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} />
      {st.label}
    </span>
  )
}

export default function CxCDashboardPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const [data, setData] = useState<DashboardRow[]>([])
  const [totals, setTotals] = useState<Totals>({ totalBalance: 0, currentBalance: 0, overdueBalance: 0, customerCount: 0 })
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [hasBalance, setHasBalance] = useState(false)
  const [overdueOnly, setOverdueOnly] = useState(false)
  const [search, setSearch] = useState('')
  const [searchDebounced, setSearchDebounced] = useState('')
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search), 300)
    return () => clearTimeout(t)
  }, [search])

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string> = {}
      if (statusFilter) params.credit_status = statusFilter
      if (hasBalance) params.has_balance = 'true'
      if (overdueOnly) params.overdue_only = 'true'
      if (searchDebounced) params.q = searchDebounced

      const res = await api.get('/api/receivables/dashboard', { params })
      const result = res.data
      setData(result.data || [])
      setTotals(result.totals || { totalBalance: 0, currentBalance: 0, overdueBalance: 0, customerCount: 0 })
    } catch {
      toast.error('Error al cargar dashboard CxC')
    } finally {
      setLoading(false)
    }
  }, [statusFilter, hasBalance, overdueOnly, searchDebounced, toast])

  useEffect(() => { fetchData() }, [fetchData])

  const handleStatusAction = async (customerId: string, newStatus: string) => {
    setUpdatingId(customerId)
    try {
      await api.put(`/api/customers/${customerId}`, { creditStatus: newStatus })
      toast.success(`Estado actualizado a "${statusConfig[newStatus]?.label || newStatus}"`)
      fetchData()
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Error al cambiar estado')
    } finally {
      setUpdatingId(null)
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <DollarSign className="h-6 w-6 text-gray-500" />
          <h1 className="text-2xl font-bold text-gray-900">Dashboard CxC</h1>
        </div>
        <p className="mt-1 text-sm text-gray-500">Vista consolidada de cuentas por cobrar por cliente</p>
      </div>

      {/* KPI Cards */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
              <DollarSign className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Saldo Total</p>
              <p className="text-lg font-bold text-gray-900">{fmtMoney(totals.totalBalance)}</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100">
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Saldo Vencido</p>
              <p className="text-lg font-bold text-red-600">{fmtMoney(totals.overdueBalance)}</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100">
              <TrendingUp className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Saldo Vigente</p>
              <p className="text-lg font-bold text-green-600">{fmtMoney(totals.currentBalance)}</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100">
              <Users className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Clientes con Saldo</p>
              <p className="text-lg font-bold text-gray-900">{totals.customerCount}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
        >
          <option value="">Todos los estados</option>
          <option value="active">Activo</option>
          <option value="pending">Pendiente</option>
          <option value="warning">Alerta</option>
          <option value="suspended">Suspendido</option>
          <option value="rejected">Rechazado</option>
        </select>

        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={hasBalance}
            onChange={(e) => setHasBalance(e.target.checked)}
            className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
          />
          Solo con saldo
        </label>

        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={overdueOnly}
            onChange={(e) => setOverdueOnly(e.target.checked)}
            className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
          />
          Solo vencidos
        </label>

        <div className="relative ml-auto">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar cliente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-lg border border-gray-300 pl-9 pr-3 py-2 text-sm focus:border-primary-500 focus:outline-none w-64"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : data.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-500">
            No se encontraron clientes con credito
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Cliente</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-600">Estado Credito</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">Limite</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">Saldo Total</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">Vigente</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">Vencido</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">Disponible</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">Max Atraso</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-600">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {data.map((row) => (
                  <tr
                    key={row.customerId}
                    className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => navigate(`/receivables/statement/${row.customerId}`)}
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{row.customerName}</div>
                      {row.phone && <div className="text-xs text-gray-500">{row.phone}</div>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <CreditStatusBadge status={row.creditStatus} />
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">{fmtMoney(row.creditLimit)}</td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">{fmtMoney(row.totalBalance)}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{fmtMoney(row.currentBalance)}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={row.overdueBalance > 0 ? 'font-medium text-red-600' : 'text-gray-700'}>
                        {fmtMoney(row.overdueBalance)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={row.availableCredit > 0 ? 'text-green-600' : 'font-medium text-red-600'}>
                        {fmtMoney(row.availableCredit)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={row.maxDaysOverdue > 0 ? 'font-medium text-red-600' : 'text-gray-500'}>
                        {row.maxDaysOverdue > 0 ? `${row.maxDaysOverdue}d` : '-'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-1">
                        {row.creditStatus === 'pending' && (
                          <>
                            <button
                              onClick={() => handleStatusAction(row.customerId, 'active')}
                              disabled={updatingId === row.customerId}
                              className="rounded bg-green-600 px-2 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                              title="Aprobar"
                            >
                              Aprobar
                            </button>
                            <button
                              onClick={() => handleStatusAction(row.customerId, 'rejected')}
                              disabled={updatingId === row.customerId}
                              className="rounded bg-gray-500 px-2 py-1 text-xs font-medium text-white hover:bg-gray-600 disabled:opacity-50"
                              title="Rechazar"
                            >
                              Rechazar
                            </button>
                          </>
                        )}
                        {(row.creditStatus === 'active' || row.creditStatus === 'warning') && (
                          <button
                            onClick={() => handleStatusAction(row.customerId, 'suspended')}
                            disabled={updatingId === row.customerId}
                            className="rounded bg-red-600 px-2 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                            title="Suspender"
                          >
                            Suspender
                          </button>
                        )}
                        {row.creditStatus === 'suspended' && (
                          <button
                            onClick={() => handleStatusAction(row.customerId, 'active')}
                            disabled={updatingId === row.customerId}
                            className="rounded bg-green-600 px-2 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                            title="Reactivar"
                          >
                            Reactivar
                          </button>
                        )}
                        <button
                          onClick={() => navigate(`/receivables/statement/${row.customerId}`)}
                          className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-primary-600"
                          title="Ver estado de cuenta"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </button>
                        {updatingId === row.customerId && (
                          <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
