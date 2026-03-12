// TODO: Verificar acceso a módulos según licencia

export const SOFTWARE_MODULES: Record<string, {
  default: string[]
  addons: string[]
}> = {
  'enlocal-facturacion': {
    default: ['mod-config', 'mod-catalogs', 'mod-invoicing', 'mod-reports'],
    addons: ['mod-inventory', 'mod-pos', 'mod-quotes'],
  },
  'enlocal-nominas': {
    default: ['mod-config', 'mod-catalogs', 'mod-payroll', 'mod-reports'],
    addons: ['mod-invoicing'],
  },
  'enlocal-erp': {
    default: ['mod-config', 'mod-catalogs', 'mod-invoicing', 'mod-inventory',
              'mod-pos', 'mod-payroll', 'mod-reports', 'mod-quotes'],
    addons: ['mod-appointments'],
  },
  'enlocal-servicios': {
    default: ['mod-config', 'mod-catalogs', 'mod-appointments', 'mod-invoicing', 'mod-reports', 'mod-quotes'],
    addons: ['mod-inventory', 'mod-pos'],
  },
  'enlocal-caja': {
    default: ['mod-config', 'mod-catalogs', 'mod-pos', 'mod-reports', 'mod-inventory'],
    addons: ['mod-invoicing', 'mod-quotes', 'mod-remissions', 'mod-payables', 'mod-multicaja'],
  },
}

export const MODULE_DEPENDENCIES: Record<string, string[]> = {
  'mod-remissions': ['mod-inventory', 'mod-invoicing'],
  'mod-payables': ['mod-catalogs'],
  'mod-quotes': ['mod-catalogs'],
  'mod-invoicing': ['mod-catalogs'],
  'mod-inventory': ['mod-catalogs'],
  'mod-pos': ['mod-catalogs'],
  'mod-multicaja': ['mod-pos'],
}

export function validateModuleDependencies(
  enabledModules: string[]
): Array<{ module: string; missing: string[] }> {
  const warnings: Array<{ module: string; missing: string[] }> = []
  for (const mod of enabledModules) {
    const deps = MODULE_DEPENDENCIES[mod]
    if (!deps) continue
    const missing = deps.filter(d => !enabledModules.includes(d))
    if (missing.length > 0) {
      warnings.push({ module: mod, missing })
    }
  }
  return warnings
}

export function getEnabledModules(appId: string, _plan: string, addons: string[]): string[] {
  const appModules = SOFTWARE_MODULES[appId]
  if (!appModules) return []

  const enabled = [...appModules.default]

  for (const addon of addons) {
    if (appModules.addons.includes(addon)) {
      enabled.push(addon)
    }
  }

  return enabled
}

export function hasModuleAccess(enabledModules: string[], requiredModule: string): boolean {
  return enabledModules.includes(requiredModule)
}
