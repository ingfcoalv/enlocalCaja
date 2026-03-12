import { ExternalLink, Sparkles } from 'lucide-react'

interface AddonPromoCardProps {
  name: string
  description: string
  ctaUrl?: string
}

/**
 * Card shown when an addon module is not active.
 * CTA links to todoenlocal.com.
 */
export function AddonPromoCard({
  name,
  description,
  ctaUrl = 'https://todoenlocal.com/precios',
}: AddonPromoCardProps) {
  return (
    <div className="flex flex-col items-center rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 p-8 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-100">
        <Sparkles className="h-6 w-6 text-primary-600" />
      </div>
      <h3 className="mt-4 text-lg font-semibold text-gray-900">{name}</h3>
      <p className="mt-2 max-w-sm text-sm text-gray-600">{description}</p>
      <a
        href={ctaUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-700"
      >
        Activar en todoenlocal.com
        <ExternalLink className="h-4 w-4" />
      </a>
    </div>
  )
}
