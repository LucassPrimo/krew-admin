import { Globe, Link2, MousePointerClick, Send, Share2, Sparkles, Store } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import { PLATFORM_BY_ID, type PlatformId } from '@/components/bio/platforms'
import { CartaoPainel, PainelVazio } from '@/components/bio/analytics/painel-ui'

/**
 * Ranking de cliques por alvo.
 *
 * Mostra os quatro tipos, não só os links: o clique numa rede social e no botão
 * de proposta competem pelo mesmo visitante. Um ranking que só lista links
 * responderia "qual link funciona" quando a pergunta do criador é "para onde
 * meu público vai".
 *
 * Rede social aparece pelo NOME de cada uma — Instagram, TikTok, X —, não como
 * um balde único de "redes sociais": saber que 40% dos cliques vão para o
 * Instagram é acionável, "40% foram para alguma rede" não é. O nome sai do
 * mesmo registry que desenha os ícones da página, então uma rede nova aparece
 * aqui sozinha.
 *
 * Cliques cujo link foi apagado depois aparecem sob o rótulo genérico do tipo —
 * o evento sobrevive à remoção do link (`on delete set null`), e sumir com ele
 * faria a soma do ranking não bater com o total do topo.
 *
 * O painel usa DUAS cópias deste cartão (ver `LinksClicados`): uma só com os
 * links da lista, outra com o resto (redes, proposta, rodapé). A proporção de
 * cada linha é calculada dentro do próprio cartão — misturar as duas bases
 * faria "40%" querer dizer coisas diferentes em cartões vizinhos.
 */
const ICONE: Record<string, LucideIcon> = {
  link: Link2,
  rede: Share2,
  proposta: Send,
  rodape: Sparkles,
  marca: Store,
}

export interface LinhaBotao {
  buttonId: string | null
  buttonKind: string | null
  buttonRef: string | null
  cliques: number
}

export function RankingBotoes({
  linhas,
  titulos,
  rotulos,
  icone,
  subtitulo,
  vazioTitulo,
  vazioDescricao,
}: {
  linhas: LinhaBotao[]
  /** Título do link, por id. Quem tem id e não está aqui foi apagado. */
  titulos: Record<string, string>
  rotulos: {
    titulo: string
    link: string
    rede: string
    proposta: string
    rodape: string
    marca: string
    removido: string
  }
  icone?: LucideIcon
  subtitulo?: string
  vazioTitulo: string
  vazioDescricao: string
}) {
  const total = linhas.reduce((s, l) => s + l.cliques, 0)
  const ordenadas = [...linhas].sort((a, b) => b.cliques - a.cliques)

  return (
    <CartaoPainel icone={icone} titulo={rotulos.titulo} subtitulo={subtitulo}>
      {ordenadas.length === 0 ? (
        <PainelVazio
          icone={icone ?? MousePointerClick}
          titulo={vazioTitulo}
          descricao={vazioDescricao}
        />
      ) : (
        <ul className="flex flex-col gap-2.5">
          {ordenadas.map((l, i) => {
            const tipo = l.buttonKind ?? 'link'
            const Icone = ICONE[tipo] ?? Link2
            // Ordem das perguntas: é um link cadastrado? é uma rede conhecida?
            // senão, o rótulo genérico do tipo.
            const plataforma = l.buttonRef
              ? PLATFORM_BY_ID.get(l.buttonRef as PlatformId)
              : undefined
            const nome = l.buttonId
              ? (titulos[l.buttonId] ?? rotulos.removido)
              : (plataforma?.label ??
                 l.buttonRef ??
                 rotulos[tipo as 'link' | 'rede' | 'proposta' | 'rodape' | 'marca'] ??
                 tipo)
            const proporcao = total > 0 ? (l.cliques / total) * 100 : 0

            return (
              <li key={`${l.buttonId ?? l.buttonRef ?? tipo}-${i}`} className="flex items-center gap-3">
                <Icone className="size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm text-foreground">{nome}</span>
                    <span className="shrink-0 text-xs tabular-figures text-muted-foreground">
                      {l.cliques} · {Math.round(proporcao)}%
                    </span>
                  </div>
                  {/* Barra de proporção: com 3 linhas o número basta, com 15 o
                      olho precisa de algo para comparar sem ler. */}
                  <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-secondary">
                    <div className="h-full rounded-full bg-mint" style={{ width: `${proporcao}%` }} />
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </CartaoPainel>
  )
}

/**
 * Os dois cartões de cliques, lado a lado: os links da lista de um lado, tudo
 * que não é link do outro (redes, botão de proposta, rodapé).
 *
 * Separados porque respondem perguntas diferentes: "qual link da minha lista
 * funciona" é uma decisão de conteúdo, "o público clica na minha lista ou vai
 * embora pelas redes" é uma decisão de estrutura da página.
 */
export function LinksClicados({
  linhas,
  titulos,
  rotulos,
}: {
  linhas: LinhaBotao[]
  titulos: Record<string, string>
  rotulos: {
    link: string
    rede: string
    proposta: string
    rodape: string
    marca: string
    removido: string
    tituloLinks: string
    subtituloLinks: string
    vazioLinksTitulo: string
    vazioLinksDesc: string
    tituloOutros: string
    subtituloOutros: string
    vazioOutrosTitulo: string
    vazioOutrosDesc: string
  }
}) {
  const daLista = linhas.filter((l) => (l.buttonKind ?? 'link') === 'link')
  const outros = linhas.filter((l) => (l.buttonKind ?? 'link') !== 'link')

  const comuns = {
    link: rotulos.link,
    rede: rotulos.rede,
    proposta: rotulos.proposta,
    rodape: rotulos.rodape,
    marca: rotulos.marca,
    removido: rotulos.removido,
  }

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <RankingBotoes
        linhas={daLista}
        titulos={titulos}
        icone={Globe}
        subtitulo={rotulos.subtituloLinks}
        rotulos={{ ...comuns, titulo: rotulos.tituloLinks }}
        vazioTitulo={rotulos.vazioLinksTitulo}
        vazioDescricao={rotulos.vazioLinksDesc}
      />
      <RankingBotoes
        linhas={outros}
        titulos={titulos}
        icone={MousePointerClick}
        subtitulo={rotulos.subtituloOutros}
        rotulos={{ ...comuns, titulo: rotulos.tituloOutros }}
        vazioTitulo={rotulos.vazioOutrosTitulo}
        vazioDescricao={rotulos.vazioOutrosDesc}
      />
    </div>
  )
}
