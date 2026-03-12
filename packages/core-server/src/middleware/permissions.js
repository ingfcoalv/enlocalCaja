const ROLE_PERMISSIONS = {
    owner: ['*'],
    admin: ['*'],
    manager: [
        'users.*', 'roles.read',
        'customers.*', 'products.*', 'services.*', 'categories.*',
        'suppliers.*', 'sections.*',
        'invoices.*', 'payroll.*', 'pos.*', 'inventory.*',
        'remissions.*', 'returns.*', 'receivables.*',
        'appointments.*', 'reports.*', 'dashboard.*',
    ],
    operator: [
        'customers.*', 'products.read', 'services.read', 'categories.read',
        'suppliers.read', 'sections.read',
        'invoices.create', 'invoices.read', 'invoices.update',
        'payroll.read', 'pos.*', 'inventory.read', 'inventory.create',
        'remissions.create', 'remissions.read', 'remissions.update', 'remissions.confirm', 'remissions.cancel',
        'returns.request', 'receivables.read',
        'appointments.*', 'reports.read', 'dashboard.read',
    ],
    warehouse: [
        'remissions.read', 'remissions.prepare', 'remissions.deliver',
        'returns.read', 'returns.receive', 'returns.reject',
        'inventory.read', 'inventory.movements', 'stock.read',
    ],
    cashier: [
        'pos.*', 'customers.read', 'products.read',
        'receivables.read', 'receivables.collect',
    ],
    viewer: [
        'customers.read', 'products.read', 'services.read', 'categories.read',
        'suppliers.read', 'sections.read',
        'invoices.read', 'payroll.read', 'pos.read', 'inventory.read',
        'remissions.read', 'returns.read', 'receivables.read',
        'appointments.read', 'reports.read', 'dashboard.read',
    ],
};
function matchPermission(granted, required) {
    if (granted === '*')
        return true;
    if (granted === required)
        return true;
    // Wildcard: 'orders.*' matches 'orders.create'
    if (granted.endsWith('.*')) {
        const prefix = granted.slice(0, -2);
        return required.startsWith(prefix + '.');
    }
    return false;
}
export function requirePermission(permission) {
    return (req, res, next) => {
        if (!req.user) {
            res.status(401).json({ error: 'UNAUTHORIZED', message: 'Autenticación requerida' });
            return;
        }
        const userRole = req.user.role;
        const rolePerms = ROLE_PERMISSIONS[userRole] || [];
        const userPerms = [...rolePerms, ...(req.user.permissions || [])];
        const hasPermission = userPerms.some((p) => matchPermission(p, permission));
        if (!hasPermission) {
            res.status(403).json({ error: 'FORBIDDEN', message: `Permiso requerido: ${permission}` });
            return;
        }
        next();
    };
}
export { ROLE_PERMISSIONS };
//# sourceMappingURL=permissions.js.map