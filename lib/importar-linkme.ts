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

import type { PlatformId } from '@/components/bio/platforms'
import type { EstiloItem } from '@/lib/bio/tipos'

/**
 * Plataformas que o app conhece — o MESMO tipo do catálogo, não uma cópia.
 *
 * Já foi uma lista escrita à mão aqui, "espelhando" `PlatformId`. Espelho de
 * lista não se mantém: com quarenta e cinco redes, a próxima que entrasse no
 * catálogo ficaria de fora daqui em silêncio, e o importador a trataria como
 * link comum. É a mesma armadilha do `'pequeno'` que o banco recusava — nome
 * próprio de um lado, verdade do outro.
 *
 * `import type` é apagado na compilação, então nada de `platforms.tsx` (nem o
 * React que ele usa) entra no pacote deste módulo.
 */
export type Plataforma = PlatformId

export type RedeImportada = { plataforma: Plataforma; handle: string; url: string }
export type LinkImportado = {
  /**
   * `divisor` é o TÍTULO DE SEÇÃO da página de origem ("MY LATEST VIDEOS"),
   * que o link.me desenha entre os botões e o produto guarda na mesma lista,
   * com `creator_links.tipo = 'divisor'`.
   *
   * Um divisor não tem endereço nem arte: `url` e `capaUrl` vêm nulos, e
   * `estilo` fica inerte. Ele mora na MESMA lista dos links porque é a posição
   * dele entre eles que diz onde a seção começa — separar em dois arrays
   * perderia exatamente essa informação.
   *
   * `marca` é o carrossel que o link.me chama de BRAND AFFILIATES: a fileira
   * de logos das marcas com quem o criador trabalha. No produto ela é o
   * carrossel de marcas parceiras da `/@handle` (`creator_links.tipo =
   * 'marca'`, ver a migration `20260901120000` no repo do app), desenhado
   * entre o botão de proposta e a lista.
   *
   * Vem na MESMA lista pelo motivo oposto ao do divisor — não pela posição,
   * mas pelo caminho: título, URL, arte e ordem são os mesmos quatro campos, e
   * o insert da oferta já sabe gravar `tipo`. Um segundo array obrigaria a
   * duplicar o download das imagens, a normalização e o insert para não mudar
   * mais nada. Ao contrário do divisor, a marca EXIGE url e capaUrl: sem logo
   * ela não aparece no carrossel (a consulta da página filtra), e sem destino
   * é enfeite que rouba o toque de quem tentou.
   */
  tipo: 'link' | 'divisor' | 'marca'
  titulo: string
  /** Nulo no divisor — é o que o CHECK `creator_links_url_por_tipo` exige. */
  url: string | null
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
 * A ORDEM é significativa, e por isso é um array e não um objeto: os padrões
 * são testados de cima para baixo e o primeiro que casa vence. Os subdomínios
 * mais específicos vêm ANTES do domínio geral — `music.youtube.com` antes de
 * `youtube.com`, `podcasts.apple.com` antes de `apple.com` —, senão o serviço
 * específico seria engolido pelo genérico e as duas coisas virariam a mesma
 * rede. Como a tabela tem `unique (user_id, platform)`, isso não daria erro:
 * daria um `on conflict do nothing`, e o segundo link sumiria calado.
 *
 * O que não está aqui não é descartado: vira link comum (ver `montar`).
 */
const HOSTS: [RegExp, Plataforma][] = [
  // Específicos primeiro — ver a nota sobre ordem acima.
  [/(^|\.)music\.youtube\.com$/i, 'youtube-music'],
  [/(^|\.)podcasts\.apple\.com$/i, 'apple-podcasts'],
  [/(^|\.)music\.apple\.com$/i, 'applemusic'],
  [/(^|\.)music\.amazon\.[a-z.]+$/i, 'amazon-music'],

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
  [/(^|\.)apple\.com$/i, 'applemusic'],
  [/(^|\.)soundcloud\.com$/i, 'soundcloud'],

  // Sociais
  [/(^|\.)discord\.(com|gg)$/i, 'discord'],
  [/(^|\.)(join)?clubhouse\.com$/i, 'clubhouse'],
  [/(^|\.)bere\.al$|(^|\.)bereal\.com$/i, 'bereal'],
  [/(^|\.)linktr\.ee$|(^|\.)linktree\.com$/i, 'linktree'],
  [/(^|\.)rumble\.com$/i, 'rumble'],
  // O Mastodon é federado: não existe UM host. Pegamos as instâncias grandes
  // e o padrão de nome que a maioria usa; o resto cai como link, que é honesto
  // — chutar que `exemplo.social` é Mastodon erraria com frequência.
  [/(^|\.)mastodon\.[a-z.]+$|(^|\.)mstdn\.[a-z.]+$/i, 'mastodon'],

  // Negócios
  [/(^|\.)skype\.com$/i, 'skype'],
  [/(^|\.)t\.me$|(^|\.)telegram\.(me|org)$/i, 'telegram'],
  [/(^|\.)wa\.me$|(^|\.)whatsapp\.com$/i, 'whatsapp'],
  [/(^|\.)calendly\.com$/i, 'calendly'],
  [/(^|\.)github\.com$/i, 'github'],

  // Música
  [/(^|\.)audiomack\.com$/i, 'audiomack'],
  [/(^|\.)tidal\.com$/i, 'tidal'],
  [/(^|\.)deezer\.com$|(^|\.)deezer\.page\.link$/i, 'deezer'],

  // Pagamento
  [/(^|\.)paypal\.(me|com)$/i, 'paypal'],
  [/(^|\.)cash\.app$/i, 'cashapp'],

  // Entretenimento
  [/(^|\.)playstation\.com$/i, 'playstation'],
  [/(^|\.)xbox\.com$/i, 'xbox'],
  [/(^|\.)steamcommunity\.com$|(^|\.)steampowered\.com$/i, 'steam'],
  [/(^|\.)kick\.com$/i, 'kick'],

  // Estilo de vida
  [/(^|\.)pinterest\.[a-z.]+$|(^|\.)pin\.it$/i, 'pinterest'],
  [/(^|\.)vsco\.co$/i, 'vsco'],
  [/(^|\.)depop\.com$/i, 'depop'],
  [/(^|\.)onlyfans\.com$/i, 'onlyfans'],
  [/(^|\.)opensea\.io$/i, 'opensea'],
  [/(^|\.)cameo\.com$/i, 'cameo'],
  [/(^|\.)patreon\.com$/i, 'patreon'],
  [/(^|\.)behance\.net$/i, 'behance'],
]

export function plataformaDaUrl(url: string): Plataforma | null {
  try {
    const host = new URL(url).hostname
    for (const [re, plataforma] of HOSTS) if (re.test(host)) return plataforma
    return null
  } catch {
    return null
  }
}

/**
 * O @ que o app guarda: último segmento do caminho, sem os prefixos que a
 * plataforma põe na URL e o app repõe sozinho.
 *
 * `@` sempre foi tirado; o `$` entrou junto por causa do Cash App, cuja URL é
 * `cash.app/$fulano` — e o `prefix` do catálogo já é `cash.app/$`. Guardar o
 * cifrão faria a URL final sair com dois.
 */
export function handleDaUrl(url: string): string {
  try {
    const u = new URL(url)
    const partes = u.pathname.split('/').filter(Boolean)
    const ultimo = partes[partes.length - 1] ?? u.hostname
    return decodeURIComponent(ultimo).replace(/^[@$]/, '')
  } catch {
    return url
  }
}

/**
 * O rótulo é o nome da PLATAFORMA e não o da marca?
 *
 * Acontece quando quem montou o card do link.me deixou o rótulo padrão: o
 * cartão da @werneckcompany chega com alt/title/rótulo "Instagram". Guardar
 * isso daria um carrossel com três marcas chamadas "Instagram", e o nome é o
 * `alt` da logo na página publicada — ou seja, é o que o leitor de tela
 * anuncia. Comparado com o host sem `www.` e sem TLD, que é como a plataforma
 * costuma se escrever.
 */
function ehNomeDePlataforma(rotulo: string, url: string): boolean {
  if (!rotulo) return true
  try {
    const host = new URL(url).hostname.replace(/^www\./, '')
    const nome = host.split('.')[0]
    return rotulo.trim().toLowerCase() === nome.toLowerCase()
  } catch {
    return false
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

  /**
   * Botões e TÍTULOS DE SEÇÃO, na ordem em que aparecem na página.
   *
   * A ordem é o ponto. Um divisor não diz nada sozinho — o que ele significa é
   * "daqui para baixo começa a seção tal", e isso só existe em relação aos
   * links que vêm depois dele. Por isso os dois são coletados com a POSIÇÃO no
   * documento (`match.index`) e ordenados juntos no fim, em vez de duas
   * varreduras independentes que depois não teriam como ser intercaladas.
   *
   * O título de seção é um `<section>` que embrulha um único `<span>` marcado
   * `notranslate`, e é essa forma que o identifica — não a classe, que é uma
   * pilha de utilitários do Tailwind e muda a cada ajuste de espaçamento no
   * link.me. O contador de seguidores da página também usa `notranslate`, mas
   * vive dentro de um `<button>`, então a exigência do `<section>` colado ao
   * `<span>` já o deixa de fora.
   */
  const achados: { pos: number; item: LinkImportado }[] = []
  const vistos = new Set<string>()

  for (const s of doc.matchAll(
    /<section\s[^>]*>\s*<span[^>]*\bnotranslate\b[^>]*>([\s\S]*?)<\/span>\s*<\/section>/gi,
  )) {
    const titulo = decodificar(semTags(s[1])).trim()
    if (!titulo) continue
    achados.push({
      pos: s.index ?? 0,
      item: { tipo: 'divisor', titulo, url: null, capaUrl: null, estilo: 'grande' },
    })
  }

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
    achados.push({
      pos: a.index ?? 0,
      item: { tipo: 'link', titulo: tituloLink, url, capaUrl: capa, estilo },
    })
  }

  /**
   * O carrossel de marcas — "BRAND AFFILIATES" na página de origem.
   *
   * DEPOIS do laço dos botões, e isso é ordem de precedência, não acaso: as
   * duas varreduras dividem o `vistos`, então uma URL que já virou botão não
   * vira também logo. O contrário faria um link legítimo sumir da lista para
   * reaparecer como imagem num carrossel.
   *
   * A âncora é reconhecida pelo `aria-roledescription="slide"` do slide que a
   * embrulha, e NÃO pelas classes (`block relative h-full overflow-hidden
   * rounded-xl`) nem pelo texto do título da seção. Os dois seriam piores por
   * razões diferentes: classe do link.me é pilha de utilitário do Tailwind e
   * muda a cada ajuste de espaçamento (é o que o comentário do topo deste
   * arquivo já dizia sobre os botões), e o título é texto que o CRIADOR
   * escreve — "BRAND AFFILIATES" hoje, "PARCEIROS" no perfil brasileiro do
   * lado. ARIA é o que existe para ser lido por máquina e o que menos muda.
   *
   * O `{0,4000}?` não é superstição: um slide sem âncora dentro faria o
   * `[\s\S]*?` correr até o próximo `</a>` do documento e engolir meia
   * página numa "marca" só. O teto transforma esse caso em nenhuma marca, que
   * é o defeito certo.
   */
  let slidesVistos = 0
  for (const slide of doc.matchAll(
    /aria-roledescription="slide"([\s\S]{0,4000}?)<\/a>/gi,
  )) {
    slidesVistos++
    const bloco = slide[1]

    const ancora = bloco.match(/<a\s([^>]*)>([\s\S]*)$/i)
    if (!ancora) continue

    const url = ancora[1].match(/href="([^"]*)"/i)?.[1]
    if (!url || vistos.has(url)) continue

    const img = ancora[2].match(/<img[^>]*>/i)?.[0] ?? ''
    const capa = img.match(/src="([^"]+)"/i)?.[1] ?? null
    // Sem logo não há marca. O carrossel do produto ignora a linha sem imagem
    // (é o filtro da própria consulta), então importá-la criaria um item que
    // existe no editor e não existe na página — o pior dos dois mundos.
    if (!capa) continue

    vistos.add(url)

    // O nome vem do rótulo sob a arte; `alt`/`title` repetem-no e servem de
    // reserva. Os três podem trazer o nome da PLATAFORMA em vez do da marca
    // (visto em produção: um card do Instagram com alt="Instagram"), e aí o
    // handle da URL é o que mais se parece com o nome — `instagram.com/ng.cash`
    // vira "ng.cash", não "Instagram".
    const rotulo =
      ancora[2].match(/<p[^>]*>([\s\S]*?)<\/p>/i)?.[1] ??
      img.match(/alt="([^"]*)"/i)?.[1] ??
      ''
    const nomeDaMarca = decodificar(semTags(rotulo)).trim()

    achados.push({
      pos: slide.index ?? 0,
      item: {
        tipo: 'marca',
        titulo: ehNomeDePlataforma(nomeDaMarca, url) ? handleDaUrl(url) : nomeDaMarca,
        url,
        capaUrl: capa,
        // Inerte para a marca: o carrossel desenha todas as logos do mesmo
        // tamanho. Vai 'grande' porque é o default da coluna.
        estilo: 'grande',
      },
    })
  }

  if (slidesVistos > 0 && !achados.some((a) => a.item.tipo === 'marca')) {
    avisos.push(
      'A página tem um carrossel de marcas, mas nenhuma logo foi reconhecida — ' +
        'o layout do link.me pode ter mudado.',
    )
  }

  const links: LinkImportado[] = achados
    .sort((x, y) => x.pos - y.pos)
    .map((x) => x.item)

  // Conta só os LINKS. Um perfil que devolvesse apenas divisores está tão
  // quebrado quanto um vazio, e sem esta distinção o aviso sumiria justo no
  // caso em que a extração dos botões parou de funcionar.
  if (!links.some((l) => l.tipo === 'link')) {
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
      links.push({ tipo: 'link', titulo: nomeDoServico, url, capaUrl: null, estilo: 'botao' })
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
