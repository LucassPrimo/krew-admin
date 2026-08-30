/**
 * Importador de perfis do Linktree (`linktr.ee/fulano`).
 *
 * Irmão do `importar-linkme.ts`, e com a MESMA saída (`PerfilLinkme`): quem
 * consome — a tela de nova oferta, `criarOferta`, `trazerImagem` — não precisa
 * saber de onde o perfil veio. O que muda é só de onde o dado é lido.
 *
 * ---------------------------------------------------------------------------
 * Aqui não se raspa HTML
 * ---------------------------------------------------------------------------
 * O link.me obriga a ler âncora por âncora porque a página não expõe os dados.
 * O Linktree é um app Next.js e serve o estado inteiro da página dentro de
 * `<script id="__NEXT_DATA__" type="application/json">` — o MESMO objeto que o
 * React usa para desenhar os botões. Então lemos JSON, e não classe de CSS.
 *
 * A diferença prática é grande: o que quebra a raspagem do link.me é uma
 * mudança de layout (frequente e invisível); o que quebraria esta aqui é uma
 * mudança de FORMA DO DADO (rara, e que também quebraria a página deles).
 * Ainda assim continua sendo extração de página alheia, sem contrato — por
 * isso a saída também traz `avisos`, e o resultado segue sendo SUGESTÃO.
 *
 * ---------------------------------------------------------------------------
 * O que fica de fora, de propósito
 * ---------------------------------------------------------------------------
 * - **Os ícones dos botões** (`thumbnail`). Quase todo botão do Linktree traz
 *   um SVG genérico de `assets.production.linktr.ee` (um ícone de loja, uma
 *   lâmpada, o logo do WhatsApp). Isso não é arte do criador: virar `capa_url`
 *   faria um perfil inteiro nascer como coluna de banners com clip-art. Só a
 *   imagem hospedada em `ugc.` (o bucket de upload do usuário) é tratada como
 *   capa — é a única que a pessoa realmente escolheu.
 * - **`metadata.image`.** É a og:image raspada pelo Linktree do site de
 *   destino, o equivalente do nosso `preview_url` — e não capa própria. Quem
 *   gera preview aqui é o `lib/link-preview.ts`, sobre a URL final.
 */

import type { EstiloItem } from './bio/tipos'
import {
  handleDaUrl,
  plataformaDaUrl,
  type LinkImportado,
  type PerfilLinkme,
  type Plataforma,
  type RedeImportada,
} from './importar-linkme'

/**
 * O recorte do `__NEXT_DATA__` que a gente usa.
 *
 * Tudo opcional porque nada disso é contrato: o objeto vem com mais de cem
 * campos e qualquer um pode sumir numa quinta-feira. O tipo descreve o que
 * esperamos encontrar, não o que o Linktree promete entregar.
 */
type LinkDoLinktree = {
  type?: string
  title?: string | null
  url?: string | null
  position?: number
  thumbnail?: string | null
  layoutOption?: string | null
  parent?: { id?: number | string | null } | null
  modifiers?: { thumbnailUrl?: string | null; layoutOption?: string | null } | null
}

type NextDataLinktree = {
  props?: {
    pageProps?: {
      username?: string | null
      links?: LinkDoLinktree[]
      pinnedLinks?: LinkDoLinktree[]
      account?: {
        username?: string | null
        pageTitle?: string | null
        description?: string | null
        customAvatar?: string | null
        profilePictureUrl?: string | null
        socialLinks?: { type?: string; url?: string; position?: number }[]
        links?: LinkDoLinktree[]
      } | null
    }
  }
}

/**
 * A arte só conta como capa quando é upload do criador.
 *
 * `ugc` = user generated content, o bucket de quem edita o perfil.
 * `assets.production.linktr.ee` é a biblioteca de ícones do produto deles —
 * ver a nota do cabeçalho sobre por que ela não vira capa.
 */
function capaDoLink(link: LinkDoLinktree): string | null {
  const bruta = link.thumbnail ?? link.modifiers?.thumbnailUrl ?? null
  if (!bruta) return null
  try {
    const u = new URL(bruta)
    if (!/^ugc\.[a-z0-9.-]*linktr\.ee$/i.test(u.hostname)) return null
    // SVG não passa pelo `trazerImagem` (o bucket só aceita jpeg/png/webp), e
    // apontar para uma imagem que nunca vai ser copiada é card quebrado.
    if (/\.svg(\?|$)/i.test(u.pathname)) return null
    return bruta
  } catch {
    return null
  }
}

/**
 * O formato do card, a partir do `layoutOption` do Linktree.
 *
 * Os valores devolvidos são os do PRODUTO (`EstiloItem`, do CHECK de
 * `creator_links`) — a mesma regra que o importador do link.me aprendeu na
 * marra: nome inventado deste lado vira erro de constraint no insert.
 *
 * `stack` é o botão empilhado padrão do Linktree, que é exatamente o nosso
 * `botao` quando não há arte; com arte do criador ele vira card grande, que é
 * como a página já desenha link com capa.
 */
function estiloDoLayout(layout: string | null | undefined, temCapa: boolean): EstiloItem {
  const l = (layout ?? '').toLowerCase()
  if (l === 'grid') return 'metade'
  if (l === 'feature' || l === 'featured' || l === 'hero') return 'grande'
  return temCapa ? 'grande' : 'botao'
}

/**
 * A ordem em que os botões saem.
 *
 * `position` é relativa ao PAI, não à página: os três filhos de um grupo vêm
 * como 0, 1, 2 enquanto os botões de primeiro nível estão em 10, 11, 14… Uma
 * ordenação global por `position` jogaria os filhos para o topo, longe do
 * grupo a que pertencem. Então: primeiro nível na ordem dele, e cada grupo
 * logo em seguida, com os filhos na ordem interna — que é como a página do
 * Linktree os desenha.
 */
function ordenar(links: LinkDoLinktree[]): LinkDoLinktree[] {
  const pai = (l: LinkDoLinktree) => String(l.parent?.id ?? '')
  const soltos = links.filter((l) => !pai(l))
  const agrupados = links.filter((l) => pai(l))

  const porPosicao = (a: LinkDoLinktree, b: LinkDoLinktree) =>
    (a.position ?? 0) - (b.position ?? 0)

  const grupos = new Map<string, LinkDoLinktree[]>()
  for (const l of agrupados) {
    const chave = pai(l)
    const lista = grupos.get(chave) ?? []
    lista.push(l)
    grupos.set(chave, lista)
  }

  return [
    ...soltos.sort(porPosicao),
    ...[...grupos.values()].flatMap((g) => g.sort(porPosicao)),
  ]
}

/**
 * Extração pura: recebe o HTML da página, devolve o perfil.
 *
 * Separada da rede pelo mesmo motivo do outro importador — é esta parte que
 * precisa de teste de regressão, e ela não deve depender do Linktree estar no
 * ar para ser exercitada.
 */
export function extrairDeHtmlLinktree(doc: string): PerfilLinkme {
  const avisos: string[] = []
  const vazio: PerfilLinkme = {
    handle: null, nome: null, bio: null, avatarUrl: null, redes: [], links: [], avisos,
  }

  const bloco = doc.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i)
  if (!bloco) {
    avisos.push('A página não trouxe o bloco de dados do Linktree — nada pôde ser importado.')
    return vazio
  }

  let dados: NextDataLinktree
  try {
    dados = JSON.parse(bloco[1]) as NextDataLinktree
  } catch {
    avisos.push('O bloco de dados da página existe mas não é JSON válido.')
    return vazio
  }

  const pp = dados.props?.pageProps ?? {}
  const conta = pp.account ?? {}

  const handle = conta.username ?? pp.username ?? null
  const nome = (conta.pageTitle ?? '').trim() || handle
  const bio = (conta.description ?? '').trim() || null
  const avatarUrl = conta.customAvatar ?? conta.profilePictureUrl ?? null

  if (!handle) {
    avisos.push('A página abriu, mas não trouxe a conta do perfil.')
    return { ...vazio, nome, bio, avatarUrl }
  }

  /**
   * Redes: as URLs, e não os rótulos `type` do Linktree.
   *
   * Eles têm um vocabulário próprio (`FACEBOOK`, `YOUTUBE`, `EMAIL`…) e
   * traduzi-lo aqui seria uma SEGUNDA tabela de plataformas para manter, que
   * envelheceria em silêncio a cada rede nova do catálogo. `plataformaDaUrl`
   * já sabe o que o app modela, e é a mesma resposta que o link.me recebe.
   */
  const redes: RedeImportada[] = []
  const jaTem = new Set<Plataforma>()
  const naoModeladas: { url: string }[] = []

  for (const social of conta.socialLinks ?? []) {
    const url = social.url ?? ''
    if (!url) continue
    const plataforma = plataformaDaUrl(url)
    if (!plataforma) {
      // `mailto:`/`tel:` caem aqui, e é onde eles devem ficar: viram botão,
      // que é como a página desenha contato que não é rede.
      naoModeladas.push({ url })
      continue
    }
    if (jaTem.has(plataforma)) continue
    jaTem.add(plataforma)
    redes.push({ plataforma, handle: handleDaUrl(url), url })
  }

  const brutos = (pp.links?.length ? pp.links : conta.links) ?? []
  const links: LinkImportado[] = []
  const vistos = new Set<string>()

  for (const l of ordenar(brutos)) {
    const titulo = (l.title ?? '').trim()
    const url = (l.url ?? '').trim()

    // Cabeçalho de seção do Linktree: título sem endereço. É o nosso divisor,
    // e mora na mesma lista porque é a POSIÇÃO dele entre os botões que diz
    // onde a seção começa.
    if ((l.type ?? '').toUpperCase() === 'HEADER' || !url) {
      if (!titulo) continue
      links.push({ tipo: 'divisor', titulo, url: null, capaUrl: null, estilo: 'grande' })
      continue
    }

    if (vistos.has(url)) continue
    vistos.add(url)

    const capaUrl = capaDoLink(l)
    let rotulo = titulo
    if (!rotulo) {
      try {
        rotulo = new URL(url).hostname.replace(/^www\./, '')
      } catch {
        rotulo = 'Link'
      }
    }

    links.push({
      tipo: 'link',
      titulo: rotulo,
      url,
      capaUrl,
      estilo: estiloDoLayout(l.layoutOption ?? l.modifiers?.layoutOption, Boolean(capaUrl)),
    })
  }

  for (const { url } of naoModeladas) {
    if (vistos.has(url)) continue
    vistos.add(url)
    let nomeDoServico = 'Link'
    try {
      nomeDoServico = new URL(url).hostname.replace(/^www\./, '') || url
    } catch { /* mailto: e afins não têm hostname; fica o rótulo genérico */ }
    links.push({ tipo: 'link', titulo: nomeDoServico, url, capaUrl: null, estilo: 'botao' })
  }

  if (!links.some((l) => l.tipo === 'link')) {
    avisos.push(
      'Nenhum botão foi encontrado. Ou o perfil não tem nenhum, ou o formato ' +
        'dos dados do Linktree mudou e a extração precisa ser revista.',
    )
  }

  return { handle, nome, bio, avatarUrl, redes, links, avisos }
}

/** Só o Linktree. Mesmo motivo de SSRF do outro importador. */
const HOSTS_PERMITIDOS = /^([a-z0-9-]+\.)?(linktr\.ee|linktree\.com)$/i

export function normalizarUrlLinktree(entrada: string): string | null {
  const texto = entrada.trim()
  try {
    const u = new URL(texto.startsWith('http') ? texto : `https://${texto}`)
    if (!HOSTS_PERMITIDOS.test(u.hostname)) return null
    // `linktree.com` é o site institucional; os perfis moram em `linktr.ee`.
    // Normalizar evita ir buscar página de marketing achando que é perfil.
    const caminho = u.pathname.split('/').filter(Boolean)
    if (caminho.length !== 1) return null
    return `https://linktr.ee/${caminho[0]}`
  } catch {
    return null
  }
}

/** Busca a página e extrai. Ver a nota sobre SSRF em `importar-linkme`. */
export async function buscarPerfilLinktree(
  entrada: string,
): Promise<{ ok: true; perfil: PerfilLinkme; url: string } | { ok: false; erro: string }> {
  const url = normalizarUrlLinktree(entrada)
  if (!url) return { ok: false, erro: 'Informe uma URL de perfil do linktr.ee.' }

  try {
    const resposta = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
        'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(20_000),
      cache: 'no-store',
    })

    if (resposta.status === 404) {
      return { ok: false, erro: 'Esse perfil não existe no Linktree.' }
    }
    if (!resposta.ok) {
      return { ok: false, erro: `O Linktree respondeu ${resposta.status}.` }
    }

    const perfil = extrairDeHtmlLinktree(await resposta.text())
    if (!perfil.handle) {
      return { ok: false, erro: 'A página abriu mas não parece um perfil do Linktree.' }
    }

    return { ok: true, perfil, url }
  } catch (e) {
    const erro = e instanceof Error && e.name === 'TimeoutError'
      ? 'O Linktree demorou demais para responder.'
      : 'Não consegui abrir a página do Linktree.'
    return { ok: false, erro }
  }
}
