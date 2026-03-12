import type { ReactNode } from 'react'
import { useModuleAccess } from '@enlocal/react-hooks'
import { AddonPromoCard } from './AddonPromoCard'

interface ModuleGateProps {
  module: string
  children: ReactNode
  fallback?: ReactNode
  promoFallback?: {
    name: string
    description: string
    ctaUrl?: string
  }
}

export function ModuleGate({ module, children, fallback, promoFallback }: ModuleGateProps): JSX.Element | null {
  const { hasAccess } = useModuleAccess(module)

  if (hasAccess) {
    return <>{children}</>
  }

  if (promoFallback) {
    return (
      <AddonPromoCard
        name={promoFallback.name}
        description={promoFallback.description}
        ctaUrl={promoFallback.ctaUrl}
      />
    )
  }

  if (fallback !== undefined) {
    return <>{fallback}</>
  }

  return null
}
