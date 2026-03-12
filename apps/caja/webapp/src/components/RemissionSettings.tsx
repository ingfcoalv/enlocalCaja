import { useEffect, useState, useCallback, useRef } from 'react'
import {
  Loader2, Upload, Trash2, Image, Hash, Save,
} from 'lucide-react'
import { api, useToast } from '@enlocal/react-hooks'

interface FolioConfig {
  series: string
  currentFolio: number
  startingFolio: number
}

export function RemissionSettings() {
  const toast = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Logo state
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  // Folio state
  const [remissionFolio, setRemissionFolio] = useState<FolioConfig>({ series: 'NR', currentFolio: 0, startingFolio: 1 })
  const [returnFolio, setReturnFolio] = useState<FolioConfig>({ series: 'DR', currentFolio: 0, startingFolio: 1 })
  const [loadingFolios, setLoadingFolios] = useState(true)
  const [savingFolios, setSavingFolios] = useState(false)

  // Load logo
  useEffect(() => {
    const loadLogo = async () => {
      try {
        const { data } = await api.get('/api/settings/logo', { responseType: 'blob' })
        if (data && data.size > 0) {
          setLogoUrl(URL.createObjectURL(data))
        }
      } catch {
        // No logo yet
      }
    }
    loadLogo()
  }, [])

  // Load folios
  useEffect(() => {
    const loadFolios = async () => {
      setLoadingFolios(true)
      try {
        const [remRes, retRes] = await Promise.all([
          api.get('/api/folio-config/remission-folio'),
          api.get('/api/folio-config/return-folio'),
        ])
        const rem = remRes.data?.data || remRes.data
        const ret = retRes.data?.data || retRes.data
        if (rem) setRemissionFolio({ series: rem.series || 'NR', currentFolio: rem.currentFolio || 0, startingFolio: rem.startingFolio || 1 })
        if (ret) setReturnFolio({ series: ret.series || 'DR', currentFolio: ret.currentFolio || 0, startingFolio: ret.startingFolio || 1 })
      } catch {
        // Use defaults
      }
      setLoadingFolios(false)
    }
    loadFolios()
  }, [])

  const handleUploadLogo = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.warning('Solo se permiten imagenes')
      return
    }
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('logo', file)
      await api.post('/api/settings/logo', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      // Reload logo
      const { data } = await api.get('/api/settings/logo', { responseType: 'blob' })
      if (data && data.size > 0) {
        if (logoUrl) URL.revokeObjectURL(logoUrl)
        setLogoUrl(URL.createObjectURL(data))
      }
      toast.success('Logo actualizado')
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Error al subir logo')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }, [toast, logoUrl])

  const handleDeleteLogo = useCallback(async () => {
    try {
      await api.delete('/api/settings/logo')
      if (logoUrl) URL.revokeObjectURL(logoUrl)
      setLogoUrl(null)
      toast.success('Logo eliminado')
    } catch {
      toast.error('Error al eliminar logo')
    }
  }, [toast, logoUrl])

  const handleSaveFolios = useCallback(async () => {
    setSavingFolios(true)
    try {
      await Promise.all([
        api.put('/api/folio-config/remission-folio', { startingFolio: remissionFolio.startingFolio }),
        api.put('/api/folio-config/return-folio', { startingFolio: returnFolio.startingFolio }),
      ])
      toast.success('Configuracion de folios guardada')
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Error al guardar folios')
    } finally {
      setSavingFolios(false)
    }
  }, [toast, remissionFolio.startingFolio, returnFolio.startingFolio])

  return (
    <>
      {/* Logo del negocio */}
      <div className="mb-6 rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-gray-200 px-6 py-4">
          <Image className="h-4 w-4 text-gray-500" />
          <h2 className="text-sm font-semibold text-gray-900">Logo del negocio</h2>
        </div>
        <div className="p-6">
          <div className="flex items-center gap-6">
            <div className="flex h-24 w-24 items-center justify-center rounded-xl border-2 border-dashed border-gray-300 bg-gray-50">
              {logoUrl ? (
                <img src={logoUrl} alt="Logo" className="h-full w-full rounded-xl object-contain" />
              ) : (
                <Image className="h-8 w-8 text-gray-300" />
              )}
            </div>
            <div className="space-y-2">
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleUploadLogo} className="hidden" />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {logoUrl ? 'Cambiar logo' : 'Subir logo'}
              </button>
              {logoUrl && (
                <button
                  onClick={handleDeleteLogo}
                  className="flex items-center gap-2 rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" /> Eliminar
                </button>
              )}
              <p className="text-xs text-gray-500">Se recomienda imagen cuadrada, max 10MB. Se convierte a WebP.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Configuracion de folios */}
      <div className="mb-6 rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-gray-200 px-6 py-4">
          <Hash className="h-4 w-4 text-gray-500" />
          <h2 className="text-sm font-semibold text-gray-900">Folios de remisiones</h2>
        </div>
        <div className="p-6">
          {loadingFolios ? (
            <div className="flex justify-center py-4"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
          ) : (
            <div className="space-y-4">
              {/* Remission folio */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Serie remisiones</label>
                  <input
                    type="text"
                    value={remissionFolio.series}
                    readOnly
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Folio actual</label>
                  <input
                    type="number"
                    value={remissionFolio.currentFolio}
                    readOnly
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Folio inicial</label>
                  <input
                    type="number"
                    min="1"
                    value={remissionFolio.startingFolio}
                    onChange={(e) => setRemissionFolio((f) => ({ ...f, startingFolio: parseInt(e.target.value) || 1 }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                  />
                </div>
              </div>

              {/* Return folio */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Serie devoluciones</label>
                  <input
                    type="text"
                    value={returnFolio.series}
                    readOnly
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Folio actual</label>
                  <input
                    type="number"
                    value={returnFolio.currentFolio}
                    readOnly
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Folio inicial</label>
                  <input
                    type="number"
                    min="1"
                    value={returnFolio.startingFolio}
                    onChange={(e) => setReturnFolio((f) => ({ ...f, startingFolio: parseInt(e.target.value) || 1 }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={handleSaveFolios}
                  disabled={savingFolios}
                  className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
                >
                  {savingFolios ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Guardar folios
                </button>
              </div>
              <p className="text-xs text-gray-500">
                El folio inicial solo aplica si es mayor al folio actual. Los folios se asignan automaticamente.
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
