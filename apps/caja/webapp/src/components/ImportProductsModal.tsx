import { useState, useCallback, useRef } from 'react'
import {
  X,
  Upload,
  Download,
  FileSpreadsheet,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ArrowUpCircle,
  ChevronLeft,
} from 'lucide-react'
import { useAuth, useToast } from '@enlocal/react-hooks'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface ValidatedRow {
  rowNum: number
  status: 'new' | 'update' | 'error'
  errors: string[]
  existingProductId?: string
  matchField?: string
  data: {
    name: string
    sku: string
    barcode: string
    categoryId: string | null
    categoryName: string
    price: string
    cost: string
    currentStock: string
    minStock: string
    taxRate: string
    iepsRate: string
    objetoImpuesto: string
    satCode: string
    satUnit: string
    sellByWeight: boolean
    saleUnit: string | null
    description: string
  }
}

interface ValidationResult {
  rows: ValidatedRow[]
  stats: { total: number; new: number; updates: number; errors: number }
  newCategories: string[]
}

interface ImportResult {
  created: number
  updated: number
  skipped: number
}

interface Props {
  onClose: () => void
  onImported: () => void
}

// ---------------------------------------------------------------------------
// CSV helpers
// ---------------------------------------------------------------------------
const CSV_HEADERS = [
  'nombre', 'sku', 'codigo_barras', 'categoria', 'precio', 'costo',
  'inventario', 'stock_minimo', 'tasa_iva', 'tasa_ieps', 'objeto_impuesto',
  'clave_sat', 'unidad_sat', 'venta_granel', 'unidad_venta', 'descripcion',
]

const TEMPLATE_EXAMPLE = [
  'Coca Cola 600ml', 'SKU-001', '7501234567890', 'Bebidas', '18.00', '12.00',
  '100', '10', '0.16', '0', '02', '01010101', 'H87', 'no', '', 'Refresco 600ml',
]

function generateTemplate(): string {
  const bom = '\uFEFF'
  return bom + CSV_HEADERS.join(',') + '\n' + TEMPLATE_EXAMPLE.join(',') + '\n'
}

function downloadCSV(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  result.push(current)
  return result
}

function parseCSV(text: string): { headers: string[]; rows: Record<string, string>[] } {
  // Remove BOM if present
  const clean = text.replace(/^\uFEFF/, '')
  const lines = clean.split(/\r?\n/).filter((l) => l.trim())
  if (lines.length === 0) return { headers: [], rows: [] }

  const headers = parseCSVLine(lines[0]).map((h) => h.trim().toLowerCase())
  const rows = lines.slice(1).map((line) => {
    const values = parseCSVLine(line)
    const obj: Record<string, string> = {}
    headers.forEach((h, i) => {
      obj[h] = (values[i] || '').trim()
    })
    return obj
  })
  return { headers, rows }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function ImportProductsModal({ onClose, onImported }: Props) {
  const { token } = useAuth()
  const toast = useToast()

  const [step, setStep] = useState<'upload' | 'preview' | 'result'>('upload')
  const [loading, setLoading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [fileName, setFileName] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Validation results
  const [validation, setValidation] = useState<ValidationResult | null>(null)
  const [duplicateMode, setDuplicateMode] = useState<'skip' | 'update'>('skip')

  // Import results
  const [importResult, setImportResult] = useState<ImportResult | null>(null)

  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }

  const handleDownloadTemplate = () => {
    downloadCSV(generateTemplate(), 'machote_productos.csv')
  }

  const handleExportCatalog = async () => {
    try {
      const res = await fetch('/api/products/export', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Error al exportar')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'productos_catalogo.csv'
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error('Error al exportar el catalogo')
    }
  }

  const processFile = useCallback(
    async (file: File) => {
      if (!file.name.endsWith('.csv')) {
        toast.error('Solo se aceptan archivos CSV')
        return
      }

      setFileName(file.name)
      setLoading(true)

      try {
        const text = await file.text()
        const { headers: csvHeaders, rows: csvRows } = parseCSV(text)

        // Validate headers
        const requiredHeaders = ['nombre', 'precio']
        for (const req of requiredHeaders) {
          if (!csvHeaders.includes(req)) {
            toast.error(`Falta la columna requerida: "${req}"`)
            setLoading(false)
            return
          }
        }

        if (csvRows.length === 0) {
          toast.error('El archivo no contiene filas de datos')
          setLoading(false)
          return
        }

        if (csvRows.length > 5000) {
          toast.error('Maximo 5000 productos por importacion')
          setLoading(false)
          return
        }

        // Map CSV rows to ImportRawRow format
        const importRows = csvRows.map((row, idx) => ({
          rowNum: idx + 2, // +2 because row 1 is headers, data starts at row 2
          nombre: row['nombre'] || '',
          sku: row['sku'] || '',
          codigo_barras: row['codigo_barras'] || '',
          categoria: row['categoria'] || '',
          precio: row['precio'] || '',
          costo: row['costo'] || '',
          inventario: row['inventario'] || '',
          stock_minimo: row['stock_minimo'] || '',
          tasa_iva: row['tasa_iva'] || '',
          tasa_ieps: row['tasa_ieps'] || '',
          objeto_impuesto: row['objeto_impuesto'] || '',
          clave_sat: row['clave_sat'] || '',
          unidad_sat: row['unidad_sat'] || '',
          venta_granel: row['venta_granel'] || '',
          unidad_venta: row['unidad_venta'] || '',
          descripcion: row['descripcion'] || '',
        }))

        // Send to backend for validation
        const res = await fetch('/api/products/import/validate', {
          method: 'POST',
          headers,
          body: JSON.stringify({ rows: importRows }),
        })

        if (!res.ok) {
          const err = await res.json()
          throw new Error(err.error || 'Error de validacion')
        }

        const result: ValidationResult = await res.json()
        setValidation(result)
        setStep('preview')
      } catch (err: any) {
        toast.error(err.message || 'Error al procesar el archivo')
      } finally {
        setLoading(false)
      }
    },
    [token, toast]
  )

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processFile(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) processFile(file)
  }

  const handleExecuteImport = async () => {
    if (!validation) return
    setLoading(true)

    try {
      const rowsToImport = validation.rows.filter((r) => r.status !== 'error')
      const res = await fetch('/api/products/import/execute', {
        method: 'POST',
        headers,
        body: JSON.stringify({ rows: rowsToImport, mode: duplicateMode }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Error al importar')
      }

      const result: ImportResult = await res.json()
      setImportResult(result)
      setStep('result')
      onImported()
    } catch (err: any) {
      toast.error(err.message || 'Error al importar productos')
    } finally {
      setLoading(false)
    }
  }

  const importableCount = validation
    ? validation.stats.new + (duplicateMode === 'update' ? validation.stats.updates : 0)
    : 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="relative mx-4 flex max-h-[90vh] w-full max-w-4xl flex-col rounded-xl border border-gray-200 bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div className="flex items-center gap-3">
            {step === 'preview' && (
              <button
                onClick={() => { setStep('upload'); setValidation(null); setFileName('') }}
                className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                type="button"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
            )}
            <FileSpreadsheet className="h-5 w-5 text-primary-600" />
            <h3 className="text-lg font-semibold text-gray-900">
              {step === 'upload' && 'Importar Productos'}
              {step === 'preview' && `Vista previa - ${fileName}`}
              {step === 'result' && 'Importacion completada'}
            </h3>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            type="button"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* ── STEP 1: Upload ── */}
          {step === 'upload' && (
            <div className="space-y-6">
              {/* Info */}
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                <h4 className="mb-2 text-sm font-semibold text-blue-800">Formato del archivo CSV</h4>
                <p className="text-sm text-blue-700">
                  El archivo debe tener las columnas: <strong>nombre</strong> y <strong>precio</strong> (obligatorias).
                  Las demas columnas son opcionales y se usaran valores por defecto si se omiten.
                </p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {CSV_HEADERS.map((h) => (
                    <span
                      key={h}
                      className={`rounded px-1.5 py-0.5 text-xs font-mono ${
                        h === 'nombre' || h === 'precio'
                          ? 'bg-blue-200 text-blue-800 font-semibold'
                          : 'bg-blue-100 text-blue-600'
                      }`}
                    >
                      {h}
                    </span>
                  ))}
                </div>
                <div className="mt-3 text-xs text-blue-600 space-y-1">
                  <p><strong>categoria:</strong> Nombre de la categoria (se crea automaticamente si no existe)</p>
                  <p><strong>inventario:</strong> Stock inicial del producto</p>
                  <p><strong>tasa_iva:</strong> 0.16 (16%), 0.08 (8%), 0 (exento). Default: 0.16</p>
                  <p><strong>venta_granel:</strong> si/no. Default: no</p>
                  <p><strong>Duplicados:</strong> Si el SKU o codigo de barras ya existe, se marcara para actualizar u omitir</p>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={handleDownloadTemplate}
                  className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  type="button"
                >
                  <Download className="h-4 w-4" />
                  Descargar machote CSV
                </button>
                <button
                  onClick={handleExportCatalog}
                  className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  type="button"
                >
                  <Download className="h-4 w-4" />
                  Exportar catalogo actual
                </button>
              </div>

              {/* Drop zone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-12 transition-colors ${
                  dragOver
                    ? 'border-primary-500 bg-primary-50'
                    : 'border-gray-300 bg-gray-50 hover:border-primary-400 hover:bg-primary-50/50'
                }`}
              >
                {loading ? (
                  <>
                    <Loader2 className="mb-3 h-10 w-10 animate-spin text-primary-500" />
                    <p className="text-sm font-medium text-gray-700">Procesando archivo...</p>
                  </>
                ) : (
                  <>
                    <Upload className="mb-3 h-10 w-10 text-gray-400" />
                    <p className="text-sm font-medium text-gray-700">
                      Arrastra tu archivo CSV aqui
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      o haz clic para seleccionar
                    </p>
                  </>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>
            </div>
          )}

          {/* ── STEP 2: Preview ── */}
          {step === 'preview' && validation && (
            <div className="space-y-4">
              {/* Stats */}
              <div className="grid grid-cols-4 gap-3">
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-center">
                  <p className="text-2xl font-bold text-gray-900">{validation.stats.total}</p>
                  <p className="text-xs text-gray-500">Total filas</p>
                </div>
                <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-center">
                  <p className="text-2xl font-bold text-green-700">{validation.stats.new}</p>
                  <p className="text-xs text-green-600">Nuevos</p>
                </div>
                <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-center">
                  <p className="text-2xl font-bold text-yellow-700">{validation.stats.updates}</p>
                  <p className="text-xs text-yellow-600">Ya existen</p>
                </div>
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-center">
                  <p className="text-2xl font-bold text-red-700">{validation.stats.errors}</p>
                  <p className="text-xs text-red-600">Con errores</p>
                </div>
              </div>

              {/* New categories notice */}
              {validation.newCategories.length > 0 && (
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                  <p className="text-sm font-medium text-blue-800">
                    Se crearan {validation.newCategories.length} categorias nuevas:
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {validation.newCategories.map((c) => (
                      <span key={c} className="rounded bg-blue-200 px-2 py-0.5 text-xs font-medium text-blue-800">
                        {c}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Duplicate mode toggle */}
              {validation.stats.updates > 0 && (
                <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3">
                  <p className="mb-2 text-sm font-medium text-yellow-800">
                    Se encontraron {validation.stats.updates} productos que ya existen (por SKU o codigo de barras).
                  </p>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="duplicateMode"
                        checked={duplicateMode === 'skip'}
                        onChange={() => setDuplicateMode('skip')}
                        className="text-primary-600"
                      />
                      <span className="text-sm text-gray-700">Omitir existentes</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="duplicateMode"
                        checked={duplicateMode === 'update'}
                        onChange={() => setDuplicateMode('update')}
                        className="text-primary-600"
                      />
                      <span className="text-sm text-gray-700">Actualizar existentes</span>
                    </label>
                  </div>
                </div>
              )}

              {/* Preview table */}
              <div className="overflow-hidden rounded-lg border border-gray-200">
                <div className="max-h-[40vh] overflow-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="sticky top-0 bg-gray-50">
                      <tr className="border-b border-gray-200">
                        <th className="px-3 py-2 font-medium text-gray-600 w-10">#</th>
                        <th className="px-3 py-2 font-medium text-gray-600 w-20">Estado</th>
                        <th className="px-3 py-2 font-medium text-gray-600">Nombre</th>
                        <th className="px-3 py-2 font-medium text-gray-600">SKU</th>
                        <th className="px-3 py-2 font-medium text-gray-600">Categoria</th>
                        <th className="px-3 py-2 font-medium text-gray-600 text-right">Precio</th>
                        <th className="px-3 py-2 font-medium text-gray-600 text-right">Inventario</th>
                        <th className="px-3 py-2 font-medium text-gray-600">Detalle</th>
                      </tr>
                    </thead>
                    <tbody>
                      {validation.rows.map((row) => (
                        <tr
                          key={row.rowNum}
                          className={`border-b border-gray-100 ${
                            row.status === 'error'
                              ? 'bg-red-50'
                              : row.status === 'update'
                                ? 'bg-yellow-50'
                                : ''
                          }`}
                        >
                          <td className="px-3 py-2 text-gray-400 text-xs">{row.rowNum}</td>
                          <td className="px-3 py-2">
                            {row.status === 'new' && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                                <CheckCircle2 className="h-3 w-3" /> Nuevo
                              </span>
                            )}
                            {row.status === 'update' && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700">
                                <ArrowUpCircle className="h-3 w-3" /> Existe
                              </span>
                            )}
                            {row.status === 'error' && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                                <AlertCircle className="h-3 w-3" /> Error
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 font-medium text-gray-900 max-w-[200px] truncate">
                            {row.data.name || '-'}
                          </td>
                          <td className="px-3 py-2 text-gray-600 text-xs font-mono">
                            {row.data.sku || '-'}
                          </td>
                          <td className="px-3 py-2 text-gray-600 text-sm">
                            {row.data.categoryName || '-'}
                          </td>
                          <td className="px-3 py-2 text-right text-gray-900">
                            ${row.data.price}
                          </td>
                          <td className="px-3 py-2 text-right text-gray-600">
                            {row.data.currentStock}
                          </td>
                          <td className="px-3 py-2">
                            {row.status === 'error' && (
                              <div className="space-y-0.5">
                                {row.errors.map((e, i) => (
                                  <p key={i} className="text-xs text-red-600">{e}</p>
                                ))}
                              </div>
                            )}
                            {row.status === 'update' && row.matchField && (
                              <p className="text-xs text-yellow-600">
                                Coincide por {row.matchField === 'sku' ? 'SKU' : 'codigo de barras'}
                              </p>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ── STEP 3: Result ── */}
          {step === 'result' && importResult && (
            <div className="flex flex-col items-center py-8">
              <CheckCircle2 className="mb-4 h-16 w-16 text-green-500" />
              <h4 className="mb-6 text-xl font-semibold text-gray-900">Importacion exitosa</h4>
              <div className="grid grid-cols-3 gap-6 text-center">
                <div>
                  <p className="text-3xl font-bold text-green-600">{importResult.created}</p>
                  <p className="text-sm text-gray-500">Creados</p>
                </div>
                <div>
                  <p className="text-3xl font-bold text-yellow-600">{importResult.updated}</p>
                  <p className="text-sm text-gray-500">Actualizados</p>
                </div>
                <div>
                  <p className="text-3xl font-bold text-gray-400">{importResult.skipped}</p>
                  <p className="text-sm text-gray-500">Omitidos</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 border-t border-gray-200 px-6 py-4">
          {step === 'upload' && (
            <button
              onClick={onClose}
              className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              type="button"
            >
              Cancelar
            </button>
          )}

          {step === 'preview' && (
            <>
              <button
                onClick={() => { setStep('upload'); setValidation(null); setFileName('') }}
                disabled={loading}
                className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                type="button"
              >
                Volver
              </button>
              <button
                onClick={handleExecuteImport}
                disabled={loading || importableCount === 0}
                className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
                type="button"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                Importar {importableCount} productos
              </button>
            </>
          )}

          {step === 'result' && (
            <button
              onClick={onClose}
              className="rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700"
              type="button"
            >
              Cerrar
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
