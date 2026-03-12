import { ShoppingBag } from 'lucide-react'
import { PayablesSettings } from '../components/PayablesSettings'

export default function PayablesSettingsPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <ShoppingBag className="h-6 w-6 text-primary-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Configuracion de Compras</h1>
            <p className="mt-1 text-sm text-gray-500">Folios de ordenes, recepciones, devoluciones y umbral de pago</p>
          </div>
        </div>
      </div>
      <PayablesSettings />
    </div>
  )
}
