import { execFile } from 'child_process'
import { promisify } from 'util'
import fs from 'fs'
import path from 'path'

const execFileAsync = promisify(execFile)

function getBackupDir(): string {
  let userDataDir: string
  try {
    const { app } = require('electron')
    userDataDir = app.getPath('userData')
  } catch {
    userDataDir = process.env.HOME || process.env.USERPROFILE || '/tmp'
  }
  const dir = path.join(userDataDir, 'backups')
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  return dir
}

export async function backupPostgres(dbName: string): Promise<string> {
  const backupDir = getBackupDir()
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backupFile = path.join(backupDir, `${dbName}_${timestamp}.sql`)

  await execFileAsync('pg_dump', [
    '-h', 'localhost',
    '-U', 'enlocal',
    '-d', dbName,
    '-f', backupFile,
    '--format=custom',
  ], { env: { ...process.env, PGPASSWORD: 'enlocal' } })

  return backupFile
}

export async function restorePostgres(dbName: string, backupPath: string): Promise<void> {
  await execFileAsync('pg_restore', [
    '-h', 'localhost',
    '-U', 'enlocal',
    '-d', dbName,
    '--clean',
    '--if-exists',
    backupPath,
  ], { env: { ...process.env, PGPASSWORD: 'enlocal' } })
}

export function cleanOldBackups(dir?: string, keepCount: number = 5): void {
  const backupDir = dir || getBackupDir()
  if (!fs.existsSync(backupDir)) return

  const files = fs.readdirSync(backupDir)
    .filter((f) => f.endsWith('.sql'))
    .map((f) => ({
      name: f,
      path: path.join(backupDir, f),
      mtime: fs.statSync(path.join(backupDir, f)).mtimeMs,
    }))
    .sort((a, b) => b.mtime - a.mtime)

  // Remove all but the most recent keepCount backups
  for (const file of files.slice(keepCount)) {
    fs.unlinkSync(file.path)
  }
}
