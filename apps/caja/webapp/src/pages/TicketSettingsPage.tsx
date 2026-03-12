import { useEffect, useState, useCallback } from 'react'
import {
  Receipt, Loader2, Save, Printer,
} from 'lucide-react'
import { api, useToast } from '@enlocal/react-hooks'

interface PrinterOption {
  ip: string
  name: string
}

interface TicketConfig {
  receiptHeader: string
  receiptFooter: string
  printerEnabled: boolean
  defaultPrinterIp: string
  ticketFont: string
  ticketShowLogo: boolean
}

const defaultConfig: TicketConfig = {
  receiptHeader: '',
  receiptFooter: 'Gracias por su compra',
  printerEnabled: false,
  defaultPrinterIp: '',
  ticketFont: 'normal',
  ticketShowLogo: false,
}

export default function TicketSettingsPage() {
  const toast = useToast()
  const [config, setConfig] = useState<TicketConfig>(defaultConfig)
  const [printers, setPrinters] = useState<PrinterOption[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const [settingsRes, printersRes] = await Promise.all([
          api.get('/api/settings'),
          api.get('/api/settings/printers'),
        ])

        // Parse settings
        const rows: { key: string; value: string }[] = Array.isArray(settingsRes.data) ? settingsRes.data : (settingsRes.data?.data || [])
        const m: Record<string, string> = {}
        for (const r of rows) m[r.key] = r.value

        setConfig({
          receiptHeader: m.receipt_header ?? '',
          receiptFooter: m.receipt_footer ?? 'Gracias por su compra',
          printerEnabled: m.printer_enabled === 'true',
          defaultPrinterIp: m.default_printer_ip ?? '',
          ticketFont: m.ticket_font ?? 'normal',
          ticketShowLogo: m.ticket_show_logo === 'true',
        })

        // Parse printers list
        const pList = printersRes.data?.data || printersRes.data || []
        setPrinters(Array.isArray(pList) ? pList.map((p: any) => ({ ip: p.ip, name: p.name })) : [])
      } catch { /* defaults */ }
      setLoading(false)
    }
    load()
  }, [])

  const handleSave = useCallback(async () => {
    setSaving(true)
    try {
      await api.post('/api/settings/bulk', {
        items: [
          { key: 'receipt_header', value: config.receiptHeader },
          { key: 'receipt_footer', value: config.receiptFooter },
          { key: 'printer_enabled', value: String(config.printerEnabled) },
          { key: 'default_printer_ip', value: config.defaultPrinterIp },
          { key: 'ticket_font', value: config.ticketFont },
          { key: 'ticket_show_logo', value: String(config.ticketShowLogo) },
        ],
      })
      toast.success('Configuracion de ticket guardada')
    } catch {
      toast.error('Error al guardar configuracion')
    }
    setSaving(false)
  }, [config, toast])

  const updateField = <K extends keyof TicketConfig>(key: K, value: TicketConfig[K]) => {
    setConfig((prev) => ({ ...prev, [key]: value }))
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
        <div className="flex items-center gap-3">
          <Receipt className="h-6 w-6 text-primary-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Configuracion de Ticket</h1>
            <p className="mt-1 text-sm text-gray-500">Encabezado, pie de pagina y opciones de impresion</p>
          </div>
        </div>
      </div>

      {/* Receipt content */}
      <div className="mb-6 rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-gray-200 px-6 py-4">
          <Receipt className="h-4 w-4 text-gray-500" />
          <h2 className="text-sm font-semibold text-gray-900">Contenido del ticket</h2>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label htmlFor="receipt-header" className="mb-1.5 block text-sm font-medium text-gray-700">
              Encabezado del ticket
            </label>
            <textarea
              id="receipt-header"
              value={config.receiptHeader}
              onChange={(e) => updateField('receiptHeader', e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              placeholder="Texto del encabezado"
            />
          </div>
          <div>
            <label htmlFor="receipt-footer" className="mb-1.5 block text-sm font-medium text-gray-700">
              Pie del ticket
            </label>
            <textarea
              id="receipt-footer"
              value={config.receiptFooter}
              onChange={(e) => updateField('receiptFooter', e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              placeholder="Gracias por su compra"
            />
          </div>
        </div>
      </div>

      {/* Print options */}
      <div className="mb-6 rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-gray-200 px-6 py-4">
          <Printer className="h-4 w-4 text-gray-500" />
          <h2 className="text-sm font-semibold text-gray-900">Opciones de impresion</h2>
        </div>
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <label className="relative inline-flex cursor-pointer items-center">
              <input
                type="checkbox"
                checked={config.printerEnabled}
                onChange={(e) => updateField('printerEnabled', e.target.checked)}
                className="peer sr-only"
              />
              <div className="peer h-5 w-9 rounded-full bg-gray-300 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all peer-checked:bg-primary-600 peer-checked:after:translate-x-full" />
            </label>
            <span className="text-sm text-gray-700">Imprimir ticket automaticamente</span>
          </div>

          <div className="flex items-center gap-3">
            <label className="relative inline-flex cursor-pointer items-center">
              <input
                type="checkbox"
                checked={config.ticketShowLogo}
                onChange={(e) => updateField('ticketShowLogo', e.target.checked)}
                className="peer sr-only"
              />
              <div className="peer h-5 w-9 rounded-full bg-gray-300 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all peer-checked:bg-primary-600 peer-checked:after:translate-x-full" />
            </label>
            <span className="text-sm text-gray-700">Mostrar logo en ticket</span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Impresora predeterminada</label>
              <select
                value={config.defaultPrinterIp}
                onChange={(e) => updateField('defaultPrinterIp', e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              >
                <option value="">Seleccionar impresora...</option>
                {printers.map((p) => (
                  <option key={p.ip} value={p.ip}>{p.name} ({p.ip})</option>
                ))}
              </select>
              {printers.length === 0 && (
                <p className="mt-1 text-xs text-gray-400">Configura impresoras primero en la seccion de Impresoras</p>
              )}
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Fuente del ticket</label>
              <select
                value={config.ticketFont}
                onChange={(e) => updateField('ticketFont', e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              >
                <option value="normal">Normal</option>
                <option value="compressed">Comprimida</option>
              </select>
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
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Guardar configuracion
        </button>
      </div>
    </div>
  )
}
