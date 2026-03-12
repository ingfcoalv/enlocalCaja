import { useEffect, useState } from 'react'
import { api, getSocket } from '@enlocal/react-hooks'

/**
 * Tracks pending warehouse remission count.
 * Fetches initial count from API and listens to socket events to increment/decrement.
 */
export function useWarehouseBadge() {
  const [count, setCount] = useState(0)

  // Initial fetch
  useEffect(() => {
    api.get('/api/remissions/warehouse/pending')
      .then(({ data }) => {
        const items = data.data || []
        setCount(items.length)
      })
      .catch(() => {})
  }, [])

  // Socket listeners
  useEffect(() => {
    const socket = getSocket()
    if (!socket) return

    const onConfirmed = () => setCount((c) => c + 1)
    const onPrepared = () => {} // stays in warehouse pending (prepared)
    const onDelivered = () => setCount((c) => Math.max(0, c - 1))
    const onCancelled = () => setCount((c) => Math.max(0, c - 1))

    socket.on('remission:confirmed', onConfirmed)
    socket.on('remission:prepared', onPrepared)
    socket.on('remission:delivered', onDelivered)
    socket.on('remission:cancelled', onCancelled)

    return () => {
      socket.off('remission:confirmed', onConfirmed)
      socket.off('remission:prepared', onPrepared)
      socket.off('remission:delivered', onDelivered)
      socket.off('remission:cancelled', onCancelled)
    }
  }, [])

  return count
}
