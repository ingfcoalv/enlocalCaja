import { useSyncStatus } from '@enlocal/react-hooks'
import { WifiOff } from 'lucide-react'

/**
 * Yellow banner shown when cloud is not reachable.
 * Auto-hides when connection is restored.
 */
export function OfflineIndicator() {
  const { isCloudReachable, loading } = useSyncStatus()

  if (loading || isCloudReachable) return null

  return (
    <div className="flex items-center gap-2 rounded-lg bg-yellow-50 px-4 py-2 text-sm text-yellow-800">
      <WifiOff className="h-4 w-4 flex-shrink-0" />
      <span>Modo sin conexion — Los cambios se sincronizaran al reconectar</span>
    </div>
  )
}
