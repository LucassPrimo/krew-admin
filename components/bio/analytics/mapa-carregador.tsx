'use client'

import dynamic from 'next/dynamic'

import type { GeoBio } from '@/app/actions/bio-analytics'
import type { MapaTextos } from '@/components/bio/analytics/mapa-audiencia'

/**
 * Carrega o mapa em pedaço separado, e só quando a seção de geo aparece.
 *
 * Existia por obrigação: o Leaflet tocava `window` já no import, e renderizar
 * no servidor quebrava a página. O mapa novo é SVG e não tem esse problema —
 * a indireção fica por outro motivo, menor e ainda válido: o componente traz
 * `Intl.DisplayNames`, a rampa e a lógica de pintura, e nada disso precisa
 * viajar no JS de quem abre o painel e nunca rola até o mapa.
 *
 * `ssr: false` porque a pintura depende do DOM (o SVG entra por
 * `dangerouslySetInnerHTML` e é percorrido depois) — renderizar no servidor
 * produziria só a moldura vazia, para logo em seguida refazer tudo no cliente.
 */
const Mapa = dynamic(
  () => import('@/components/bio/analytics/mapa-audiencia').then((m) => m.MapaAudiencia),
  {
    ssr: false,
    loading: () => <div className="h-[240px] animate-pulse rounded-2xl bg-secondary" />,
  }
)

export function MapaCarregador({
  paises,
  locale,
  textos,
}: {
  paises: GeoBio['porPais']
  locale: string
  textos: MapaTextos
}) {
  return <Mapa paises={paises} locale={locale} textos={textos} />
}
