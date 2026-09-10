'use client'

import { CidadesAnalytics } from '@/components/bio/analytics/cidades'
import { Globe, Info } from 'lucide-react'

import type { GeoBio } from '@/app/actions/bio-analytics'
import { Distribuicao } from '@/components/bio/analytics/distribuicao'
import { CartaoPainel } from '@/components/bio/analytics/painel-ui'
import { MapaCarregador } from '@/components/bio/analytics/mapa-carregador'

interface GeoTextos {
  porCidade: string
  mapa: string
  avisoGeo: string
  mapaVazio: string
  mapaMenos: string
  mapaMais: string
  /** Reaproveita a chave do topo do painel — é o mesmo "Acessos". */
  acessos: string
  paisDesconhecido: string
  creditoMapa: string
  /** Template cru com `{n}` — ver `t.raw` na página. */
  suprimidos: string
  semGeo: string
  porOperadora: string
  notaOperadora: string
  semDados: string
}

function preencher(template: string, n: number): string {
  return template.replace('{n}', n.toLocaleString('pt-BR'))
}

/**
 * Cidade, mapa por país e operadora.
 *
 * A parte mais cara da leitura — e por isso `PainelAnalytics` só a pede
 * quando a geolocalização está ligada (`p_geo` no RPC). Sem ela, esses
 * agregados nem são calculados no banco.
 */
export function GeoSection({
  dados: geo,
  locale,
  textos,
  mostrarTodasCidades,
}: {
  dados: GeoBio
  locale: string
  textos: GeoTextos
  mostrarTodasCidades?: boolean
}) {
  const vazio = textos.semDados

  return (
    <>
      <CidadesAnalytics dados={geo} locale={locale} titulo={textos.porCidade} acessos={textos.acessos} vazio={vazio} />

      <CartaoPainel icone={Globe} titulo={textos.mapa}>
        <p className="-mt-2 mb-3 flex items-start gap-1.5 text-xs text-muted-foreground">
          <Info className="mt-px size-3.5 shrink-0" />
          {textos.avisoGeo}
        </p>

        {geo.porPais.length > 0 ? (
          <MapaCarregador
            paises={geo.porPais}
            locale={locale}
            textos={{
              menos: textos.mapaMenos,
              mais: textos.mapaMais,
              acessos: textos.acessos,
              paisDesconhecido: textos.paisDesconhecido,
              credito: textos.creditoMapa,
            }}
            mostrarTodasCidades={mostrarTodasCidades}
          />
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">{textos.mapaVazio}</p>
        )}

        {geo.semGeo > 0 && (
          <p className="mt-3 text-xs text-muted-foreground">
            {preencher(textos.semGeo, geo.semGeo)}
          </p>
        )}
      </CartaoPainel>

      <Distribuicao
        titulo={textos.porOperadora}
        nota={textos.notaOperadora}
        vazio={vazio}
        itens={geo.porIsp.map((i) => ({ rotulo: i.isp, valor: i.eventos }))}
      />
    </>
  )
}
