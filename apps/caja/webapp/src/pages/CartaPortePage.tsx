import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Loader2, FileText, Stamp, Truck, Plus, Trash2, ChevronRight, ChevronLeft,
  Search, CheckCircle2, MapPin, Package, AlertTriangle,
} from 'lucide-react'
import { api, useToast } from '@enlocal/react-hooks'
import { useInvoiceStore } from '../stores/useInvoiceStore'
import { useSatCatalogStore } from '../stores/useSatCatalogStore'

const inputClass = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20'
const selectClass = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none'
const labelClass = 'mb-1 block text-xs font-medium text-gray-600'
const btnPrimary = 'flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50'
const btnOutline = 'flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50'

function formatCurrency(amount: number | string): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(num || 0)
}

interface Location {
  id: string
  type: 'origin' | 'destination'
  street: string
  extNumber: string
  colony: string
  municipality: string
  state: string
  postalCode: string
  country: string
  date: string
  distance: string
}

interface Merchandise {
  id: string
  description: string
  satCode: string
  quantity: string
  unit: string
  weight: string
  value: string
  isHazmat: boolean
  hazmatCode: string
}

interface VehicleData {
  permisoSct: string
  configVehicular: string
  placas: string
  anioModelo: string
  aseguradora: string
  poliza: string
}

interface OperatorData {
  rfc: string
  nombre: string
  licencia: string
  codigoPostal: string
}

const emptyLocation = (type: 'origin' | 'destination'): Location => ({
  id: `${Date.now()}-${Math.random()}`, type, street: '', extNumber: '', colony: '', municipality: '',
  state: '', postalCode: '', country: 'MEX', date: new Date().toISOString().split('T')[0], distance: '',
})

const emptyMerchandise = (): Merchandise => ({
  id: `${Date.now()}-${Math.random()}`, description: '', satCode: '', quantity: '1', unit: 'H87',
  weight: '', value: '', isHazmat: false, hazmatCode: '',
})

export default function CartaPortePage() {
  const toast = useToast()
  const navigate = useNavigate()
  const { create, stamp } = useInvoiceStore()

  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)
  const [showStampModal, setShowStampModal] = useState(false)
  const [createdId, setCreatedId] = useState<string | null>(null)

  // Step 1: Locations
  const [locations, setLocations] = useState<Location[]>([
    emptyLocation('origin'),
    emptyLocation('destination'),
  ])

  // Step 2: Merchandise
  const [merchandises, setMerchandises] = useState<Merchandise[]>([emptyMerchandise()])

  // Step 3: Vehicle
  const [vehicle, setVehicle] = useState<VehicleData>({
    permisoSct: '', configVehicular: '', placas: '', anioModelo: '', aseguradora: '', poliza: '',
  })

  // Step 4: Operator + Customer
  const [operator, setOperator] = useState<OperatorData>({ rfc: '', nombre: '', licencia: '', codigoPostal: '' })
  const [customers, setCustomers] = useState<any[]>([])
  const [customerSearch, setCustomerSearch] = useState('')
  const [customerId, setCustomerId] = useState('')
  const [customerRfc, setCustomerRfc] = useState('')
  const [useCfdi, setUseCfdi] = useState('S01')

  // Customer search
  useEffect(() => {
    if (customerSearch.length < 2) { setCustomers([]); return }
    const timer = setTimeout(async () => {
      try {
        const { data } = await api.get('/api/customers', { params: { q: customerSearch, limit: 10 } })
        setCustomers(data?.data || [])
      } catch { /* ignore */ }
    }, 300)
    return () => clearTimeout(timer)
  }, [customerSearch])

  const updateLocation = (id: string, field: keyof Location, value: string) => {
    setLocations(locations.map((l) => l.id === id ? { ...l, [field]: value } : l))
  }

  const addDestination = () => {
    setLocations([...locations, emptyLocation('destination')])
  }

  const removeLocation = (id: string) => {
    if (locations.filter((l) => l.type === 'destination').length <= 1 && locations.find((l) => l.id === id)?.type === 'destination') return
    setLocations(locations.filter((l) => l.id !== id))
  }

  const updateMerchandise = (id: string, field: keyof Merchandise, value: any) => {
    setMerchandises(merchandises.map((m) => m.id === id ? { ...m, [field]: value } : m))
  }

  const addMerchandise = () => setMerchandises([...merchandises, emptyMerchandise()])
  const removeMerchandise = (id: string) => {
    if (merchandises.length <= 1) return
    setMerchandises(merchandises.filter((m) => m.id !== id))
  }

  const totalWeight = merchandises.reduce((sum, m) => sum + (parseFloat(m.weight) || 0), 0)
  const totalValue = merchandises.reduce((sum, m) => sum + (parseFloat(m.value) || 0) * (parseFloat(m.quantity) || 0), 0)

  const handleGenerate = async (andStamp: boolean) => {
    setSaving(true)
    try {
      const payload = {
        customerId: customerId || undefined,
        series: 'CT',
        type: 'T',
        useCfdi,
        paymentMethod: 'PUE',
        paymentForm: '99',
        currency: 'MXN',
        items: merchandises.map((m) => ({
          description: m.description,
          quantity: m.quantity,
          unitPrice: m.value || '0',
          satCode: m.satCode,
          satUnit: m.unit,
          taxRate: '0',
        })),
        cartaPorte: {
          locations: locations.map((l) => ({
            type: l.type,
            street: l.street,
            extNumber: l.extNumber,
            colony: l.colony,
            municipality: l.municipality,
            state: l.state,
            postalCode: l.postalCode,
            country: l.country,
            date: l.date,
            distance: l.distance,
          })),
          merchandises: merchandises.map((m) => ({
            description: m.description,
            satCode: m.satCode,
            quantity: m.quantity,
            unit: m.unit,
            weight: m.weight,
            value: m.value,
            isHazmat: m.isHazmat,
            hazmatCode: m.hazmatCode,
          })),
          vehicle,
          operator,
        },
      }
      const { data } = await api.post('/api/invoices', payload)
      const created = data.data || data
      if (andStamp) {
        setCreatedId(created.id)
        setShowStampModal(true)
      } else {
        toast.success('Carta porte creada como borrador')
        navigate(`/invoicing/${created.id}`)
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Error al crear carta porte')
    } finally {
      setSaving(false)
    }
  }

  const confirmStamp = async () => {
    if (!createdId) return
    setSaving(true)
    setShowStampModal(false)
    try {
      await stamp(createdId)
      toast.success('Carta porte timbrada')
      navigate(`/invoicing/${createdId}`)
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Error al timbrar')
    } finally {
      setSaving(false)
    }
  }

  const steps = [
    { n: 1, label: 'Ubicaciones', icon: MapPin },
    { n: 2, label: 'Mercancia', icon: Package },
    { n: 3, label: 'Vehiculo', icon: Truck },
    { n: 4, label: 'Operador', icon: FileText },
  ]

  return (
    <div>
      <button onClick={() => navigate('/invoicing')} className="mb-4 flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900" type="button">
        <ArrowLeft className="h-4 w-4" /> Volver a facturas
      </button>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Carta Porte</h1>
        <p className="mt-1 text-sm text-gray-500">CFDI tipo Traslado (T) con complemento Carta Porte 3.1</p>
      </div>

      {/* Stepper */}
      <div className="mb-6 flex items-center gap-2">
        {steps.map(({ n, label, icon: Icon }) => (
          <div key={n} className="flex items-center gap-2">
            <button onClick={() => n < step && setStep(n)}
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${step >= n ? 'bg-primary-600 text-white' : 'bg-gray-200 text-gray-500'}`}
              type="button">{n}</button>
            <span className={`hidden text-sm sm:inline ${step >= n ? 'font-medium text-gray-900' : 'text-gray-400'}`}>{label}</span>
            {n < 4 && <ChevronRight className="h-4 w-4 text-gray-300" />}
          </div>
        ))}
      </div>

      {/* Step 1: Ubicaciones */}
      {step === 1 && (
        <div className="space-y-4">
          {locations.map((loc) => (
            <div key={loc.id} className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-700">
                  {loc.type === 'origin' ? 'Origen' : 'Destino'}
                </h3>
                {loc.type === 'destination' && locations.filter((l) => l.type === 'destination').length > 1 && (
                  <button onClick={() => removeLocation(loc.id)} className="text-red-400 hover:text-red-600" type="button"><Trash2 className="h-4 w-4" /></button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="sm:col-span-2"><label className={labelClass}>Calle</label><input type="text" value={loc.street} onChange={(e) => updateLocation(loc.id, 'street', e.target.value)} className={inputClass} /></div>
                <div><label className={labelClass}>No. ext.</label><input type="text" value={loc.extNumber} onChange={(e) => updateLocation(loc.id, 'extNumber', e.target.value)} className={inputClass} /></div>
                <div><label className={labelClass}>Colonia</label><input type="text" value={loc.colony} onChange={(e) => updateLocation(loc.id, 'colony', e.target.value)} className={inputClass} /></div>
                <div><label className={labelClass}>Municipio</label><input type="text" value={loc.municipality} onChange={(e) => updateLocation(loc.id, 'municipality', e.target.value)} className={inputClass} /></div>
                <div><label className={labelClass}>Estado</label><input type="text" value={loc.state} onChange={(e) => updateLocation(loc.id, 'state', e.target.value)} className={inputClass} /></div>
                <div><label className={labelClass}>C.P.</label><input type="text" value={loc.postalCode} onChange={(e) => updateLocation(loc.id, 'postalCode', e.target.value)} className={inputClass} /></div>
                <div><label className={labelClass}>Fecha</label><input type="date" value={loc.date} onChange={(e) => updateLocation(loc.id, 'date', e.target.value)} className={inputClass} /></div>
              </div>
              {loc.type === 'destination' && (
                <div className="mt-3"><label className={labelClass}>Distancia recorrida (km)</label><input type="number" step="0.01" min="0" value={loc.distance} onChange={(e) => updateLocation(loc.id, 'distance', e.target.value)} className="w-32 rounded-lg border border-gray-300 px-3 py-2 text-sm" /></div>
              )}
            </div>
          ))}
          <button onClick={addDestination} className={btnOutline} type="button"><Plus className="h-4 w-4" /> Agregar destino</button>
          <div className="flex justify-end"><button onClick={() => setStep(2)} className={btnPrimary} type="button">Siguiente <ChevronRight className="h-4 w-4" /></button></div>
        </div>
      )}

      {/* Step 2: Mercancia */}
      {step === 2 && (
        <div className="space-y-4">
          {merchandises.map((m) => (
            <div key={m.id} className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-medium text-gray-700">Mercancia</h3>
                {merchandises.length > 1 && <button onClick={() => removeMerchandise(m.id)} className="text-red-400 hover:text-red-600" type="button"><Trash2 className="h-4 w-4" /></button>}
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="sm:col-span-2"><label className={labelClass}>Descripcion</label><input type="text" value={m.description} onChange={(e) => updateMerchandise(m.id, 'description', e.target.value)} className={inputClass} /></div>
                <div><label className={labelClass}>Clave SAT</label><input type="text" value={m.satCode} onChange={(e) => updateMerchandise(m.id, 'satCode', e.target.value)} className={inputClass} placeholder="Ej: 01010101" /></div>
                <div><label className={labelClass}>Cantidad</label><input type="number" step="0.01" min="0" value={m.quantity} onChange={(e) => updateMerchandise(m.id, 'quantity', e.target.value)} className={inputClass} /></div>
                <div>
                  <label className={labelClass}>Unidad</label>
                  <select value={m.unit} onChange={(e) => updateMerchandise(m.id, 'unit', e.target.value)} className={selectClass}>
                    <option value="H87">H87 - Pieza</option><option value="KGM">KGM - Kilogramo</option><option value="LTR">LTR - Litro</option><option value="XBX">XBX - Caja</option>
                  </select>
                </div>
                <div><label className={labelClass}>Peso (kg)</label><input type="number" step="0.01" min="0" value={m.weight} onChange={(e) => updateMerchandise(m.id, 'weight', e.target.value)} className={inputClass} /></div>
                <div><label className={labelClass}>Valor ($)</label><input type="number" step="0.01" min="0" value={m.value} onChange={(e) => updateMerchandise(m.id, 'value', e.target.value)} className={inputClass} /></div>
                <div className="flex items-end gap-2">
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input type="checkbox" checked={m.isHazmat} onChange={(e) => updateMerchandise(m.id, 'isHazmat', e.target.checked)} className="rounded border-gray-300" />
                    Mat. peligroso
                  </label>
                </div>
              </div>
              {m.isHazmat && (
                <div className="mt-3"><label className={labelClass}>Clave material peligroso</label><input type="text" value={m.hazmatCode} onChange={(e) => updateMerchandise(m.id, 'hazmatCode', e.target.value)} className="w-48 rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="Ej: 1203" /></div>
              )}
            </div>
          ))}
          <button onClick={addMerchandise} className={btnOutline} type="button"><Plus className="h-4 w-4" /> Agregar mercancia</button>
          <div className="rounded-lg bg-gray-50 p-3 text-sm text-gray-600">
            Peso total: <span className="font-bold">{totalWeight.toFixed(2)} kg</span> | Valor total: <span className="font-bold">{formatCurrency(totalValue)}</span>
          </div>
          <div className="flex justify-between">
            <button onClick={() => setStep(1)} className={btnOutline} type="button"><ChevronLeft className="h-4 w-4" /> Anterior</button>
            <button onClick={() => setStep(3)} className={btnPrimary} type="button">Siguiente <ChevronRight className="h-4 w-4" /></button>
          </div>
        </div>
      )}

      {/* Step 3: Vehiculo */}
      {step === 3 && (
        <div className="space-y-4">
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <h3 className="mb-3 text-sm font-semibold text-gray-700">Datos del vehiculo</h3>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <div><label className={labelClass}>Permiso SCT</label><input type="text" value={vehicle.permisoSct} onChange={(e) => setVehicle({ ...vehicle, permisoSct: e.target.value })} className={inputClass} placeholder="Tipo permiso" /></div>
              <div><label className={labelClass}>Config. vehicular</label><input type="text" value={vehicle.configVehicular} onChange={(e) => setVehicle({ ...vehicle, configVehicular: e.target.value })} className={inputClass} placeholder="Ej: VL" /></div>
              <div><label className={labelClass}>Placas</label><input type="text" value={vehicle.placas} onChange={(e) => setVehicle({ ...vehicle, placas: e.target.value })} className={inputClass} /></div>
              <div><label className={labelClass}>Anio modelo</label><input type="text" value={vehicle.anioModelo} onChange={(e) => setVehicle({ ...vehicle, anioModelo: e.target.value })} className={inputClass} placeholder="Ej: 2023" /></div>
              <div><label className={labelClass}>Aseguradora</label><input type="text" value={vehicle.aseguradora} onChange={(e) => setVehicle({ ...vehicle, aseguradora: e.target.value })} className={inputClass} /></div>
              <div><label className={labelClass}>No. poliza</label><input type="text" value={vehicle.poliza} onChange={(e) => setVehicle({ ...vehicle, poliza: e.target.value })} className={inputClass} /></div>
            </div>
          </div>
          <div className="flex justify-between">
            <button onClick={() => setStep(2)} className={btnOutline} type="button"><ChevronLeft className="h-4 w-4" /> Anterior</button>
            <button onClick={() => setStep(4)} className={btnPrimary} type="button">Siguiente <ChevronRight className="h-4 w-4" /></button>
          </div>
        </div>
      )}

      {/* Step 4: Operador + Receptor */}
      {step === 4 && (
        <div className="space-y-4">
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <h3 className="mb-3 text-sm font-semibold text-gray-700">Operador</h3>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div><label className={labelClass}>RFC operador</label><input type="text" value={operator.rfc} onChange={(e) => setOperator({ ...operator, rfc: e.target.value })} className={inputClass} /></div>
              <div><label className={labelClass}>Nombre</label><input type="text" value={operator.nombre} onChange={(e) => setOperator({ ...operator, nombre: e.target.value })} className={inputClass} /></div>
              <div><label className={labelClass}>No. licencia</label><input type="text" value={operator.licencia} onChange={(e) => setOperator({ ...operator, licencia: e.target.value })} className={inputClass} /></div>
              <div><label className={labelClass}>C.P.</label><input type="text" value={operator.codigoPostal} onChange={(e) => setOperator({ ...operator, codigoPostal: e.target.value })} className={inputClass} /></div>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <h3 className="mb-3 text-sm font-semibold text-gray-700">Receptor</h3>
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input type="text" placeholder="Buscar cliente..." value={customerSearch} onChange={(e) => { setCustomerSearch(e.target.value); setCustomerId('') }}
                className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-4 text-sm focus:border-primary-500 focus:outline-none" />
              {customers.length > 0 && !customerId && (
                <div className="absolute z-20 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg max-h-60 overflow-auto">
                  {customers.map((c: any) => (
                    <button key={c.id} onClick={() => { setCustomerId(c.id); setCustomerSearch(c.razonSocial || c.name); setCustomerRfc(c.rfc || ''); setCustomers([]) }}
                      className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50" type="button">
                      <span className="font-medium">{c.razonSocial || c.name}</span>
                      {c.rfc && <span className="ml-2 text-xs text-gray-500">{c.rfc}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {customerId && <p className="flex items-center gap-1 text-xs text-green-600"><CheckCircle2 className="h-3.5 w-3.5" /> Cliente seleccionado ({customerRfc})</p>}
          </div>

          {/* Summary */}
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <h3 className="mb-3 text-sm font-semibold text-gray-700">Resumen</h3>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 text-sm">
              <div><p className="text-gray-500">Ubicaciones</p><p className="font-bold">{locations.length} ({locations.filter((l) => l.type === 'destination').length} destinos)</p></div>
              <div><p className="text-gray-500">Mercancias</p><p className="font-bold">{merchandises.length} items</p></div>
              <div><p className="text-gray-500">Peso total</p><p className="font-bold">{totalWeight.toFixed(2)} kg</p></div>
              <div><p className="text-gray-500">Valor total</p><p className="font-bold">{formatCurrency(totalValue)}</p></div>
            </div>
          </div>

          <div className="flex justify-between">
            <button onClick={() => setStep(3)} className={btnOutline} type="button"><ChevronLeft className="h-4 w-4" /> Anterior</button>
            <div className="flex gap-2">
              <button onClick={() => handleGenerate(false)} disabled={saving} className={btnOutline} type="button">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />} Guardar borrador
              </button>
              <button onClick={() => handleGenerate(true)} disabled={saving} className={btnPrimary} type="button">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Stamp className="h-4 w-4" />} Generar y timbrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stamp modal */}
      {showStampModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-yellow-100"><AlertTriangle className="h-5 w-5 text-yellow-600" /></div>
              <h3 className="text-lg font-semibold text-gray-900">Confirmar timbrado</h3>
            </div>
            <p className="mb-4 text-sm text-gray-600">Se timbrara una carta porte con {merchandises.length} mercancias.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => { setShowStampModal(false); if (createdId) navigate(`/invoicing/${createdId}`) }} className={btnOutline} type="button">Cancelar</button>
              <button onClick={confirmStamp} disabled={saving} className={btnPrimary} type="button">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Stamp className="h-4 w-4" />} Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
