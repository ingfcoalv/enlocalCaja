// @enlocal/core-server — Express base compartido

export { createBaseServer } from './createServer'
export { authMiddleware } from './middleware/auth'
export { requirePermission, ROLE_PERMISSIONS } from './middleware/permissions'
export { moduleGuard } from './middleware/moduleGuard'
export { errorHandler } from './middleware/errorHandler'
export type { AppError } from './middleware/errorHandler'
export { setupSocketHandlers, getConnectedDevices, setMaxConnections } from './realtime/socketHandler'
export type { SocketHandlerOptions } from './realtime/socketHandler'
export type { ServerConfig, AuthenticatedRequest, AuthenticatedUser } from './types'

// Permission registry & defaults
export { PERMISSION_REGISTRY, ALL_PERMISSION_KEYS } from './permissions/registry'
export type { PermissionDef, PermissionSection } from './permissions/registry'
export { ROLE_PERMISSION_DEFAULTS, SYSTEM_ROLES } from './permissions/defaults'
