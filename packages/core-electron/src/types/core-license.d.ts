declare module '@enlocal/core-license' {
  export function activateLicense(params: {
    cloudApiUrl: string
    appId: string
    serialKey: string
  }): Promise<any>

  export function validateLicense(params: {
    cloudApiUrl: string
    appId: string
  }): Promise<any>

  export function getEnabledModules(
    appId: string,
    plan: string,
    addons: string[]
  ): string[]
}
