import type { ReactNode } from 'react'

/**
 * Registry de plataformas da página de bio — fonte única de verdade.
 *
 * Os logos de marca vêm de `public/logos/redes/`, que já existia no
 * projeto (é o mesmo conjunto usado no onboarding). São os logos oficiais, em
 * cores — bem melhores que glifo monocromático, e sem dependência nova.
 *
 * Cobrem TODAS as plataformas da lista. Os glifos inline continuam aqui como
 * reserva: são o que aparece se um asset for removido da pasta, e o que uma
 * plataforma nova usa até ganhar o logo dela.
 *
 * `logoTemTile` separa os dois formatos de asset. Instagram, TikTok, X, Reddit,
 * LinkedIn, Facebook, Spotify, Threads e Snapchat já trazem o próprio quadrado
 * (ou círculo) colorido e vão de borda a borda — pôr fundo atrás deles criaria
 * uma moldura. YouTube, Twitch e Website são só o desenho, em preto: sem um
 * tile branco atrás sumiriam no fundo escuro da bio.
 *
 * Apple Music e SoundCloud entraram depois, quando os assets foram somados à
 * pasta. Ambos vêm com o próprio fundo (o recorte arredondado de ícone de app,
 * no primeiro; o círculo laranja, no segundo), então são `logoTemTile` como o
 * Instagram e o TikTok — pôr um fundo nosso atrás criaria moldura.
 *
 * IDs importantes de não inventar: `twitter` (não `x`), `instagram`, `tiktok`,
 * `youtube` e `twitch` são os cinco valores aceitos pelo CHECK de
 * `creator_metrics.platform`. Renomear o id aqui desliga o contador de
 * seguidores daquela rede em silêncio. O rótulo pode mudar — o id, não.
 */

export type PlatformId =
  | 'instagram'
  | 'tiktok'
  | 'youtube'
  | 'twitter'
  | 'twitch'
  | 'linkedin'
  | 'facebook'
  | 'spotify'
  | 'threads'
  | 'reddit'
  | 'snapchat'
  | 'applemusic'
  | 'soundcloud'
  | 'website'
  | 'discord'
  | 'clubhouse'
  | 'bereal'
  | 'linktree'
  | 'rumble'
  | 'mastodon'
  | 'skype'
  | 'telegram'
  | 'whatsapp'
  | 'calendly'
  | 'github'
  | 'youtube-music'
  | 'audiomack'
  | 'tidal'
  | 'deezer'
  | 'amazon-music'
  | 'paypal'
  | 'cashapp'
  | 'playstation'
  | 'xbox'
  | 'steam'
  | 'kick'
  | 'apple-podcasts'
  | 'pinterest'
  | 'vsco'
  | 'depop'
  | 'onlyfans'
  | 'opensea'
  | 'cameo'
  | 'patreon'
  | 'behance'

/**
 * As gavetas da fileira de redes, na ordem em que aparecem.
 *
 * São as mesmas do link.me, e não uma taxonomia nossa: a lista existe para
 * quem está montando a bio encontrar a rede que procura, e essa pessoa
 * provavelmente acabou de vir de lá. Inventar categorias diferentes obrigaria
 * a reaprender onde cada coisa mora.
 *
 * `outros` no fim, porque é a gaveta do que não coube nas outras — e uma
 * gaveta assim no meio da lista empurra para baixo coisas mais procuradas.
 */
export const CATEGORIAS = [
  'social',
  'negocios',
  'musica',
  'pagamento',
  'entretenimento',
  'estilo',
  'outros',
] as const

export type Categoria = (typeof CATEGORIAS)[number]

export interface PlatformDef {
  id: PlatformId
  label: string
  /** Em que gaveta da fileira ela aparece. Ver `CATEGORIAS`. */
  categoria: Categoria
  /** Prefixo mostrado antes do input, para o criador saber o que digitar. */
  prefix: string
  /** Monta a URL pública a partir do handle. `null` = a rede guarda URL crua. */
  href: ((handle: string) => string) | null
  /** Cor de marca — fundo do ícone quando não há logo oficial. */
  cor: string
  /** Logo oficial em `public/logos/redes/`. */
  logo?: string
  /** O asset já traz o próprio quadrado colorido (vai de borda a borda). */
  logoTemTile?: boolean
  /**
   * Cor do tile atrás do logo, quando ele NÃO traz o próprio fundo. Padrão é
   * branco.
   *
   * Existe por causa do Twitch: o asset dele é a variante SÓLIDA — corpo roxo
   * com a tela vazada em branco. Sobre branco, o vazado se funde ao tile e
   * sobra um borrão roxo irreconhecível. Sobre o roxo da marca, o corpo se
   * funde ao tile e o vazado vira o desenho — que é exatamente o ícone oficial.
   */
  logoFundo?: string
  /**
   * Respiro entre o desenho e a borda do tile branco, em % do lado. Só vale
   * para logo SEM tile próprio, e é por asset porque o desenho de cada um
   * ocupa o viewBox de um jeito — ver o comentário em `PlatformIcon`.
   */
  logoRespiro?: number
  /**
   * Deslocamento do desenho dentro do tile, em % do lado. Existe por causa de
   * UM caso, o Twitch, e ele explica a regra: quando o tile tem a cor de parte
   * do asset, o que se enxerga não é o desenho inteiro, é o que sobra dele — e
   * centralizar o desenho inteiro deixa a parte visível fora do centro.
   *
   * Não confundir com `logoRespiro`, que é simétrico e só muda o tamanho.
   */
  logoDeslocamento?: { x: number; y: number }
  icone: ReactNode
}

/** Redes com contador de seguidores (CHECK de `creator_metrics.platform`). */
export const PLATAFORMAS_COM_METRICAS: PlatformId[] = [
  'instagram',
  'tiktok',
  'youtube',
  'twitter',
  'twitch',
]

/**
 * Normaliza o que o criador digita. As pessoas colam o perfil inteiro
 * (`https://instagram.com/fulano/`) tanto quanto digitam `@fulano` — as duas
 * coisas têm que virar `fulano`. Sem isso a URL final fica dupla e quebra.
 */
export function normalizarHandle(valor: string) {
  return valor
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/^[a-z0-9.]+\.[a-z]{2,}\/(@)?/i, '')
    .replace(/^@/, '')
    .replace(/\/+$/, '')
    .replace(/\s/g, '')
}

/** URL crua (site, Spotify): garante protocolo, senão o href vira relativo. */
export function normalizarUrl(valor: string) {
  const limpo = valor.trim()
  if (!limpo) return ''
  return /^https?:\/\//i.test(limpo) ? limpo : `https://${limpo}`
}

/**
 * O glifo de reserva das redes que ainda não têm desenho próprio: as INICIAIS
 * sobre a cor da marca.
 *
 * Ele quase nunca aparece — todas as plataformas apontam para um arquivo em
 * `public/logos/redes/`, e o `PlatformIcon` só cai no glifo quando não
 * há `logo`. Existe para o caso de um asset sumir da pasta, e para uma
 * plataforma nova funcionar antes de alguém desenhá-la.
 *
 * Duas letras e não uma: `Twitch` e `Tidal`, `Pinterest` e `Patreon` começam
 * igual, e uma inicial só transformaria a fileira num teste de adivinhação.
 */
const letra = (iniciais: string) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="h-full w-full">
    <text
      x="12"
      y="12"
      textAnchor="middle"
      dominantBaseline="central"
      fontSize="11"
      fontWeight="700"
      fill="currentColor"
    >
      {iniciais}
    </text>
  </svg>
)

const svg = (children: ReactNode) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="w-full h-full">
    {children}
  </svg>
)

export const PLATFORMS: PlatformDef[] = [
  {
    id: 'instagram',
    categoria: 'social',
    label: 'Instagram',
    prefix: '@',
    href: (h) => `https://instagram.com/${h}`,
    cor: '#E1306C',
    logo: '/logos/redes/instagram.svg',
    logoTemTile: true,
    icone: svg(
      <path d="M12 2.16c3.2 0 3.58.01 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.42.36 1.06.41 2.23.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.25 1.8-.41 2.23-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.42.16-1.06.36-2.23.41-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.8-.25-2.23-.41a3.8 3.8 0 0 1-1.38-.9 3.8 3.8 0 0 1-.9-1.38c-.16-.42-.36-1.06-.41-2.23-.06-1.27-.07-1.65-.07-4.85s.01-3.58.07-4.85c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.16 1.06-.36 2.23-.41 1.27-.06 1.65-.07 4.85-.07Zm0 6.18a3.66 3.66 0 1 0 0 7.32 3.66 3.66 0 0 0 0-7.32Zm0 6.04a2.38 2.38 0 1 1 0-4.76 2.38 2.38 0 0 1 0 4.76Zm4.66-6.18a.86.86 0 1 1-1.71 0 .86.86 0 0 1 1.71 0Z" />
    ),
  },
  {
    id: 'tiktok',
    categoria: 'social',
    label: 'TikTok',
    prefix: '@',
    href: (h) => `https://tiktok.com/@${h}`,
    cor: '#010101',
    logo: '/logos/redes/tiktok.svg',
    logoTemTile: true,
    icone: svg(
      <path d="M16.6 5.82A4.28 4.28 0 0 1 15.54 3h-3.09v12.4a2.59 2.59 0 1 1-1.79-2.46V9.8a5.67 5.67 0 1 0 4.88 5.61V9.01a7.35 7.35 0 0 0 4.29 1.38V7.3a4.28 4.28 0 0 1-3.23-1.48Z" />
    ),
  },
  {
    id: 'youtube',
    categoria: 'social',
    label: 'YouTube',
    prefix: 'youtube.com/@',
    href: (h) => `https://youtube.com/@${h}`,
    cor: '#FF0000',
    logo: '/logos/redes/youtube.svg',
    logoRespiro: 12,
    icone: svg(
      <path d="M21.58 7.19a2.51 2.51 0 0 0-1.77-1.77C18.25 5 12 5 12 5s-6.25 0-7.81.42a2.51 2.51 0 0 0-1.77 1.77A26.1 26.1 0 0 0 2 12a26.1 26.1 0 0 0 .42 4.81 2.51 2.51 0 0 0 1.77 1.77C5.75 19 12 19 12 19s6.25 0 7.81-.42a2.51 2.51 0 0 0 1.77-1.77A26.1 26.1 0 0 0 22 12a26.1 26.1 0 0 0-.42-4.81ZM10 15.02V8.98L15.2 12 10 15.02Z" />
    ),
  },
  {
    id: 'twitter',
    categoria: 'social',
    label: 'X',
    prefix: '@',
    href: (h) => `https://x.com/${h}`,
    cor: '#000000',
    logo: '/logos/redes/x.svg',
    logoTemTile: true,
    icone: svg(
      <path d="M17.53 3h3.06l-6.69 7.64L21.75 21h-6.16l-4.82-6.3L5.25 21H2.19l7.15-8.17L2.25 3h6.31l4.36 5.77L17.53 3Zm-1.07 16.14h1.69L7.6 4.77H5.79l10.67 14.37Z" />
    ),
  },
  {
    id: 'twitch',
    categoria: 'entretenimento',
    label: 'Twitch',
    prefix: 'twitch.tv/',
    href: (h) => `https://twitch.tv/${h}`,
    cor: '#9146FF',
    logo: '/logos/redes/twitch.svg',
    // O mesmo roxo que o arquivo usa. Um tom diferente aqui criaria emenda
    // visível entre o corpo do desenho e o fundo.
    logoFundo: '#9F77F7',
    logoRespiro: 12,
    /**
     * O asset é o balão de chat INTEIRO — corpo roxo, tela vazada em branco e
     * a pontinha embaixo à esquerda. Sobre o tile roxo o corpo e a pontinha
     * somem, e sobra só a tela branca, que não fica no meio do desenho: ela
     * ocupa x 109,75→402,42 e y 36,59→374,98 de um viewBox de 439×512,17.
     *
     * O centro dela cai em (256,09, 205,79) contra o (219,50, 256,08) do
     * viewBox — 7,14% à direita e 9,82% acima, já convertidos para o tamanho
     * renderizado (o `object-contain` encaixa pela altura, porque o viewBox é
     * mais alto que largo). O deslocamento abaixo é exatamente esse desvio,
     * com o sinal trocado.
     *
     * Corrigir aqui e não no SVG é de propósito: recortar o viewBox em volta
     * da tela branca centralizaria o logo neste tile e quebraria o arquivo em
     * qualquer outro fundo, onde o corpo roxo É o desenho. O asset continua
     * completo e correto; quem sabe do tile roxo é quem o pinta.
     */
    logoDeslocamento: { x: -7.14, y: 9.82 },
    icone: svg(
      <path d="M4.3 3 3 6.5V19h4.2v2.5h2.4l2.4-2.5h3.5L21 14.2V3H4.3Zm15 10.4-2.8 2.8h-3.6l-2.4 2.4v-2.4H7.2V4.7h12.1v8.7ZM16 7.6v4.6h-1.7V7.6H16Zm-4.5 0v4.6H9.8V7.6h1.7Z" />
    ),
  },
  {
    id: 'linkedin',
    categoria: 'negocios',
    label: 'LinkedIn',
    prefix: 'linkedin.com/in/',
    href: (h) => `https://linkedin.com/in/${h}`,
    cor: '#0A66C2',
    logo: '/logos/redes/linkedin.svg',
    logoTemTile: true,
    icone: svg(
      <path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM3 9h4v12H3V9Zm6.5 0h3.8v1.65h.05c.53-.95 1.83-1.95 3.76-1.95 4.02 0 4.76 2.5 4.76 5.76V21h-4v-5.65c0-1.35-.02-3.08-1.9-3.08-1.9 0-2.19 1.46-2.19 2.98V21h-4V9Z" />
    ),
  },
  {
    id: 'facebook',
    categoria: 'social',
    label: 'Facebook',
    prefix: 'facebook.com/',
    href: (h) => `https://facebook.com/${h}`,
    cor: '#1877F2',
    logo: '/logos/redes/facebook.svg',
    logoTemTile: true,
    icone: svg(
      <path d="M22 12a10 10 0 1 0-11.56 9.88v-6.99H7.9V12h2.54V9.8c0-2.5 1.49-3.89 3.77-3.89 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.78l-.44 2.89h-2.34v6.99A10 10 0 0 0 22 12Z" />
    ),
  },
  {
    id: 'spotify',
    categoria: 'musica',
    label: 'Spotify',
    prefix: 'https://',
    href: null,
    cor: '#1DB954',
    logo: '/logos/redes/spotify.svg',
    logoTemTile: true,
    icone: svg(
      <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm4.59 14.42a.62.62 0 0 1-.86.21c-2.35-1.44-5.3-1.76-8.79-.96a.62.62 0 1 1-.28-1.22c3.81-.87 7.08-.5 9.72 1.11.29.18.38.57.21.86Zm1.22-2.72a.78.78 0 0 1-1.07.26c-2.69-1.65-6.79-2.13-9.97-1.17a.78.78 0 1 1-.45-1.49c3.63-1.1 8.15-.57 11.24 1.33.36.22.48.7.25 1.07Zm.11-2.84c-3.23-1.92-8.55-2.09-11.63-1.16a.94.94 0 1 1-.54-1.8c3.54-1.07 9.42-.86 13.13 1.34a.94.94 0 0 1-.96 1.62Z" />
    ),
  },
  {
    id: 'threads',
    categoria: 'social',
    label: 'Threads',
    prefix: '@',
    href: (h) => `https://threads.net/@${h}`,
    cor: '#000000',
    logo: '/logos/redes/threads.svg',
    logoTemTile: true,
    icone: svg(
      <path d="M17.1 11.2c-.1-.05-.2-.1-.3-.14-.18-3.3-1.98-5.18-5-5.2h-.04c-1.8 0-3.3.77-4.23 2.18l1.66 1.14c.69-1.05 1.78-1.28 2.57-1.28h.03c.98 0 1.72.29 2.2.85.35.4.58.97.7 1.68a12.7 12.7 0 0 0-2.85-.14c-2.87.17-4.72 1.84-4.6 4.17.06 1.18.65 2.2 1.66 2.86.85.56 1.95.83 3.09.77 1.5-.08 2.68-.66 3.5-1.7.63-.8 1.02-1.83 1.2-3.14.72.43 1.25 1 1.55 1.68.5 1.16.53 3.07-1.02 4.62-1.36 1.36-3 1.95-5.48 1.97-2.75-.02-4.83-.9-6.19-2.61C4.3 17.4 3.64 15.1 3.62 12c.02-3.1.68-5.4 1.93-6.99C6.91 3.3 8.99 2.42 11.74 2.4c2.77.02 4.88.9 6.29 2.62.69.84 1.21 1.9 1.55 3.13l1.94-.52c-.42-1.51-1.08-2.82-1.98-3.9C17.74 1.53 15.11.4 11.75.38h-.01C8.4.4 5.8 1.53 4.11 3.74 2.6 5.7 1.83 8.44 1.8 11.99v.02c.03 3.55.8 6.28 2.31 8.25 1.69 2.2 4.29 3.33 7.63 3.36h.01c2.97-.02 5.06-.8 6.79-2.52 2.26-2.26 2.19-5.1 1.45-6.84-.54-1.25-1.56-2.26-2.9-2.94v-.12Zm-5.06 4.9c-1.26.07-2.57-.5-2.63-1.66-.05-.86.61-1.82 2.71-1.94.24-.01.47-.02.7-.02.76 0 1.48.07 2.13.21-.24 3.03-1.66 3.35-2.91 3.41Z" />
    ),
  },
  {
    id: 'reddit',
    categoria: 'social',
    label: 'Reddit',
    prefix: 'reddit.com/u/',
    href: (h) => `https://reddit.com/user/${h}`,
    cor: '#FF4500',
    logo: '/logos/redes/reddit.svg',
    logoTemTile: true,
    icone: svg(
      <path d="M22 12.07a2.1 2.1 0 0 0-3.56-1.5 10.3 10.3 0 0 0-5.6-1.78l.95-4.49 3.12.66a1.5 1.5 0 1 0 .17-1.02l-3.49-.74a.5.5 0 0 0-.59.39l-1.06 5.2a10.3 10.3 0 0 0-5.68 1.78 2.1 2.1 0 1 0-2.32 3.43 4.14 4.14 0 0 0-.05.64c0 3.24 3.77 5.87 8.42 5.87s8.42-2.63 8.42-5.87c0-.21-.02-.42-.05-.63A2.1 2.1 0 0 0 22 12.07ZM7.6 13.57a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0Zm8.32 3.96c-1.02 1.02-2.98 1.1-3.55 1.1-.57 0-2.53-.08-3.55-1.1a.39.39 0 0 1 .55-.55c.64.64 2.02.87 3 .87.98 0 2.36-.23 3-.87a.39.39 0 1 1 .55.55Zm-.03-2.46a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Z" />
    ),
  },
  {
    id: 'snapchat',
    categoria: 'social',
    label: 'Snapchat',
    prefix: '@',
    href: (h) => `https://snapchat.com/add/${h}`,
    cor: '#FFFC00',
    logo: '/logos/redes/snapchat.svg',
    logoTemTile: true,
    icone: svg(
      <path d="M12.2 2c2.6 0 4.4 1.86 4.5 4.5.02.5 0 1 0 1.5.02.34.13.5.47.4.28-.08.6-.16.87-.05.4.16.55.5.44.9-.14.5-.63.7-1.06.87-.3.12-.63.2-.7.55-.08.4.16.8.36 1.14.68 1.16 1.7 2.02 2.98 2.46.4.14.53.42.4.8-.2.6-1.13.9-1.9 1.03-.32.05-.4.2-.44.5-.06.4-.16.72-.6.72-.5 0-1-.13-1.5-.1-.9.06-1.55.62-2.2 1.16-.6.5-1.2.9-2 .9s-1.4-.4-2-.9c-.65-.54-1.3-1.1-2.2-1.16-.5-.03-1 .1-1.5.1-.44 0-.54-.32-.6-.72-.04-.3-.12-.45-.44-.5-.77-.13-1.7-.43-1.9-1.03-.13-.38 0-.66.4-.8 1.28-.44 2.3-1.3 2.98-2.46.2-.34.44-.74.36-1.14-.07-.35-.4-.43-.7-.55-.43-.17-.92-.37-1.06-.87-.11-.4.04-.74.44-.9.27-.11.59-.03.87.05.34.1.45-.06.47-.4 0-.5-.02-1 0-1.5C7.7 3.86 9.5 2 12.1 2h.1Z" />
    ),
  },
  {
    id: 'applemusic',
    categoria: 'musica',
    label: 'Apple Music',
    prefix: 'https://',
    href: null,
    cor: '#FA243C',
    logo: '/logos/redes/apple-music.svg',
    logoTemTile: true,
    icone: svg(
      <path d="M18.7 3.2a1 1 0 0 1 .8 1v12.1c0 1.7-1.3 2.9-3 2.9-1.6 0-2.8-1-2.8-2.4 0-1.4 1.1-2.4 2.9-2.5l1.4-.1V8.5l-7.6 1.5v8.4c0 1.7-1.3 2.9-3 2.9-1.6 0-2.8-1-2.8-2.4 0-1.4 1.1-2.4 2.9-2.5l1.4-.1V6.7c0-.6.4-1 1-1.1l8.8-1.4Z" />
    ),
  },
  {
    id: 'soundcloud',
    categoria: 'musica',
    label: 'SoundCloud',
    prefix: 'https://',
    href: null,
    cor: '#FF5500',
    logo: '/logos/redes/soundcloud.svg',
    logoTemTile: true,
    icone: svg(
      <path d="M1.5 13.2c-.2 0-.3.1-.3.3l-.2 1.9.2 1.8c0 .2.1.3.3.3.1 0 .3-.1.3-.3l.2-1.8-.2-1.9c0-.2-.2-.3-.3-.3Zm2-1.3c-.2 0-.3.2-.3.3l-.3 3.2.3 3.1c0 .2.1.3.3.3s.3-.1.3-.3l.3-3.1-.3-3.2c0-.1-.1-.3-.3-.3Zm2-.9c-.2 0-.4.2-.4.4l-.2 4 .2 3.8c0 .2.2.4.4.4s.4-.2.4-.4l.3-3.8-.3-4c0-.2-.2-.4-.4-.4Zm2.1-.5c-.2 0-.4.2-.4.4l-.2 4.5.2 3.7c0 .3.2.4.4.4.3 0 .4-.1.4-.4l.3-3.7-.3-4.5c0-.2-.1-.4-.4-.4Zm2.2 0c-.3 0-.5.2-.5.5l-.2 4.4.2 3.7c0 .3.2.5.5.5s.5-.2.5-.5l.2-3.7-.2-4.4c0-.3-.2-.5-.5-.5Zm2.3-1.1c-.3 0-.5.2-.5.5l-.2 5.5.2 3.6c0 .3.2.5.5.5s.5-.2.5-.5l.2-3.6-.2-5.5c0-.3-.2-.5-.5-.5Zm2.7 1.2c-.3 0-.5.2-.5.6l-.1 4.2.1 3.5c0 .3.2.6.5.6s.6-.3.6-.6l.2-3.5-.2-4.2c0-.4-.3-.6-.6-.6Zm2.6-2.5c-.4 0-.6.3-.6.6l-.2 6.7.2 3.4c0 .3.2.6.6.6.3 0 .6-.3.6-.6l.2-3.4-.2-6.7c0-.3-.3-.6-.6-.6Zm2.9 2.8c-.6 0-1.1.1-1.6.3-.3-3.5-3.2-6.2-6.8-6.2-.9 0-1.7.2-2.4.5-.3.1-.4.2-.4.5v13.4c0 .3.2.5.5.5h10.7A3.4 3.4 0 0 0 24 16.6a3.4 3.4 0 0 0-3.7-3.4Z" />
    ),
  },
  {
    id: 'website',
    categoria: 'outros',
    label: 'Website',
    prefix: 'https://',
    href: null,
    cor: '#6B7280',
    logo: '/logos/redes/website.svg',
    logoTemTile: true,
    icone: svg(
      <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm6.9 6h-2.95a15.6 15.6 0 0 0-1.4-3.6A8.03 8.03 0 0 1 18.9 8ZM12 4.04c.83 1.2 1.48 2.53 1.91 3.96h-3.82c.43-1.43 1.08-2.76 1.91-3.96ZM4.26 14a8.06 8.06 0 0 1 0-4h3.38a16.5 16.5 0 0 0 0 4H4.26Zm.84 2h2.95c.32 1.25.79 2.45 1.4 3.6A8.03 8.03 0 0 1 5.1 16Zm2.95-8H5.1a8.03 8.03 0 0 1 4.35-3.6A15.6 15.6 0 0 0 8.05 8ZM12 19.96A13.9 13.9 0 0 1 10.09 16h3.82A13.9 13.9 0 0 1 12 19.96ZM14.34 14H9.66a14.7 14.7 0 0 1 0-4h4.68a14.7 14.7 0 0 1 0 4Zm.21 5.6c.61-1.15 1.08-2.35 1.4-3.6h2.95a8.03 8.03 0 0 1-4.35 3.6ZM16.36 14a16.5 16.5 0 0 0 0-4h3.38a8.06 8.06 0 0 1 0 4h-3.38Z" />
    ),
  },

  /* -------------------------------------------------------------------------
   * As redes trazidas do catálogo do link.me, agrupadas como lá.
   *
   * Elas entram DEPOIS das que o app já tinha, e não intercaladas por
   * categoria, porque a ordem dentro de cada gaveta é a ordem deste array — e
   * as antigas são justamente as mais usadas. Quem procura Instagram continua
   * achando na primeira posição de "Sociais".
   *
   * As que não têm URL previsível (Discord, Mastodon, Tidal, Zelle, e as
   * demais com `href: null`) pedem o endereço inteiro em vez do @: um handle
   * do Mastodon depende da instância, um do Tidal é um número. Inventar um
   * padrão para elas produziria links quebrados que só aparecem quando alguém
   * clica.
   * ---------------------------------------------------------------------- */
  {
    id: 'discord',
    label: 'Discord',
    prefix: 'URL',
    href: null,
    cor: '#5865F2',
    categoria: 'social',
    logo: '/logos/redes/discord.svg',
    logoTemTile: true,
    icone: letra('Dc'),
  },
  {
    id: 'clubhouse',
    label: 'Clubhouse',
    prefix: 'clubhouse.com/@',
    href: (h) => `https://clubhouse.com/@${h}`,
    cor: '#F2D544',
    categoria: 'social',
    logo: '/logos/redes/clubhouse.svg',
    // O arquivo é só o desenho, sem quadrado colorido próprio: o tile
    // vem daqui, senão ele fica transparente e some no fundo do cartão.
    logoRespiro: 16,
    icone: letra('Ch'),
  },
  {
    id: 'bereal',
    label: 'BeReal',
    prefix: 'bere.al/',
    href: (h) => `https://bere.al/${h}`,
    cor: '#000000',
    categoria: 'social',
    logo: '/logos/redes/bereal.svg',
    logoTemTile: true,
    icone: letra('Be'),
  },
  {
    id: 'linktree',
    label: 'Linktree',
    prefix: 'linktr.ee/',
    href: (h) => `https://linktr.ee/${h}`,
    cor: '#43E660',
    categoria: 'social',
    logo: '/logos/redes/linktree.svg',
    // O arquivo é só o desenho, sem quadrado colorido próprio: o tile
    // vem daqui, senão ele fica transparente e some no fundo do cartão.
    logoRespiro: 18,
    icone: letra('Lt'),
  },
  {
    id: 'rumble',
    label: 'Rumble',
    prefix: 'rumble.com/c/',
    href: (h) => `https://rumble.com/c/${h}`,
    cor: '#85C742',
    categoria: 'social',
    logo: '/logos/redes/rumble.svg',
    // O arquivo é só o desenho, sem quadrado colorido próprio: o tile
    // vem daqui, senão ele fica transparente e some no fundo do cartão.
    logoRespiro: 18,
    icone: letra('Rb'),
  },
  {
    id: 'mastodon',
    label: 'Mastodon',
    prefix: 'URL',
    href: null,
    cor: '#6364FF',
    categoria: 'social',
    logo: '/logos/redes/mastodon.svg',
    logoTemTile: true,
    icone: letra('Ma'),
  },
  {
    id: 'skype',
    label: 'Skype',
    prefix: 'URL',
    href: null,
    cor: '#00AFF0',
    categoria: 'negocios',
    logo: '/logos/redes/skype.svg',
    // O arquivo é só o desenho, sem quadrado colorido próprio: o tile
    // vem daqui, senão ele fica transparente e some no fundo do cartão.
    logoRespiro: 18,
    icone: letra('Sk'),
  },
  {
    id: 'telegram',
    label: 'Telegram',
    prefix: 't.me/',
    href: (h) => `https://t.me/${h}`,
    cor: '#2AABEE',
    categoria: 'negocios',
    logo: '/logos/redes/telegram.svg',
    logoTemTile: true,
    icone: letra('Tg'),
  },
  {
    id: 'whatsapp',
    label: 'WhatsApp',
    prefix: 'wa.me/',
    href: (h) => `https://wa.me/${h}`,
    cor: '#25D366',
    categoria: 'negocios',
    logo: '/logos/redes/whatsapp.svg',
    logoTemTile: true,
    icone: letra('Wa'),
  },
  {
    id: 'calendly',
    label: 'Calendly',
    prefix: 'calendly.com/',
    href: (h) => `https://calendly.com/${h}`,
    cor: '#006BFF',
    categoria: 'negocios',
    logo: '/logos/redes/calendly.svg',
    // O arquivo é só o desenho, sem quadrado colorido próprio: o tile
    // vem daqui, senão ele fica transparente e some no fundo do cartão.
    logoRespiro: 18,
    icone: letra('Cy'),
  },
  {
    id: 'github',
    label: 'GitHub',
    prefix: 'github.com/',
    href: (h) => `https://github.com/${h}`,
    cor: '#181717',
    categoria: 'negocios',
    logo: '/logos/redes/github.svg',
    // O arquivo é só o desenho, sem quadrado colorido próprio: o tile
    // vem daqui, senão ele fica transparente e some no fundo do cartão.
    logoRespiro: 16,
    icone: letra('Gh'),
  },
  {
    id: 'youtube-music',
    label: 'YouTube Music',
    prefix: 'URL',
    href: null,
    cor: '#FF0000',
    categoria: 'musica',
    logo: '/logos/redes/youtube-music.svg',
    logoTemTile: true,
    icone: letra('YM'),
  },
  {
    id: 'audiomack',
    label: 'Audiomack',
    prefix: 'audiomack.com/',
    href: (h) => `https://audiomack.com/${h}`,
    cor: '#F7A01B',
    categoria: 'musica',
    logo: '/logos/redes/audiomack.svg',
    logoTemTile: true,
    icone: letra('Am'),
  },
  {
    id: 'tidal',
    label: 'Tidal',
    prefix: 'URL',
    href: null,
    cor: '#000000',
    categoria: 'musica',
    logo: '/logos/redes/tidal.svg',
    logoTemTile: true,
    icone: letra('Td'),
  },
  {
    id: 'deezer',
    label: 'Deezer',
    prefix: 'URL',
    href: null,
    cor: '#1A1A1A',
    categoria: 'musica',
    logo: '/logos/redes/deezer.svg',
    // O arquivo é só o desenho, sem quadrado colorido próprio: o tile
    // vem daqui, senão ele fica transparente e some no fundo do cartão.
    logoRespiro: 18,
    icone: letra('Dz'),
  },
  {
    id: 'amazon-music',
    label: 'Amazon Music',
    prefix: 'URL',
    href: null,
    cor: '#2D1DC4',
    categoria: 'musica',
    logo: '/logos/redes/amazon-music.svg',
    // O arquivo é só o desenho, sem quadrado colorido próprio: o tile
    // vem daqui, senão ele fica transparente e some no fundo do cartão.
    logoRespiro: 18,
    icone: letra('AM'),
  },
  {
    id: 'paypal',
    label: 'PayPal',
    prefix: 'paypal.me/',
    href: (h) => `https://paypal.me/${h}`,
    cor: '#0070BA',
    categoria: 'pagamento',
    logo: '/logos/redes/paypal.svg',
    // O arquivo é só o desenho, sem quadrado colorido próprio: o tile
    // vem daqui, senão ele fica transparente e some no fundo do cartão.
    logoRespiro: 18,
    icone: letra('PP'),
  },
  {
    id: 'cashapp',
    label: 'Cash App',
    prefix: 'cash.app/$',
    href: (h) => `https://cash.app/$${h}`,
    cor: '#00D632',
    categoria: 'pagamento',
    logo: '/logos/redes/cashapp.svg',
    logoTemTile: true,
    icone: letra('Ca'),
  },
  {
    id: 'playstation',
    label: 'PlayStation',
    prefix: 'URL',
    href: null,
    cor: '#2E6ADB',
    categoria: 'entretenimento',
    logo: '/logos/redes/playstation.svg',
    // O arquivo é só o desenho, sem quadrado colorido próprio: o tile
    // vem daqui, senão ele fica transparente e some no fundo do cartão.
    logoRespiro: 22,
    icone: letra('PS'),
  },
  {
    id: 'xbox',
    label: 'Xbox',
    prefix: 'URL',
    href: null,
    cor: '#107C10',
    categoria: 'entretenimento',
    logo: '/logos/redes/xbox.svg',
    // O arquivo é só o desenho, sem quadrado colorido próprio: o tile
    // vem daqui, senão ele fica transparente e some no fundo do cartão.
    logoRespiro: 18,
    icone: letra('Xb'),
  },
  {
    id: 'steam',
    label: 'Steam',
    prefix: 'steamcommunity.com/id/',
    href: (h) => `https://steamcommunity.com/id/${h}`,
    cor: '#2A475E',
    categoria: 'entretenimento',
    logo: '/logos/redes/steam.svg',
    logoTemTile: true,
    icone: letra('Sm'),
  },
  {
    id: 'kick',
    label: 'Kick',
    prefix: 'kick.com/',
    href: (h) => `https://kick.com/${h}`,
    cor: '#53FC18',
    categoria: 'entretenimento',
    logo: '/logos/redes/kick.svg',
    // O arquivo é só o desenho, sem quadrado colorido próprio: o tile
    // vem daqui, senão ele fica transparente e some no fundo do cartão.
    logoFundo: '#0F0F0F',
    logoRespiro: 18,
    icone: letra('Ki'),
  },
  {
    id: 'apple-podcasts',
    label: 'Apple Podcasts',
    prefix: 'URL',
    href: null,
    cor: '#9933CC',
    categoria: 'entretenimento',
    logo: '/logos/redes/apple-podcasts.svg',
    logoTemTile: true,
    icone: letra('AP'),
  },
  {
    id: 'pinterest',
    label: 'Pinterest',
    prefix: 'pinterest.com/',
    href: (h) => `https://pinterest.com/${h}`,
    cor: '#E60023',
    categoria: 'estilo',
    logo: '/logos/redes/pinterest.svg',
    logoTemTile: true,
    icone: letra('Pi'),
  },
  {
    id: 'vsco',
    label: 'VSCO',
    prefix: 'vsco.co/',
    href: (h) => `https://vsco.co/${h}`,
    // O preto do selo, e não o azul que a grade do link.me mostra: a marca da
    // VSCO é monocromática, e a cor aqui é o que pinta o fundo se um dia o
    // arquivo sumir.
    cor: '#000000',
    categoria: 'estilo',
    logo: '/logos/redes/vsco.svg',
    // O selo ocupa o viewBox inteiro, mas é DESENHO preto sobre transparente
    // — não um disco colorido. Marcá-lo como tile próprio o deixaria preto
    // sobre o fundo escuro do painel, ou seja, invisível. Tile branco resolve
    // e é como a VSCO usa a marca.
    logoRespiro: 10,
    icone: letra('Vs'),
  },
  {
    id: 'depop',
    label: 'Depop',
    prefix: 'depop.com/',
    href: (h) => `https://depop.com/${h}`,
    cor: '#FF2300',
    categoria: 'estilo',
    logo: '/logos/redes/depop.svg',
    logoTemTile: true,
    icone: letra('Dp'),
  },
  {
    id: 'onlyfans',
    label: 'OnlyFans',
    prefix: 'onlyfans.com/',
    href: (h) => `https://onlyfans.com/${h}`,
    cor: '#00AFF0',
    categoria: 'estilo',
    logo: '/logos/redes/onlyfans.svg',
    // O arquivo é só o desenho, sem quadrado colorido próprio: o tile
    // vem daqui, senão ele fica transparente e some no fundo do cartão.
    logoRespiro: 20,
    icone: letra('OF'),
  },
  {
    id: 'opensea',
    label: 'OpenSea',
    prefix: 'opensea.io/',
    href: (h) => `https://opensea.io/${h}`,
    cor: '#2081E2',
    categoria: 'estilo',
    logo: '/logos/redes/opensea.svg',
    logoTemTile: true,
    icone: letra('Os'),
  },
  {
    id: 'cameo',
    label: 'Cameo',
    prefix: 'cameo.com/',
    href: (h) => `https://cameo.com/${h}`,
    cor: '#111111',
    categoria: 'estilo',
    logo: '/logos/redes/cameo.svg',
    // O arquivo é só o desenho, sem quadrado colorido próprio: o tile
    // vem daqui, senão ele fica transparente e some no fundo do cartão.
    logoRespiro: 18,
    icone: letra('Cm'),
  },
  {
    id: 'patreon',
    label: 'Patreon',
    prefix: 'patreon.com/',
    href: (h) => `https://patreon.com/${h}`,
    cor: '#FF424D',
    categoria: 'estilo',
    logo: '/logos/redes/patreon.svg',
    // O arquivo é só o desenho, sem quadrado colorido próprio: o tile
    // vem daqui, senão ele fica transparente e some no fundo do cartão.
    logoRespiro: 20,
    icone: letra('Pt'),
  },
  {
    id: 'behance',
    label: 'Behance',
    prefix: 'behance.net/',
    href: (h) => `https://behance.net/${h}`,
    cor: '#1769FF',
    categoria: 'estilo',
    logo: '/logos/redes/behance.svg',
    logoTemTile: true,
    icone: letra('Bh'),
  },
]

export const PLATFORM_BY_ID = new Map(PLATFORMS.map((p) => [p.id, p]))

/**
 * O ícone de uma rede — um só componente para a página pública e o dashboard.
 *
 * Três casos, e é por isso que isto não é um `<img>` solto no lugar de uso:
 *  - logo com tile próprio (Instagram, TikTok, X, Reddit…): vai de borda a
 *    borda, sem fundo nosso, senão apareceria uma moldura em volta do quadrado
 *    colorido que o asset já tem;
 *  - logo sem tile (YouTube, Twitch, Website): fundo branco e respiro, porque o
 *    desenho é escuro e sumiria sobre a vinheta da foto;
 *  - sem logo: glifo inline em branco sobre a cor da marca.
 *
 * O RESPIRO É POR ASSET, e não um número só, porque o desenho de cada um ocupa
 * o viewBox de um jeito — medi antes de escolher:
 *
 *  - YouTube: o botão de play é largo e baixo (1,42:1), então com
 *    `object-contain` num quadrado a largura é que aperta, não a altura. 12%.
 *
 *    O ARQUIVO foi corrigido junto: o viewBox vinha `0 0 333333 333333` com o
 *    desenho ocupando só 70% da ALTURA — 15% de vazio em cima e embaixo,
 *    embutido no asset. Aqui isso era compensado com um respiro menor, mas
 *    `ChannelLogo` (onboarding) desenha o SVG cru, sem tile e sem respiro, e lá
 *    o logo saía visivelmente menor que os outros. O viewBox agora é a caixa
 *    real do desenho, então os dois componentes acertam sem compensação.
 *  - Twitch: viewBox 439×512, mais alto que largo. Com `object-contain` a
 *    altura é que manda, então a largura já sai reduzida sozinha; 12% chega no
 *    mesmo peso óptico dos quadrados.
 *
 * Website NÃO está mais nesta lista: o asset era o único em traço fino, sem
 * preenchimento — um globo preto vazado enquanto os outros treze são tiles
 * sólidos de ícone de app. Não havia respiro que resolvesse, porque o problema
 * era o desenho, não o tamanho. Virou disco cinza da marca com o globo em
 * branco, e por isso agora é `logoTemTile`.
 *
 * `aria-hidden` no desenho: quem rotula é sempre o link em volta (`aria-label`
 * com o nome da rede), então repetir aqui só faria o leitor de tela dizer
 * "Instagram Instagram".
 */
export function PlatformIcon({
  def,
  className = '',
}: {
  def: PlatformDef
  className?: string
}) {
  /**
   * O respiro é o TAMANHO DO DESENHO, não o padding do tile — e essa distinção
   * é a diferença entre funcionar e explodir.
   *
   * `padding: 15%` parece dizer "15% de mim", mas porcentagem em padding
   * resolve contra a LARGURA DO PAI, sempre. Enquanto o pai era do tamanho da
   * bolinha (a fileira de redes), os dois valores coincidiam e ninguém notava.
   * Bastou o mesmo ícone aparecer no cabeçalho do campo — onde o pai é uma
   * linha de largura inteira — para o padding virar ~160px: com `box-sizing:
   * border-box`, a caixa não tem como encolher abaixo do próprio padding, e o
   * `size-6` de 24px virou um disco branco gigante.
   *
   * Medindo a IMAGEM em vez do tile, a porcentagem passa a se referir ao span
   * — que tem tamanho definido por quem o usa — e o ícone fica igual em
   * qualquer contexto.
   */
  const respiro = def.logoRespiro ?? 15
  const ladoDoDesenho = `${100 - respiro * 2}%`

  if (def.logo) {
    return (
      <span
        aria-hidden
        className={`flex items-center justify-center overflow-hidden ${className}`}
        style={def.logoTemTile ? undefined : { backgroundColor: def.logoFundo ?? '#FFFFFF' }}
      >
        {/* next/image está com `unoptimized` no projeto — <img> direto evita a
            camada extra sem ganho nenhum num SVG local. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={def.logo}
          alt=""
          className="object-contain"
          style={{
            // Com tile próprio o asset vai de borda a borda; sem ele, encolhe
            // para abrir a margem que faz o desenho ler como ícone de app.
            width: def.logoTemTile ? '100%' : ladoDoDesenho,
            height: def.logoTemTile ? '100%' : ladoDoDesenho,
            ...(def.logoDeslocamento
              ? { transform: `translate(${def.logoDeslocamento.x}%, ${def.logoDeslocamento.y}%)` }
              : null),
          }}
        />
      </span>
    )
  }

  return (
    <span
      aria-hidden
      className={`flex items-center justify-center overflow-hidden text-white ${className}`}
      style={{ backgroundColor: def.cor }}
    >
      {/* Mesma correção do caso acima: quem mede é o glifo, não o tile. 56% é
          o que os antigos 22% de padding davam. */}
      <span className="flex items-center justify-center" style={{ width: '56%', height: '56%' }}>
        {def.icone}
      </span>
    </span>
  )
}

/** URL final de uma rede: handle → URL da plataforma, ou a URL crua salva. */
export function urlDaRede(platform: string, handle: string, url: string | null) {
  const def = PLATFORM_BY_ID.get(platform as PlatformId)
  if (!def) return url ?? null
  if (def.href && handle) return def.href(handle)
  return url ? normalizarUrl(url) : null
}
