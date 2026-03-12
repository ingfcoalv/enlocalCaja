import { pgTable, uuid, text, boolean, numeric, integer, index } from 'drizzle-orm/pg-core'

// ─── Regímenes Fiscales SAT ──────────────────────────────────
export const satTaxRegimes = pgTable('sat_tax_regimes', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: text('code').notNull().unique(),
  description: text('description').notNull(),
  personaMoral: boolean('persona_moral').notNull().default(false),
  personaFisica: boolean('persona_fisica').notNull().default(false),
  active: boolean('active').notNull().default(true),
})

// ─── Usos de CFDI SAT ───────────────────────────────────────
export const satCfdiUses = pgTable('sat_cfdi_uses', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: text('code').notNull().unique(),
  description: text('description').notNull(),
  personaMoral: boolean('persona_moral').notNull().default(false),
  personaFisica: boolean('persona_fisica').notNull().default(false),
  active: boolean('active').notNull().default(true),
})

// ─── Formas de Pago SAT ─────────────────────────────────────
export const satPaymentForms = pgTable('sat_payment_forms', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: text('code').notNull().unique(),
  description: text('description').notNull(),
  active: boolean('active').notNull().default(true),
})

// ─── Claves de Producto/Servicio SAT ─────────────────────────
export const satProductCodes = pgTable('sat_product_codes', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: text('code').notNull().unique(),
  description: text('description').notNull(),
  includesIva: boolean('includes_iva').notNull().default(false),
  includesIeps: boolean('includes_ieps').notNull().default(false),
  stimulusFrontera: boolean('stimulus_frontera').notNull().default(false),
  active: boolean('active').notNull().default(true),
}, (table) => [
  index('sat_product_codes_code_idx').on(table.code),
  index('sat_product_codes_description_idx').on(table.description),
])

// ─── Claves de Unidad SAT ───────────────────────────────────
export const satUnitCodes = pgTable('sat_unit_codes', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  description: text('description'),
  active: boolean('active').notNull().default(true),
}, (table) => [
  index('sat_unit_codes_code_idx').on(table.code),
])

// ─── Monedas SAT ─────────────────────────────────────────────
export const satCurrencies = pgTable('sat_currencies', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: text('code').notNull().unique(),
  description: text('description').notNull(),
  decimals: integer('decimals').notNull().default(2),
  active: boolean('active').notNull().default(true),
})

// ─── Tipos de Relación entre CFDIs SAT ──────────────────────
export const satRelationshipTypes = pgTable('sat_relationship_types', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: text('code').notNull().unique(),
  description: text('description').notNull(),
  active: boolean('active').notNull().default(true),
})

// ─── Países SAT (para Carta Porte) ──────────────────────────
export const satCountries = pgTable('sat_countries', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: text('code').notNull().unique(),
  description: text('description').notNull(),
  active: boolean('active').notNull().default(true),
})

// ─── Types ───────────────────────────────────────────────────
export type SatTaxRegime = typeof satTaxRegimes.$inferSelect
export type SatCfdiUse = typeof satCfdiUses.$inferSelect
export type SatPaymentForm = typeof satPaymentForms.$inferSelect
export type SatProductCode = typeof satProductCodes.$inferSelect
export type SatUnitCode = typeof satUnitCodes.$inferSelect
export type SatCurrency = typeof satCurrencies.$inferSelect
export type SatRelationshipType = typeof satRelationshipTypes.$inferSelect
export type SatCountry = typeof satCountries.$inferSelect
