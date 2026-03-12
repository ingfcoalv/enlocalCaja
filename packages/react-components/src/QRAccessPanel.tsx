import { useState, useEffect } from 'react'
import { QrCode, RefreshCw } from 'lucide-react'

interface ServerInfo {
  qrDataUrl: string
  serverUrl: string
}

interface QRAccessPanelProps {
  multiuser: boolean
}

export function QRAccessPanel({ multiuser }: QRAccessPanelProps): JSX.Element | null {
  const [serverInfo, setServerInfo] = useState<ServerInfo | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchServerInfo = async () => {
    const api = window.electronAPI
    if (!api) {
      setError('API de Electron no disponible')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const result = (await api.invoke('get-server-info')) as ServerInfo
      if (result && typeof result.qrDataUrl === 'string' && typeof result.serverUrl === 'string') {
        setServerInfo(result)
      } else {
        setError('No se pudo obtener la informacion del servidor')
      }
    } catch {
      setError('Error al obtener informacion del servidor')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (multiuser) {
      fetchServerInfo()
    }
  }, [multiuser])

  if (!multiuser) {
    return null
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <QrCode className="h-5 w-5 text-gray-600" />
        <h3 className="text-lg font-semibold text-gray-900">Acceso desde otros dispositivos</h3>
      </div>

      {loading && (
        <div className="flex flex-col items-center py-8">
          <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
          <p className="mt-3 text-sm text-gray-500">Obteniendo informacion del servidor...</p>
        </div>
      )}

      {error && (
        <div className="flex flex-col items-center py-8">
          <p className="mb-3 text-sm text-red-600">{error}</p>
          <button
            onClick={fetchServerInfo}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
            type="button"
          >
            Reintentar
          </button>
        </div>
      )}

      {!loading && !error && serverInfo && (
        <div className="flex flex-col items-center">
          <div className="mb-4 overflow-hidden rounded-lg border border-gray-100 bg-white p-2">
            <img
              src={serverInfo.qrDataUrl}
              alt="Codigo QR para acceso en red local"
              className="h-48 w-48"
            />
          </div>

          <p className="text-center text-sm text-gray-600">
            Otros dispositivos pueden acceder en:
          </p>
          <p className="mt-1 rounded-lg bg-gray-100 px-4 py-2 font-mono text-sm font-medium text-gray-800">
            {serverInfo.serverUrl}
          </p>
        </div>
      )}
    </div>
  )
}
