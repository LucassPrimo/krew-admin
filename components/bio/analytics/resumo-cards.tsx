import { Eye, MousePointerClick, Percent, Users } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

/**
 * Os quatro números do topo.
 *
 * CTR aparece porque é o único que já é uma CONCLUSÃO: acesso e clique
 * separados dizem volume, a razão entre eles diz se a página está fazendo o
 * trabalho dela. Sem acesso nenhum ele é `—`, não `0%` — dividir por zero e
 * mostrar zero afirmaria um desempenho ruim onde não houve medição.
 */
export function ResumoCards({
  pageViews,
  visitantes,
  cliques,
  rotulos,
}: {
  pageViews: number
  visitantes: number
  cliques: number
  rotulos: { acessos: string; visitantes: string; cliques: string; ctr: string }
}) {
  const ctr = pageViews > 0 ? `${Math.round((cliques / pageViews) * 100)}%` : '—'

  const itens: { icone: LucideIcon; rotulo: string; valor: string }[] = [
    { icone: Eye, rotulo: rotulos.acessos, valor: pageViews.toLocaleString('pt-BR') },
    { icone: Users, rotulo: rotulos.visitantes, valor: visitantes.toLocaleString('pt-BR') },
    { icone: MousePointerClick, rotulo: rotulos.cliques, valor: cliques.toLocaleString('pt-BR') },
    { icone: Percent, rotulo: rotulos.ctr, valor: ctr },
  ]

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {itens.map((i) => (
        <div key={i.rotulo} className="bg-card rounded-2xl p-4 shadow-card">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <i.icone className="size-3.5" />
            <span className="text-xs">{i.rotulo}</span>
          </div>
          <p className="mt-1 text-2xl font-bold tabular-figures text-foreground">{i.valor}</p>
        </div>
      ))}
    </div>
  )
}
