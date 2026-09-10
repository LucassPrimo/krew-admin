'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'

import { cn } from '@/lib/utils'
import type { Periodo } from '@/app/actions/bio-analytics'

/**
 * Janela de tempo do painel.
 *
 * São `<Link>` e não botões com estado: o período vira `?periodo=` na URL, o
 * que torna a visão compartilhável, recarregável e navegável pelo botão voltar.
 * Estado em `useState` daria a mesma tela e perderia as três coisas.
 */
export function SeletorPeriodo({
  atual,
  rotulos,
}: {
  atual: Periodo
  rotulos: Record<Periodo, string>
}) {
  const pathname = usePathname()
  const params = useSearchParams()

  return (
    <div className="flex rounded-full border border-border p-1">
      {(['hoje', '7d', '30d'] as const).map((p) => {
        const busca = new URLSearchParams(params)
        busca.set('periodo', p)
        return (
          <Link
            key={p}
            href={`${pathname}?${busca}`}
            scroll={false}
            className={cn(
              'rounded-full px-3 py-1 text-xs font-medium transition-colors',
              p === atual
                ? 'bg-mint text-white'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {rotulos[p]}
          </Link>
        )
      })}
    </div>
  )
}
