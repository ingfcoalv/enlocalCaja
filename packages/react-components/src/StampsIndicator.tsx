import { useLicenseStore } from '@enlocal/react-hooks'
import { Stamp } from 'lucide-react'

/**
 * Badge showing stamps balance in sidebar.
 * Green (>10), Yellow (<=10), Red (0).
 * Only visible if mod-invoicing is active.
 */
export function StampsIndicator() {
  const { stamps, isModuleActive } = useLicenseStore()

  if (!isModuleActive('invoicing')) return null

  const { available } = stamps
  let colorClass = 'bg-green-500 text-white'
  if (available === 0) {
    colorClass = 'bg-red-500 text-white'
  } else if (available <= 10) {
    colorClass = 'bg-yellow-500 text-white'
  }

  return (
    <div className="flex items-center gap-2 rounded-lg px-3 py-2">
      <Stamp className="h-4 w-4 text-primary-200" />
      <span className="text-xs text-primary-200">Timbres</span>
      <span
        className={`ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-xs font-bold ${colorClass}`}
      >
        {available}
      </span>
    </div>
  )
}
