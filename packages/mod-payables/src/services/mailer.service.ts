import nodemailer from 'nodemailer'
import crypto from 'crypto'
import { settings } from '@enlocal/core-db'
import { eq, inArray } from 'drizzle-orm'

const SALT = 'enlocal-suite-2025'
const ALGORITHM = 'aes-256-gcm'

function deriveKey(fingerprint: string): Buffer {
  return crypto.pbkdf2Sync(fingerprint, SALT, 100000, 32, 'sha512')
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

export async function sendPurchaseOrderEmail(
  db: any,
  opts: {
    to: string
    cc?: string
    subject: string
    body: string
    pdfBuffer?: Buffer
    pdfFilename?: string
  }
): Promise<void> {
  const transporter = await createTransporter(db)

  const keys = ['email_from_name', 'email_from_address', 'email_user']
  const rows = await db.select().from(settings).where(inArray(settings.key, keys))
  const cfg: Record<string, string> = {}
  for (const row of rows) cfg[row.key] = row.value

  const fromName = cfg.email_from_name || 'Mi Negocio'
  const fromAddress = cfg.email_from_address || cfg.email_user

  const attachments: any[] = []
  if (opts.pdfBuffer) {
    attachments.push({
      filename: opts.pdfFilename || 'OrdenDeCompra.pdf',
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

  await transporter.sendMail(mailOptions)
}
