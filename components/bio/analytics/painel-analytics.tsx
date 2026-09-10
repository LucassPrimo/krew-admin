'use client'

import { Info } from 'lucide-react'
import { ProvedorBorrado } from '@/components/bio/analytics/painel-ui'

import { getPainelBio, type Periodo } from '@/app/actions/bio-analytics'
import { useRetryFetch } from '@/lib/bio/use-retry-fetch'
import { useEffect } from 'react'

import { TopoSection, type TopoTextos } from '@/components/bio/analytics/topo-section'
import { TempoRealSection } from '@/components/bio/analytics/tempo-real-section'
import { ComparacaoSection } from '@/components/bio/analytics/comparacao-section'
import { LeveSection } from '@/components/bio/analytics/leve-section'
import { GeoSection } from '@/components/bio/analytics/geo-section'
import { PainelRetry } from '@/components/bio/analytics/painel-retry'

/**
 * O painel inteiro, e a ÚNICA busca que o alimenta.
 *
 * Antes, cada seção buscava a sua (`useRetryFetch` por seção) para que uma
 * lenta não segurasse as vizinhas. Só que as cinco varriam `link_bio_events`
 * pela MESMA janela, pelo mesmo índice, ao mesmo tempo — a concorrência entre
 * elas era parte da lentidão que a separação queria resolver. Pior: topo e
 * comparação chamavam a MESMA action (`getComparacaoBio`), então os mesmos
 * números chegavam à tela duas vezes, em instantes diferentes, e por um
 * segundo discordavam entre si.
 *
 * Agora é uma chamada (`getPainelBio` → `get_bio_painel`) e um estado só: ou
 * o painel está carregando, ou está inteiro na tela. As seções viraram
 * componentes de desenho — recebem `dados` e não sabem mais o que é buscar.
 *
 * A retentativa continua existindo, agora do painel inteiro: uma consulta só
 * ou dá certo ou não dá, e não há mais "metade da tela pronta" para preservar.
 * O botão "atualizar" do cartão de topo é o mesmo `tentarDeNovo`.
 */
export function PainelAnalytics({
  orgId,
  userId,
  periodo,
  intervalo,
  geoLigado,
  locale,
  textos,
  blurNumeros = false,
}: {
  orgId: string
  userId: string
  periodo: Periodo
  intervalo: string
  geoLigado: boolean
  /** Idioma do painel — o mapa resolve nome de país com `Intl.DisplayNames`. */
  locale: string
  textos: {
    topo: TopoTextos
    tempoReal: React.ComponentProps<typeof TempoRealSection>['textos']
    comparacao: React.ComponentProps<typeof ComparacaoSection>['textos']
    leve: React.ComponentProps<typeof LeveSection>['textos']
    geo: React.ComponentProps<typeof GeoSection>['textos']
    rodapeNota: string
  }
  blurNumeros?: boolean
}) {
  const [estado, tentarDeNovo] = useRetryFetch(
    () => getPainelBio(orgId, userId, periodo, geoLigado),
    [orgId, userId, periodo, geoLigado]
  )
  // No Admin, a leitura é autenticada no servidor e acompanha os eventos
  // já persistidos pelo worker do produto.
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') tentarDeNovo()
    }, 30_000)
    return () => clearInterval(timer)
  }, [tentarDeNovo])

  if (estado.status === 'carregando') {
    return (
      <div className="flex flex-col gap-3">
        <div className="bg-card h-56 animate-pulse rounded-3xl shadow-card" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-card h-40 animate-pulse rounded-2xl shadow-card" />
          ))}
        </div>
        <div className="bg-card h-96 animate-pulse rounded-2xl shadow-card" />
        <div className="bg-card h-96 animate-pulse rounded-2xl shadow-card" />
      </div>
    )
  }

  if (estado.status === 'tentando' || estado.status === 'falhou') {
    return (
      <PainelRetry
        emAutoRetry={estado.status === 'tentando'}
        titulo={textos.topo.carregandoTitulo}
        descricao={textos.topo.carregandoDescricao}
        tentarNovamente={textos.topo.tentarNovamente}
        aoTentar={tentarDeNovo}
      />
    )
  }

  const { leve, geo, comparacao, tempoReal, titulos } = estado.dados

  return (
    <ProvedorBorrado borrado={blurNumeros}>
      <div className="flex flex-col gap-3">
        <TopoSection
          dados={comparacao}
          periodo={periodo}
          intervalo={intervalo}
          // A mesma série do gráfico de tráfego desenha os sparklines dos
          // cartões: um dado, um lugar de onde ele vem.
          serie={leve.porDia}
          aoAtualizar={tentarDeNovo}
          textos={textos.topo}
        />

        {/* A ressalva sobre o que estes números são fica logo abaixo dos
          cartões, não no fim da página: é ali que alguém compara o número com
          o do Instagram e conclui que um dos dois está errado. */}
        <p className="flex items-start gap-2 px-1 text-xs text-muted-foreground">
          <Info className="mt-px size-3.5 shrink-0" aria-hidden />
          <span>{textos.rodapeNota}</span>
        </p>

        <TempoRealSection dados={tempoReal} textos={textos.tempoReal} />

        <ComparacaoSection dados={comparacao} textos={textos.comparacao} />

        <LeveSection dados={leve} titulos={titulos} textos={textos.leve} />

        {geoLigado && <GeoSection dados={geo} locale={locale} textos={textos.geo} />}
      </div>
    </ProvedorBorrado>
  )
}
