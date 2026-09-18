'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export function CrmNav({ ofertasAbertas }: { ofertasAbertas?: number }) {
  const pathname = usePathname()
  const ofertas = pathname.startsWith('/crm/ofertas') || pathname.startsWith('/ofertas')
  const item = 'rounded-md px-3 py-1.5 text-sm transition-colors'

  return (
    <nav className="mb-5 flex items-center gap-1 border-b border-borda pb-2" aria-label="Áreas do CRM">
      <Link href="/crm" className={`${item} ${!ofertas ? 'bg-painel-2 font-medium text-texto' : 'text-texto-fraco hover:text-texto'}`}>
        Pipeline
      </Link>
      <Link href="/crm/ofertas" className={`${item} ${ofertas ? 'bg-painel-2 font-medium text-texto' : 'text-texto-fraco hover:text-texto'}`}>
        Ofertas de bio
        {typeof ofertasAbertas === 'number' && ofertasAbertas > 0 && <span className="ml-1.5 rounded-full bg-acento/10 px-1.5 py-0.5 text-[10px] text-acento">{ofertasAbertas}</span>}
      </Link>
    </nav>
  )
}
