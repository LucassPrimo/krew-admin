import { getLocale, getTranslations } from 'next-intl/server'
import { intervaloDoPeriodo, type Periodo } from '@/lib/bio/periodo'
import { ExportarPdf } from '@/components/bio/analytics/exportar-pdf'
import { PainelAnalytics } from '@/components/bio/analytics/painel-analytics'

/** Mesma apresentação do /analytics do krew-app, sem bloqueio por plano. */
export async function AnalyticsAdmin({ creator, periodo, mostrarTodasCidades }: { creator: { id: string; org_id: string; user_id: string }, periodo: Periodo, mostrarTodasCidades?: boolean }) {
  const [t, locale] = await Promise.all([getTranslations('bioAnalytics'), getLocale()])
  const geoLigado = true
  const { desde, ate } = intervaloDoPeriodo(periodo)
  const fmt = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' })
  const intervalo = periodo === 'hoje' ? fmt.format(ate) : `${fmt.format(desde)} – ${fmt.format(ate)}`
  const carregando = {
    carregandoTitulo: t('carregandoTitulo'),
    carregandoDescricao: t('carregandoDescricao'),
    tentarNovamente: t('tentarNovamente'),
  }
  // Os textos de geo eram duplicados literalmente nas duas variantes da tela
  // (Free e PRO). Montados uma vez, é impossível ajustar um e esquecer o
  // outro — que é exatamente o que a duplicação estava esperando para fazer.
  const geo = {
    porCidade: t('porCidade'),
    mapa: t('mapa'),
    avisoGeo: t('avisoGeo'),
    mapaVazio: t('mapaVazio'),
    mapaMenos: t('mapaMenos'),
    mapaMais: t('mapaMais'),
    acessos: t('acessos'),
    paisDesconhecido: t('paisDesconhecido'),
    creditoMapa: t('creditoMapa'),
    // `t.raw` porque o `{n}` é preenchido no cliente, quando o número de
    // eventos suprimidos/sem geo já está na tela.
    suprimidos: t.raw('suprimidos') as string,
    semGeo: t.raw('semGeo') as string,
    porOperadora: t('porOperadora'),
    notaOperadora: t('notaOperadora'),
    semDados: t('semDados'),
  }
  return (
    <div className="analytics-krew py-5 md:py-8">
      <div className="mb-4 flex justify-end"><ExportarPdf pageId={creator.id} /></div>
      <PainelAnalytics
        orgId={creator.org_id}
        userId={creator.user_id}
        periodo={periodo}
        intervalo={intervalo}
        geoLigado={geoLigado}
        locale={locale}
        mostrarTodasCidades={mostrarTodasCidades}
        textos={{
          rodapeNota: t('notaPrimeiraParte'),

          topo: {
            eyebrow: t('eyebrow'),
            titulo: t('titulo'),
            subtitulo: t('subtitulo'),
            aoVivo: t('aoVivo'),
            atualizar: t('atualizar'),
            acessos: t('acessos'),
            cliques: t('cliques'),
            interacoes: t('interacoes'),
            engajamento: t('engajamento'),
            vsAnterior: t('vsAnterior'),
            visaoGeral: t('visaoGeral'),
            periodoHoje: t('periodoHoje'),
            periodo7d: t('periodo7d'),
            periodo30d: t('periodo30d'),
            ...carregando,
          },

          tempoReal: {
            titulo: t('tempoRealTitulo'),
            subtitulo: t('tempoRealSubtitulo'),
            aoVivo: t('aoVivo'),
            visitas: t('visitas'),
            cliques: t('cliques'),
            atividade: t('atividade'),
            porMinuto: t('porMinuto'),
            legendaVisitas: t('visitas'),
            legendaCliques: t('cliques'),
            fontes: t('fontesAoVivo'),
            fontesVazioTitulo: t('fontesAoVivoVazioTitulo'),
            fontesVazioDesc: t('fontesAoVivoVazioDesc'),
            origemDireta: t('origemDireta'),
          },

          comparacao: {
            titulo: t('comparacaoTitulo'),
            subtitulo: t('comparacaoSubtitulo'),
            visitas: t('visitas'),
            cliques: t('cliques'),
            atividade: t('atividade'),
            anteriorPrefixo: t('anteriorPrefixo'),
            visaoGeral: t('visaoGeralComparacao'),
            distribuicao: t('distribuicao'),
            padraoHorario: t('padraoHorario'),
            periodoAtual: t('periodoAtual'),
            periodoAnterior: t('periodoAnterior'),
            diasAtivos: t('diasAtivos'),
            mediaDiaria: t('mediaDiaria'),
            crescimento: t('crescimento'),
          },

          leve: {
            porDia: t('visaoTrafego'),
            intervalo,
            acessos: t('acessos'),
            cliques: t('cliques'),
            semDados: t('semDados'),
            alvoLink: t('alvoLink'),
            alvoRede: t('alvoRede'),
            alvoProposta: t('alvoProposta'),
            alvoRodape: t('alvoRodape'),
            alvoMarca: t('alvoMarca'),
            linkRemovido: t('linkRemovido'),
            tituloLinks: t('topLinks'),
            subtituloLinks: t('topLinksDesc'),
            vazioLinksTitulo: t('topLinksVazioTitulo'),
            vazioLinksDesc: t('topLinksVazioDesc'),
            tituloOutros: t('outrosLinks'),
            subtituloOutros: t('outrosLinksDesc'),
            vazioOutrosTitulo: t('outrosLinksVazioTitulo'),
            vazioOutrosDesc: t('outrosLinksVazioDesc'),
            porDispositivo: t('porDispositivo'),
            fontesTrafego: t('fontesTrafego'),
            fontesVazioTitulo: t('fontesVazioTitulo'),
            fontesVazioDesc: t('fontesVazioDesc'),
            visitas: t('visitas'),
            origemDireta: t('origemDireta'),
            // Um Client Component não pode chamar `t()` com chave dinâmica —
            // resolve as quatro aqui, ainda no servidor.
            dispositivoLabels: {
              mobile: t('dispositivo.mobile'),
              desktop: t('dispositivo.desktop'),
              tablet: t('dispositivo.tablet'),
              desconhecido: t('dispositivo.desconhecido'),
            },
          },

          geo: geo,
        }}
      />    </div>
  )
}
