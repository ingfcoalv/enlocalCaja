// @enlocal/core-db — Base de datos compartida (PostgreSQL + Drizzle ORM)

// Connection
export { createDbPool, closeDbPool } from './connection'
export type { DbPoolConfig, DbInstance } from './connection'

// Migrations
export { runMigrations } from './migrator'

// Schemas
export {
  users,
  type User,
  type NewUser,
} from './schema/users'

export {
  roles,
  userRoles,
  type Role,
  type NewRole,
  type UserRole,
  type NewUserRole,
} from './schema/roles'

export {
  customers,
  type Customer,
  type NewCustomer,
} from './schema/customers'

export {
  categories,
  products,
  type Category,
  type NewCategory,
  type Product,
  type NewProduct,
} from './schema/products'

export {
  priceLists,
  productPrices,
  type PriceList,
  type NewPriceList,
  type ProductPrice,
  type NewProductPrice,
} from './schema/priceLists'

export {
  services,
  type Service,
  type NewService,
} from './schema/services'

export {
  sections,
  type Section,
  type NewSection,
} from './schema/sections'

export {
  suppliers,
  type Supplier,
  type NewSupplier,
} from './schema/suppliers'

export {
  invoices,
  invoiceItems,
  type Invoice,
  type NewInvoice,
  type InvoiceItem,
  type NewInvoiceItem,
} from './schema/invoices'

export {
  invoiceLinks,
  type InvoiceLink,
  type NewInvoiceLink,
} from './schema/invoiceLinks'

export {
  settings,
  type Setting,
  type NewSetting,
} from './schema/settings'

export {
  changeJournal,
  type ChangeJournalEntry,
  type NewChangeJournalEntry,
} from './schema/changeJournal'

export {
  syncState,
  type SyncState,
  type NewSyncState,
} from './schema/syncState'

export {
  remissionNotes,
  remissionNoteItems,
  remissionReturns,
  remissionReturnItems,
  receivables,
  receivablePayments,
  remissionStatusHistory,
  type RemissionNote,
  type NewRemissionNote,
  type RemissionNoteItem,
  type NewRemissionNoteItem,
  type RemissionReturn,
  type NewRemissionReturn,
  type RemissionReturnItem,
  type NewRemissionReturnItem,
  type Receivable,
  type NewReceivable,
  type ReceivablePayment,
  type NewReceivablePayment,
  type RemissionStatusHistoryEntry,
  type NewRemissionStatusHistoryEntry,
} from './schema/remissions'

export {
  quotes,
  quoteItems,
  quoteEmails,
  quoteActivities,
  type Quote,
  type NewQuote,
  type QuoteItem,
  type NewQuoteItem,
  type QuoteEmail,
  type NewQuoteEmail,
  type QuoteActivity,
  type NewQuoteActivity,
} from './schema/quotes'

export {
  purchaseOrders,
  purchaseOrderItems,
  purchaseReceipts,
  purchaseReceiptItems,
  supplierInvoices,
  supplierInvoiceItems,
  payables,
  payablePayments,
  purchaseReturns,
  purchaseReturnItems,
  purchaseOrderStatusHistory,
  type PurchaseOrder,
  type NewPurchaseOrder,
  type PurchaseOrderItem,
  type NewPurchaseOrderItem,
  type PurchaseReceipt,
  type NewPurchaseReceipt,
  type PurchaseReceiptItem,
  type NewPurchaseReceiptItem,
  type SupplierInvoice,
  type NewSupplierInvoice,
  type SupplierInvoiceItem,
  type NewSupplierInvoiceItem,
  type Payable,
  type NewPayable,
  type PayablePayment,
  type NewPayablePayment,
  type PurchaseReturn,
  type NewPurchaseReturn,
  type PurchaseReturnItem,
  type NewPurchaseReturnItem,
  type PurchaseOrderStatusHistoryEntry,
  type NewPurchaseOrderStatusHistoryEntry,
} from './schema/payables'

export {
  fiscalConfig,
  invoiceRelations,
  invoicePaymentDetails,
  invoicePaymentRelatedDocs,
  invoiceCartaPorte,
  invoiceCartaPorteLocations,
  invoiceCartaPorteGoods,
  invoiceCartaPorteOperators,
  globalInvoiceTickets,
} from './schema/invoicing'

export {
  satTaxRegimes,
  satCfdiUses,
  satPaymentForms,
  satProductCodes,
  satUnitCodes,
  satCurrencies,
  satRelationshipTypes,
  satCountries,
} from './schema/satCatalogs'

export {
  syncQueue,
  type SyncQueueEntry,
  type NewSyncQueueEntry,
} from './schema/syncQueue'

export {
  idMappings,
  type IdMapping,
  type NewIdMapping,
} from './schema/idMappings'

export {
  productVariants,
  type ProductVariant,
  type NewProductVariant,
} from './schema/productVariants'

// Re-export all schemas as a namespace for Drizzle relational queries
export * as schema from './schema'
