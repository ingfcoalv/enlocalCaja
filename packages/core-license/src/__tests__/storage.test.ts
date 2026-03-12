import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { saveLicenseFile, readLicenseFile, deleteLicenseFile, setLicenseDir } from '../storage'
import type { LicenseFile } from '../types'

const TEST_DIR = path.join(os.tmpdir(), 'enlocal-license-test-' + process.pid)
const TEST_FINGERPRINT = 'abc123def456abc123def456abc123def456abc123def456abc123def456abcd'
const WRONG_FINGERPRINT = 'wrong_fingerprint_000000000000000000000000000000000000000000000'

const SAMPLE_LICENSE: LicenseFile = {
  installationHash: 'hash-123',
  fingerprint: TEST_FINGERPRINT,
  licenseKey: 'ENLOCAL-XXXX-XXXX-XXXX',
  appId: 'enlocal-facturacion',
  plan: 'pro',
  expiresAt: '2027-12-31T23:59:59.000Z',
  modules: ['mod-config', 'mod-catalogs', 'mod-invoicing', 'mod-reports'],
  addons: ['mod-inventory'],
  businessId: 'biz-001',
  branchId: 'branch-001',
  terminalId: 'terminal-001',
  lastCloudValidation: new Date().toISOString(),
  serverSignature: 'sig-abc-123',
}

describe('core-license storage', () => {
  beforeEach(() => {
    fs.mkdirSync(TEST_DIR, { recursive: true })
    setLicenseDir(TEST_DIR)
  })

  afterEach(() => {
    try {
      fs.rmSync(TEST_DIR, { recursive: true, force: true })
    } catch { /* ignore */ }
  })

  it('should save and read a license file', () => {
    saveLicenseFile(SAMPLE_LICENSE, TEST_FINGERPRINT)
    const result = readLicenseFile(TEST_FINGERPRINT)

    expect(result).not.toBeNull()
    expect(result!.licenseKey).toBe('ENLOCAL-XXXX-XXXX-XXXX')
    expect(result!.appId).toBe('enlocal-facturacion')
    expect(result!.plan).toBe('pro')
    expect(result!.modules).toEqual(['mod-config', 'mod-catalogs', 'mod-invoicing', 'mod-reports'])
    expect(result!.addons).toEqual(['mod-inventory'])
  })

  it('should NOT decrypt with a different fingerprint', () => {
    saveLicenseFile(SAMPLE_LICENSE, TEST_FINGERPRINT)
    const result = readLicenseFile(WRONG_FINGERPRINT)

    expect(result).toBeNull()
  })

  it('should return null when no license file exists', () => {
    const result = readLicenseFile(TEST_FINGERPRINT)
    expect(result).toBeNull()
  })

  it('should delete the license file', () => {
    saveLicenseFile(SAMPLE_LICENSE, TEST_FINGERPRINT)
    const licensePath = path.join(TEST_DIR, '.enlocal-license')
    expect(fs.existsSync(licensePath)).toBe(true)

    deleteLicenseFile()
    expect(fs.existsSync(licensePath)).toBe(false)
  })

  it('encrypted file should not contain plaintext data', () => {
    saveLicenseFile(SAMPLE_LICENSE, TEST_FINGERPRINT)
    const licensePath = path.join(TEST_DIR, '.enlocal-license')
    const raw = fs.readFileSync(licensePath, 'utf8')

    expect(raw).not.toContain('ENLOCAL-XXXX')
    expect(raw).not.toContain('enlocal-facturacion')
    expect(raw).not.toContain('pro')

    const parsed = JSON.parse(raw)
    expect(parsed).toHaveProperty('iv')
    expect(parsed).toHaveProperty('authTag')
    expect(parsed).toHaveProperty('data')
  })
})
