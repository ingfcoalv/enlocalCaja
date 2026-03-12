import { useState, useEffect, useCallback } from 'react'

interface SyncStatus {
  status: 'idle' | 'syncing' | 'error' | 'offline' | 'disabled'
  lastSyncAt: string | null
  lastError: string | null
  isCloudReachable: boolean
  queueStats: {
    pending: number
    synced: number
    failed: number
  }
}

const DEFAULT_STATUS: SyncStatus = {
  status: 'idle',
  lastSyncAt: null,
  lastError: null,
  isCloudReachable: false,
  queueStats: { pending: 0, synced: 0, failed: 0 },
}

function getBaseUrl(): string {
  if (typeof window !== 'undefined') {
    return window.location.origin
  }
  return 'http://localhost:9005'
}

export function useSyncStatus(pollIntervalMs = 30_000) {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(DEFAULT_STATUS)
  const [loading, setLoading] = useState(true)

  const fetchStatus = useCallback(async () => {
    try {
      const response = await fetch(`${getBaseUrl()}/api/sync/status`)
      if (!response.ok) return

      const data = await response.json()
      setSyncStatus(data)
    } catch {
      setSyncStatus((prev) => ({ ...prev, isCloudReachable: false }))
    } finally {
      setLoading(false)
    }
  }, [])

  const triggerSync = useCallback(async () => {
    try {
      await fetch(`${getBaseUrl()}/api/sync/trigger`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trigger: 'manual' }),
      })
      // Refresh status after trigger
      setTimeout(fetchStatus, 1000)
    } catch {
      // Ignore
    }
  }, [fetchStatus])

  useEffect(() => {
    fetchStatus()

    const interval = setInterval(fetchStatus, pollIntervalMs)
    return () => clearInterval(interval)
  }, [fetchStatus, pollIntervalMs])

  return {
    ...syncStatus,
    loading,
    triggerSync,
    refetch: fetchStatus,
  }
}
