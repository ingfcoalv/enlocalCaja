// TODO: Express server para enLocal Servicios
// Monta: mod-config, mod-catalogs, mod-appointments, mod-invoicing, mod-reports
// Addons: mod-inventory, mod-pos
// Escucha en 0.0.0.0 (multiuser)

export async function startServer(_config: {
  port: number
  dbName: string
  enabledModules: string[]
  multiuser: boolean
}): Promise<any> {
  // Implementación en Fase 10
  return {}
}
