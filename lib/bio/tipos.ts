/**
 * Formato da bio pública, como o RPC `get_bio_by_slug` devolve.
 *
 * Mora aqui, e NÃO em `app/actions/bio.ts`, por um motivo que só aparece sob
 * carga: aquele arquivo é `'use server'`, e importar dele — mesmo só um TIPO —
 * faz o bundler arrastar o módulo inteiro para o pacote de quem importou. Com
 * ele vinha `lib/org.ts`, que chama `cookies()`. Resultado medido: a página
 * `/@handle` virava dinâmica em tempo de execução ("Page changed from static to
 * dynamic at runtime, reason: cookies"), a CDN recusava guardá-la, e cada
 * visitante de um lançamento virava uma renderização no servidor.
 *
 * Tipo é apagado na compilação, então a intuição de que "importar tipo é de
 * graça" está certa para o TypeScript — e errada para o empacotador do Next.
 */

export interface BioRede {
  platform: string
  handle: string
  url: string | null
  followers: number | null
}

/** Link clicável ou título de seção. O divisor não tem URL. */
export type TipoItem = 'link' | 'divisor'

/**
 * Como o card é desenhado. Os três formatos da página de referência:
 *
 *   grande  largura inteira, capa alta, ícone grande no canto
 *   metade  meia largura, dois por linha
 *   meio    faixa com o fundo desfocado da própria capa e miniatura ao lado
 *
 * Substituiu o antigo `destaque` booleano, que só sabia responder
 * "largo ou não" — e a referência tem três larguras, não duas.
 */
export type EstiloItem = 'grande' | 'metade' | 'meio'


export interface BioLink {
  id: string
  titulo: string
  /** Null no divisor — é o que o CHECK `creator_links_url_por_tipo` garante. */
  url: string | null
  /** URL pública da capa no bucket `capas`. Null = card no bloco tingido. */
  capa: string | null
  tipo: TipoItem
  estilo: EstiloItem
}

export interface BioData {
  slug: string
  nome: string | null
  /** A foto do perfil. Continua sendo o rosto: barra do topo, OG de reserva. */
  avatarUrl: string | null
  /** A capa escolhida para o topo da página. Null = usa `avatarUrl`. */
  capaUrl: string | null
  headline: string | null
  bio: string | null
  nicho: string | null
  cidade: string | null
  estado: string | null
  /** Selo concedido pela Krew, nunca pelo dono da página. */
  verificado: boolean
  /** Assinatura de pé — a segunda porta para o mesmo selo. Booleano e não a
   *  linha da assinatura: esta página é pública (ver a migration do selo). */
  pro: boolean
  tema: {
    theme: string
    bg_color: string
    form_color: string
    form_font: string
    title_font: string
    border_style: string
    title_text: string | null
    locale: string
  }
  redes: BioRede[]
  links: BioLink[]
  seguidoresTotal: number | null
  mostrarPropostas: boolean
  esconderMarca: boolean
}
