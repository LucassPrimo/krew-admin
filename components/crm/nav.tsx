'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export function CrmNav({ ofertasAbertas }: { ofertasAbertas?: number }) {
  const pathname = usePathname()
  const ofertas = pathname.startsWith('/crm/ofertas') || pathname.startsWith('/ofertas')
  const item = 'rounded-lg px-4 py-2 text-sm transition-colors'

  return (
    <nav className="mb-6 flex w-fit items-center gap-1 rounded-xl border border-borda bg-painel p-1" aria-label="Áreas do CRM">
      <Link href="/crm" aria-current={!ofertas ? 'page' : undefined} className={`${item} ${!ofertas ? 'bg-painel-2 font-semibold text-texto shadow-sm' : 'text-texto-fraco hover:text-texto'}`}>
        Kanban
      </Link>
      <Link href="/crm/ofertas" aria-current={ofertas ? 'page' : undefined} className={`${item} ${ofertas ? 'bg-painel-2 font-semibold text-texto shadow-sm' : 'text-texto-fraco hover:text-texto'}`}>
        Ofertas de bio
        {typeof ofertasAbertas === 'number' && ofertasAbertas > 0 && <span className="ml-1.5 rounded-full bg-acento/10 px-1.5 py-0.5 text-[10px] text-acento">{ofertasAbertas}</span>}
      </Link>
    </nav>
  )
}
