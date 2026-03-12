import path from 'path'
import fs from 'fs'
import os from 'os'
import zlib from 'zlib'
import type { Pool } from 'pg'

export interface SmartBackupConfig {
  dbName?: string
  dbPort?: number
  dbUser?: string
  dbPassword?: string
  appVersion?: string
  backupDir?: string
  excludedTables?: string[]
}

interface TableSchema {
  columns: Array<{
    name: string
    type: string
    udtName: string
    nullable: boolean
    default: string | null
    maxLength: number | null
  }>
  primaryKeys: string[]
  rowCount: number
}

interface BackupManifest {
  format: string
  formatVersion: number
  appVersion: string
  backupType: string
  createdAt: string
  database: string
  tables: Record<string, {
    columns: string[]
    columnTypes: Array<{ name: string; type: string; udtName: string }>
    primaryKeys: string[]
    rowCount: number
  }>
  totalRows: number
  totalTables: number
  checksum?: string
}

export class SmartBackupService {
  private pool: Pool
  private appVersion: string
  private appDataPath: string
  private statePath: string
  backupDir: string
  private excludedTables: string[]
  private rotation = {
    todayMax: 3,
    dailyDays: 7,
    sparseInterval: 3,
    sparseDays: 30,
    monthlyCount: 2,
  }

  constructor(pool: Pool, config: SmartBackupConfig = {}) {
    this.pool = pool
    this.appVersion = config.appVersion || '1.0.0'
    this.appDataPath = path.join(os.homedir(), 'AppData', 'Roaming', 'enLocal')
    this.statePath = path.join(this.appDataPath, 'backup-state.json')
    this.backupDir = config.backupDir || this.resolveBackupDirectory()
    this.excludedTables = config.excludedTables || [
      'pg_stat_statements',
      'schema_migrations',
      'knex_migrations',
      'knex_migrations_lock',
      '_prisma_migrations',
    ]
    this.ensureDirectories()
  }

  // ─── Path detection ─────────────────────────────────────────

  private detectGoogleDrivePath(): string | null {
    const possiblePaths = [
      path.join(os.homedir(), 'Google Drive'),
      path.join(os.homedir(), 'Mi unidad'),
      path.join(os.homedir(), 'My Drive'),
    ]
    try {
      for (const letter of ['G', 'H', 'I', 'D', 'E', 'F']) {
        const p1 = path.join(`${letter}:\\`, 'Mi unidad')
        const p2 = path.join(`${letter}:\\`, 'My Drive')
        if (fs.existsSync(p1)) return p1
        if (fs.existsSync(p2)) return p2
      }
    } catch { /* ignore */ }
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) return p
    }
    return null
  }

  private resolveBackupDirectory(): string {
    const state = this.loadState()
    if (state.customBackupDir && fs.existsSync(state.customBackupDir)) {
      return state.customBackupDir
    }
    const drivePath = this.detectGoogleDrivePath()
    if (drivePath) {
      return path.join(drivePath, 'enLocal Caja', 'Respaldos')
    }
    return path.join(os.homedir(), 'Documents', 'enLocal Caja', 'Respaldos')
  }

  setCustomBackupDirectory(newPath: string) {
    if (!fs.existsSync(newPath)) {
      fs.mkdirSync(newPath, { recursive: true })
    }
    this.backupDir = newPath
    this.saveState({ customBackupDir: newPath })
    return { success: true, path: newPath }
  }

  // ─── Internal state ─────────────────────────────────────────

  loadState(): Record<string, any> {
    try {
      if (fs.existsSync(this.statePath)) {
        return JSON.parse(fs.readFileSync(this.statePath, 'utf-8'))
      }
    } catch { /* ignore */ }
    return { lastBackup: null, lastRestore: null, backupHistory: [], customBackupDir: null }
  }

  private saveState(updates: Record<string, any> = {}) {
    const state = { ...this.loadState(), ...updates }
    fs.mkdirSync(path.dirname(this.statePath), { recursive: true })
    fs.writeFileSync(this.statePath, JSON.stringify(state, null, 2))
  }

  private ensureDirectories() {
    fs.mkdirSync(this.backupDir, { recursive: true })
    fs.mkdirSync(this.appDataPath, { recursive: true })
  }

  // ─── Schema discovery ───────────────────────────────────────

  async discoverSchema(): Promise<Record<string, TableSchema>> {
    const client = await this.pool.connect()
    try {
      const tablesResult = await client.query(`
        SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
        ORDER BY table_name
      `)
      const schema: Record<string, TableSchema> = {}

      for (const row of tablesResult.rows) {
        const tableName = row.table_name
        if (this.excludedTables.includes(tableName)) continue

        const columnsResult = await client.query(`
          SELECT column_name, data_type, udt_name, is_nullable, column_default, character_maximum_length
          FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = $1
          ORDER BY ordinal_position
        `, [tableName])

        const pkResult = await client.query(`
          SELECT kcu.column_name FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
          WHERE tc.table_schema = 'public' AND tc.table_name = $1 AND tc.constraint_type = 'PRIMARY KEY'
        `, [tableName])

        const countResult = await client.query(`SELECT COUNT(*) as count FROM "${tableName}"`)

        schema[tableName] = {
          columns: columnsResult.rows.map((col: any) => ({
            name: col.column_name,
            type: col.data_type,
            udtName: col.udt_name,
            nullable: col.is_nullable === 'YES',
            default: col.column_default,
            maxLength: col.character_maximum_length,
          })),
          primaryKeys: pkResult.rows.map((r: any) => r.column_name),
          rowCount: parseInt(countResult.rows[0].count),
        }
      }
      return schema
    } finally {
      client.release()
    }
  }

  // ─── Create backup ──────────────────────────────────────────

  async createBackup(tipo = 'manual') {
    const startTime = Date.now()
    const client = await this.pool.connect()

    try {
      const schema = await this.discoverSchema()
      const data: Record<string, any[]> = {}
      let totalRows = 0

      for (const [tableName] of Object.entries(schema)) {
        const result = await client.query(`SELECT * FROM "${tableName}"`)
        data[tableName] = result.rows
        totalRows += result.rows.length
      }

      const manifest: BackupManifest = {
        format: 'enlocal-smart-backup',
        formatVersion: 2,
        appVersion: this.appVersion,
        backupType: tipo,
        createdAt: new Date().toISOString(),
        database: (this.pool as any).options?.database || 'enlocal_caja',
        tables: Object.fromEntries(
          Object.entries(schema).map(([name, info]) => [name, {
            columns: info.columns.map(c => c.name),
            columnTypes: info.columns.map(c => ({ name: c.name, type: c.type, udtName: c.udtName })),
            primaryKeys: info.primaryKeys,
            rowCount: info.rowCount,
          }])
        ),
        totalRows,
        totalTables: Object.keys(schema).length,
      }

      const backupPayload = JSON.stringify({ manifest, data })
      manifest.checksum = this.simpleChecksum(backupPayload)
      const finalPayload = JSON.stringify({ manifest, data })
      const finalCompressed = zlib.gzipSync(finalPayload, { level: 9 })

      const filename = this.generateFilename(tipo, 'enlocal-backup')
      const filepath = path.join(this.backupDir, filename)
      fs.writeFileSync(filepath, finalCompressed)

      const sizeMB = parseFloat((finalCompressed.length / (1024 * 1024)).toFixed(2))
      const result = {
        success: true,
        filename,
        filepath,
        tipo,
        mode: 'smart' as const,
        sizeMB,
        duration: Date.now() - startTime,
        totalRows,
        totalTables: Object.keys(schema).length,
        appVersion: this.appVersion,
        timestamp: new Date().toISOString(),
      }

      this.saveState({
        lastBackup: result,
        backupHistory: [result, ...(this.loadState().backupHistory || []).slice(0, 99)],
      })
      this.applyRotation()
      return result
    } finally {
      client.release()
    }
  }

  // ─── Restore backup ─────────────────────────────────────────

  async restoreBackup(backupFilepath: string) {
    if (!fs.existsSync(backupFilepath)) {
      throw new Error(`Archivo no encontrado: ${backupFilepath}`)
    }

    let safetyBackup: any
    try {
      safetyBackup = await this.createBackup('pre-restauracion')
    } catch (error: any) {
      throw new Error(`No se pudo crear respaldo de seguridad. Restauración cancelada.\nError: ${error.message}`)
    }

    let backupData: { manifest: BackupManifest; data: Record<string, any[]> }
    try {
      backupData = this.readBackupFile(backupFilepath)
    } catch (error: any) {
      throw new Error(`Archivo de respaldo inválido o corrupto.\nTu BD actual NO fue modificada.\nError: ${error.message}`)
    }

    const { manifest, data } = backupData
    const currentSchema = await this.discoverSchema()
    const compatReport = this.generateCompatibilityReport(manifest, currentSchema)

    const client = await this.pool.connect()
    const results: {
      tablesRestored: any[]
      tablesSkipped: any[]
      tablesEmpty: string[]
      columnsIgnored: any[]
      warnings: any[]
    } = { tablesRestored: [], tablesSkipped: [], tablesEmpty: [], columnsIgnored: [], warnings: [] }

    try {
      await client.query('BEGIN')
      await client.query('SET session_replication_role = replica;')

      for (const [tableName, tableData] of Object.entries(data)) {
        if (!currentSchema[tableName]) {
          results.tablesSkipped.push({ table: tableName, reason: 'Tabla no existe en la versión actual', rowCount: tableData.length })
          continue
        }
        if (tableData.length === 0) {
          results.tablesEmpty.push(tableName)
          continue
        }

        const currentColumns = currentSchema[tableName].columns.map(c => c.name)
        const backupColumns: string[] = manifest.tables[tableName]?.columns || Object.keys(tableData[0])
        const commonColumns = backupColumns.filter(col => currentColumns.includes(col))
        const droppedColumns = backupColumns.filter(col => !currentColumns.includes(col))

        if (droppedColumns.length > 0) {
          results.columnsIgnored.push({ table: tableName, columns: droppedColumns, reason: 'Columnas no existen en la versión actual' })
        }
        const newColumns = currentColumns.filter(col => !backupColumns.includes(col))
        if (newColumns.length > 0) {
          results.warnings.push({ table: tableName, message: `Columnas nuevas tomarán valor DEFAULT: ${newColumns.join(', ')}` })
        }
        if (commonColumns.length === 0) {
          results.tablesSkipped.push({ table: tableName, reason: 'Sin columnas en común', rowCount: tableData.length })
          continue
        }

        await client.query(`DELETE FROM "${tableName}"`)

        const batchSize = 500
        let insertedRows = 0

        for (let i = 0; i < tableData.length; i += batchSize) {
          const batch = tableData.slice(i, i + batchSize)
          const placeholders: string[] = []
          const values: any[] = []
          let paramIdx = 1

          for (const row of batch) {
            const rowPlaceholders: string[] = []
            for (const col of commonColumns) {
              rowPlaceholders.push(`$${paramIdx}`)
              values.push(row[col] !== undefined ? row[col] : null)
              paramIdx++
            }
            placeholders.push(`(${rowPlaceholders.join(', ')})`)
          }

          const quotedColumns = commonColumns.map(c => `"${c}"`).join(', ')
          try {
            await client.query(
              `INSERT INTO "${tableName}" (${quotedColumns}) VALUES ${placeholders.join(', ')} ON CONFLICT DO NOTHING`,
              values
            )
            insertedRows += batch.length
          } catch (insertError: any) {
            results.warnings.push({ table: tableName, message: `Error parcial en lote ${Math.floor(i / batchSize) + 1}: ${insertError.message}` })
          }
        }

        await this.resetSequences(client, tableName, currentSchema[tableName])
        results.tablesRestored.push({
          table: tableName,
          rowsInserted: insertedRows,
          rowsInBackup: tableData.length,
          columnsUsed: commonColumns.length,
          columnsTotal: currentColumns.length,
        })
      }

      await client.query('SET session_replication_role = DEFAULT;')
      await client.query('COMMIT')
    } catch (error: any) {
      await client.query('ROLLBACK')
      throw new Error(
        `Error durante restauración. Se hizo rollback.\n` +
        `Tu respaldo de seguridad está en: ${safetyBackup.filepath}\n` +
        `Error: ${error.message}`
      )
    } finally {
      client.release()
    }

    for (const tableName of Object.keys(currentSchema)) {
      if (!data[tableName]) {
        results.warnings.push({ table: tableName, message: 'Tabla nueva — no existía en el respaldo, queda vacía' })
      }
    }

    this.saveState({
      lastRestore: {
        restoredFrom: backupFilepath,
        safetyBackup: safetyBackup.filepath,
        backupVersion: manifest.appVersion,
        currentVersion: this.appVersion,
        timestamp: new Date().toISOString(),
        results,
      },
    })

    return {
      success: true,
      safetyBackup: safetyBackup.filepath,
      backupVersion: manifest.appVersion,
      currentVersion: this.appVersion,
      versionMatch: manifest.appVersion === this.appVersion,
      compatReport,
      results,
      message: this.generateRestoreSummary(results, manifest),
    }
  }

  private async resetSequences(client: any, tableName: string, tableInfo: TableSchema) {
    for (const pk of tableInfo.primaryKeys) {
      const col = tableInfo.columns.find(c => c.name === pk)
      if (col && (col.type === 'integer' || col.type === 'bigint' || col.udtName === 'serial' || col.default?.includes('nextval'))) {
        try {
          await client.query(`
            SELECT setval(
              pg_get_serial_sequence('"${tableName}"', '${pk}'),
              COALESCE((SELECT MAX("${pk}") FROM "${tableName}"), 1)
            )
          `)
        } catch { /* not all PKs have sequences */ }
      }
    }
  }

  // ─── Utilities ──────────────────────────────────────────────

  readBackupFile(filepath: string): { manifest: BackupManifest; data: Record<string, any[]> } {
    const compressed = fs.readFileSync(filepath)
    const decompressed = zlib.gunzipSync(compressed)
    const parsed = JSON.parse(decompressed.toString('utf-8'))
    if (!parsed.manifest || !parsed.data) throw new Error('Formato de respaldo inválido')
    if (parsed.manifest.format !== 'enlocal-smart-backup') {
      throw new Error('Este no es un respaldo smart de enLocal. Usa "Restaurar dump completo" si es un pg_dump.')
    }
    return parsed
  }

  readBackupManifest(filepath: string): BackupManifest | null {
    try {
      return this.readBackupFile(filepath).manifest
    } catch { return null }
  }

  generateCompatibilityReport(manifest: BackupManifest, currentSchema: Record<string, TableSchema>) {
    const backupTables = Object.keys(manifest.tables)
    const currentTables = Object.keys(currentSchema)
    return {
      backupVersion: manifest.appVersion,
      currentVersion: this.appVersion,
      versionMatch: manifest.appVersion === this.appVersion,
      backupDate: manifest.createdAt,
      commonTables: backupTables.filter(t => currentTables.includes(t)),
      removedTables: backupTables.filter(t => !currentTables.includes(t)),
      newTables: currentTables.filter(t => !backupTables.includes(t)),
      totalRows: manifest.totalRows,
    }
  }

  private generateRestoreSummary(results: any, manifest: BackupManifest): string {
    const lines: string[] = []
    if (manifest.appVersion !== this.appVersion) {
      lines.push(`Respaldo de v${manifest.appVersion} restaurado en v${this.appVersion} (modo compatibilidad).`)
    } else {
      lines.push('Respaldo restaurado exitosamente.')
    }
    if (results.tablesRestored.length > 0) {
      const totalRows = results.tablesRestored.reduce((s: number, t: any) => s + t.rowsInserted, 0)
      lines.push(`${results.tablesRestored.length} tablas restauradas con ${totalRows} registros.`)
    }
    if (results.tablesSkipped.length > 0) {
      lines.push(`${results.tablesSkipped.length} tablas del respaldo ignoradas (no existen en esta versión).`)
    }
    if (results.columnsIgnored.length > 0) {
      lines.push('Algunas columnas obsoletas fueron ignoradas.')
    }
    return lines.join(' ')
  }

  private generateFilename(tipo: string, extension: string): string {
    const timestamp = new Date().toISOString()
      .replace(/[T]/g, '_')
      .replace(/[:.]/g, '-')
      .slice(0, 19)
    return `enlocal_caja_${timestamp}_v${this.appVersion}_${tipo}.${extension}`
  }

  private simpleChecksum(str: string): string {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i)
      hash = hash & hash
    }
    return Math.abs(hash).toString(36)
  }

  // ─── Listing & rotation ─────────────────────────────────────

  listBackups() {
    try {
      return fs.readdirSync(this.backupDir)
        .filter(f => f.startsWith('enlocal_caja_') && f.endsWith('.enlocal-backup'))
        .map(f => {
          const filepath = path.join(this.backupDir, f)
          const stats = fs.statSync(filepath)
          const parts = f.match(/enlocal_caja_(\d{4}-\d{2}-\d{2})_(\d{2}-\d{2}-\d{2})_v([\d.]+)_(\w[\w-]*)\.enlocal-backup/)
          return {
            filename: f,
            filepath,
            mode: 'smart' as const,
            date: parts ? `${parts[1]}T${parts[2].replace(/-/g, ':')}` : stats.mtime.toISOString(),
            appVersion: parts ? parts[3] : 'desconocido',
            tipo: parts ? parts[4] : 'desconocido',
            sizeMB: parseFloat((stats.size / (1024 * 1024)).toFixed(2)),
            createdAt: stats.birthtime || stats.mtime,
          }
        })
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    } catch { return [] }
  }

  applyRotation() {
    const backups = this.listBackups()
    const now = new Date()
    const keep = new Set<string>()

    backups.filter(b => b.tipo === 'pre-restauracion').slice(0, 5).forEach(b => keep.add(b.filename))

    const todayStr = now.toISOString().slice(0, 10)
    backups.filter(b => b.date.startsWith(todayStr)).slice(0, this.rotation.todayMax).forEach(b => keep.add(b.filename))

    for (let i = 1; i <= this.rotation.dailyDays; i++) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      const dayStr = d.toISOString().slice(0, 10)
      const dayBackups = backups.filter(b => b.date.startsWith(dayStr))
      if (dayBackups.length > 0) keep.add(dayBackups[0].filename)
    }

    for (let i = this.rotation.dailyDays + 1; i <= this.rotation.sparseDays; i += this.rotation.sparseInterval) {
      const start = new Date(now)
      start.setDate(start.getDate() - i - this.rotation.sparseInterval + 1)
      const end = new Date(now)
      end.setDate(end.getDate() - i)
      const range = backups.filter(b => { const bd = new Date(b.date); return bd >= start && bd <= end })
      if (range.length > 0) keep.add(range[0].filename)
    }

    for (let i = 1; i <= this.rotation.monthlyCount; i++) {
      const md = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const monthStr = md.toISOString().slice(0, 7)
      const mb = backups.filter(b => b.date.startsWith(monthStr))
      if (mb.length > 0) keep.add(mb[0].filename)
    }

    let deleted = 0
    backups.forEach(b => {
      if (!keep.has(b.filename)) {
        try { fs.unlinkSync(b.filepath); deleted++ } catch { /* ignore */ }
      }
    })
    return { kept: keep.size, deleted }
  }

  // ─── Dashboard info ─────────────────────────────────────────

  getBackupInfo() {
    const state = this.loadState()
    const smartBackups = this.listBackups()
    const drivePath = this.detectGoogleDrivePath()
    const totalSizeMB = smartBackups.reduce((s, b) => s + b.sizeMB, 0)

    return {
      backupDirectory: this.backupDir,
      storageType: drivePath ? 'Google Drive' : 'Local (Documentos)',
      googleDriveDetected: !!drivePath,
      appVersion: this.appVersion,
      lastBackup: state.lastBackup,
      lastRestore: state.lastRestore,
      totalBackups: smartBackups.length,
      totalSizeMB: parseFloat(totalSizeMB.toFixed(2)),
      backups: smartBackups,
      healthStatus: this.getHealthStatus(state, smartBackups),
    }
  }

  private getHealthStatus(state: any, backups: any[]) {
    if (!state.lastBackup) return { status: 'warning', message: 'Nunca se ha creado un respaldo', color: 'orange' }
    const hours = (Date.now() - new Date(state.lastBackup.timestamp).getTime()) / 3600000
    if (hours > 48) return { status: 'danger', message: `Último respaldo hace ${Math.floor(hours)} horas`, color: 'red' }
    if (hours > 24) return { status: 'warning', message: `Último respaldo hace ${Math.floor(hours)} horas`, color: 'orange' }
    if (backups.length === 0) return { status: 'danger', message: 'No hay respaldos disponibles', color: 'red' }
    return { status: 'healthy', message: 'Sistema de respaldos funcionando', color: 'green' }
  }
}
