import { ipcMain } from 'electron'

export function registerLicenseHandlers(): void {
  ipcMain.handle('activate-license', async (_event, params: { cloudApiUrl: string; appId: string; serialKey: string }) => {
    const { activateLicense } = await import('@enlocal/core-license')
    return activateLicense(params)
  })

  ipcMain.handle('get-license-info', async (_event, params: { cloudApiUrl: string; appId: string }) => {
    const { validateLicense } = await import('@enlocal/core-license')
    return validateLicense(params)
  })

  ipcMain.handle('get-module-access', async (_event, params: { appId: string; plan: string; addons: string[] }) => {
    const { getEnabledModules } = await import('@enlocal/core-license')
    return getEnabledModules(params.appId, params.plan, params.addons)
  })
}
