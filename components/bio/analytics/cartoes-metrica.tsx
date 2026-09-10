'use client'

import { Activity, Globe, MousePointerClick, Users } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Area, AreaChart, ResponsiveContainer } from 'recharts'

import { ChipVariacao, useBorrado, variacao } from '@/components/bio/analytics/painel-ui'
import type { ComparacaoBio } from '@/app/actions/bio-analytics'

/**
 * Os quatro números do período, um cartão cada.
 *
 * Repetem o que o cartão de topo já mostra — de propósito: o topo é o resumo
 * que se lê de passagem, estes são a âncora da seção "Visão geral", onde o
 * seletor de período fica. Sem eles, mudar o período não teria efeito visível
 * perto do próprio controle.
 *
 * A minifaixa (`Area`) só aparece no cartão que tem série: um sparkline
 * chapado em zero nos outros afirmaria estabilidade onde não houve medição.
 */
export function CartoesMetrica({
  dados,
  serie,
  textos,
}: {
  dados: ComparacaoBio
  /** Série diária, para o sparkline. Vazia esconde a faixa. */
  serie: { views: number; cliques: number }[]
  textos: {
    acessos: string
    cliques: string
    interacoes: string
    engajamento: string
    vsAnterior: string
  }
}) {
  const { atual, anterior } = dados
  const taxa = (t: { views: number; cliques: number }) =>
    t.views > 0 ? (t.cliques / t.views) * 100 : 0

  const cartoes: {
    icone: LucideIcon
    rotulo: string
    valor: string
    delta: number
    faixa?: { v: number }[]
  }[] = [
    {
      icone: Users,
      rotulo: textos.acessos,
      valor: atual.views.toLocaleString('pt-BR'),
      delta: variacao(atual.views, anterior.views),
      faixa: serie.map((d) => ({ v: d.views })),
    },
    {
      icone: MousePointerClick,
      rotulo: textos.cliques,
      valor: atual.cliques.toLocaleString('pt-BR'),
      delta: variacao(atual.cliques, anterior.cliques),
      faixa: serie.map((d) => ({ v: d.cliques })),
    },
    {
      icone: Globe,
      rotulo: textos.interacoes,
      valor: atual.total.toLocaleString('pt-BR'),
      delta: variacao(atual.total, anterior.total),
      faixa: serie.map((d) => ({ v: d.views + d.cliques })),
    },
    {
      icone: Activity,
      rotulo: textos.engajamento,
      valor: `${taxa(atual).toFixed(0)}%`,
      delta: variacao(taxa(atual), taxa(anterior)),
      faixa: serie.map((d) => ({ v: d.views > 0 ? (d.cliques / d.views) * 100 : 0 })),
    },
  ]

  // Estes quatro cartões têm casca própria (não passam por `CartaoPainel`),
  // então o borrão do Free precisa ser aplicado aqui — número, variação e a
  // faixinha do fim, que também é o dado desenhado.
  const borrado = useBorrado()

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {cartoes.map((c) => (
        <div key={c.rotulo} className="bg-card flex flex-col rounded-2xl p-5 shadow-card">
          <span className="flex size-9 items-center justify-center rounded-xl bg-mint/12 text-mint">
            <c.icone className="size-4.5" aria-hidden />
          </span>

          <p className="mt-4 text-sm text-muted-foreground">{c.rotulo}</p>
          <p
            className={`mt-0.5 text-3xl font-bold tabular-figures text-foreground ${
              borrado ? 'blur-sm select-none' : ''
            }`}
          >
            {borrado ? '00' : c.valor}
          </p>

          <div
            className={`mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 ${
              borrado ? 'blur-sm select-none' : ''
            }`}
          >
            <ChipVariacao valor={c.delta} />
            <span className="text-xs text-muted-foreground">{textos.vsAnterior}</span>
          </div>

          {/* A faixa é uma FILA própria no fim do cartão, não um desenho atrás
              do texto: sobreposta, ela cruzava o rótulo "vs. período anterior"
              e vazava pelo canto arredondado. A altura fixa fica mesmo quando
              não há série — sem ela, um cartão sem dado encolheria e a linha
              de quatro ficaria desalinhada. */}
          <div aria-hidden className={`mt-auto h-10 pt-3 ${borrado ? 'blur-sm' : ''}`}>
            {c.faixa && c.faixa.length > 1 && (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={c.faixa} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
                  <Area
                    type="monotone"
                    dataKey="v"
                    stroke="var(--color-mint)"
                    strokeWidth={1.5}
                    fill="var(--color-mint)"
                    fillOpacity={0.15}
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
