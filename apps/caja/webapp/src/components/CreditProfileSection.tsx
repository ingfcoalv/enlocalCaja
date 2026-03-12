import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Loader2, Landmark, ExternalLink,
} from 'lucide-react'
import { api, useToast } from '@enlocal/react-hooks'

interface CreditProfile {
  creditEnabled: boolean
  creditLimit: number
  creditDays: number
  paymentTerms: string
  creditBalance: number
  creditStatus: string
}

interface Receivable {
  id: string
  originalAmount: string
  balance: string
  dueDate: string
  status: string
}

interface CreditProfileSectionProps {
  customerId: string
}

const fmtMoney = (v: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(v || 0)
const fmtDate = (d: string) => {
  if (!d) return ''
  return new Date(d).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
}

const statusConfig: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  active:    { label: 'Activo',     color: 'text-green-600',  bg: 'bg-green-100',  dot: 'bg-green-500' },
  pending:   { label: 'Pendiente',  color: 'text-yellow-600', bg: 'bg-yellow-100', dot: 'bg-yellow-500' },
  warning:   { label: 'Alerta',     color: 'text-orange-600', bg: 'bg-orange-100', dot: 'bg-orange-500' },
  suspended: { label: 'Suspendido', color: 'text-red-600',    bg: 'bg-red-100',    dot: 'bg-red-600' },
  rejected:  { label: 'Rechazado',  color: 'text-gray-600',   bg: 'bg-gray-100',   dot: 'bg-gray-500' },
}

export function CreditProfileSection({ customerId }: CreditProfileSectionProps) {
  const toast = useToast()
  const navigate = useNavigate()
  const [profile, setProfile] = useState<CreditProfile>({
    creditEnabled: false,
    creditLimit: 0,
    creditDays: 30,
    paymentTerms: 'net_30',
    creditBalance: 0,
    creditStatus: 'pending',
  })
  const [receivables, setReceivables] = useState<Receivable[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [changingStatus, setChangingStatus] = useState(false)

  useEffect(() => {
    if (!customerId) return
    const load = async () => {
      setLoading(true)
      try {
        const [creditRes, cxcRes] = await Promise.all([
          api.get(`/api/customers/${customerId}`).catch(() => null),
          api.get('/api/receivables', { params: { customer_id: customerId, limit: 5 } }).catch(() => null),
        ])
        if (creditRes) {
          const d = creditRes.data?.data || creditRes.data
          setProfile({
            creditEnabled: d.creditEnabled ?? false,
            creditLimit: parseFloat(d.creditLimit) || 0,
            creditDays: parseInt(d.creditDays) || 30,
            paymentTerms: d.paymentTerms || 'net_30',
            creditBalance: parseFloat(d.creditBalance) || 0,
            creditStatus: d.creditStatus || 'pending',
          })
        }
        if (cxcRes) {
          const items = cxcRes.data?.data || cxcRes.data?.items || []
          setReceivables(items)
        }
      } catch { /* handled */ }
      setLoading(false)
    }
    load()
  }, [customerId])

  const handleSave = useCallback(async () => {
    setSaving(true)
    try {
      await api.put(`/api/customers/${customerId}`, {
        creditEnabled: profile.creditEnabled,
        creditLimit: profile.creditLimit,
        creditDays: profile.creditDays,
        paymentTerms: profile.paymentTerms,
        creditStatus: profile.creditStatus,
      })
      toast.success('Perfil crediticio actualizado')
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }, [customerId, profile, toast])

  const handleStatusChange = useCallback(async (newStatus: string) => {
    setChangingStatus(true)
    try {
      await api.put(`/api/customers/${customerId}`, { creditStatus: newStatus })
      setProfile((p) => ({ ...p, creditStatus: newStatus }))
      toast.success(`Estado de credito actualizado a "${statusConfig[newStatus]?.label || newStatus}"`)
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Error al cambiar estado')
    } finally {
      setChangingStatus(false)
    }
  }, [customerId, toast])

  if (loading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex justify-center py-4"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
      </div>
    )
  }

  const available = Math.max(0, profile.creditLimit - profile.creditBalance)
  const st = statusConfig[profile.creditStatus] || statusConfig.pending

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
        <div className="flex items-center gap-2">
          <Landmark className="h-4 w-4 text-gray-500" />
          <h2 className="text-sm font-semibold text-gray-900">Perfil Crediticio</h2>
        </div>
        <button
          onClick={() => navigate(`/receivables/statement/${customerId}`)}
          className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700"
        >
          Ver estado de cuenta <ExternalLink className="h-3 w-3" />
        </button>
      </div>
      <div className="p-6 space-y-4">
        {/* Toggle */}
        <div className="flex items-center gap-3">
          <label className="relative inline-flex cursor-pointer items-center">
            <input
              type="checkbox"
              checked={profile.creditEnabled}
              onChange={(e) => setProfile((p) => ({ ...p, creditEnabled: e.target.checked }))}
              className="peer sr-only"
            />
            <div className="peer h-5 w-9 rounded-full bg-gray-300 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all peer-checked:bg-primary-600 peer-checked:after:translate-x-full" />
          </label>
          <span className="text-sm text-gray-700">Credito habilitado</span>
        </div>

        {profile.creditEnabled && (
          <>
            {/* Credit fields */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Limite de credito</label>
                <input
                  type="number"
                  min="0"
                  step="100"
                  value={profile.creditLimit}
                  onChange={(e) => setProfile((p) => ({ ...p, creditLimit: parseFloat(e.target.value) || 0 }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Dias de credito</label>
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={profile.creditDays}
                  onChange={(e) => setProfile((p) => ({ ...p, creditDays: parseInt(e.target.value) || 30 }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Condiciones de pago</label>
              <select
                value={profile.paymentTerms}
                onChange={(e) => setProfile((p) => ({ ...p, paymentTerms: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              >
                <option value="net_15">Neto 15 dias</option>
                <option value="net_30">Neto 30 dias</option>
                <option value="net_45">Neto 45 dias</option>
                <option value="net_60">Neto 60 dias</option>
                <option value="net_90">Neto 90 dias</option>
              </select>
            </div>

            {/* Balance summary */}
            <div className="grid grid-cols-3 gap-4 rounded-lg bg-gray-50 p-4">
              <div>
                <p className="text-xs text-gray-500">Saldo actual</p>
                <p className="text-lg font-bold text-gray-900">{fmtMoney(profile.creditBalance)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Disponible</p>
                <p className={`text-lg font-bold ${available > 0 ? 'text-green-600' : 'text-red-600'}`}>{fmtMoney(available)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Estado</p>
                <span className={`inline-flex items-center gap-1.5 rounded-full ${st.bg} px-2.5 py-0.5 text-xs font-medium ${st.color}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} />
                  {st.label}
                </span>
              </div>
            </div>

            {/* Credit status actions */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-gray-500">Acciones:</span>
              {profile.creditStatus === 'pending' && (
                <>
                  <button
                    onClick={() => handleStatusChange('active')}
                    disabled={changingStatus}
                    className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                  >
                    Aprobar
                  </button>
                  <button
                    onClick={() => handleStatusChange('rejected')}
                    disabled={changingStatus}
                    className="rounded-lg bg-gray-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-600 disabled:opacity-50"
                  >
                    Rechazar
                  </button>
                </>
              )}
              {(profile.creditStatus === 'active' || profile.creditStatus === 'warning') && (
                <button
                  onClick={() => handleStatusChange('suspended')}
                  disabled={changingStatus}
                  className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                >
                  Suspender
                </button>
              )}
              {profile.creditStatus === 'suspended' && (
                <button
                  onClick={() => handleStatusChange('active')}
                  disabled={changingStatus}
                  className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                >
                  Reactivar
                </button>
              )}
              {profile.creditStatus === 'rejected' && (
                <button
                  onClick={() => handleStatusChange('pending')}
                  disabled={changingStatus}
                  className="rounded-lg bg-yellow-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-yellow-600 disabled:opacity-50"
                >
                  Reabrir
                </button>
              )}
              {changingStatus && <Loader2 className="h-4 w-4 animate-spin text-gray-400" />}
            </div>

            {/* Mini CxC table */}
            {receivables.length > 0 && (
              <div>
                <h4 className="mb-2 text-xs font-semibold uppercase text-gray-500">Ultimas CxC</h4>
                <div className="overflow-hidden rounded-lg border border-gray-200">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="px-3 py-2 text-left font-medium text-gray-600">Vencimiento</th>
                        <th className="px-3 py-2 text-right font-medium text-gray-600">Monto</th>
                        <th className="px-3 py-2 text-right font-medium text-gray-600">Saldo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {receivables.map((r) => (
                        <tr key={r.id} className="border-t border-gray-100">
                          <td className="px-3 py-2 text-gray-500">{fmtDate(r.dueDate)}</td>
                          <td className="px-3 py-2 text-right text-gray-700">{fmtMoney(parseFloat(r.originalAmount))}</td>
                          <td className="px-3 py-2 text-right font-medium text-gray-900">{fmtMoney(parseFloat(r.balance))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

        {/* Save */}
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Guardar credito
          </button>
        </div>
      </div>
    </div>
  )
}
