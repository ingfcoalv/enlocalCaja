import type { Server as SocketServer } from 'socket.io'
import jwt from 'jsonwebtoken'

interface ConnectedDevice {
  socketId: string
  userId: string
  userName: string
  deviceType: string
  connectedAt: Date
}

const connectedDevices = new Map<string, ConnectedDevice>()

// Module-level max so it can be updated at runtime
let _maxConnections = Infinity

export interface SocketHandlerOptions {
  maxConnections?: number
  onCountChange?: (count: number) => void
}

/**
 * Update max connections limit at runtime (e.g. after license revalidation).
 */
export function setMaxConnections(max: number): void {
  _maxConnections = max
}

export function setupSocketHandlers(
  io: SocketServer,
  jwtSecret?: string,
  options?: SocketHandlerOptions,
): void {
  const secret = jwtSecret || 'enlocal-suite-jwt-secret'
  _maxConnections = options?.maxConnections ?? Infinity
  const onCountChange = options?.onCountChange

  // Auth middleware for Socket.io handshake
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token
    if (!token) {
      return next(new Error('Token de autenticación requerido'))
    }

    try {
      const decoded = jwt.verify(token, secret) as { id: string; name: string }
      socket.data.user = decoded
      next()
    } catch {
      next(new Error('Token inválido'))
    }
  })

  // Connection limit middleware
  io.use((socket, next) => {
    if (connectedDevices.size >= _maxConnections) {
      return next(new Error('Límite de conexiones alcanzado'))
    }
    next()
  })

  io.on('connection', (socket) => {
    const user = socket.data.user
    const deviceType = socket.handshake.query.deviceType as string || 'desktop'

    // Track connected device
    connectedDevices.set(socket.id, {
      socketId: socket.id,
      userId: user.id,
      userName: user.name,
      deviceType,
      connectedAt: new Date(),
    })

    // Broadcast updated device list
    io.emit('devices:updated', Array.from(connectedDevices.values()))
    onCountChange?.(connectedDevices.size)

    socket.on('disconnect', () => {
      connectedDevices.delete(socket.id)
      io.emit('devices:updated', Array.from(connectedDevices.values()))
      onCountChange?.(connectedDevices.size)
    })
  })
}

export function getConnectedDevices(): ConnectedDevice[] {
  return Array.from(connectedDevices.values())
}
