import { useSyncStatus, useLicenseStore } from '@enlocal/react-hooks'
import { RefreshCw, Cloud, CloudOff, AlertCircle, Lock } from 'lucide-react'

/**
 * Sync status indicator for header.
 * Green = synced, Yellow = syncing, Red = error/offline.
 * Lock = trial mode (sync disabled).
 * Click triggers manual sync.
 */
export function SyncStatusIndicator() {
  const { status, lastSyncAt, isCloudReachable, triggerSync } = useSyncStatus()
  const isTrial = useLicenseStore((s) => (s as any).isTrial as boolean)

  // Trial mode — show lock
  if (isTrial) {
    return (
      <div
        className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-gray-400 cursor-default"
        title="Sincronizacion disponible con licencia activa"
      >
        <Lock className="h-4 w-4" />
        <span className="hidden text-xs sm:inline">Sync</span>
      </div>
    )
  }

  let icon = <Cloud className="h-4 w-4" />
  let colorClass = 'text-green-500'
  let title = 'Sincronizado'

  if (status === 'syncing') {
    icon = <RefreshCw className="h-4 w-4 animate-spin" />
    colorClass = 'text-yellow-500'
    title = 'Sincronizando...'
  } else if (status === 'error') {
    icon = <AlertCircle className="h-4 w-4" />
    colorClass = 'text-red-500'
    title = 'Error de sincronizacion'
  } else if (status === 'offline' || !isCloudReachable) {
    icon = <CloudOff className="h-4 w-4" />
    colorClass = 'text-red-500'
    title = 'Sin conexion a la nube'
  }

  const lastSync = lastSyncAt
    ? new Date(lastSyncAt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
    : null

  return (
    <button
      onClick={triggerSync}
      className={`flex items-center gap-1.5 rounded-lg px-2 py-1 transition-colors hover:bg-gray-100 ${colorClass}`}
      title={`${title}${lastSync ? ` — Ultima sync: ${lastSync}` : ''}`}
      type="button"
    >
      {icon}
      {lastSync && (
        <span className="hidden text-xs text-gray-500 sm:inline">{lastSync}</span>
      )}
    </button>
  )
}
