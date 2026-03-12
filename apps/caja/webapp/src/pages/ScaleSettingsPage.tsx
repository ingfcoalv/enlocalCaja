import { useEffect, useState, useCallback } from 'react'
import {
  Loader2, Plus, Trash2, Pencil, Search, Zap, X, Weight,
  Plug, Unplug,
} from 'lucide-react'
import { api, useToast } from '@enlocal/react-hooks'

interface ScaleConfig {
  id: string
  name: string
  port: string
  baudRate: number
  protocol: 'generic' | 'torrey'
  isDefault?: boolean
}

interface PortInfo {
  path: string
  manufacturer?: string
  serialNumber?: string
}

export default function ScaleSettingsPage() {
  const toast = useToast()
  const [scales, setScales] = useState<ScaleConfig[]>([])
  const [connected, setConnected] = useState(false)
  const [loading, setLoading] = useState(true)
  const [scanning, setScanning] = useState(false)
  const [ports, setPorts] = useState<PortInfo[]>([])
  const [testing, setTesting] = useState<string | null>(null)
  const [connecting, setConnecting] = useState(false)

  // Modal state
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<ScaleConfig>({
    id: '',
    name: '',
    port: '',
    baudRate: 9600,
    protocol: 'generic',
  })

  const loadScales = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/api/settings/scale')
      const result = data?.data || data || {}
      setScales(Array.isArray(result.scales) ? result.scales : Array.isArray(result) ? result : [])
      setConnected(result.connected ?? false)
    } catch { /* empty */ }
    setLoading(false)
  }, [])

  useEffect(() => { loadScales() }, [loadScales])

  const handleDetectPorts = async () => {
    setScanning(true)
    try {
      const { data } = await api.get('/api/settings/scale/ports')
      const result = data?.data || data || []
      setPorts(Array.isArray(result) ? result : [])
      if (result.length === 0) toast.info('No se detectaron puertos seriales')
    } catch {
      toast.error('Error al detectar puertos')
    }
    setScanning(false)
  }

  const handleAdd = () => {
    const newId = crypto.randomUUID()
    setForm({ id: newId, name: '', port: '', baudRate: 9600, protocol: 'generic' })
    setEditingId(null)
    setShowModal(true)
    // Auto-detect ports when opening add modal
    if (ports.length === 0) handleDetectPorts()
  }

  const handleEdit = (scale: ScaleConfig) => {
    setForm({ ...scale })
    setEditingId(scale.id)
    setShowModal(true)
    if (ports.length === 0) handleDetectPorts()
  }

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/api/settings/scale/${encodeURIComponent(id)}`)
      toast.success('Bascula eliminada')
      loadScales()
    } catch {
      toast.error('Error al eliminar bascula')
    }
  }

  const handleTest = async (scale: ScaleConfig) => {
    setTesting(scale.id)
    try {
      const { data } = await api.post('/api/settings/scale/test', {
        port: scale.port,
        baudRate: scale.baudRate,
        protocol: scale.protocol,
      })
      const result = data?.data || data
      if (result.success) {
        toast.success(`Lectura: ${result.weight} ${result.unit || 'kg'}`)
      } else {
        toast.error(result.error || 'No se pudo leer peso')
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Error al probar bascula')
    }
    setTesting(null)
  }

  const handleSetDefault = async (id: string) => {
    try {
      await api.post('/api/settings/scale/default', { id })
      toast.success('Bascula predeterminada actualizada')
      loadScales()
    } catch {
      toast.error('Error al establecer bascula predeterminada')
    }
  }

  const handleConnect = async () => {
    setConnecting(true)
    try {
      await api.post('/api/settings/scale/connect')
      toast.success('Bascula conectada')
      setConnected(true)
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Error al conectar bascula')
    }
    setConnecting(false)
  }

  const handleDisconnect = async () => {
    setConnecting(true)
    try {
      await api.post('/api/settings/scale/disconnect')
      toast.success('Bascula desconectada')
      setConnected(false)
    } catch {
      toast.error('Error al desconectar bascula')
    }
    setConnecting(false)
  }

  const handleSave = async () => {
    if (!form.name || !form.port) {
      toast.warning('Nombre y puerto son requeridos')
      return
    }
    try {
      await api.post('/api/settings/scale', {
        ...form,
        oldId: editingId,
      })
      toast.success(editingId ? 'Bascula actualizada' : 'Bascula agregada')
      setShowModal(false)
      loadScales()
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Error al guardar bascula')
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
          <Weight className="h-6 w-6 text-primary-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Bascula</h1>
            <p className="mt-1 text-sm text-gray-500">Configuracion de basculas electronicas (serial RS-232 / USB)</p>
          </div>
        </div>
      </div>

      {/* Connection status */}
      <div className="mb-4 flex items-center justify-between rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className={`h-3 w-3 rounded-full ${connected ? 'bg-green-500' : 'bg-gray-300'}`} />
          <span className="text-sm font-medium text-gray-700">
            {connected ? 'Bascula conectada' : 'Bascula desconectada'}
          </span>
        </div>
        <button
          onClick={connected ? handleDisconnect : handleConnect}
          disabled={connecting || scales.length === 0}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50 ${
            connected
              ? 'border border-gray-300 text-gray-700 hover:bg-gray-50'
              : 'bg-primary-600 text-white hover:bg-primary-700'
          }`}
        >
          {connecting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : connected ? (
            <Unplug className="h-4 w-4" />
          ) : (
            <Plug className="h-4 w-4" />
          )}
          {connected ? 'Desconectar' : 'Conectar'}
        </button>
      </div>

      {/* Actions */}
      <div className="mb-4 flex gap-2">
        <button
          onClick={handleAdd}
          className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
        >
          <Plus className="h-4 w-4" /> Agregar
        </button>
        <button
          onClick={handleDetectPorts}
          disabled={scanning}
          className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          Detectar puertos
        </button>
      </div>

      {/* Detected ports info */}
      {ports.length > 0 && (
        <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium text-blue-900">Puertos detectados</span>
            <button onClick={() => setPorts([])} className="text-blue-400 hover:text-blue-600">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="space-y-1">
            {ports.map((p) => (
              <div key={p.path} className="flex items-center justify-between rounded-lg bg-white p-2">
                <div>
                  <span className="text-sm font-mono text-gray-800">{p.path}</span>
                  {p.manufacturer && (
                    <span className="ml-2 text-xs text-gray-500">{p.manufacturer}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Scales table */}
      {scales.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
          <Weight className="mx-auto mb-3 h-10 w-10 text-gray-300" />
          <p className="text-sm text-gray-500">No hay basculas configuradas</p>
          <p className="mt-1 text-xs text-gray-400">Agrega una bascula para comenzar a vender por peso</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Nombre</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Puerto</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Protocolo</th>
                <th className="px-4 py-3 text-center text-xs font-medium uppercase text-gray-500">Default</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {scales.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{s.name}</td>
                  <td className="px-4 py-3 text-sm font-mono text-gray-600">{s.port} ({s.baudRate})</td>
                  <td className="px-4 py-3 text-sm text-gray-600 capitalize">{s.protocol}</td>
                  <td className="px-4 py-3 text-center">
                    <input
                      type="radio"
                      name="default-scale"
                      checked={s.isDefault || false}
                      onChange={() => handleSetDefault(s.id)}
                      className="h-4 w-4 text-primary-600 focus:ring-primary-500"
                    />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => handleTest(s)}
                        disabled={testing === s.id}
                        className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-50"
                        title="Probar lectura"
                      >
                        {testing === s.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                      </button>
                      <button
                        onClick={() => handleEdit(s)}
                        className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                        title="Editar"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(s.id)}
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

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingId ? 'Editar bascula' : 'Agregar bascula'}
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
                  placeholder="Bascula de caja"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Puerto serial</label>
                <select
                  value={form.port}
                  onChange={(e) => setForm((f) => ({ ...f, port: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                >
                  <option value="">Seleccionar puerto...</option>
                  {ports.map((p) => (
                    <option key={p.path} value={p.path}>
                      {p.path} {p.manufacturer ? `(${p.manufacturer})` : ''}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-400">
                  Si no ves tu puerto, escribe la ruta manualmente:
                </p>
                <input
                  type="text"
                  value={form.port}
                  onChange={(e) => setForm((f) => ({ ...f, port: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                  placeholder="/dev/ttyUSB0 o COM3"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Baud Rate</label>
                  <select
                    value={form.baudRate}
                    onChange={(e) => setForm((f) => ({ ...f, baudRate: parseInt(e.target.value) }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                  >
                    <option value={4800}>4800</option>
                    <option value={9600}>9600</option>
                    <option value={19200}>19200</option>
                    <option value={38400}>38400</option>
                    <option value={115200}>115200</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Protocolo</label>
                  <select
                    value={form.protocol}
                    onChange={(e) => setForm((f) => ({ ...f, protocol: e.target.value as 'generic' | 'torrey' }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                  >
                    <option value="generic">Generic (ST,GS,...)</option>
                    <option value="torrey">Torrey</option>
                  </select>
                </div>
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
                  {editingId ? 'Actualizar' : 'Agregar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
