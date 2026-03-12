// @enlocal/mod-config — Módulo de Configuración, Usuarios, Roles
// Monta rutas: /api/auth, /api/users, /api/roles, /api/settings

export { mountConfigRoutes, mountGenericSettingsRoutes } from './mount'
export { ScaleService } from './services/scale.service'
export type { ScaleConfig } from './services/scale.service'
export { loadScales } from './routes/scale.routes'
