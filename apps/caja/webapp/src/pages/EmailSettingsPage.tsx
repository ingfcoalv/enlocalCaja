import { useEffect, useState, useCallback } from 'react'
import {
  Loader2, Save, Mail, SendHorizonal, Eye, EyeOff,
} from 'lucide-react'
import { api, useToast } from '@enlocal/react-hooks'

interface EmailConfig {
  host: string
  port: number
  secure: boolean
  user: string
  hasPassword: boolean
  fromName: string
  fromAddress: string
}

const SMTP_PRESETS: Record<string, { host: string; port: number; secure: boolean }> = {
  gmail: { host: 'smtp.gmail.com', port: 587, secure: false },
  outlook: { host: 'smtp.office365.com', port: 587, secure: false },
  yahoo: { host: 'smtp.mail.yahoo.com', port: 465, secure: true },
}

export default function EmailSettingsPage() {
  const toast = useToast()

  const [emailConfig, setEmailConfig] = useState<EmailConfig | null>(null)
  const [editEmail, setEditEmail] = useState({ host: '', port: 587, secure: false, user: '', password: '', fromName: '', fromAddress: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testEmailTo, setTestEmailTo] = useState('')

  useEffect(() => {
    const loadEmail = async () => {
      setLoading(true)
      try {
        const { data } = await api.get('/api/settings/email')
        const d = data?.data || data
        setEmailConfig(d)
        setEditEmail({ host: d.host || '', port: d.port || 587, secure: d.secure || false, user: d.user || '', password: '', fromName: d.fromName || '', fromAddress: d.fromAddress || '' })
      } catch { /* defaults */ }
      setLoading(false)
    }
    loadEmail()
  }, [])

  const applyPreset = (preset: string) => {
    const p = SMTP_PRESETS[preset]
    if (p) setEditEmail((e) => ({ ...e, host: p.host, port: p.port, secure: p.secure }))
  }

  const handleSave = useCallback(async () => {
    setSaving(true)
    try {
      const payload: any = {
        email_host: editEmail.host,
        email_port: editEmail.port,
        email_secure: editEmail.secure,
        email_user: editEmail.user,
        email_from_name: editEmail.fromName,
        email_from_address: editEmail.fromAddress,
      }
      if (editEmail.password) payload.email_password = editEmail.password
      await api.put('/api/settings/email', payload)
      const { data } = await api.get('/api/settings/email')
      setEmailConfig(data?.data || data)
      setEditEmail((e) => ({ ...e, password: '' }))
      toast.success('Configuracion de email guardada')
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Error al guardar email')
    }
    setSaving(false)
  }, [toast, editEmail])

  const handleTest = useCallback(async () => {
    if (!testEmailTo) { toast.warning('Ingrese un email de destino'); return }
    setTesting(true)
    try {
      await api.post('/api/settings/email/test', { to: testEmailTo })
      toast.success('Email de prueba enviado')
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Error al enviar prueba')
    }
    setTesting(false)
  }, [toast, testEmailTo])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <Mail className="h-6 w-6 text-primary-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Configuracion de Email SMTP</h1>
            <p className="mt-1 text-sm text-gray-500">Configuracion del servidor de correo para enviar cotizaciones</p>
          </div>
        </div>
      </div>

      <div className="mb-6 rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-gray-200 px-6 py-4">
          <Mail className="h-4 w-4 text-gray-500" />
          <h2 className="text-sm font-semibold text-gray-900">Email SMTP</h2>
        </div>
        <div className="p-6">
          <div className="space-y-4">
            {/* Provider presets */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Proveedor</label>
              <div className="flex gap-2">
                {['gmail', 'outlook', 'yahoo'].map((p) => (
                  <button key={p} type="button" onClick={() => applyPreset(p)}
                    className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 capitalize">
                    {p}
                  </button>
                ))}
                <span className="self-center text-xs text-gray-500">o configura manualmente</span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2">
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Servidor SMTP</label>
                <input type="text" value={editEmail.host} onChange={(e) => setEditEmail((s) => ({ ...s, host: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                  placeholder="smtp.gmail.com" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Puerto</label>
                <input type="number" value={editEmail.port} onChange={(e) => setEditEmail((s) => ({ ...s, port: parseInt(e.target.value) || 587 }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Usuario</label>
                <input type="email" value={editEmail.user} onChange={(e) => setEditEmail((s) => ({ ...s, user: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                  placeholder="usuario@gmail.com" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Contrasena {emailConfig?.hasPassword && <span className="text-xs text-green-600">(configurada)</span>}
                </label>
                <div className="relative">
                  <input type={showPassword ? 'text' : 'password'} value={editEmail.password}
                    onChange={(e) => setEditEmail((s) => ({ ...s, password: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 pr-10 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                    placeholder={emailConfig?.hasPassword ? '••••••••' : 'Contrasena o App Password'} />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Nombre remitente</label>
                <input type="text" value={editEmail.fromName} onChange={(e) => setEditEmail((s) => ({ ...s, fromName: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                  placeholder="Mi Negocio" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Email remitente</label>
                <input type="email" value={editEmail.fromAddress} onChange={(e) => setEditEmail((s) => ({ ...s, fromAddress: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                  placeholder="ventas@minegocio.com" />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <label className="relative inline-flex cursor-pointer items-center">
                <input type="checkbox" checked={editEmail.secure} onChange={(e) => setEditEmail((s) => ({ ...s, secure: e.target.checked }))} className="peer sr-only" />
                <div className="peer h-5 w-9 rounded-full bg-gray-300 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all peer-checked:bg-primary-600 peer-checked:after:translate-x-full" />
              </label>
              <span className="text-sm text-gray-700">Conexion segura (SSL/TLS)</span>
            </div>

            <div className="flex items-center gap-3">
              <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Guardar email
              </button>
              <div className="flex flex-1 items-center gap-2">
                <input type="email" value={testEmailTo} onChange={(e) => setTestEmailTo(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                  placeholder="Email para prueba" />
                <button onClick={handleTest} disabled={testing} className="flex items-center gap-2 whitespace-nowrap rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                  {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizonal className="h-4 w-4" />}
                  Probar
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
