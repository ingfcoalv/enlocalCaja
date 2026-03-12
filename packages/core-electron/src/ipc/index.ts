import { registerServerHandlers } from './serverHandlers'
import { registerLicenseHandlers } from './licenseHandlers'
import { registerUpdateHandlers } from './updateHandlers'

export function registerAllIPCHandlers(): void {
  registerServerHandlers()
  registerLicenseHandlers()
  registerUpdateHandlers()
}
