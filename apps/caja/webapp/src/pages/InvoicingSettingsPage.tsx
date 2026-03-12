import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Loader2, Save, Shield, Upload, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { useToast } from '@enlocal/react-hooks'
import { useFiscalConfigStore, type FiscalConfig } from '../stores/useFiscalConfigStore'
import { useSatCatalogStore } from '../stores/useSatCatalogStore'

const inputClass = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20'
const selectClass = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none'
const labelClass = 'mb-1 block text-xs font-medium text-gray-600'
const sectionTitleClass = 'mb-3 text-sm font-semibold text-gray-700'
const btnPrimary = 'flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50'

export default function InvoicingSettingsPage() {
  const toast = useToast()
  const navigate = useNavigate()
  const { config, loading, fetchConfig, updateConfig, fetchCertStatus } = useFiscalConfigStore()
  const { taxRegimes, fetchTaxRegimes } = useSatCatalogStore()

  const [form, setForm] = useState<Partial<FiscalConfig>>({})
  const [saving, setSaving] = useState(false)
  const [certStatus, setCertStatus] = useState<any>(null)

  useEffect(() => {
    fetchConfig()
    fetchTaxRegimes()
  }, [fetchConfig, fetchTaxRegimes])

  useEffect(() => {
    if (config) setForm({ ...config })
  }, [config])

  useEffect(() => {
    fetchCertStatus().then(setCertStatus).catch(() => {})
  }, [fetchCertStatus])

  const handleChange = (field: keyof FiscalConfig, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await updateConfig(form)
      toast.success('Configuracion fiscal guardada')
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  if (loading && !config) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div>
      <button onClick={() => navigate('/settings')} className="mb-4 flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900" type="button">
        <ArrowLeft className="h-4 w-4" /> Volver a configuracion
      </button>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Configuracion de Facturacion</h1>
        <p className="mt-1 text-sm text-gray-500">Datos del emisor, certificados y preferencias CFDI</p>
      </div>

      <div className="space-y-6">
        {/* Emisor data */}
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <h3 className={sectionTitleClass}>Datos del emisor</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className={labelClass}>RFC</label>
              <input type="text" value={form.rfc || ''} onChange={(e) => handleChange('rfc', e.target.value)} className={inputClass} placeholder="RFC del emisor" maxLength={13} />
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass}>Razon social</label>
              <input type="text" value={form.razonSocial || ''} onChange={(e) => handleChange('razonSocial', e.target.value)} className={inputClass} placeholder="Razon social completa" />
            </div>
            <div>
              <label className={labelClass}>Regimen fiscal</label>
              {taxRegimes.length > 0 ? (
                <select value={form.regimenFiscal || ''} onChange={(e) => handleChange('regimenFiscal', e.target.value)} className={selectClass}>
                  <option value="">Seleccionar...</option>
                  {taxRegimes.map((r) => <option key={r.code} value={r.code}>{r.code} - {r.description}</option>)}
                </select>
              ) : (
                <input type="text" value={form.regimenFiscal || ''} onChange={(e) => handleChange('regimenFiscal', e.target.value)} className={inputClass} placeholder="Ej: 601" />
              )}
            </div>
            <div>
              <label className={labelClass}>Codigo postal</label>
              <input type="text" value={form.codigoPostal || ''} onChange={(e) => handleChange('codigoPostal', e.target.value)} className={inputClass} placeholder="C.P." maxLength={5} />
            </div>
            <div>
              <label className={labelClass}>Lugar de expedicion</label>
              <input type="text" value={form.lugarExpedicion || ''} onChange={(e) => handleChange('lugarExpedicion', e.target.value)} className={inputClass} placeholder="C.P. del lugar de expedicion" />
            </div>
          </div>
        </div>

        {/* Certificate status */}
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <h3 className={sectionTitleClass}>Certificado de Sello Digital (CSD)</h3>
          {certStatus ? (
            <div className={`rounded-lg p-3 ${certStatus.status === 'active' ? 'bg-green-50 border border-green-200' : certStatus.status === 'expired' ? 'bg-red-50 border border-red-200' : 'bg-gray-50 border border-gray-200'}`}>
              <div className="flex items-center gap-2">
                {certStatus.status === 'active' ? <CheckCircle2 className="h-5 w-5 text-green-600" /> : certStatus.status === 'expired' ? <AlertTriangle className="h-5 w-5 text-red-600" /> : <Shield className="h-5 w-5 text-gray-400" />}
                <span className={`text-sm font-medium ${certStatus.status === 'active' ? 'text-green-700' : certStatus.status === 'expired' ? 'text-red-700' : 'text-gray-600'}`}>
                  {certStatus.status === 'active' ? 'Certificado activo' : certStatus.status === 'expired' ? 'Certificado expirado' : 'Sin certificado'}
                </span>
              </div>
              {certStatus.certificateNumber && <p className="mt-1 text-xs text-gray-500">No. certificado: {certStatus.certificateNumber}</p>}
              {certStatus.validTo && <p className="text-xs text-gray-500">Valido hasta: {new Date(certStatus.validTo).toLocaleDateString('es-MX')}</p>}
            </div>
          ) : (
            <div className="rounded-lg bg-gray-50 border border-gray-200 p-3">
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-gray-400" />
                <span className="text-sm text-gray-600">No hay certificado configurado</span>
              </div>
            </div>
          )}
          <p className="mt-3 text-xs text-gray-500">
            Para subir un certificado CSD, contacte al administrador del sistema. Los archivos .cer, .key y la contrasena se configuran a nivel servidor.
          </p>
        </div>

        {/* Series / Folio config */}
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <h3 className={sectionTitleClass}>Series y folios</h3>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <label className={labelClass}>Serie Ingreso (I)</label>
              <input type="text" value={form.seriesIngreso || 'FA'} onChange={(e) => handleChange('seriesIngreso', e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Folio Ingreso</label>
              <input type="number" value={form.folioIngreso || 1} onChange={(e) => handleChange('folioIngreso', parseInt(e.target.value))} className={inputClass} min={1} />
            </div>
            <div>
              <label className={labelClass}>Serie Egreso (E)</label>
              <input type="text" value={form.seriesEgreso || 'NC'} onChange={(e) => handleChange('seriesEgreso', e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Folio Egreso</label>
              <input type="number" value={form.folioEgreso || 1} onChange={(e) => handleChange('folioEgreso', parseInt(e.target.value))} className={inputClass} min={1} />
            </div>
            <div>
              <label className={labelClass}>Serie Pago (P)</label>
              <input type="text" value={form.seriesPago || 'CP'} onChange={(e) => handleChange('seriesPago', e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Folio Pago</label>
              <input type="number" value={form.folioPago || 1} onChange={(e) => handleChange('folioPago', parseInt(e.target.value))} className={inputClass} min={1} />
            </div>
            <div>
              <label className={labelClass}>Serie Traslado (T)</label>
              <input type="text" value={form.seriesTraslado || 'CT'} onChange={(e) => handleChange('seriesTraslado', e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Folio Traslado</label>
              <input type="number" value={form.folioTraslado || 1} onChange={(e) => handleChange('folioTraslado', parseInt(e.target.value))} className={inputClass} min={1} />
            </div>
          </div>
        </div>

        {/* Preferences */}
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <h3 className={sectionTitleClass}>Preferencias</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className={labelClass}>Periodicidad global</label>
              <select value={form.globalPeriodicity || '04'} onChange={(e) => handleChange('globalPeriodicity', e.target.value)} className={selectClass}>
                <option value="01">01 - Diario</option>
                <option value="02">02 - Semanal</option>
                <option value="03">03 - Quincenal</option>
                <option value="04">04 - Mensual</option>
                <option value="05">05 - Bimestral</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Agrupacion global</label>
              <select value={form.globalGrouping || 'sat_code'} onChange={(e) => handleChange('globalGrouping', e.target.value)} className={selectClass}>
                <option value="sat_code">Por clave SAT</option>
                <option value="individual">Individual</option>
                <option value="general">General</option>
              </select>
            </div>
            <div className="flex flex-col justify-end">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={form.retentionsEnabled || false} onChange={(e) => handleChange('retentionsEnabled', e.target.checked)} className="rounded border-gray-300" />
                Habilitar retenciones
              </label>
            </div>
          </div>
        </div>

        {/* Save */}
        <div className="flex justify-end">
          <button onClick={handleSave} disabled={saving} className={btnPrimary} type="button">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Guardar configuracion
          </button>
        </div>
      </div>
    </div>
  )
}
