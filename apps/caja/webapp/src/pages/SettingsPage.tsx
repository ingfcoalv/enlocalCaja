import { useEffect, useState, useCallback } from 'react'
import {
  Save,
  Loader2,
  Settings,
  Store,
} from 'lucide-react'
import { api, useToast } from '@enlocal/react-hooks'

interface AppSettings {
  businessName: string
  businessAddress: string
  businessPhone: string
  businessRfc: string
  currency: string
  taxRate: number
}

const defaultSettings: AppSettings = {
  businessName: '',
  businessAddress: '',
  businessPhone: '',
  businessRfc: '',
  currency: 'MXN',
  taxRate: 16,
}

export default function SettingsPage() {
  const toast = useToast()
  const [settings, setSettings] = useState<AppSettings>(defaultSettings)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const fetchSettings = async () => {
      setLoading(true)
      try {
        const { data } = await api.get('/api/settings')
        const rows: { key: string; value: string }[] = Array.isArray(data) ? data : (data?.data || [])
        const m: Record<string, string> = {}
        for (const r of rows) m[r.key] = r.value

        setSettings({
          businessName: m.business_name ?? '',
          businessAddress: m.business_address ?? '',
          businessPhone: m.business_phone ?? '',
          businessRfc: m.business_rfc ?? '',
          currency: m.currency ?? 'MXN',
          taxRate: parseInt(m.tax_rate) || 16,
        })
      } catch {
        // Use defaults
      } finally {
        setLoading(false)
      }
    }

    fetchSettings()
  }, [])

  const handleSave = useCallback(async () => {
    setSaving(true)
    try {
      await api.post('/api/settings/bulk', {
        items: [
          { key: 'business_name', value: settings.businessName },
          { key: 'business_address', value: settings.businessAddress },
          { key: 'business_phone', value: settings.businessPhone },
          { key: 'business_rfc', value: settings.businessRfc },
          { key: 'currency', value: settings.currency },
          { key: 'tax_rate', value: String(settings.taxRate) },
        ],
      })
      toast.success('Configuracion guardada exitosamente')
    } catch {
      toast.error('Error al guardar la configuracion')
    } finally {
      setSaving(false)
    }
  }, [settings, toast])

  const updateField = <K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K]
  ) => {
    setSettings((prev) => ({ ...prev, [key]: value }))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Configuracion General</h1>
        <p className="mt-1 text-sm text-gray-500">
          Ajustes generales del punto de venta
        </p>
      </div>

      {/* Business Info */}
      <div className="mb-6 rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-gray-200 px-6 py-4">
          <Store className="h-4 w-4 text-gray-500" />
          <h2 className="text-sm font-semibold text-gray-900">
            Informacion del negocio
          </h2>
        </div>
        <div className="p-6">
          <div className="space-y-4">
            <div>
              <label htmlFor="biz-name" className="mb-1.5 block text-sm font-medium text-gray-700">
                Nombre del negocio
              </label>
              <input
                id="biz-name"
                type="text"
                value={settings.businessName}
                onChange={(e) => updateField('businessName', e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                placeholder="Mi Tienda"
              />
            </div>

            <div>
              <label htmlFor="biz-address" className="mb-1.5 block text-sm font-medium text-gray-700">
                Direccion
              </label>
              <textarea
                id="biz-address"
                value={settings.businessAddress}
                onChange={(e) => updateField('businessAddress', e.target.value)}
                rows={2}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                placeholder="Calle, colonia, ciudad..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="biz-phone" className="mb-1.5 block text-sm font-medium text-gray-700">
                  Telefono
                </label>
                <input
                  id="biz-phone"
                  type="tel"
                  value={settings.businessPhone}
                  onChange={(e) => updateField('businessPhone', e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                  placeholder="55 1234 5678"
                />
              </div>
              <div>
                <label htmlFor="biz-rfc" className="mb-1.5 block text-sm font-medium text-gray-700">
                  RFC
                </label>
                <input
                  id="biz-rfc"
                  type="text"
                  value={settings.businessRfc}
                  onChange={(e) =>
                    updateField('businessRfc', e.target.value.toUpperCase())
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm uppercase focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                  placeholder="XAXX010101000"
                  maxLength={13}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tax & Currency */}
      <div className="mb-6 rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-gray-200 px-6 py-4">
          <Settings className="h-4 w-4 text-gray-500" />
          <h2 className="text-sm font-semibold text-gray-900">
            Impuestos y moneda
          </h2>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="currency" className="mb-1.5 block text-sm font-medium text-gray-700">
                Moneda
              </label>
              <select
                id="currency"
                value={settings.currency}
                onChange={(e) => updateField('currency', e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              >
                <option value="MXN">MXN - Peso Mexicano</option>
                <option value="USD">USD - Dolar Americano</option>
              </select>
            </div>
            <div>
              <label htmlFor="tax-rate" className="mb-1.5 block text-sm font-medium text-gray-700">
                Tasa IVA (%)
              </label>
              <input
                id="tax-rate"
                type="number"
                min="0"
                max="100"
                step="1"
                value={settings.taxRate}
                onChange={(e) =>
                  updateField('taxRate', parseInt(e.target.value) || 0)
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Save button */}
      <div className="mb-8 flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 rounded-lg bg-primary-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
          type="button"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Guardar configuracion
        </button>
      </div>
    </div>
  )
}
