import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Loader2, ChevronLeft, CalendarDays, Phone, Mail,
} from 'lucide-react'
import { useReceivableStore, type Receivable } from '../stores/useReceivableStore'

const fmtMoney = (v: string | number) => {
  const n = typeof v === 'string' ? parseFloat(v) : v
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n || 0)
}
const fmtDate = (d: string) => {
  if (!d) return ''
  return new Date(d).toLocaleDateString('es-MX', { weekday: 'short', day: '2-digit', month: 'short' })
}

export default function CollectionSchedulePage() {
  const navigate = useNavigate()
  const { collectionSchedule, loading, fetchCollectionSchedule } = useReceivableStore()

  const today = new Date().toISOString().slice(0, 10)
  const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)
  const [from, setFrom] = useState(today)
  const [to, setTo] = useState(nextWeek)

  useEffect(() => {
    fetchCollectionSchedule(from, to)
  }, [fetchCollectionSchedule, from, to])

  // Group by due date
  const grouped: Record<string, Receivable[]> = {}
  for (const r of collectionSchedule) {
    const key = r.dueDate?.slice(0, 10) || 'sin-fecha'
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(r)
  }
  const sortedDates = Object.keys(grouped).sort()

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/receivables')} className="rounded-lg p-2 hover:bg-gray-100">
            <ChevronLeft className="h-5 w-5 text-gray-500" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Agenda de Cobranza</h1>
            <p className="text-sm text-gray-500">Vencimientos programados por periodo</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
          />
          <span className="text-sm text-gray-500">a</span>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      ) : collectionSchedule.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white py-20 text-center text-sm text-gray-500 shadow-sm">
          No hay cobranza programada en este periodo
        </div>
      ) : (
        <div className="space-y-6">
          {sortedDates.map((date) => {
            const items = grouped[date]
            const dayTotal = items.reduce((s, r) => s + parseFloat(r.balance), 0)
            const isOverdue = date < today

            return (
              <div key={date}>
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CalendarDays className={`h-4 w-4 ${isOverdue ? 'text-red-500' : 'text-gray-500'}`} />
                    <h3 className={`text-sm font-semibold ${isOverdue ? 'text-red-600' : 'text-gray-700'}`}>
                      {fmtDate(date)}
                      {isOverdue && <span className="ml-2 text-xs font-normal text-red-500">Vencido</span>}
                    </h3>
                  </div>
                  <span className="text-sm font-medium text-gray-900">{fmtMoney(dayTotal)}</span>
                </div>
                <div className="space-y-2">
                  {items.map((r) => (
                    <div
                      key={r.id}
                      onClick={() => navigate(`/receivables/statement/${r.customerId}`)}
                      className={`cursor-pointer rounded-xl border bg-white p-4 shadow-sm transition-colors hover:bg-gray-50 ${
                        isOverdue ? 'border-red-200' : 'border-gray-200'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-900">{r.customerName || 'Cliente'}</p>
                          <p className="text-xs text-gray-500">
                            {r.remissionSeries && r.remissionFolio
                              ? `NR-${String(r.remissionFolio).padStart(4, '0')}`
                              : `CxC #${r.id.slice(0, 8)}`}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-gray-900">{fmtMoney(r.balance)}</p>
                          <p className="text-xs text-gray-500">de {fmtMoney(r.originalAmount)}</p>
                        </div>
                      </div>
                      {(r.customerPhone || r.customerEmail) && (
                        <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
                          {r.customerPhone && (
                            <span className="flex items-center gap-1">
                              <Phone className="h-3 w-3" /> {r.customerPhone}
                            </span>
                          )}
                          {r.customerEmail && (
                            <span className="flex items-center gap-1">
                              <Mail className="h-3 w-3" /> {r.customerEmail}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Total summary */}
      {collectionSchedule.length > 0 && (
        <div className="mt-6 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">
              {collectionSchedule.length} cobros en el periodo
            </span>
            <span className="font-bold text-gray-900">
              Total: {fmtMoney(collectionSchedule.reduce((s, r) => s + parseFloat(r.balance), 0))}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
