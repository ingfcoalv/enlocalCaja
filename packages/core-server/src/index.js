// @enlocal/core-server — Express base compartido
export { createBaseServer } from './createServer';
export { authMiddleware } from './middleware/auth';
export { requirePermission, ROLE_PERMISSIONS } from './middleware/permissions';
export { moduleGuard } from './middleware/moduleGuard';
export { errorHandler } from './middleware/errorHandler';
export { setupSocketHandlers, getConnectedDevices } from './realtime/socketHandler';
//# sourceMappingURL=index.js.map