import { describe, it, expect } from 'vitest'
import { getTableName } from 'drizzle-orm'
import {
  users,
  roles,
  userRoles,
  customers,
  categories,
  products,
  services,
  sections,
  suppliers,
  invoices,
  invoiceItems,
  settings,
  changeJournal,
  syncState,
} from '../schema'

describe('core-db schemas', () => {
  it('should define all 14 tables with correct names', () => {
    expect(getTableName(users)).toBe('users')
    expect(getTableName(roles)).toBe('roles')
    expect(getTableName(userRoles)).toBe('user_roles')
    expect(getTableName(customers)).toBe('customers')
    expect(getTableName(categories)).toBe('categories')
    expect(getTableName(products)).toBe('products')
    expect(getTableName(services)).toBe('services')
    expect(getTableName(sections)).toBe('sections')
    expect(getTableName(suppliers)).toBe('suppliers')
    expect(getTableName(invoices)).toBe('invoices')
    expect(getTableName(invoiceItems)).toBe('invoice_items')
    expect(getTableName(settings)).toBe('settings')
    expect(getTableName(changeJournal)).toBe('change_journal')
    expect(getTableName(syncState)).toBe('sync_state')
  })

  it('users table should have expected columns', () => {
    const columns = Object.keys(users)
    expect(columns).toContain('id')
    expect(columns).toContain('name')
    expect(columns).toContain('email')
    expect(columns).toContain('pinHash')
    expect(columns).toContain('role')
    expect(columns).toContain('active')
    expect(columns).toContain('createdAt')
    expect(columns).toContain('updatedAt')
  })

  it('invoices table should have CFDI-specific columns', () => {
    const columns = Object.keys(invoices)
    expect(columns).toContain('series')
    expect(columns).toContain('folio')
    expect(columns).toContain('type')
    expect(columns).toContain('status')
    expect(columns).toContain('useCfdi')
    expect(columns).toContain('uuidFiscal')
    expect(columns).toContain('xmlContent')
    expect(columns).toContain('subtotal')
    expect(columns).toContain('tax')
    expect(columns).toContain('total')
    expect(columns).toContain('currency')
  })

  it('products table should have SAT-specific columns', () => {
    const columns = Object.keys(products)
    expect(columns).toContain('satCode')
    expect(columns).toContain('satUnit')
    expect(columns).toContain('taxRate')
    expect(columns).toContain('barcode')
    expect(columns).toContain('sku')
  })

  it('customers table should have fiscal data columns', () => {
    const columns = Object.keys(customers)
    expect(columns).toContain('rfc')
    expect(columns).toContain('razonSocial')
    expect(columns).toContain('regimenFiscal')
    expect(columns).toContain('usoCfdi')
    expect(columns).toContain('codigoPostal')
  })

  it('changeJournal should have sync-related columns', () => {
    const columns = Object.keys(changeJournal)
    expect(columns).toContain('tableName')
    expect(columns).toContain('recordId')
    expect(columns).toContain('action')
    expect(columns).toContain('data')
    expect(columns).toContain('synced')
  })
})
