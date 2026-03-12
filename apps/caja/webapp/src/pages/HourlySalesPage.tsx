import { useEffect, useState } from 'react'
import { api, useToast } from '@enlocal/react-hooks'
import { BarChart3, Calendar, Clock, DollarSign, Loader2, ShoppingBag } from 'lucide-react'

interface RegisterOption {
  id: string
  name: string
}

interface HourlyRow {
  hour: number
  total: number
  count: number
}

const formatCurrency = (amount: number): string =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amount)

const formatHourLabel = (hour: number): string => {
  const h = String(hour).padStart(2, '0')
  const next = String(hour + 1).padStart(2, '0')
  return `${h}:00 - ${next}:00`
}

export default function HourlySalesPage() {
  const toast = useToast()
  const [registers, setRegisters] = useState<RegisterOption[]>([])
  const [selectedRegister, setSelectedRegister] = useState('')
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0])
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<HourlyRow[]>([])

  useEffect(() => {
    const fetchRegs = async () => {
      try {
        const { data } = await api.get('/api/pos/registers')
        setRegisters((data.data ?? []).map((r: any) => ({ id: r.id, name: r.name })))
      } catch { /* ignore */ }
    }
    fetchRegs()
  }, [])

  const handleSearch = async () => {
    setLoading(true)
    try {
      const { data: res } = await api.get('/api/reports/hourly-sales', {
        params: {
          from: date,
          to: date,
          registerId: selectedRegister || undefined,
        },
      })
      const rows = res?.data || res || []
      setData(
        Array.isArray(rows)
          ? rows.map((r: any) => ({
              hour: r.hour ?? 0,
              total: parseFloat(String(r.total ?? 0)),
              count: r.count ?? r.transactions ?? 0,
            }))
          : []
      )
    } catch {
      toast.error('Error al cargar ventas por hora')
      setData([])
    } finally {
      setLoading(false)
    }
  }

  const maxTotal = data.length > 0 ? Math.max(...data.map((r) => r.total)) : 0
  const totalSales = data.reduce((s, r) => s + r.total, 0)
  const totalTransactions = data.reduce((s, r) => s + r.count, 0)
  const peakHour = data.length > 0
    ? data.reduce((best, r) => (r.total > best.total ? r : best), data[0])
    : null

  // Filter visible hours (6am - 11pm) but keep all data for calculations
  const visibleHours = data.filter((r) => r.hour >= 6 && r.hour <= 23)

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Ventas por Hora</h1>
        <p className="mt-1 text-sm text-gray-500">Analisis de ventas por franja horaria</p>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 bg-white p-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Fecha</label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="rounded-lg border border-gray-300 py-2 pl-10 pr-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Caja</label>
          <select
            value={selectedRegister}
            onChange={(e) => setSelectedRegister(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
          >
            <option value="">Todas las cajas</option>
            {registers.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
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
      {data.length > 0 && (
        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-gray-500">Total ventas del dia</p>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-100">
                <DollarSign className="h-4 w-4 text-primary-600" />
              </div>
            </div>
            <p className="mt-2 text-xl font-bold text-gray-900">{formatCurrency(totalSales)}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-gray-500">Total transacciones</p>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100">
                <ShoppingBag className="h-4 w-4 text-blue-600" />
              </div>
            </div>
            <p className="mt-2 text-xl font-bold text-gray-900">{totalTransactions}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-gray-500">Hora pico</p>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100">
                <Clock className="h-4 w-4 text-amber-600" />
              </div>
            </div>
            <p className="mt-2 text-xl font-bold text-gray-900">
              {peakHour ? formatHourLabel(peakHour.hour) : '-'}
            </p>
            {peakHour && (
              <p className="mt-0.5 text-xs text-gray-400">
                {formatCurrency(peakHour.total)} ({peakHour.count} txns)
              </p>
            )}
          </div>
        </div>
      )}

      {/* Hourly Bar Chart */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-5 py-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-gray-500" />
            <h2 className="text-sm font-semibold text-gray-900">Desglose por hora</h2>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : data.length === 0 ? (
          <div className="py-12 text-center">
            <BarChart3 className="mx-auto h-8 w-8 text-gray-300" />
            <p className="mt-2 text-sm text-gray-500">Selecciona una fecha y consulta para ver datos</p>
          </div>
        ) : (
          <div className="p-5">
            <div className="space-y-2">
              {visibleHours.map((row) => (
                <div key={row.hour} className="flex items-center gap-3">
                  <span className="w-28 flex-shrink-0 text-right text-xs text-gray-500">
                    {formatHourLabel(row.hour)}
                  </span>
                  <div className="flex-1">
                    <div className="relative h-6 overflow-hidden rounded-full bg-gray-100">
                      <div
                        className="absolute inset-y-0 left-0 rounded-full bg-primary-500 transition-all"
                        style={{
                          width: maxTotal > 0 ? `${(row.total / maxTotal) * 100}%` : '0%',
                        }}
                      />
                    </div>
                  </div>
                  <span className="w-24 flex-shrink-0 text-right text-xs font-medium text-gray-700">
                    {formatCurrency(row.total)}
                  </span>
                  <span className="w-12 flex-shrink-0 text-right text-xs text-gray-400">
                    {row.count} txn
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
