import { pgTable, uuid, text, boolean, timestamp, numeric, integer } from 'drizzle-orm/pg-core'
import { suppliers } from './suppliers'
import { products } from './products'

// ─── Ordenes de Compra ────────────────────────────────────────
export const purchaseOrders = pgTable('purchase_orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  folio: integer('folio').notNull(),
  series: text('series').notNull().default('OC'),
  supplierId: uuid('supplier_id').notNull().references(() => suppliers.id, { onDelete: 'restrict' }),
  supplierName: text('supplier_name').notNull(),
  supplierRfc: text('supplier_rfc'),
  paymentTerms: text('payment_terms').notNull().default('credit'),
  creditDays: integer('credit_days'),
  expectedDate: timestamp('expected_date', { withTimezone: true }),
  status: text('status').notNull().default('draft'),
  subtotal: numeric('subtotal', { precision: 12, scale: 2 }).notNull().default('0'),
  discountAmount: numeric('discount_amount', { precision: 12, scale: 2 }).notNull().default('0'),
  taxAmount: numeric('tax_amount', { precision: 12, scale: 2 }).notNull().default('0'),
  total: numeric('total', { precision: 12, scale: 2 }).notNull().default('0'),
  deliveryAddress: text('delivery_address'),
  deliveryNotes: text('delivery_notes'),
  internalNotes: text('internal_notes'),
  createdBy: uuid('created_by').notNull(),
  approvedBy: uuid('approved_by'),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  cancelledBy: uuid('cancelled_by'),
  cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
  cancelReason: text('cancel_reason'),
  closedBy: uuid('closed_by'),
  closedAt: timestamp('closed_at', { withTimezone: true }),
  closeReason: text('close_reason'),
  cloudId: text('cloud_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// ─── Items de Orden de Compra ─────────────────────────────────
export const purchaseOrderItems = pgTable('purchase_order_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  purchaseOrderId: uuid('purchase_order_id').notNull().references(() => purchaseOrders.id, { onDelete: 'cascade' }),
  productId: uuid('product_id').notNull().references(() => products.id, { onDelete: 'restrict' }),
  productName: text('product_name').notNull(),
  productSku: text('product_sku'),
  quantity: numeric('quantity', { precision: 12, scale: 4 }).notNull(),
  unitCost: numeric('unit_cost', { precision: 12, scale: 2 }).notNull(),
  discount: numeric('discount', { precision: 12, scale: 2 }).notNull().default('0'),
  taxRate: numeric('tax_rate', { precision: 5, scale: 4 }).notNull().default('0.1600'),
  taxAmount: numeric('tax_amount', { precision: 12, scale: 2 }).notNull().default('0'),
  total: numeric('total', { precision: 12, scale: 2 }).notNull(),
  quantityReceived: numeric('quantity_received', { precision: 12, scale: 4 }).notNull().default('0'),
  quantityReturned: numeric('quantity_returned', { precision: 12, scale: 4 }).notNull().default('0'),
  satCode: text('sat_code'),
  satUnit: text('sat_unit').notNull().default('E48'),
  notes: text('notes'),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// ─── Recepciones de Mercancia ─────────────────────────────────
export const purchaseReceipts = pgTable('purchase_receipts', {
  id: uuid('id').primaryKey().defaultRandom(),
  purchaseOrderId: uuid('purchase_order_id').notNull().references(() => purchaseOrders.id, { onDelete: 'restrict' }),
  folio: integer('folio').notNull(),
  series: text('series').notNull().default('REC'),
  receivedBy: uuid('received_by').notNull(),
  receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),
  notes: text('notes'),
  cloudId: text('cloud_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// ─── Items de Recepcion ───────────────────────────────────────
export const purchaseReceiptItems = pgTable('purchase_receipt_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  receiptId: uuid('receipt_id').notNull().references(() => purchaseReceipts.id, { onDelete: 'cascade' }),
  orderItemId: uuid('order_item_id').notNull().references(() => purchaseOrderItems.id, { onDelete: 'restrict' }),
  productId: uuid('product_id').notNull(),
  productName: text('product_name').notNull(),
  quantityReceived: numeric('quantity_received', { precision: 12, scale: 4 }).notNull(),
  quantityRejected: numeric('quantity_rejected', { precision: 12, scale: 4 }).notNull().default('0'),
  condition: text('condition').notNull().default('good'),
  conditionNotes: text('condition_notes'),
  inventoryMovementId: uuid('inventory_movement_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// ─── Facturas de Proveedor ────────────────────────────────────
export const supplierInvoices = pgTable('supplier_invoices', {
  id: uuid('id').primaryKey().defaultRandom(),
  supplierId: uuid('supplier_id').notNull().references(() => suppliers.id, { onDelete: 'restrict' }),
  purchaseOrderId: uuid('purchase_order_id').references(() => purchaseOrders.id, { onDelete: 'set null' }),
  invoiceNumber: text('invoice_number').notNull(),
  invoiceUuid: text('invoice_uuid'),
  type: text('type').notNull().default('I'),
  issueDate: timestamp('issue_date', { withTimezone: true }).notNull(),
  subtotal: numeric('subtotal', { precision: 12, scale: 2 }).notNull().default('0'),
  taxAmount: numeric('tax_amount', { precision: 12, scale: 2 }).notNull().default('0'),
  total: numeric('total', { precision: 12, scale: 2 }).notNull().default('0'),
  currency: text('currency').notNull().default('MXN'),
  paymentMethod: text('payment_method'),
  paymentForm: text('payment_form'),
  xmlData: text('xml_data'),
  status: text('status').notNull().default('pending'),
  notes: text('notes'),
  createdBy: uuid('created_by').notNull(),
  cloudId: text('cloud_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  parentInvoiceId: uuid('parent_invoice_id'),
  amountComplemented: numeric('amount_complemented', { precision: 12, scale: 2 }).notNull().default('0'),
})

// ─── Items de Factura de Proveedor ────────────────────────────
export const supplierInvoiceItems = pgTable('supplier_invoice_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  invoiceId: uuid('invoice_id').notNull().references(() => supplierInvoices.id, { onDelete: 'cascade' }),
  description: text('description').notNull(),
  quantity: numeric('quantity', { precision: 12, scale: 4 }).notNull(),
  unitCost: numeric('unit_cost', { precision: 12, scale: 2 }).notNull(),
  discount: numeric('discount', { precision: 12, scale: 2 }).notNull().default('0'),
  taxRate: numeric('tax_rate', { precision: 5, scale: 4 }).notNull().default('0.1600'),
  taxAmount: numeric('tax_amount', { precision: 12, scale: 2 }).notNull().default('0'),
  total: numeric('total', { precision: 12, scale: 2 }).notNull(),
  productId: uuid('product_id'),
  satCode: text('sat_code'),
  satUnit: text('sat_unit'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// ─── Cuentas por Pagar ────────────────────────────────────────
export const payables = pgTable('payables', {
  id: uuid('id').primaryKey().defaultRandom(),
  supplierId: uuid('supplier_id').notNull().references(() => suppliers.id, { onDelete: 'restrict' }),
  supplierInvoiceId: uuid('supplier_invoice_id').references(() => supplierInvoices.id, { onDelete: 'set null' }),
  purchaseOrderId: uuid('purchase_order_id').references(() => purchaseOrders.id, { onDelete: 'set null' }),
  originalAmount: numeric('original_amount', { precision: 12, scale: 2 }).notNull(),
  adjustments: numeric('adjustments', { precision: 12, scale: 2 }).notNull().default('0'),
  amountPaid: numeric('amount_paid', { precision: 12, scale: 2 }).notNull().default('0'),
  balance: numeric('balance', { precision: 12, scale: 2 }).notNull(),
  issuedDate: timestamp('issued_date', { withTimezone: true }).notNull(),
  dueDate: timestamp('due_date', { withTimezone: true }).notNull(),
  status: text('status').notNull().default('current'),
  priority: integer('priority').notNull().default(0),
  paymentMethod: text('payment_method'),
  lastPaymentDate: timestamp('last_payment_date', { withTimezone: true }),
  daysOverdue: integer('days_overdue').notNull().default(0),
  cloudId: text('cloud_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// ─── Pagos a CxP ─────────────────────────────────────────────
export const payablePayments = pgTable('payable_payments', {
  id: uuid('id').primaryKey().defaultRandom(),
  payableId: uuid('payable_id').notNull().references(() => payables.id, { onDelete: 'restrict' }),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  paymentMethod: text('payment_method').notNull(),
  reference: text('reference'),
  paidBy: uuid('paid_by').notNull(),
  notes: text('notes'),
  cloudId: text('cloud_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// ─── Devoluciones a Proveedor ─────────────────────────────────
export const purchaseReturns = pgTable('purchase_returns', {
  id: uuid('id').primaryKey().defaultRandom(),
  purchaseOrderId: uuid('purchase_order_id').notNull().references(() => purchaseOrders.id, { onDelete: 'restrict' }),
  folio: integer('folio').notNull(),
  series: text('series').notNull().default('DPR'),
  status: text('status').notNull().default('draft'),
  returnType: text('return_type').notNull(),
  reasonCategory: text('reason_category').notNull(),
  reason: text('reason').notNull(),
  totalReturned: numeric('total_returned', { precision: 12, scale: 2 }).notNull().default('0'),
  createdBy: uuid('created_by').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  sentBy: uuid('sent_by'),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  completedBy: uuid('completed_by'),
  rejectedAt: timestamp('rejected_at', { withTimezone: true }),
  rejectedBy: uuid('rejected_by'),
  rejectedReason: text('rejected_reason'),
  payableAdjusted: boolean('payable_adjusted').notNull().default(false),
  cloudId: text('cloud_id'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// ─── Items de Devolucion a Proveedor ──────────────────────────
export const purchaseReturnItems = pgTable('purchase_return_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  returnId: uuid('return_id').notNull().references(() => purchaseReturns.id, { onDelete: 'cascade' }),
  orderItemId: uuid('order_item_id').notNull().references(() => purchaseOrderItems.id, { onDelete: 'restrict' }),
  productId: uuid('product_id').notNull(),
  productName: text('product_name').notNull(),
  quantityReturned: numeric('quantity_returned', { precision: 12, scale: 4 }).notNull(),
  unitCost: numeric('unit_cost', { precision: 12, scale: 2 }).notNull(),
  totalRefund: numeric('total_refund', { precision: 12, scale: 2 }).notNull().default('0'),
  condition: text('condition'),
  conditionNotes: text('condition_notes'),
  inventoryMovementId: uuid('inventory_movement_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// ─── Historial de Estados de OC ───────────────────────────────
export const purchaseOrderStatusHistory = pgTable('purchase_order_status_history', {
  id: uuid('id').primaryKey().defaultRandom(),
  purchaseOrderId: uuid('purchase_order_id').notNull().references(() => purchaseOrders.id, { onDelete: 'cascade' }),
  fromStatus: text('from_status'),
  toStatus: text('to_status').notNull(),
  changedBy: uuid('changed_by').notNull(),
  changedByName: text('changed_by_name').notNull(),
  changedByRole: text('changed_by_role').notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// ─── Types ────────────────────────────────────────────────────
export type PurchaseOrder = typeof purchaseOrders.$inferSelect
export type NewPurchaseOrder = typeof purchaseOrders.$inferInsert
export type PurchaseOrderItem = typeof purchaseOrderItems.$inferSelect
export type NewPurchaseOrderItem = typeof purchaseOrderItems.$inferInsert
export type PurchaseReceipt = typeof purchaseReceipts.$inferSelect
export type NewPurchaseReceipt = typeof purchaseReceipts.$inferInsert
export type PurchaseReceiptItem = typeof purchaseReceiptItems.$inferSelect
export type NewPurchaseReceiptItem = typeof purchaseReceiptItems.$inferInsert
export type SupplierInvoice = typeof supplierInvoices.$inferSelect
export type NewSupplierInvoice = typeof supplierInvoices.$inferInsert
export type SupplierInvoiceItem = typeof supplierInvoiceItems.$inferSelect
export type NewSupplierInvoiceItem = typeof supplierInvoiceItems.$inferInsert
export type Payable = typeof payables.$inferSelect
export type NewPayable = typeof payables.$inferInsert
export type PayablePayment = typeof payablePayments.$inferSelect
export type NewPayablePayment = typeof payablePayments.$inferInsert
export type PurchaseReturn = typeof purchaseReturns.$inferSelect
export type NewPurchaseReturn = typeof purchaseReturns.$inferInsert
export type PurchaseReturnItem = typeof purchaseReturnItems.$inferSelect
export type NewPurchaseReturnItem = typeof purchaseReturnItems.$inferInsert
export type PurchaseOrderStatusHistoryEntry = typeof purchaseOrderStatusHistory.$inferSelect
export type NewPurchaseOrderStatusHistoryEntry = typeof purchaseOrderStatusHistory.$inferInsert
