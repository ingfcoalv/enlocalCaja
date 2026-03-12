import { exec, execSync } from 'child_process'
import path from 'path'
import fs from 'fs'
import os from 'os'
import type { SmartBackupService } from './smartBackupService'

export interface FullDumpConfig {
  pgBinPath?: string
  dbName?: string
  dbHost?: string
  dbPort?: number
  dbUser?: string
  dbPassword?: string
  appVersion?: string
  backupDir?: string
}

export class FullDumpService {
  private pgBinPath: string
  private dbName: string
  private dbHost: string
  private dbPort: number
  private dbUser: string
  private dbPassword: string
  private appVersion: string
  backupDir: string

  constructor(config: FullDumpConfig = {}) {
    this.pgBinPath = config.pgBinPath || this.detectPgBinPath()
    this.dbName = config.dbName || 'enlocal_caja'
    this.dbHost = config.dbHost || '127.0.0.1'
    this.dbPort = config.dbPort || 5433
    this.dbUser = config.dbUser || 'enlocal'
    this.dbPassword = config.dbPassword || 'enlocal'
    this.appVersion = config.appVersion || '1.0.0'

    this.backupDir = config.backupDir
      ? path.join(config.backupDir, 'dumps-completos')
      : path.join(os.homedir(), 'Documents', 'enLocal Caja', 'Respaldos', 'dumps-completos')

    this.ensureDirectories()
  }

  private detectPgBinPath(): string {
    const possiblePaths = [
      // Bundled postgres in tools/ (copied to resources by electron-builder)
      path.join((process as any).resourcesPath || '', 'postgres', 'bin'),
      path.join(process.cwd(), 'tools', 'postgres', 'bin'),
      // Local dev postgres
      path.join(os.homedir(), 'AppData', 'Roaming', 'enLocal', 'postgres', 'bin'),
      'C:\\Program Files\\PostgreSQL\\16\\bin',
      'C:\\Program Files\\PostgreSQL\\15\\bin',
    ]

    const pgDumpExe = process.platform === 'win32' ? 'pg_dump.exe' : 'pg_dump'
    for (const p of possiblePaths) {
      if (fs.existsSync(path.join(p, pgDumpExe))) return p
    }
    throw new Error('No se encontró pg_dump. Verifica la instalación de PostgreSQL.')
  }

  private ensureDirectories() {
    fs.mkdirSync(this.backupDir, { recursive: true })
  }

  async createFullDump() {
    const timestamp = new Date().toISOString()
      .replace(/[T]/g, '_')
      .replace(/[:.]/g, '-')
      .slice(0, 19)

    const filename = `enlocal_dump_${timestamp}_v${this.appVersion}.dump`
    const filepath = path.join(this.backupDir, filename)
    const pgDump = path.join(this.pgBinPath, 'pg_dump')

    const cmd = `"${pgDump}" -h ${this.dbHost} -p ${this.dbPort} -U ${this.dbUser} -Fc -Z 9 -f "${filepath}" ${this.dbName}`

    return new Promise<Record<string, any>>((resolve, reject) => {
      const startTime = Date.now()
      exec(cmd, { env: { ...process.env, PGPASSWORD: this.dbPassword } }, (error, _stdout, stderr) => {
        if (error) {
          reject({ success: false, error: `Error al crear dump: ${error.message}`, stderr })
          return
        }
        const stats = fs.statSync(filepath)
        resolve({
          success: true,
          mode: 'full-dump',
          filename,
          filepath,
          sizeMB: parseFloat((stats.size / (1024 * 1024)).toFixed(2)),
          duration: Date.now() - startTime,
          appVersion: this.appVersion,
          timestamp: new Date().toISOString(),
          warning: 'Este dump solo es compatible con la misma versión de la aplicación y el mismo schema de base de datos.',
        })
      })
    })
  }

  async restoreFullDump(dumpFilepath: string, smartBackupService?: SmartBackupService) {
    if (!fs.existsSync(dumpFilepath)) {
      throw new Error(`Archivo no encontrado: ${dumpFilepath}`)
    }

    await this.verifyDump(dumpFilepath)

    let safetyBackup: any = null
    if (smartBackupService) {
      try {
        safetyBackup = await smartBackupService.createBackup('pre-restauracion')
      } catch (e: any) {
        throw new Error(`No se pudo crear respaldo de seguridad previo. Restauración cancelada.\nError: ${e.message}`)
      }
    }

    const pgRestore = path.join(this.pgBinPath, 'pg_restore')
    const psql = path.join(this.pgBinPath, 'psql')
    const env = { ...process.env, PGPASSWORD: this.dbPassword }

    try {
      execSync(
        `"${psql}" -h ${this.dbHost} -p ${this.dbPort} -U ${this.dbUser} -d postgres -c ` +
        `"SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${this.dbName}' AND pid <> pg_backend_pid();"`,
        { env }
      )
    } catch { /* OK if no connections */ }

    try {
      execSync(`"${psql}" -h ${this.dbHost} -p ${this.dbPort} -U ${this.dbUser} -d postgres -c "DROP DATABASE IF EXISTS ${this.dbName};"`, { env })
      execSync(`"${psql}" -h ${this.dbHost} -p ${this.dbPort} -U ${this.dbUser} -d postgres -c "CREATE DATABASE ${this.dbName};"`, { env })
    } catch (e: any) {
      throw new Error(
        `Error preparando la base de datos.\n` +
        (safetyBackup ? `Respaldo de seguridad: ${safetyBackup.filepath}\n` : '') +
        `Error: ${e.message}`
      )
    }

    const restoreCmd = `"${pgRestore}" -h ${this.dbHost} -p ${this.dbPort} -U ${this.dbUser} -d ${this.dbName} "${dumpFilepath}"`

    return new Promise<Record<string, any>>((resolve, reject) => {
      exec(restoreCmd, { env }, (error, _stdout, stderr) => {
        if (error && stderr && !stderr.includes('WARNING')) {
          reject(new Error(
            `Error durante restauración de dump completo.\n` +
            (safetyBackup ? `Respaldo de seguridad: ${safetyBackup.filepath}\n` : '') +
            `Error: ${error.message}`
          ))
          return
        }
        resolve({
          success: true,
          mode: 'full-dump-restore',
          restoredFrom: path.basename(dumpFilepath),
          safetyBackup: safetyBackup?.filepath || null,
          timestamp: new Date().toISOString(),
          message: 'Dump completo restaurado exitosamente.' +
            (safetyBackup ? ` Respaldo de seguridad en: ${safetyBackup.filepath}` : ''),
        })
      })
    })
  }

  private async verifyDump(filepath: string): Promise<boolean> {
    const pgRestore = path.join(this.pgBinPath, 'pg_restore')
    return new Promise((resolve, reject) => {
      exec(`"${pgRestore}" --list "${filepath}"`, (error) => {
        if (error) { reject(new Error('El archivo no es un dump válido de PostgreSQL.')); return }
        resolve(true)
      })
    })
  }

  listDumps() {
    try {
      return fs.readdirSync(this.backupDir)
        .filter(f => f.startsWith('enlocal_dump_') && f.endsWith('.dump'))
        .map(f => {
          const filepath = path.join(this.backupDir, f)
          const stats = fs.statSync(filepath)
          const parts = f.match(/enlocal_dump_(\d{4}-\d{2}-\d{2})_(\d{2}-\d{2}-\d{2})_v([\d.]+)\.dump/)
          return {
            filename: f,
            filepath,
            mode: 'full-dump' as const,
            date: parts ? `${parts[1]}T${parts[2].replace(/-/g, ':')}` : stats.mtime.toISOString(),
            appVersion: parts ? parts[3] : 'desconocido',
            sizeMB: parseFloat((stats.size / (1024 * 1024)).toFixed(2)),
          }
        })
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    } catch { return [] }
  }

  cleanOldDumps(keepCount = 5) {
    const dumps = this.listDumps()
    let deleted = 0
    dumps.slice(keepCount).forEach(d => {
      try { fs.unlinkSync(d.filepath); deleted++ } catch { /* ignore */ }
    })
    return { kept: Math.min(dumps.length, keepCount), deleted }
  }
}
