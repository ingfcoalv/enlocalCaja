// @enlocal/core-db — Base de datos compartida (PostgreSQL + Drizzle ORM)
// Connection
export { createDbPool, closeDbPool } from './connection';
// Migrations
export { runMigrations } from './migrator';
// Schemas
export { users, } from './schema/users';
export { roles, userRoles, } from './schema/roles';
export { customers, } from './schema/customers';
export { categories, products, } from './schema/products';
export { priceLists, productPrices, } from './schema/priceLists';
export { services, } from './schema/services';
export { sections, } from './schema/sections';
export { suppliers, } from './schema/suppliers';
export { invoices, invoiceItems, } from './schema/invoices';
export { settings, } from './schema/settings';
export { changeJournal, } from './schema/changeJournal';
export { syncState, } from './schema/syncState';
export { remissionNotes, remissionNoteItems, remissionReturns, remissionReturnItems, receivables, receivablePayments, remissionStatusHistory, } from './schema/remissions';
// Re-export all schemas as a namespace for Drizzle relational queries
export * as schema from './schema';
//# sourceMappingURL=index.js.map