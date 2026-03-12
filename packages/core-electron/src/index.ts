// @enlocal/core-electron — Shell Electron reutilizable

export { createEnLocalApp } from './createApp'
export type { EnLocalAppConfig } from './createApp'

export { createMainWindow } from './windowManager'
export type { WindowConfig } from './windowManager'

export { createTray, updateTrayStatus } from './tray'

export { getLocalIP, generateAccessQR } from './qrAccess'

export { registerAllIPCHandlers } from './ipc'
export { setServerInfo } from './ipc/serverHandlers'

export { PgManager } from './pgManager'
export type { PgManagerConfig, PgConnectionConfig } from './pgManager'
