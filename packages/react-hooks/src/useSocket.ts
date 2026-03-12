import { create } from 'zustand'
import { io, Socket } from 'socket.io-client'

interface SocketState {
  socket: Socket | null
  connected: boolean
  reconnecting: boolean
}

const useSocketStore = create<SocketState>(() => ({
  socket: null,
  connected: false,
  reconnecting: false,
}))

/**
 * Connect to the Socket.io server with authentication token.
 * If already connected, disconnects first.
 */
export function connectSocket(token: string, serverUrl?: string): Socket {
  const current = useSocketStore.getState().socket
  if (current) {
    current.disconnect()
  }

  const url = serverUrl || 'http://localhost:3000'

  const socket = io(url, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
  })

  socket.on('connect', () => {
    useSocketStore.setState({ connected: true, reconnecting: false })
  })

  socket.on('disconnect', () => {
    useSocketStore.setState({ connected: false })
  })

  socket.io.on('reconnect_attempt', () => {
    useSocketStore.setState({ reconnecting: true })
  })

  socket.io.on('reconnect', () => {
    useSocketStore.setState({ connected: true, reconnecting: false })
  })

  socket.io.on('reconnect_failed', () => {
    useSocketStore.setState({ reconnecting: false })
  })

  socket.on('connect_error', () => {
    useSocketStore.setState({ connected: false })
  })

  useSocketStore.setState({ socket, connected: false, reconnecting: false })

  return socket
}

/**
 * Disconnect and cleanup the current socket connection.
 */
export function disconnectSocket(): void {
  const { socket } = useSocketStore.getState()
  if (socket) {
    socket.removeAllListeners()
    socket.disconnect()
    useSocketStore.setState({ socket: null, connected: false, reconnecting: false })
  }
}

/**
 * Get the current socket instance (or null if not connected).
 */
export function getSocket(): Socket | null {
  return useSocketStore.getState().socket
}

/**
 * React hook returning socket connection state and control functions.
 */
export function useSocket() {
  const connected = useSocketStore((s) => s.connected)
  const reconnecting = useSocketStore((s) => s.reconnecting)

  return {
    connected,
    reconnecting,
    connect: connectSocket,
    disconnect: disconnectSocket,
  }
}
