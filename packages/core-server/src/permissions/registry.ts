/**
 * Central Permission Registry
 *
 * All permissions in the system, grouped by section.
 * Sections with a `module` field are only visible when that addon is licensed.
 */

export interface PermissionDef {
  key: string
  label: string
}

export interface PermissionSection {
  id: string
  label: string
  /** If set, section only shows when this module is active */
  module?: string
  permissions: PermissionDef[]
}

export const PERMISSION_REGISTRY: PermissionSection[] = [
  // ── Always visible ──────────────────────────────────────────────

  {
    id: 'dashboard',
    label: 'Dashboard',
    permissions: [
      { key: 'dashboard.read', label: 'Ver dashboard' },
    ],
  },
  {
    id: 'pos',
    label: 'Punto de Venta',
    permissions: [
      { key: 'pos.read', label: 'Ver punto de venta' },
      { key: 'pos.sell', label: 'Realizar ventas' },
      { key: 'pos.discount', label: 'Aplicar descuentos' },
      { key: 'pos.cancel', label: 'Cancelar ventas' },
      { key: 'pos.reprint', label: 'Reimprimir tickets' },
      { key: 'pos.open_drawer', label: 'Abrir cajon' },
    ],
  },
  {
    id: 'registers',
    label: 'Cajas',
    permissions: [
      { key: 'registers.read', label: 'Ver cajas' },
      { key: 'registers.create', label: 'Crear cajas' },
      { key: 'registers.update', label: 'Editar cajas' },
      { key: 'registers.delete', label: 'Eliminar cajas' },
    ],
  },
  {
    id: 'catalogs',
    label: 'Catalogos',
    permissions: [
      { key: 'products.read', label: 'Ver productos' },
      { key: 'products.create', label: 'Crear productos' },
      { key: 'products.update', label: 'Editar productos' },
      { key: 'products.delete', label: 'Eliminar productos' },
      { key: 'services.read', label: 'Ver servicios' },
      { key: 'services.create', label: 'Crear servicios' },
      { key: 'services.update', label: 'Editar servicios' },
      { key: 'services.delete', label: 'Eliminar servicios' },
      { key: 'categories.read', label: 'Ver categorias' },
      { key: 'categories.create', label: 'Crear categorias' },
      { key: 'categories.update', label: 'Editar categorias' },
      { key: 'categories.delete', label: 'Eliminar categorias' },
      { key: 'sections.read', label: 'Ver secciones' },
      { key: 'sections.create', label: 'Crear secciones' },
      { key: 'sections.update', label: 'Editar secciones' },
      { key: 'sections.delete', label: 'Eliminar secciones' },
      { key: 'suppliers.read', label: 'Ver proveedores' },
      { key: 'suppliers.create', label: 'Crear proveedores' },
      { key: 'suppliers.update', label: 'Editar proveedores' },
      { key: 'suppliers.delete', label: 'Eliminar proveedores' },
    ],
  },
  {
    id: 'customers',
    label: 'Clientes',
    permissions: [
      { key: 'customers.read', label: 'Ver clientes' },
      { key: 'customers.create', label: 'Crear clientes' },
      { key: 'customers.update', label: 'Editar clientes' },
      { key: 'customers.delete', label: 'Eliminar clientes' },
    ],
  },
  {
    id: 'invoices',
    label: 'Ventas',
    permissions: [
      { key: 'invoices.read', label: 'Ver ventas' },
      { key: 'invoices.create', label: 'Crear ventas' },
      { key: 'invoices.update', label: 'Editar ventas' },
      { key: 'invoices.delete', label: 'Eliminar ventas' },
    ],
  },
  {
    id: 'reports',
    label: 'Reportes',
    permissions: [
      { key: 'reports.read', label: 'Ver reportes' },
      { key: 'reports.export', label: 'Exportar reportes' },
    ],
  },
  {
    id: 'config',
    label: 'Configuracion',
    permissions: [
      { key: 'settings.read', label: 'Ver configuracion' },
      { key: 'settings.update', label: 'Modificar configuracion' },
      { key: 'payroll.read', label: 'Ver nomina' },
      { key: 'payroll.update', label: 'Gestionar nomina' },
    ],
  },
  {
    id: 'users',
    label: 'Usuarios y Roles',
    permissions: [
      { key: 'users.read', label: 'Ver usuarios' },
      { key: 'users.create', label: 'Crear usuarios' },
      { key: 'users.update', label: 'Editar usuarios' },
      { key: 'users.delete', label: 'Eliminar usuarios' },
      { key: 'roles.read', label: 'Ver roles' },
      { key: 'roles.create', label: 'Crear roles' },
      { key: 'roles.update', label: 'Editar roles' },
      { key: 'roles.delete', label: 'Eliminar roles' },
    ],
  },

  // ── Addon gated ─────────────────────────────────────────────────

  {
    id: 'remissions',
    label: 'Remisiones',
    module: 'remissions',
    permissions: [
      { key: 'remissions.read', label: 'Ver remisiones' },
      { key: 'remissions.create', label: 'Crear remisiones' },
      { key: 'remissions.update', label: 'Editar remisiones' },
      { key: 'remissions.confirm', label: 'Confirmar remisiones' },
      { key: 'remissions.cancel', label: 'Cancelar remisiones' },
      { key: 'remissions.prepare', label: 'Preparar remisiones' },
      { key: 'remissions.deliver', label: 'Entregar remisiones' },
    ],
  },
  {
    id: 'returns',
    label: 'Devoluciones (Ventas)',
    module: 'remissions',
    permissions: [
      { key: 'returns.read', label: 'Ver devoluciones' },
      { key: 'returns.request', label: 'Solicitar devoluciones' },
      { key: 'returns.receive', label: 'Recibir devoluciones' },
      { key: 'returns.reject', label: 'Rechazar devoluciones' },
    ],
  },
  {
    id: 'receivables',
    label: 'Cuentas por Cobrar',
    module: 'remissions',
    permissions: [
      { key: 'receivables.read', label: 'Ver cuentas por cobrar' },
      { key: 'receivables.collect', label: 'Registrar cobros' },
    ],
  },
  {
    id: 'quotes',
    label: 'Cotizaciones',
    module: 'quotes',
    permissions: [
      { key: 'quotes.read', label: 'Ver cotizaciones' },
      { key: 'quotes.create', label: 'Crear cotizaciones' },
      { key: 'quotes.update', label: 'Editar cotizaciones' },
      { key: 'quotes.send', label: 'Enviar cotizaciones' },
      { key: 'quotes.convert', label: 'Convertir a venta' },
      { key: 'quotes.cancel', label: 'Cancelar cotizaciones' },
    ],
  },
  {
    id: 'inventory',
    label: 'Inventario',
    module: 'inventory',
    permissions: [
      { key: 'inventory.read', label: 'Ver inventario' },
      { key: 'inventory.create', label: 'Crear movimientos' },
      { key: 'inventory.movements', label: 'Gestionar movimientos' },
      { key: 'stock.read', label: 'Ver existencias' },
    ],
  },
  {
    id: 'invoicing',
    label: 'Facturacion',
    module: 'invoicing',
    permissions: [
      { key: 'invoicing.read', label: 'Ver facturas' },
      { key: 'invoicing.create', label: 'Crear facturas' },
      { key: 'invoicing.cancel', label: 'Cancelar facturas' },
    ],
  },
  {
    id: 'purchase_orders',
    label: 'Ordenes de Compra',
    module: 'payables',
    permissions: [
      { key: 'purchase_orders.read', label: 'Ver ordenes de compra' },
      { key: 'purchase_orders.create', label: 'Crear ordenes de compra' },
      { key: 'purchase_orders.update', label: 'Editar ordenes de compra' },
      { key: 'purchase_orders.cancel', label: 'Cancelar ordenes de compra' },
      { key: 'purchase_orders.receive', label: 'Recibir ordenes de compra' },
    ],
  },
  {
    id: 'supplier_invoices',
    label: 'Facturas de Proveedores',
    module: 'payables',
    permissions: [
      { key: 'supplier_invoices.read', label: 'Ver facturas de proveedores' },
      { key: 'supplier_invoices.create', label: 'Registrar facturas de proveedores' },
      { key: 'supplier_invoices.update', label: 'Editar facturas de proveedores' },
    ],
  },
  {
    id: 'purchase_returns',
    label: 'Devoluciones (Compras)',
    module: 'payables',
    permissions: [
      { key: 'purchase_returns.read', label: 'Ver devoluciones a proveedores' },
      { key: 'purchase_returns.create', label: 'Crear devoluciones a proveedores' },
      { key: 'purchase_returns.process', label: 'Procesar devoluciones a proveedores' },
    ],
  },
  {
    id: 'payables',
    label: 'Cuentas por Pagar',
    module: 'payables',
    permissions: [
      { key: 'payables.read', label: 'Ver cuentas por pagar' },
      { key: 'payables.pay', label: 'Registrar pagos' },
    ],
  },
]

/** All permission keys extracted from the registry */
export const ALL_PERMISSION_KEYS: string[] = PERMISSION_REGISTRY.flatMap(
  (s) => s.permissions.map((p) => p.key)
)
