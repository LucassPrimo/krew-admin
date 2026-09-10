'use client'

import { RefreshCw } from 'lucide-react'

import {
  ChipVariacao,
  SeloAoVivo,
  useBorrado,
  variacao,
} from '@/components/bio/analytics/painel-ui'
import type { ComparacaoBio } from '@/app/actions/bio-analytics'

/**
 * O cartão de topo: um número grande e três de apoio.
 *
 * Acessos ao perfil ganha o corpo maior porque é o número do qual todos os
 * outros derivam — clique sem acesso não existe, e taxa de engajamento é a
 * razão entre os dois. Os três de apoio ficam na mesma linha, menores, para
 * dizer visualmente que são desdobramentos e não quatro métricas concorrentes.
 */
/** O que aparece no lugar do número para quem não assina. */
const MASCARA = '00'

export function HeroPerformance({
  dados,
  intervalo,
  textos,
  aoAtualizar,
}: {
  dados: ComparacaoBio
  intervalo: string
  textos: {
    eyebrow: string
    titulo: string
    subtitulo: string
    aoVivo: string
    atualizar: string
    acessos: string
    cliques: string
    interacoes: string
    engajamento: string
    vsAnterior: string
  }
  aoAtualizar: () => void
}) {
  // Do contexto, e não de uma prop: o cartão do topo é só mais um pedaço do
  // painel borrado, e a página já diz uma vez quem está sem plano.
  //
  // Os números viram `00` de verdade, não um `0` desfocado: o servidor já
  // manda zeros para o Free (ver `semAcessoPago`), e mostrar o zero cru daria
  // a impressão de que a bio não teve visita nenhuma — que é outra mensagem,
  // e falsa.
  const borrado = useBorrado()

  const { atual, anterior } = dados

  const taxa = (t: { views: number; cliques: number }) =>
    t.views > 0 ? (t.cliques / t.views) * 100 : 0

  const apoio = [
    {
      rotulo: textos.cliques,
      valor: atual.cliques,
      delta: variacao(atual.cliques, anterior.cliques),
    },
    { rotulo: textos.interacoes, valor: atual.total, delta: variacao(atual.total, anterior.total) },
    {
      rotulo: textos.engajamento,
      valor: `${taxa(atual).toFixed(0)}%`,
      delta: variacao(taxa(atual), taxa(anterior)),
    },
  ]

  return (
    <section className="relative overflow-hidden rounded-3xl border border-border bg-card p-6 shadow-card md:p-8">
      {/* O brilho mint no canto é decoração — `aria-hidden` e sem interação,
          para não virar um alvo de toque invisível sobre o botão de atualizar. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-mint/20 blur-3xl"
      />

      <div className="relative flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {textos.eyebrow}
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            {textos.titulo}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{textos.subtitulo}</p>
        </div>

        <div className="flex items-center gap-2">
          <SeloAoVivo rotulo={textos.aoVivo} />
          <button
            type="button"
            onClick={aoAtualizar}
            className="inline-flex items-center gap-1.5 rounded-pill border border-border px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-muted"
          >
            <RefreshCw className="size-3.5" aria-hidden />
            {textos.atualizar}
          </button>
        </div>
      </div>

      <div className="relative mt-8 flex flex-wrap items-end gap-x-10 gap-y-6">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {textos.acessos}
          </p>
          {/* O blur vai no BLOCO, não só no número: a variação ao lado ("+18%")
              é o mesmo dado dito de outro jeito, e borrar um e deixar o outro
              legível entregaria de graça o que o plano cobra. O rótulo acima
              fica de fora — ele diz o que existe, não quanto. */}
          <div className={`mt-1 flex items-center gap-2 ${borrado ? 'blur-sm select-none' : ''}`}>
            <span className="text-5xl font-bold tabular-figures leading-none text-foreground">
              {borrado ? MASCARA : atual.views.toLocaleString('pt-BR')}
            </span>
            <ChipVariacao valor={variacao(atual.views, anterior.views)} />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {intervalo} · {textos.vsAnterior}
          </p>
        </div>

        {/* A régua separa o número principal dos desdobramentos. Some no
            celular, onde os blocos já empilham e a linha vertical cortaria o
            fluxo em vez de organizá-lo. */}
        <div aria-hidden className="hidden h-16 w-px self-center bg-border md:block" />

        <div className="flex flex-wrap gap-x-10 gap-y-5">
          {apoio.map((m) => (
            <div key={m.rotulo}>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {m.rotulo}
              </p>
              <div
                className={`mt-1 flex items-center gap-2 ${borrado ? 'blur-sm select-none' : ''}`}
              >
                <span className="text-2xl font-bold tabular-figures text-foreground">
                  {borrado
                    ? MASCARA
                    : typeof m.valor === 'number'
                      ? m.valor.toLocaleString('pt-BR')
                      : m.valor}
                </span>
                <ChipVariacao valor={m.delta} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
