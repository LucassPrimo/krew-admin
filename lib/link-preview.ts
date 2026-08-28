import { lookup } from 'node:dns/promises'

/**
 * Descobre a imagem de prévia que o próprio site publica (`og:image`).
 *
 * Serve o link sem capa: em vez de um bloco tingido, o card mostra a imagem
 * que o YouTube, o Spotify ou a loja já escolheram para representar aquela
 * página. É a mesma imagem que aparece quando se cola o link no WhatsApp.
 *
 * ---------------------------------------------------------------------------
 * Isto é uma requisição do NOSSO servidor para uma URL escolhida pelo usuário
 * — a definição de SSRF. As barreiras, em ordem:
 *
 *  - só http/https;
 *  - o IP resolvido do host tem que ser público (bloqueia `localhost`,
 *    `169.254.169.254` da nuvem, faixas internas e o truque do domínio que
 *    resolve para IP privado);
 *  - cada redirecionamento é revalidado pelo mesmo critério, no máximo dois —
 *    senão `bit.ly` que aponta para `10.0.0.1` passaria pela primeira checagem;
 *  - orçamento de tempo e de bytes, para uma página eterna ou de 1GB não virar
 *    função pendurada.
 * ---------------------------------------------------------------------------
 */

const PRIVADO =
  /^(0\.|10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1$|fc|fd|fe80:)/i

const TEMPO_MAXIMO_MS = 2500
const HTML_MAXIMO_BYTES = 256 * 1024
const IMAGEM_MAXIMA_BYTES = 2 * 1024 * 1024
const TIPOS_ACEITOS = ['image/jpeg', 'image/png', 'image/webp']

async function hostEhPublico(hostname: string): Promise<boolean> {
  try {
    const { address } = await lookup(hostname)
    return !PRIVADO.test(address)
  } catch {
    return false
  }
}

/** Segue redirecionamento à mão, validando o destino a cada salto. */
async function buscarComGuarda(url: string, sinal: AbortSignal, saltos = 2): Promise<Response | null> {
  let atual = url

  for (let i = 0; i <= saltos; i++) {
    let alvo: URL
    try {
      alvo = new URL(atual)
    } catch {
      return null
    }
    if (alvo.protocol !== 'http:' && alvo.protocol !== 'https:') return null
    if (!(await hostEhPublico(alvo.hostname))) return null

    const resposta = await fetch(alvo, {
      signal: sinal,
      redirect: 'manual',
      headers: {
        // Sem User-Agent muitos sites devolvem 403 e a prévia nunca funcionaria.
        'user-agent': 'KrewBot/1.0 (+https://bekrew.com)',
        accept: 'text/html,image/*',
      },
      cache: 'no-store',
    })

    if (resposta.status >= 300 && resposta.status < 400) {
      const destino = resposta.headers.get('location')
      if (!destino) return null
      atual = new URL(destino, alvo).toString()
      continue
    }

    return resposta
  }

  return null
}

/** Lê no máximo `teto` bytes do corpo. Protege contra resposta sem fim. */
async function lerLimitado(resposta: Response, teto: number): Promise<Uint8Array | null> {
  const leitor = resposta.body?.getReader()
  if (!leitor) return null

  const pedacos: Uint8Array[] = []
  let total = 0

  while (total < teto) {
    const { done, value } = await leitor.read()
    if (done) break
    if (value) {
      pedacos.push(value)
      total += value.length
    }
  }
  await leitor.cancel().catch(() => {})

  const saida = new Uint8Array(total)
  let pos = 0
  for (const p of pedacos) {
    saida.set(p.subarray(0, Math.min(p.length, total - pos)), pos)
    pos += p.length
  }
  return saida
}

/**
 * Provedores com oEmbed — endpoint público que devolve a miniatura em JSON.
 *
 * Tentado ANTES de raspar HTML porque, para os links que mais aparecem numa
 * bio, raspar não funciona: o YouTube não serve `og:image` para agente
 * desconhecido (verificado — a página vem sem nenhuma meta de imagem), e ler o
 * HTML dele custa centenas de KB para não achar nada. O oEmbed responde alguns
 * KB de JSON e é uma interface pública, feita para isto.
 */
const OEMBED: { dominio: RegExp; endpoint: (url: string) => string }[] = [
  {
    dominio: /(^|\.)youtube\.com$|(^|\.)youtu\.be$/i,
    endpoint: (u) => `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(u)}`,
  },
  {
    dominio: /(^|\.)vimeo\.com$/i,
    endpoint: (u) => `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(u)}`,
  },
  {
    dominio: /(^|\.)spotify\.com$/i,
    endpoint: (u) => `https://open.spotify.com/oembed?url=${encodeURIComponent(u)}`,
  },
  {
    dominio: /(^|\.)soundcloud\.com$/i,
    endpoint: (u) => `https://soundcloud.com/oembed?format=json&url=${encodeURIComponent(u)}`,
  },
  {
    dominio: /(^|\.)tiktok\.com$/i,
    endpoint: (u) => `https://www.tiktok.com/oembed?url=${encodeURIComponent(u)}`,
  },
]

async function imagemViaOembed(url: string, sinal: AbortSignal): Promise<string | null> {
  let host: string
  try {
    host = new URL(url).hostname
  } catch {
    return null
  }

  const provedor = OEMBED.find((p) => p.dominio.test(host))
  if (!provedor) return null

  const resposta = await buscarComGuarda(provedor.endpoint(url), sinal)
  if (!resposta?.ok) return null

  const bytes = await lerLimitado(resposta, 64 * 1024)
  if (!bytes) return null

  try {
    const dados = JSON.parse(new TextDecoder().decode(bytes)) as { thumbnail_url?: unknown }
    return typeof dados.thumbnail_url === 'string' ? dados.thumbnail_url : null
  } catch {
    return null
  }
}

/** `og:image` e, na falta dele, `twitter:image`. Regex e não parser de HTML:
 *  são duas tags no `<head>` e trazer um parser inteiro para isso seria peso
 *  sem retorno. */
function extrairImagem(html: string): string | null {
  const padroes = [
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
  ]
  for (const p of padroes) {
    const achado = html.match(p)
    if (achado?.[1]) return achado[1]
  }
  return null
}

export interface PreviaDoSite {
  bytes: Uint8Array
  contentType: string
}

/**
 * Devolve a imagem de prévia do site, já baixada.
 *
 * Baixada e não apenas apontada: exibir a URL do site alheio faria o navegador
 * do VISITANTE bater lá para carregar a imagem, entregando o IP dele àquele
 * site antes mesmo de qualquer clique. Guardando no nosso bucket, ninguém
 * externo fica sabendo de nada — e a capa não some no dia em que o site trocar
 * a imagem de lugar.
 *
 * Qualquer falha devolve `null`: prévia é enfeite, e nada aqui pode impedir a
 * pessoa de salvar o link dela.
 */
export async function buscarPreviaDoSite(url: string): Promise<PreviaDoSite | null> {
  const controle = new AbortController()
  const corte = setTimeout(() => controle.abort(), TEMPO_MAXIMO_MS)

  try {
    // Caminho curto e confiável primeiro.
    let absoluta = await imagemViaOembed(url, controle.signal)

    if (!absoluta) {
      const pagina = await buscarComGuarda(url, controle.signal)
      if (!pagina?.ok) return null
      if (!(pagina.headers.get('content-type') ?? '').includes('text/html')) return null

      const htmlBytes = await lerLimitado(pagina, HTML_MAXIMO_BYTES)
      if (!htmlBytes) return null

      const relativa = extrairImagem(new TextDecoder().decode(htmlBytes))
      if (!relativa) return null

      absoluta = new URL(relativa, pagina.url || url).toString()
    }

    const imagem = await buscarComGuarda(absoluta, controle.signal)
    if (!imagem?.ok) return null

    const contentType = (imagem.headers.get('content-type') ?? '').split(';')[0]?.trim() ?? ''
    if (!TIPOS_ACEITOS.includes(contentType)) return null

    const bytes = await lerLimitado(imagem, IMAGEM_MAXIMA_BYTES)
    if (!bytes || bytes.length === 0) return null

    return { bytes, contentType }
  } catch {
    return null
  } finally {
    clearTimeout(corte)
  }
}
