'use client'

import { PieChart } from 'lucide-react'

import type { LeveBio } from '@/app/actions/bio-analytics'
import { agruparFontes } from '@/lib/analytics/fontes'
import { VisaoTrafego } from '@/components/bio/analytics/visao-trafego'
import { LinksClicados } from '@/components/bio/analytics/ranking-botoes'
import { Distribuicao } from '@/components/bio/analytics/distribuicao'
import { Rosca } from '@/components/bio/analytics/rosca'
import { CartaoPainel, PainelVazio } from '@/components/bio/analytics/painel-ui'

interface LeveTextos {
  porDia: string
  intervalo: string
  acessos: string
  cliques: string
  semDados: string
  alvoLink: string
  alvoRede: string
  alvoProposta: string
  alvoRodape: string
  alvoMarca: string
  linkRemovido: string
  tituloLinks: string
  subtituloLinks: string
  vazioLinksTitulo: string
  vazioLinksDesc: string
  tituloOutros: string
  subtituloOutros: string
  vazioOutrosTitulo: string
  vazioOutrosDesc: string
  porDispositivo: string
  fontesTrafego: string
  fontesVazioTitulo: string
  fontesVazioDesc: string
  visitas: string
  origemDireta: string
  /** `{mobile, desktop, tablet, desconhecido}` — resolvidos no servidor
   *  porque um Client Component não pode chamar `t()` com chave dinâmica. */
  dispositivoLabels: Record<string, string>
}

/**
 * O miolo do painel: a curva do período, de onde veio o tráfego e em que se
 * clicou.
 *
 * Os quatro recortes (`porDia`, `porBotao`, `porDispositivo`, `porReferrer`)
 * chegam prontos de `PainelAnalytics` — o RPC devolve todos de uma vez, e a
 * mesma `porDia` que desenha o gráfico daqui desenha os sparklines dos
 * cartões lá em cima.
 *
 * `titulos` (id do link -> nome) vinha de uma chamada à parte (`getLinksBio`);
 * agora vem na mesma resposta, porque é um lookup, não uma consulta.
 */
export function LeveSection({
  dados: leve,
  titulos,
  textos,
}: {
  dados: LeveBio
  titulos: Record<string, string>
  textos: LeveTextos
}) {
  const totalVisitas = leve.porReferrer.reduce((s, r) => s + r.eventos, 0)

  const fontes = agruparFontes(leve.porReferrer).map((r) => ({
    rotulo: r.referrer === 'direto' ? textos.origemDireta : r.referrer,
    valor: r.eventos,
  }))

  return (
    <>
      <div className="grid gap-3 lg:grid-cols-2">
        <CartaoPainel
          icone={PieChart}
          titulo={textos.fontesTrafego}
          subtitulo={textos.intervalo}
          acao={
            <div className="text-right">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {textos.visitas}
              </p>
              <p className="text-sm font-bold tabular-figures text-foreground">{totalVisitas}</p>
            </div>
          }
        >
          {fontes.length === 0 ? (
            <PainelVazio
              icone={PieChart}
              titulo={textos.fontesVazioTitulo}
              descricao={textos.fontesVazioDesc}
            />
          ) : (
            <Rosca itens={fontes} />
          )}
        </CartaoPainel>

        <Distribuicao
          titulo={textos.porDispositivo}
          vazio={textos.semDados}
          itens={Object.entries(leve.porDispositivo).map(([k, v]) => ({
            rotulo: textos.dispositivoLabels[k] ?? textos.dispositivoLabels.desconhecido,
            valor: v,
          }))}
        />
      </div>

      <VisaoTrafego
        dados={leve.porDia}
        textos={{
          titulo: textos.porDia,
          intervalo: textos.intervalo,
          acessos: textos.acessos,
          cliques: textos.cliques,
          vazio: textos.semDados,
        }}
      />

      <LinksClicados
        linhas={leve.porBotao}
        titulos={titulos}
        rotulos={{
          link: textos.alvoLink,
          rede: textos.alvoRede,
          proposta: textos.alvoProposta,
          rodape: textos.alvoRodape,
          marca: textos.alvoMarca,
          removido: textos.linkRemovido,
          tituloLinks: textos.tituloLinks,
          subtituloLinks: textos.subtituloLinks,
          vazioLinksTitulo: textos.vazioLinksTitulo,
          vazioLinksDesc: textos.vazioLinksDesc,
          tituloOutros: textos.tituloOutros,
          subtituloOutros: textos.subtituloOutros,
          vazioOutrosTitulo: textos.vazioOutrosTitulo,
          vazioOutrosDesc: textos.vazioOutrosDesc,
        }}
      />
    </>
  )
}
