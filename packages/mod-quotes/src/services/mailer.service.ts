import nodemailer from 'nodemailer'
import crypto from 'crypto'
import { settings, quoteEmails } from '@enlocal/core-db'
import { eq, inArray } from 'drizzle-orm'

const SALT = 'enlocal-suite-2025'
const ALGORITHM = 'aes-256-gcm'

function deriveKey(fingerprint: string): Buffer {
  return crypto.pbkdf2Sync(fingerprint, SALT, 100000, 32, 'sha512')
}

function encryptPassword(password: string, fingerprint: string): string {
  const key = deriveKey(fingerprint)
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  let encrypted = cipher.update(password, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  const authTag = cipher.getAuthTag()
  return JSON.stringify({
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
    data: encrypted,
  })
}

function decryptPassword(encryptedJson: string, fingerprint: string): string {
  try {
    const parsed = JSON.parse(encryptedJson)
    const key = deriveKey(fingerprint)
    const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(parsed.iv, 'hex'))
    decipher.setAuthTag(Buffer.from(parsed.authTag, 'hex'))
    let decrypted = decipher.update(parsed.data, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    return decrypted
  } catch {
    return encryptedJson
  }
}

async function getFingerprint(db: any): Promise<string> {
  const [row] = await db.select().from(settings).where(eq(settings.key, 'app_secret'))
  return row?.value || 'enlocal-default-fingerprint'
}

export interface MailerConfig {
  host: string
  port: number
  secure: boolean
  user: string
  hasPassword: boolean
  fromName: string
  fromAddress: string
}

export async function getMailerConfig(db: any): Promise<MailerConfig> {
  const keys = ['email_host', 'email_port', 'email_secure', 'email_user', 'email_password', 'email_from_name', 'email_from_address']
  const rows = await db.select().from(settings).where(inArray(settings.key, keys))
  const cfg: Record<string, string> = {}
  for (const row of rows) cfg[row.key] = row.value

  return {
    host: cfg.email_host || '',
    port: parseInt(cfg.email_port || '587'),
    secure: cfg.email_secure === 'true',
    user: cfg.email_user || '',
    hasPassword: !!cfg.email_password,
    fromName: cfg.email_from_name || '',
    fromAddress: cfg.email_from_address || cfg.email_user || '',
  }
}

export async function saveMailerConfig(
  db: any,
  config: {
    email_host: string
    email_port: number
    email_secure: boolean
    email_user: string
    email_password?: string
    email_from_name?: string
    email_from_address?: string
  }
): Promise<void> {
  const fingerprint = await getFingerprint(db)

  const pairs: [string, string][] = [
    ['email_host', config.email_host],
    ['email_port', String(config.email_port)],
    ['email_secure', String(config.email_secure)],
    ['email_user', config.email_user],
  ]

  if (config.email_password) {
    pairs.push(['email_password', encryptPassword(config.email_password, fingerprint)])
  }
  if (config.email_from_name !== undefined) {
    pairs.push(['email_from_name', config.email_from_name])
  }
  if (config.email_from_address !== undefined) {
    pairs.push(['email_from_address', config.email_from_address])
  }

  for (const [key, value] of pairs) {
    const [existing] = await db.select().from(settings).where(eq(settings.key, key))
    if (existing) {
      await db.update(settings).set({ value }).where(eq(settings.key, key))
    } else {
      await db.insert(settings).values({ key, value })
    }
  }
}

async function createTransporter(db: any): Promise<nodemailer.Transporter> {
  const fingerprint = await getFingerprint(db)
  const keys = ['email_host', 'email_port', 'email_secure', 'email_user', 'email_password']
  const rows = await db.select().from(settings).where(inArray(settings.key, keys))
  const cfg: Record<string, string> = {}
  for (const row of rows) cfg[row.key] = row.value

  if (!cfg.email_host || !cfg.email_user || !cfg.email_password) {
    throw new Error('Configuracion de email incompleta. Configure el servidor SMTP en ajustes.')
  }

  const password = decryptPassword(cfg.email_password, fingerprint)

  return nodemailer.createTransport({
    host: cfg.email_host,
    port: parseInt(cfg.email_port || '587'),
    secure: cfg.email_secure === 'true',
    auth: {
      user: cfg.email_user,
      pass: password,
    },
  })
}

export function renderTemplate(template: string, vars: Record<string, string>): string {
  let result = template
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value || '')
  }
  return result
}

export async function sendQuoteEmail(
  db: any,
  opts: {
    quoteId: string
    to: string
    cc?: string
    subject: string
    body: string
    attachPdf: boolean
    pdfBuffer?: Buffer
    pdfFilename?: string
    logoPath?: string
    sentBy: string
  }
): Promise<any> {
  const transporter = await createTransporter(db)

  const keys = ['email_from_name', 'email_from_address', 'email_user']
  const rows = await db.select().from(settings).where(inArray(settings.key, keys))
  const cfg: Record<string, string> = {}
  for (const row of rows) cfg[row.key] = row.value

  const fromName = cfg.email_from_name || 'Mi Negocio'
  const fromAddress = cfg.email_from_address || cfg.email_user

  const attachments: any[] = []

  if (opts.attachPdf && opts.pdfBuffer) {
    attachments.push({
      filename: opts.pdfFilename || 'Cotizacion.pdf',
      content: opts.pdfBuffer,
      contentType: 'application/pdf',
    })
  }

  const mailOptions: any = {
    from: `"${fromName}" <${fromAddress}>`,
    to: opts.to,
    subject: opts.subject,
    html: opts.body,
    attachments,
  }

  if (opts.cc) {
    mailOptions.cc = opts.cc
  }

  let status = 'sent'
  let errorMessage: string | undefined

  try {
    await transporter.sendMail(mailOptions)
  } catch (err: any) {
    status = 'failed'
    errorMessage = err.message
  }

  const [emailRecord] = await db.insert(quoteEmails).values({
    quoteId: opts.quoteId,
    sentTo: opts.to,
    sentCc: opts.cc || null,
    subject: opts.subject,
    body: opts.body,
    attachedPdf: opts.attachPdf,
    status,
    errorMessage: errorMessage || null,
    sentBy: opts.sentBy,
  }).returning()

  if (status === 'failed') {
    throw new Error(`Error al enviar email: ${errorMessage}`)
  }

  return emailRecord
}

export async function testEmailConfig(db: any, to: string): Promise<void> {
  const transporter = await createTransporter(db)

  const keys = ['email_from_name', 'email_from_address', 'email_user']
  const rows = await db.select().from(settings).where(inArray(settings.key, keys))
  const cfg: Record<string, string> = {}
  for (const row of rows) cfg[row.key] = row.value

  const fromName = cfg.email_from_name || 'Mi Negocio'
  const fromAddress = cfg.email_from_address || cfg.email_user

  await transporter.sendMail({
    from: `"${fromName}" <${fromAddress}>`,
    to,
    subject: 'Prueba de configuracion - enLocal',
    html: '<h2>Configuracion correcta</h2><p>Este es un email de prueba desde enLocal. Si lo recibes, la configuracion SMTP esta correcta.</p>',
  })
}
