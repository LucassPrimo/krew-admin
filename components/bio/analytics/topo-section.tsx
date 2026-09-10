'use client'

import type { ComparacaoBio, Periodo } from '@/app/actions/bio-analytics'
import { HeroPerformance } from '@/components/bio/analytics/hero-performance'
import { CartoesMetrica } from '@/components/bio/analytics/cartoes-metrica'
import { SeletorPeriodo } from '@/components/bio/analytics/seletor-periodo'

export interface TopoTextos {
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
  visaoGeral: string
  periodoHoje: string
  periodo7d: string
  periodo30d: string
  /** Estado de "não deu para carregar" — o painel inteiro retenta com estes. */
  carregandoTitulo: string
  carregandoDescricao: string
  tentarNovamente: string
}

/**
 * O topo do painel: o cartão grande, a barra de período e os quatro cartões.
 *
 * Os três desenham a MESMA leitura — total do período e variação contra o
 * anterior. Não busca nada: `PainelAnalytics` faz a única chamada da tela e
 * desce `dados` daqui para baixo. Enquanto o topo tinha a própria busca, ela
 * era literalmente a mesma da seção de comparação, feita duas vezes.
 */
export function TopoSection({
  dados,
  periodo,
  intervalo,
  serie,
  aoAtualizar,
  textos,
}: {
  dados: ComparacaoBio
  periodo: Periodo
  intervalo: string
  /** Série diária vinda da seção de tráfego, para os sparklines. */
  serie: { views: number; cliques: number }[]
  /** Rebusca o painel inteiro — o "atualizar" é sobre a tela toda. */
  aoAtualizar: () => void
  textos: TopoTextos
}) {
  return (
    <div className="flex flex-col gap-3">
      <HeroPerformance
        dados={dados}
        intervalo={intervalo}
        textos={textos}
        aoAtualizar={aoAtualizar}
      />

      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <h2 className="text-base font-bold tracking-tight text-foreground">{textos.visaoGeral}</h2>
        <div className="flex items-center gap-2">
          <SeletorPeriodo
            atual={periodo}
            rotulos={{
              hoje: textos.periodoHoje,
              '7d': textos.periodo7d,
              '30d': textos.periodo30d,
            }}
          />
          <span className="rounded-pill border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground">
            {intervalo}
          </span>
        </div>
      </div>

      <CartoesMetrica dados={dados} serie={serie} textos={textos} />
    </div>
  )
}
