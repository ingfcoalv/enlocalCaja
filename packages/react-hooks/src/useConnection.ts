import { useState, useEffect, useCallback, useRef } from 'react'
import { api } from './useAuth'

interface ConnectionState {
  online: boolean
  serverReachable: boolean
}

const HEALTH_CHECK_INTERVAL = 15000 // 15 seconds

export function useConnection(): ConnectionState {
  const [online, setOnline] = useState<boolean>(
    typeof window !== 'undefined' ? window.navigator.onLine : true
  )
  const [serverReachable, setServerReachable] = useState<boolean>(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const checkServer = useCallback(async () => {
    try {
      await api.get('/api/health', { timeout: 5000 })
      setServerReachable(true)
    } catch {
      setServerReachable(false)
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleOnline = () => {
      setOnline(true)
      // Check server immediately when coming back online
      checkServer()
    }
    const handleOffline = () => {
      setOnline(false)
      setServerReachable(false)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Initial server check
    checkServer()

    // Periodic health check
    intervalRef.current = setInterval(checkServer, HEALTH_CHECK_INTERVAL)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [checkServer])

  return { online, serverReachable }
}
