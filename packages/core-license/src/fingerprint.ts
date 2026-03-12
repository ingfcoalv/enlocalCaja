import { machineIdSync } from 'node-machine-id'
import os from 'os'
import { execSync } from 'child_process'
import crypto from 'crypto'
import type { HardwareDetails } from './types'

function getMacAddress(): string {
  const interfaces = os.networkInterfaces()
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (!iface.internal && iface.mac && iface.mac !== '00:00:00:00:00:00') {
        return iface.mac
      }
    }
  }
  return 'unknown'
}

function getDiskSerial(): string {
  try {
    if (process.platform === 'win32') {
      const output = execSync('wmic diskdrive get serialnumber', { encoding: 'utf8' })
      const lines = output.trim().split('\n').filter((l) => l.trim())
      return lines[1]?.trim() || 'unknown'
    } else if (process.platform === 'linux') {
      const output = execSync('lsblk -ndo SERIAL /dev/sda 2>/dev/null || echo unknown', { encoding: 'utf8' })
      return output.trim() || 'unknown'
    } else {
      const output = execSync('system_profiler SPSerialATADataType 2>/dev/null | grep "Serial Number" | head -1 | awk -F: \'{print $2}\'', { encoding: 'utf8' })
      return output.trim() || 'unknown'
    }
  } catch {
    return 'unknown'
  }
}

export function getHardwareDetails(): HardwareDetails {
  const cpus = os.cpus()
  return {
    machineId: machineIdSync(true),
    hostname: os.hostname(),
    platform: process.platform,
    cpuModel: cpus[0]?.model || 'unknown',
    cpuCores: cpus.length,
    totalMemory: os.totalmem(),
    macAddress: getMacAddress(),
    diskSerial: getDiskSerial(),
  }
}

export function generateFingerprint(): string {
  const hw = getHardwareDetails()
  const raw = `${hw.machineId}|${hw.macAddress}|${hw.diskSerial}|${hw.hostname}`
  return crypto.createHash('sha256').update(raw).digest('hex')
}
