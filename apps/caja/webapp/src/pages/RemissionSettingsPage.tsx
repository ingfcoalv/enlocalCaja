import { Truck } from 'lucide-react'
import { RemissionSettings } from '../components/RemissionSettings'

export default function RemissionSettingsPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <Truck className="h-6 w-6 text-primary-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Configuracion de Remisiones</h1>
            <p className="mt-1 text-sm text-gray-500">Logo del negocio y folios de remisiones</p>
          </div>
        </div>
      </div>
      <RemissionSettings />
    </div>
  )
}
