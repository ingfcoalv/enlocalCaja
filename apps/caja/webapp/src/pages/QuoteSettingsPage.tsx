import { SendHorizonal } from 'lucide-react'
import { QuoteSettings } from '../components/QuoteSettings'

export default function QuoteSettingsPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <SendHorizonal className="h-6 w-6 text-primary-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Configuracion de Cotizaciones</h1>
            <p className="mt-1 text-sm text-gray-500">Folios y valores por defecto de cotizaciones</p>
          </div>
        </div>
      </div>
      <QuoteSettings />
    </div>
  )
}
