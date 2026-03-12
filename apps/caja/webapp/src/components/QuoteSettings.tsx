import { useEffect, useState, useCallback } from 'react'
import {
  Loader2, Save, Hash, SendHorizonal,
} from 'lucide-react'
import { api, useToast } from '@enlocal/react-hooks'

interface FolioConfig {
  series: string
  currentFolio: number
  startingFolio: number
}

interface QuoteDefaults {
  validDays: number
  emailSubjectTemplate: string
  emailBodyTemplate: string
  termsAndConditions: string
}

export function QuoteSettings() {
  const toast = useToast()

  // Folio state
  const [quoteFolio, setQuoteFolio] = useState<FolioConfig>({ series: 'COT', currentFolio: 0, startingFolio: 1 })
  const [loadingFolios, setLoadingFolios] = useState(true)
  const [savingFolios, setSavingFolios] = useState(false)

  // Quote defaults state
  const [defaults, setDefaults] = useState<QuoteDefaults>({ validDays: 30, emailSubjectTemplate: '', emailBodyTemplate: '', termsAndConditions: '' })
  const [loadingDefaults, setLoadingDefaults] = useState(true)
  const [savingDefaults, setSavingDefaults] = useState(false)

  // Load all data
  useEffect(() => {
    const loadFolios = async () => {
      setLoadingFolios(true)
      try {
        const { data } = await api.get('/api/settings/quote-folio')
        const d = data?.data || data
        if (d) setQuoteFolio({ series: d.series || 'COT', currentFolio: d.currentFolio || 0, startingFolio: d.startingFolio || 1 })
      } catch { /* defaults */ }
      setLoadingFolios(false)
    }

    const loadDefaults = async () => {
      setLoadingDefaults(true)
      try {
        const { data } = await api.get('/api/settings/quote-defaults')
        const d = data?.data || data
        if (d) setDefaults(d)
      } catch { /* defaults */ }
      setLoadingDefaults(false)
    }

    loadFolios()
    loadDefaults()
  }, [])

  const handleSaveFolios = useCallback(async () => {
    setSavingFolios(true)
    try {
      await api.put('/api/settings/quote-folio', { startingFolio: quoteFolio.startingFolio })
      toast.success('Configuracion de folios guardada')
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Error al guardar folios')
    }
    setSavingFolios(false)
  }, [toast, quoteFolio.startingFolio])

  const handleSaveDefaults = useCallback(async () => {
    setSavingDefaults(true)
    try {
      await api.put('/api/settings/quote-defaults', {
        quote_valid_days: defaults.validDays,
        quote_email_subject_template: defaults.emailSubjectTemplate,
        quote_email_body_template: defaults.emailBodyTemplate,
        quote_terms_and_conditions: defaults.termsAndConditions,
      })
      toast.success('Valores por defecto guardados')
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Error al guardar defaults')
    }
    setSavingDefaults(false)
  }, [toast, defaults])

  return (
    <>
      {/* Folios de cotizaciones */}
      <div className="mb-6 rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-gray-200 px-6 py-4">
          <Hash className="h-4 w-4 text-gray-500" />
          <h2 className="text-sm font-semibold text-gray-900">Folios de cotizaciones</h2>
        </div>
        <div className="p-6">
          {loadingFolios ? (
            <div className="flex justify-center py-4"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Serie</label>
                  <input type="text" value={quoteFolio.series} readOnly className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Folio actual</label>
                  <input type="number" value={quoteFolio.currentFolio} readOnly className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Folio inicial</label>
                  <input
                    type="number" min="1" value={quoteFolio.startingFolio}
                    onChange={(e) => setQuoteFolio((f) => ({ ...f, startingFolio: parseInt(e.target.value) || 1 }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <button onClick={handleSaveFolios} disabled={savingFolios} className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50">
                  {savingFolios ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Guardar folios
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Valores por defecto de cotizaciones */}
      <div className="mb-6 rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-gray-200 px-6 py-4">
          <SendHorizonal className="h-4 w-4 text-gray-500" />
          <h2 className="text-sm font-semibold text-gray-900">Valores por defecto de cotizaciones</h2>
        </div>
        <div className="p-6">
          {loadingDefaults ? (
            <div className="flex justify-center py-4"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Vigencia por defecto (dias)</label>
                <input type="number" min="1" value={defaults.validDays}
                  onChange={(e) => setDefaults((d) => ({ ...d, validDays: parseInt(e.target.value) || 30 }))}
                  className="w-32 rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Asunto de email (template)</label>
                <input type="text" value={defaults.emailSubjectTemplate}
                  onChange={(e) => setDefaults((d) => ({ ...d, emailSubjectTemplate: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                  placeholder="Cotizacion {{folio}} - {{business_name}}" />
                <p className="mt-1 text-xs text-gray-500">Variables: {'{{folio}}, {{business_name}}, {{customer_name}}, {{total}}'}</p>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Cuerpo de email (template HTML)</label>
                <textarea value={defaults.emailBodyTemplate}
                  onChange={(e) => setDefaults((d) => ({ ...d, emailBodyTemplate: e.target.value }))}
                  rows={5}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm font-mono focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                  placeholder="<p>Estimado(a) {{customer_name}}...</p>" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Terminos y condiciones por defecto</label>
                <textarea value={defaults.termsAndConditions}
                  onChange={(e) => setDefaults((d) => ({ ...d, termsAndConditions: e.target.value }))}
                  rows={4}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                  placeholder="1. Los precios incluyen IVA..." />
              </div>
              <div className="flex justify-end">
                <button onClick={handleSaveDefaults} disabled={savingDefaults} className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50">
                  {savingDefaults ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Guardar valores
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
