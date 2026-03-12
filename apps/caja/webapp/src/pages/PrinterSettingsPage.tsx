import { useEffect, useState, useCallback } from 'react'
import {
  Printer, Loader2, Plus, Trash2, Pencil, Search, Zap, X, Wifi,
} from 'lucide-react'
import { api, useToast } from '@enlocal/react-hooks'

interface PrinterConfig {
  ip: string
  port: number
  name: string
  paperWidth: 58 | 80
  isDefault?: boolean
}

interface ScanResult {
  ip: string
  port: number
}

export default function PrinterSettingsPage() {
  const toast = useToast()
  const [printers, setPrinters] = useState<PrinterConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [scanning, setScanning] = useState(false)
  const [scanResults, setScanResults] = useState<ScanResult[]>([])
  const [showScanResults, setShowScanResults] = useState(false)
  const [testing, setTesting] = useState<string | null>(null)

  // Modal state
  const [showModal, setShowModal] = useState(false)
  const [editingIp, setEditingIp] = useState<string | null>(null)
  const [form, setForm] = useState<PrinterConfig>({ ip: '', port: 9100, name: '', paperWidth: 80 })

  const loadPrinters = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/api/settings/printers')
      const list = data?.data || data || []
      setPrinters(Array.isArray(list) ? list : [])
    } catch { /* empty */ }
    setLoading(false)
  }, [])

  useEffect(() => { loadPrinters() }, [loadPrinters])

  const handleScan = async () => {
    setScanning(true)
    setScanResults([])
    setShowScanResults(true)
    try {
      const { data } = await api.get('/api/settings/printers/scan')
      const results = data?.data || data || []
      setScanResults(Array.isArray(results) ? results : [])
      if (results.length === 0) toast.info('No se encontraron impresoras en la red')
    } catch {
      toast.error('Error al escanear la red')
    }
    setScanning(false)
  }

  const handleAddFromScan = (result: ScanResult) => {
    setForm({ ip: result.ip, port: result.port, name: '', paperWidth: 80 })
    setEditingIp(null)
    setShowModal(true)
    setShowScanResults(false)
  }

  const handleEdit = (printer: PrinterConfig) => {
    setForm({ ...printer })
    setEditingIp(printer.ip)
    setShowModal(true)
  }

  const handleDelete = async (ip: string) => {
    try {
      await api.delete(`/api/settings/printers/${encodeURIComponent(ip)}`)
      toast.success('Impresora eliminada')
      loadPrinters()
    } catch {
      toast.error('Error al eliminar impresora')
    }
  }

  const handleTest = async (printer: PrinterConfig) => {
    setTesting(printer.ip)
    try {
      await api.post('/api/settings/printers/test', { ip: printer.ip, port: printer.port, paperWidth: printer.paperWidth })
      toast.success('Ticket de prueba enviado')
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Error al enviar ticket de prueba')
    }
    setTesting(null)
  }

  const handleSetDefault = async (ip: string) => {
    try {
      await api.post('/api/settings/printers/default', { ip })
      toast.success('Impresora predeterminada actualizada')
      loadPrinters()
    } catch {
      toast.error('Error al establecer impresora predeterminada')
    }
  }

  const handleSave = async () => {
    if (!form.ip || !form.name) {
      toast.warning('IP y nombre son requeridos')
      return
    }
    try {
      await api.post('/api/settings/printers', {
        ...form,
        oldIp: editingIp,
      })
      toast.success(editingIp ? 'Impresora actualizada' : 'Impresora agregada')
      setShowModal(false)
      loadPrinters()
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Error al guardar impresora')
    }
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
          <Printer className="h-6 w-6 text-primary-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Impresoras</h1>
            <p className="mt-1 text-sm text-gray-500">Configuracion de impresoras ESC/POS de red</p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="mb-4 flex gap-2">
        <button
          onClick={() => { setForm({ ip: '', port: 9100, name: '', paperWidth: 80 }); setEditingIp(null); setShowModal(true) }}
          className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
        >
          <Plus className="h-4 w-4" /> Agregar
        </button>
        <button
          onClick={handleScan}
          disabled={scanning}
          className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          Buscar en red
        </button>
      </div>

      {/* Scan results */}
      {showScanResults && (
        <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 p-4">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wifi className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-900">Dispositivos encontrados</span>
            </div>
            <button onClick={() => setShowScanResults(false)} className="text-blue-400 hover:text-blue-600">
              <X className="h-4 w-4" />
            </button>
          </div>
          {scanning ? (
            <div className="flex items-center gap-2 py-2">
              <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
              <span className="text-sm text-blue-700">Escaneando red local...</span>
            </div>
          ) : scanResults.length === 0 ? (
            <p className="text-sm text-blue-700">No se encontraron dispositivos en puerto 9100</p>
          ) : (
            <div className="space-y-1">
              {scanResults.map((r) => (
                <div key={r.ip} className="flex items-center justify-between rounded-lg bg-white p-2">
                  <span className="text-sm font-mono text-gray-800">{r.ip}:{r.port}</span>
                  <button
                    onClick={() => handleAddFromScan(r)}
                    className="rounded-lg bg-primary-600 px-3 py-1 text-xs font-medium text-white hover:bg-primary-700"
                  >
                    Agregar
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Printers table */}
      {printers.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
          <Printer className="mx-auto mb-3 h-10 w-10 text-gray-300" />
          <p className="text-sm text-gray-500">No hay impresoras configuradas</p>
          <p className="mt-1 text-xs text-gray-400">Agrega una impresora manualmente o busca en la red</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Nombre</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">IP:Puerto</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Papel</th>
                <th className="px-4 py-3 text-center text-xs font-medium uppercase text-gray-500">Default</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {printers.map((p) => (
                <tr key={p.ip} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{p.name}</td>
                  <td className="px-4 py-3 text-sm font-mono text-gray-600">{p.ip}:{p.port}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{p.paperWidth}mm</td>
                  <td className="px-4 py-3 text-center">
                    <input
                      type="radio"
                      name="default-printer"
                      checked={p.isDefault || false}
                      onChange={() => handleSetDefault(p.ip)}
                      className="h-4 w-4 text-primary-600 focus:ring-primary-500"
                    />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => handleTest(p)}
                        disabled={testing === p.ip}
                        className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-50"
                        title="Probar impresion"
                      >
                        {testing === p.ip ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                      </button>
                      <button
                        onClick={() => handleEdit(p)}
                        className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                        title="Editar"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(p.ip)}
                        className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                        title="Eliminar"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingIp ? 'Editar impresora' : 'Agregar impresora'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Nombre</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                  placeholder="Impresora de caja"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Direccion IP</label>
                  <input
                    type="text"
                    value={form.ip}
                    onChange={(e) => setForm((f) => ({ ...f, ip: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm font-mono focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                    placeholder="192.168.1.100"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Puerto</label>
                  <input
                    type="number"
                    value={form.port}
                    onChange={(e) => setForm((f) => ({ ...f, port: parseInt(e.target.value) || 9100 }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Ancho de papel</label>
                <select
                  value={form.paperWidth}
                  onChange={(e) => setForm((f) => ({ ...f, paperWidth: parseInt(e.target.value) as 58 | 80 }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                >
                  <option value={80}>80mm (estandar)</option>
                  <option value={58}>58mm (portatil)</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setShowModal(false)}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSave}
                  className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
                >
                  {editingIp ? 'Actualizar' : 'Agregar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
