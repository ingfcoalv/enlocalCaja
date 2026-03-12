/**
 * Default permissions for each predefined role.
 *
 * These are used by the permissions middleware as fallback when a user
 * has a role string but no explicit permissions in user_roles → roles.
 */

export const ROLE_PERMISSION_DEFAULTS: Record<string, string[]> = {
  owner: ['*'],
  admin: ['*'],
  manager: [
    'users.*', 'roles.read',
    'customers.*', 'products.*', 'services.*', 'categories.*',
    'suppliers.*', 'sections.*',
    'invoices.*', 'payroll.*', 'pos.*', 'registers.*', 'inventory.*',
    'remissions.*', 'returns.*', 'receivables.*',
    'quotes.*',
    'purchase_orders.*', 'payables.*', 'supplier_invoices.*', 'purchase_returns.*',
    'appointments.*', 'reports.*', 'dashboard.*',
    'settings.read', 'settings.update',
    'stock.read', 'invoicing.*',
    'catalogs.read', 'catalogs.write',
  ],
  operator: [
    'customers.*', 'products.read', 'services.read', 'categories.read',
    'suppliers.read', 'sections.read',
    'invoices.create', 'invoices.read', 'invoices.update',
    'payroll.read', 'pos.*', 'inventory.read', 'inventory.create',
    'remissions.create', 'remissions.read', 'remissions.update', 'remissions.confirm', 'remissions.cancel',
    'quotes.create', 'quotes.read', 'quotes.update', 'quotes.send', 'quotes.convert', 'quotes.cancel',
    'returns.request', 'receivables.read',
    'purchase_orders.create', 'purchase_orders.read', 'purchase_orders.update', 'purchase_orders.cancel',
    'appointments.*', 'reports.read', 'dashboard.read',
    'catalogs.read', 'catalogs.write',
  ],
  warehouse: [
    'remissions.read', 'remissions.prepare', 'remissions.deliver',
    'returns.read', 'returns.receive', 'returns.reject',
    'inventory.read', 'inventory.movements', 'stock.read',
    'purchase_orders.read', 'purchase_orders.receive',
    'purchase_returns.create', 'purchase_returns.read', 'purchase_returns.process',
    'products.read', 'categories.read', 'sections.read',
    'catalogs.read',
  ],
  cashier: [
    'pos.*', 'registers.read', 'customers.read', 'products.read',
    'invoices.read', 'invoices.create',
    'receivables.read', 'receivables.collect',
    'payables.read', 'payables.pay',
    'dashboard.read',
    'catalogs.read',
  ],
  viewer: [
    'customers.read', 'products.read', 'services.read', 'categories.read',
    'suppliers.read', 'sections.read',
    'invoices.read', 'payroll.read', 'pos.read', 'inventory.read',
    'remissions.read', 'returns.read', 'receivables.read',
    'purchase_orders.read', 'payables.read', 'supplier_invoices.read', 'purchase_returns.read',
    'appointments.read', 'reports.read', 'dashboard.read',
    'stock.read', 'invoicing.read', 'quotes.read',
    'catalogs.read',
  ],
}

/** System role names (used for migration seeding) */
export const SYSTEM_ROLES = Object.keys(ROLE_PERMISSION_DEFAULTS)
