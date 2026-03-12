import { describe, it, expect } from 'vitest'
import { getEnabledModules, hasModuleAccess, SOFTWARE_MODULES } from '../moduleAccess'

describe('core-license moduleAccess', () => {
  it('should have definitions for all 5 apps', () => {
    expect(SOFTWARE_MODULES).toHaveProperty('enlocal-facturacion')
    expect(SOFTWARE_MODULES).toHaveProperty('enlocal-nominas')
    expect(SOFTWARE_MODULES).toHaveProperty('enlocal-erp')
    expect(SOFTWARE_MODULES).toHaveProperty('enlocal-servicios')
    expect(SOFTWARE_MODULES).toHaveProperty('enlocal-caja')
  })

  it('should return default modules for facturacion without addons', () => {
    const modules = getEnabledModules('enlocal-facturacion', 'basic', [])
    expect(modules).toContain('mod-config')
    expect(modules).toContain('mod-catalogs')
    expect(modules).toContain('mod-invoicing')
    expect(modules).toContain('mod-reports')
    expect(modules).not.toContain('mod-inventory')
    expect(modules).not.toContain('mod-pos')
  })

  it('should include addon modules when purchased', () => {
    const modules = getEnabledModules('enlocal-facturacion', 'pro', ['mod-inventory'])
    expect(modules).toContain('mod-inventory')
    expect(modules).toContain('mod-invoicing')
    expect(modules).not.toContain('mod-pos')
  })

  it('should return all default modules for ERP', () => {
    const modules = getEnabledModules('enlocal-erp', 'enterprise', [])
    expect(modules).toContain('mod-config')
    expect(modules).toContain('mod-catalogs')
    expect(modules).toContain('mod-invoicing')
    expect(modules).toContain('mod-inventory')
    expect(modules).toContain('mod-pos')
    expect(modules).toContain('mod-payroll')
    expect(modules).toContain('mod-reports')
    expect(modules).not.toContain('mod-appointments')
  })

  it('should return empty for unknown appId', () => {
    const modules = getEnabledModules('unknown-app', 'basic', [])
    expect(modules).toEqual([])
  })

  it('hasModuleAccess should return true for enabled module', () => {
    const modules = ['mod-config', 'mod-invoicing']
    expect(hasModuleAccess(modules, 'mod-invoicing')).toBe(true)
  })

  it('hasModuleAccess should return false for disabled module', () => {
    const modules = ['mod-config', 'mod-invoicing']
    expect(hasModuleAccess(modules, 'mod-pos')).toBe(false)
  })

  it('caja should have POS as default module', () => {
    const modules = getEnabledModules('enlocal-caja', 'basic', [])
    expect(modules).toContain('mod-pos')
    expect(modules).not.toContain('mod-invoicing')
  })

  it('servicios should have appointments as default module', () => {
    const modules = getEnabledModules('enlocal-servicios', 'basic', [])
    expect(modules).toContain('mod-appointments')
    expect(modules).toContain('mod-invoicing')
  })
})
