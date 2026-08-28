/**
 * Importador de perfis do link.me.
 *
 * O que ele resolve: montar uma bio de oferta a partir de uma página que o
 * criador já tem, em vez de você redigitar nome, foto, bio, redes e uma dúzia
 * de links. O resultado é SUGESTÃO — a tela de oferta preenche os campos e você
 * revisa antes de gravar. Isso não é gentileza com o usuário, é a mitigação
 * honesta do fato de que a extração de HTML é frágil por natureza.
 *
 * ---------------------------------------------------------------------------
 * De onde vem cada pedaço, e o quanto se pode confiar
 * ---------------------------------------------------------------------------
 * A página é React renderizado no servidor, sem API pública. As três fontes,
 * da mais estável para a menos:
 *
 * 1. **JSON-LD** (`<script type="application/ld+json">`) — dá handle, avatar e
 *    a lista completa de redes sociais em `sameAs`. É dado estruturado que
 *    existe para ser lido por máquina (Google usa), então é o que menos quebra.
 * 2. **Meta OpenGraph** — nome de exibição e bio. Também padronizado, mas o
 *    texto vem embrulhado em frase de marketing, que a gente descasca.
 * 3. **As âncoras dos botões** — só isto depende de classe de CSS, e é a parte
 *    que vai quebrar primeiro quando eles mudarem o layout. Por isso a extração
 *    devolve `avisos`: se os links vierem vazios enquanto o resto veio, a tela
 *    diz isso em vez de fingir que o perfil não tinha link nenhum.
 *
 * Uma armadilha já paga: a ordem dos atributos na âncora NÃO é fixa (uns perfis
 * trazem `style` antes de `href`, outros não). Um regex ancorado em `<a href="`
 * funciona num perfil e devolve zero links no seguinte — foi exatamente o que
 * aconteceu ao testar o segundo. Por isso lemos a tag inteira e procuramos os
 * atributos dentro dela.
 */

import type { EstiloItem } from '@/lib/bio/tipos'

/** Plataformas que o app conhece (espelha `PlatformId` do krew-app). */
export type Plataforma =
  | 'instagram' | 'tiktok' | 'youtube' | 'twitter' | 'twitch' | 'linkedin'
  | 'facebook' | 'spotify' | 'threads' | 'reddit' | 'snapchat'
  | 'applemusic' | 'soundcloud' | 'website'

export type RedeImportada = { plataforma: Plataforma; handle: string; url: string }
export type LinkImportado = {
  titulo: string
  url: string
  /**
   * A arte do card no link.me.
   *
   * Vai para `creator_links.capa_url` (capa própria) e não para `preview_url`
   * (og:image automática): no link.me essa imagem é escolhida pelo criador,
   * não raspada de um site. A distinção tem efeito visível — o formato do card
   * na página sai do par (estilo, capa), então link COM capa vira card grande e
   * link SEM capa vira botão.
   */
  capaUrl: string | null
  /**
   * O formato do card, lido das classes da âncora.
   *
   * `singlebigitem` é o card de imagem grande; `smallfeaturelinks` é a fileira
   * compacta. Importar isso é o que faz a página chegar parecida com a
   * original — sem ele, tudo virava 'grande' e um perfil de 15 links compactos
   * saía como uma coluna de banners.
   *
   * Os valores são os do PRODUTO (`EstiloItem`, em `lib/bio/tipos.ts`), e não
   * um vocabulário próprio do importador. Aqui já houve um `'pequeno'`, que o
   * CHECK de `creator_links` recusa — e como o valor só era testado na hora do
   * insert, importar um perfil com fileira compacta abortava a criação da
   * oferta inteira. Nome inventado deste lado vira erro de banco do outro.
   */
  estilo: EstiloItem
}

export type PerfilLinkme = {
  handle: string | null
  nome: string | null
  bio: string | null
  avatarUrl: string | null
  redes: RedeImportada[]
  links: LinkImportado[]
  /** O que não deu para importar, dito em voz alta em vez de sumir. */
  avisos: string[]
}

/**
 * Host → plataforma do app.
 *
 * O que não está aqui não é descartado: vira link comum (ver `montar`). Serviços
 * de música que o app não modela — Tidal, Deezer, Audiomack, Amazon Music,
 * YouTube Music — são links legítimos do criador, e sumir com eles seria perder
 * exatamente o que a oferta precisa mostrar.
 */
const HOSTS: [RegExp, Plataforma][] = [
  [/(^|\.)instagram\.com$/i, 'instagram'],
  [/(^|\.)tiktok\.com$/i, 'tiktok'],
  [/(^|\.)youtube\.com$|(^|\.)youtu\.be$/i, 'youtube'],
  [/(^|\.)(twitter|x)\.com$/i, 'twitter'],
  [/(^|\.)twitch\.tv$/i, 'twitch'],
  [/(^|\.)linkedin\.com$/i, 'linkedin'],
  [/(^|\.)facebook\.com$|(^|\.)fb\.com$/i, 'facebook'],
  [/(^|\.)spotify\.com$/i, 'spotify'],
  [/(^|\.)threads\.(net|com)$/i, 'threads'],
  [/(^|\.)reddit\.com$/i, 'reddit'],
  [/(^|\.)snapchat\.com$/i, 'snapchat'],
  [/(^|\.)music\.apple\.com$|(^|\.)apple\.com$/i, 'applemusic'],
  [/(^|\.)soundcloud\.com$/i, 'soundcloud'],
]

export function plataformaDaUrl(url: string): Plataforma | null {
  try {
    const host = new URL(url).hostname
    // `music.youtube.com` casaria com youtube e viraria a MESMA plataforma do
    // canal — e a tabela tem `unique (user_id, platform)`. Fica de fora de
    // propósito: é um serviço diferente e vira link.
    if (/(^|\.)music\.youtube\.com$/i.test(host)) return null
    for (const [re, plataforma] of HOSTS) if (re.test(host)) return plataforma
    return null
  } catch {
    return null
  }
}

/** O @ que o app guarda: último segmento do caminho, sem arroba nem query. */
export function handleDaUrl(url: string): string {
  try {
    const u = new URL(url)
    const partes = u.pathname.split('/').filter(Boolean)
    const ultimo = partes[partes.length - 1] ?? u.hostname
    return decodeURIComponent(ultimo).replace(/^@/, '')
  } catch {
    return url
  }
}

function semTags(s: string): string {
  return s.replace(/<[^>]+>/g, '')
}

function decodificar(s: string): string {
  return s
    .replace(/&#x27;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
}

function meta(doc: string, prop: string): string | null {
  const m = doc.match(new RegExp(`<meta\\s+property="og:${prop}"\\s+content="([^"]*)"`, 'i'))
  return m ? decodificar(m[1]) : null
}

/**
 * A extração propriamente dita. Função PURA: recebe HTML, devolve dado.
 *
 * Separada da busca em rede para poder ser testada com um HTML fixo — a parte
 * frágil é justamente esta, e é a que precisa de teste de regressão.
 */
export function extrairDeHtml(doc: string): PerfilLinkme {
  const avisos: string[] = []
  let handle: string | null = null
  let avatarUrl: string | null = null
  let sameAs: string[] = []

  const ld = doc.match(/<script[^>]*ld\+json[^>]*>([\s\S]*?)<\/script>/i)
  if (ld) {
    try {
      const dados = JSON.parse(ld[1]) as {
        mainEntity?: { identifier?: string; image?: string; sameAs?: string[] }
      }
      const ent = dados.mainEntity ?? {}
      handle = ent.identifier ?? null
      avatarUrl = ent.image ?? null
      sameAs = Array.isArray(ent.sameAs) ? ent.sameAs : []
    } catch {
      avisos.push('O bloco de dados estruturados da página existe mas não é JSON válido.')
    }
  } else {
    avisos.push('A página não trouxe dados estruturados — redes sociais e foto podem faltar.')
  }

  // "Check out NOME (@handle) on Linkme"
  const titulo = meta(doc, 'title') ?? ''
  const nome = titulo.match(/^Check out\s+(.*?)\s*\(@/)?.[1]?.trim() ?? null

  // "Discover NOME on LinkMe: BIO" — com um sufixo de marketing que só aparece
  // em alguns perfis. Os dois casos foram vistos em páginas reais.
  let bio: string | null = null
  const desc = meta(doc, 'description')
  if (desc) {
    bio =
      desc
        .replace(/^Discover\s+[\s\S]*?\s+on LinkMe:\s*/i, '')
        .replace(/:\s*Connect and see what[\s\S]*$/i, '')
        .trim() || null
  }

  // Botões. Lê a tag inteira e procura os atributos dentro — a ordem varia.
  const links: LinkImportado[] = []
  const vistos = new Set<string>()

  for (const a of doc.matchAll(/<a\s([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const [, atributos, interno] = a
    const classe = atributos.match(/class="([^"]*)"/i)?.[1] ?? ''
    if (!/\bsinglealbum\b/.test(classe)) continue

    const url = atributos.match(/href="([^"]*)"/i)?.[1]
    if (!url || vistos.has(url)) continue
    vistos.add(url)

    const rotulo = interno.match(/albumtextbox[\s\S]*?<p>([\s\S]*?)<\/p>/i)?.[1]

    // A arte fica no primeiro <img> dentro de `imgbox`. O segundo <img> da
    // âncora é o ícone genérico de "link" (uma corrente), que não é capa de
    // nada — pegar o primeiro é o que separa os dois.
    const capa = interno.match(/imgbox[^"]*"[^>]*>\s*<img[^>]*src="([^"]+)"/i)?.[1] ?? null

    const estilo: EstiloItem =
      /\bsmallfeaturelinks\b/.test(classe) ? 'metade' : 'grande'
    // Card só de imagem não tem rótulo. O domínio é um nome provisório honesto
    // — melhor do que uma linha em branco na oferta, e você renomeia na tela.
    let tituloLink = rotulo ? decodificar(semTags(rotulo)).trim() : ''
    if (!tituloLink) {
      try {
        tituloLink = new URL(url).hostname.replace(/^www\./, '')
      } catch {
        tituloLink = 'Link'
      }
    }
    links.push({ titulo: tituloLink, url, capaUrl: capa, estilo })
  }

  if (links.length === 0) {
    avisos.push(
      'Nenhum botão de link foi reconhecido. Ou o perfil não tem nenhum, ou o ' +
        'layout do link.me mudou e a extração dos botões precisa ser revista.',
    )
  }

  // Redes: as que o app modela viram rede; o resto vira link, na ordem original.
  const redes: RedeImportada[] = []
  const jaTem = new Set<Plataforma>()

  for (const url of sameAs) {
    const plataforma = plataformaDaUrl(url)
    if (plataforma && !jaTem.has(plataforma)) {
      jaTem.add(plataforma)
      redes.push({ plataforma, handle: handleDaUrl(url), url })
    } else if (!vistos.has(url)) {
      vistos.add(url)
      let nomeDoServico = 'Link'
      try {
        nomeDoServico = new URL(url).hostname.replace(/^www\./, '')
      } catch { /* url estranha: fica o rótulo genérico */ }
      // Rede que virou link não tem arte nem formato próprio na origem — e
      // sem arte a página desenha botão de qualquer jeito, então `botao` é o
      // que já diz a verdade sobre como ele vai sair.
      links.push({ titulo: nomeDoServico, url, capaUrl: null, estilo: 'botao' })
    }
  }

  return { handle, nome, bio, avatarUrl, redes, links, avisos }
}

/** Só o link.me. Ver a nota sobre SSRF em `buscarPerfil`. */
const HOSTS_PERMITIDOS = /^([a-z0-9-]+\.)?link\.me$/i

export function normalizarUrlLinkme(entrada: string): string | null {
  const texto = entrada.trim()
  // Aceita "jasonderulo", "@jasonderulo" e a URL inteira: na prática você cola
  // o que estiver na mão.
  if (/^@?[a-zA-Z0-9._-]+$/.test(texto)) {
    return `https://link.me/${texto.replace(/^@/, '')}`
  }
  try {
    const u = new URL(texto.startsWith('http') ? texto : `https://${texto}`)
    if (!HOSTS_PERMITIDOS.test(u.hostname)) return null
    return `https://link.me${u.pathname}`
  } catch {
    return null
  }
}

/**
 * Busca a página e extrai.
 *
 * O allowlist de host não é burocracia: esta função pega uma URL de um
 * formulário e faz o SERVIDOR buscá-la. Sem restrição, seria um proxy para
 * qualquer endereço alcançável de dentro da infraestrutura — incluindo IPs
 * internos e endpoints de metadata da nuvem. É SSRF de manual, e o fato de só
 * você usar o painel não muda a natureza do buraco.
 */
export async function buscarPerfil(
  entrada: string,
): Promise<{ ok: true; perfil: PerfilLinkme; url: string } | { ok: false; erro: string }> {
  const url = normalizarUrlLinkme(entrada)
  if (!url) return { ok: false, erro: 'Informe um handle ou uma URL do link.me.' }

  try {
    const resposta = await fetch(url, {
      headers: {
        // Sem User-Agent de navegador a resposta vem diferente (ou não vem).
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
        'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(20_000),
      cache: 'no-store',
    })

    if (resposta.status === 404) {
      return { ok: false, erro: 'Esse perfil não existe no link.me.' }
    }
    if (!resposta.ok) {
      return { ok: false, erro: `O link.me respondeu ${resposta.status}.` }
    }

    const perfil = extrairDeHtml(await resposta.text())
    if (!perfil.nome && !perfil.handle) {
      return { ok: false, erro: 'A página abriu mas não parece um perfil do link.me.' }
    }

    return { ok: true, perfil, url }
  } catch (e) {
    const erro = e instanceof Error && e.name === 'TimeoutError'
      ? 'O link.me demorou demais para responder.'
      : 'Não consegui abrir a página do link.me.'
    return { ok: false, erro }
  }
}
