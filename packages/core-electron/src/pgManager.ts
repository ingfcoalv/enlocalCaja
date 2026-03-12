import { execFile, spawn } from 'child_process'
import { promisify } from 'util'
import fs from 'fs'
import path from 'path'
import { Client } from 'pg'

const execFileAsync = promisify(execFile)
const fsPromises = fs.promises

export interface PgManagerConfig {
  port?: number
  log?: (msg: string) => void
}

export interface PgConnectionConfig {
  host: string
  port: number
  user: string
  password: string
  database: string
}

const PG_USER = 'enlocal'
const PG_PASSWORD = 'enlocal'
const DEFAULT_PORT = 5433
const DEV_PORT = 5432

export class PgManager {
  private port: number
  private baseDir: string
  private dataDir: string
  private logFile: string
  private clientsFile: string
  private binDir: string
  private isDev: boolean
  private log: (msg: string) => void

  constructor(config?: PgManagerConfig) {
    this.log = config?.log ?? console.log
    this.isDev = process.env.NODE_ENV === 'development'
    this.port = config?.port ?? DEFAULT_PORT

    // Shared data directory: %APPDATA%/enLocal/postgres/
    const appData = process.env.APPDATA
      || (process.platform === 'darwin'
        ? path.join(process.env.HOME || '', 'Library', 'Application Support')
        : path.join(process.env.HOME || '', '.local', 'share'))
    this.baseDir = path.join(appData, 'enLocal', 'postgres')
    this.dataDir = path.join(this.baseDir, 'data')
    this.logFile = path.join(this.baseDir, 'postgres.log')
    this.clientsFile = path.join(this.baseDir, '.clients')

    // Binaries: bundled in extraResources in production
    this.binDir = this.isDev
      ? '' // not used in dev
      : path.join((process as any).resourcesPath || '', 'postgres', 'bin')
  }

  // ─── Public API ───

  async ensureReady(): Promise<void> {
    if (this.isDev) {
      console.log('[PgManager] Dev mode — skipping PostgreSQL management')
      return
    }

    this.log('[PgManager] step: ensureDirectories')
    await this.ensureDirectories()
    this.log('[PgManager] step: initCluster')
    await this.initCluster()
    this.log('[PgManager] step: ensureConfig')
    await this.ensureConfig()
    this.log('[PgManager] step: startOrReuse')
    await this.startOrReuse()
    this.log('[PgManager] step: waitForReady')
    await this.waitForReady(15000)
    this.log('[PgManager] step: ensureRole')
    await this.ensureRole()
    this.log('[PgManager] step: registerClient')
    this.registerClient()
  }

  async ensureDatabase(dbName: string): Promise<void> {
    if (this.isDev) return

    const client = new Client({
      host: 'localhost',
      port: this.port,
      user: PG_USER,
      password: PG_PASSWORD,
      database: 'postgres',
    })

    try {
      await client.connect()
      const res = await client.query(
        'SELECT 1 FROM pg_database WHERE datname = $1',
        [dbName],
      )
      if (res.rowCount === 0) {
        // CREATE DATABASE cannot use parameterized queries
        // Sanitize dbName: only allow alphanumeric and underscores
        const safeName = dbName.replace(/[^a-zA-Z0-9_]/g, '')
        await client.query(`CREATE DATABASE "${safeName}"`)
        console.log(`[PgManager] Created database: ${safeName}`)
      }
    } finally {
      await client.end()
    }
  }

  async shutdown(): Promise<void> {
    if (this.isDev) return

    this.unregisterClient()
    const activeClients = this.getActiveClients()

    if (activeClients.length === 0) {
      console.log('[PgManager] Last client — stopping PostgreSQL')
      await this.stopPostgres()
    } else {
      console.log(`[PgManager] ${activeClients.length} client(s) still active — keeping PostgreSQL running`)
    }
  }

  getConnectionConfig(dbName: string): PgConnectionConfig {
    return {
      host: 'localhost',
      port: this.isDev ? DEV_PORT : this.port,
      user: PG_USER,
      password: PG_PASSWORD,
      database: dbName,
    }
  }

  getLogPath(): string {
    return this.logFile
  }

  // ─── Private Methods ───

  private async ensureDirectories(): Promise<void> {
    await fsPromises.mkdir(this.baseDir, { recursive: true })
  }

  private async initCluster(): Promise<void> {
    const pgVersionFile = path.join(this.dataDir, 'PG_VERSION')
    if (fs.existsSync(pgVersionFile)) {
      this.log('[PgManager] Cluster already initialized')
      return
    }

    this.log('[PgManager] Initializing PostgreSQL cluster...')
    const initdb = this.getBinPath('initdb')

    await execFileAsync(initdb, [
      `--pgdata=${this.dataDir}`,
      `--username=${PG_USER}`,
      '--auth=trust',
      '--encoding=UTF8',
      '--locale=C',
    ])

    this.log('[PgManager] Cluster initialized')
  }

  /** Always write correct config — fixes stale config from previous versions */
  private async ensureConfig(): Promise<void> {
    // Patch postgresql.conf
    const confPath = path.join(this.dataDir, 'postgresql.conf')
    let conf = await fsPromises.readFile(confPath, 'utf-8')

    conf = conf.replace(
      /^#?port\s*=\s*\d+/m,
      `port = ${this.port}`,
    )
    conf = conf.replace(
      /^#?listen_addresses\s*=\s*'[^']*'/m,
      "listen_addresses = 'localhost'",
    )

    await fsPromises.writeFile(confPath, conf, 'utf-8')

    // pg_hba.conf — trust for localhost
    const hbaPath = path.join(this.dataDir, 'pg_hba.conf')
    const hbaContent = [
      '# TYPE  DATABASE  USER  ADDRESS      METHOD',
      'local   all       all                trust',
      'host    all       all   127.0.0.1/32 trust',
      'host    all       all   ::1/128      trust',
      '',
    ].join('\n')

    await fsPromises.writeFile(hbaPath, hbaContent, 'utf-8')
    this.log('[PgManager] Config ensured (postgresql.conf + pg_hba.conf)')
  }

  /**
   * Run a pg_ctl command with a timeout.
   * Uses spawn with detached stdio to prevent Electron handle inheritance
   * that can cause pg_ctl to hang on Windows.
   */
  private pgCtlExec(args: string[], timeoutMs = 30000): Promise<void> {
    const pgCtl = this.getBinPath('pg_ctl')
    return new Promise((resolve, reject) => {
      const child = spawn(pgCtl, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      })

      let stdout = ''
      let stderr = ''
      child.stdout?.on('data', (d: Buffer) => { stdout += d.toString() })
      child.stderr?.on('data', (d: Buffer) => { stderr += d.toString() })

      const timer = setTimeout(() => {
        child.kill()
        // Even if pg_ctl hangs, postgres may have started — resolve instead of reject
        this.log(`[PgManager] pg_ctl timed out after ${timeoutMs}ms (args: ${args[0]}) — continuing`)
        resolve()
      }, timeoutMs)

      child.on('close', (code) => {
        clearTimeout(timer)
        if (code === 0) {
          resolve()
        } else {
          reject(new Error(`pg_ctl ${args[0]} failed (code ${code}): ${stderr || stdout}`))
        }
      })

      child.on('error', (err) => {
        clearTimeout(timer)
        reject(err)
      })
    })
  }

  /** Start PostgreSQL or reuse if already running. Uses pg_ctl status (auth-independent). */
  private async startOrReuse(): Promise<void> {
    const alreadyRunning = await this.isProcessRunning()

    if (alreadyRunning) {
      this.log('[PgManager] PostgreSQL already running — reloading config')
      await this.reloadConfig()
      return
    }

    // Remove stale postmaster.pid if it exists
    const pidFile = path.join(this.dataDir, 'postmaster.pid')
    if (fs.existsSync(pidFile)) {
      this.log('[PgManager] Removing stale postmaster.pid')
      try { fs.unlinkSync(pidFile) } catch {}
    }

    this.log('[PgManager] Starting PostgreSQL...')
    await this.pgCtlExec([
      'start',
      '-D', this.dataDir,
      '-l', this.logFile,
      '-w',
      '-t', '30',
      '-o', `-p ${this.port}`,
    ], 35000)

    this.log('[PgManager] PostgreSQL started')
  }

  private async stopPostgres(): Promise<void> {
    if (!(await this.isProcessRunning())) return

    this.log('[PgManager] Stopping PostgreSQL...')
    try {
      await this.pgCtlExec([
        'stop',
        '-D', this.dataDir,
        '-m', 'fast',
        '-w',
        '-t', '30',
      ], 35000)
      this.log('[PgManager] PostgreSQL stopped')
    } catch (err: any) {
      console.error('[PgManager] Error stopping PostgreSQL:', err.message)
    }
  }

  /** Check if PG process is running via pg_ctl status (auth-independent). */
  private async isProcessRunning(): Promise<boolean> {
    try {
      await this.pgCtlExec(['status', '-D', this.dataDir], 5000)
      return true // exit code 0 = running
    } catch {
      return false // exit code != 0 = not running
    }
  }

  /** Reload PG config without restart (applies pg_hba.conf + postgresql.conf changes). */
  private async reloadConfig(): Promise<void> {
    try {
      await this.pgCtlExec(['reload', '-D', this.dataDir], 5000)
      this.log('[PgManager] Config reloaded')
    } catch (err: any) {
      console.error('[PgManager] Config reload failed:', err.message)
    }
  }

  /** Check if PG accepts TCP connections (auth-dependent). */
  private async isAcceptingConnections(): Promise<boolean> {
    const client = new Client({
      host: 'localhost',
      port: this.port,
      user: PG_USER,
      password: PG_PASSWORD,
      database: 'postgres',
      connectionTimeoutMillis: 2000,
    })

    try {
      await client.connect()
      await client.query('SELECT 1')
      await client.end()
      return true
    } catch {
      try { await client.end() } catch {}
      return false
    }
  }

  private async waitForReady(timeoutMs: number): Promise<void> {
    const start = Date.now()
    const interval = 500

    while (Date.now() - start < timeoutMs) {
      if (await this.isAcceptingConnections()) return
      await new Promise(resolve => setTimeout(resolve, interval))
    }

    throw new Error(
      `PostgreSQL did not become ready within ${timeoutMs}ms. Check log: ${this.logFile}`,
    )
  }

  private async ensureRole(): Promise<void> {
    const client = new Client({
      host: 'localhost',
      port: this.port,
      user: PG_USER,
      password: PG_PASSWORD,
      database: 'postgres',
    })

    try {
      await client.connect()
      await client.query(
        `ALTER ROLE ${PG_USER} WITH PASSWORD '${PG_PASSWORD}' CREATEDB`,
      )
    } finally {
      await client.end()
    }
  }

  private registerClient(): void {
    const pid = process.pid.toString()
    const clients = this.getActiveClients()

    if (!clients.includes(pid)) {
      clients.push(pid)
    }

    fs.writeFileSync(this.clientsFile, clients.join('\n') + '\n', 'utf-8')
  }

  private unregisterClient(): void {
    const pid = process.pid.toString()
    const clients = this.getActiveClients().filter(c => c !== pid)
    fs.writeFileSync(this.clientsFile, clients.join('\n') + '\n', 'utf-8')
  }

  private getActiveClients(): string[] {
    if (!fs.existsSync(this.clientsFile)) return []

    const pids = fs.readFileSync(this.clientsFile, 'utf-8')
      .split('\n')
      .map(s => s.trim())
      .filter(Boolean)

    // Filter out dead PIDs
    return pids.filter(pid => {
      try {
        process.kill(Number(pid), 0) // signal 0 = check if alive
        return true
      } catch {
        return false
      }
    })
  }

  private getBinPath(binary: string): string {
    const ext = process.platform === 'win32' ? '.exe' : ''
    return path.join(this.binDir, `${binary}${ext}`)
  }
}
