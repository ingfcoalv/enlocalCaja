import { useState, useEffect } from 'react'
import { Download, X } from 'lucide-react'

interface UpdateInfo {
  version: string
}

export function UpdatePrompt(): JSX.Element | null {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null)
  const [installing, setInstalling] = useState(false)

  useEffect(() => {
    const api = window.electronAPI as { on: (ch: string, cb: (...args: unknown[]) => void) => void; removeListener: (ch: string, cb: (...args: unknown[]) => void) => void; invoke: (ch: string, ...args: unknown[]) => Promise<unknown> } | undefined
    if (!api) return

    const handler = (...args: unknown[]) => {
      const data = args[0] as UpdateInfo
      if (data && typeof data.version === 'string') {
        setUpdateInfo(data)
      }
    }

    api.on('update:available', handler)

    return () => {
      api.removeListener('update:available', handler)
    }
  }, [])

  const handleInstall = async () => {
    const api = window.electronAPI
    if (!api) return

    setInstalling(true)
    try {
      await api.invoke('install-update')
    } catch {
      setInstalling(false)
    }
  }

  const handleDismiss = () => {
    setUpdateInfo(null)
  }

  if (!updateInfo) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="relative mx-4 w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-2xl">
        <button
          onClick={handleDismiss}
          className="absolute right-3 top-3 rounded p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          aria-label="Cerrar"
          type="button"
          disabled={installing}
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex flex-col items-center text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-blue-100">
            <Download className="h-7 w-7 text-blue-600" />
          </div>

          <h2 className="mb-2 text-lg font-semibold text-gray-900">
            Nueva version {updateInfo.version} disponible
          </h2>

          <p className="mb-6 text-sm text-gray-500">
            Se respaldara tu base de datos automaticamente antes de instalar la actualizacion.
          </p>

          <div className="flex w-full gap-3">
            <button
              onClick={handleDismiss}
              disabled={installing}
              className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
              type="button"
            >
              Despues
            </button>
            <button
              onClick={handleInstall}
              disabled={installing}
              className="flex-1 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
              type="button"
            >
              {installing ? 'Instalando...' : 'Actualizar ahora'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
