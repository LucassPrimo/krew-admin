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
/**
 * `marca` é a logo do carrossel de marcas parceiras (ver a migration
 * `20260901120000` no repo do app). Está aqui porque o CHECK de
 * `creator_links.tipo` é o mesmo banco — um valor a menos deste lado vira erro
 * de constraint no insert da oferta, que é exatamente o que aconteceu com o
 * `'pequeno'` inventado no importador.
 */
export type TipoItem = 'link' | 'divisor' | 'marca'

/**
 * Como o card é desenhado. Os três formatos da página de referência, mais o
 * botão:
 *
 *   grande  largura inteira, capa alta, ícone grande no canto
 *   metade  meia largura, dois por linha, capa deitada
 *   metade_alta  meia largura, dois por linha, capa em pé (4:5)
 *   meio    faixa com o fundo desfocado da própria capa e miniatura ao lado
 *   botao   bloco tingido, sem imagem — a linha de texto com o glifo da marca
 *
 * Substituiu o antigo `destaque` booleano, que só sabia responder
 * "largo ou não" — e a referência tem três larguras, não duas.
 *
 * `botao` entrou depois, e é o único que NÃO fala de largura: ele diz para não
 * desenhar a imagem. Antes disso o botão era uma ausência — item sem capa —, o
 * que obrigava a APAGAR a arte para enxugar um link e a reenviá-la para voltar
 * atrás. Sendo estilo, a capa fica guardada enquanto não for mostrada.
 *
 * A ausência continua valendo: item sem capa sai como botão em qualquer
 * estilo. São dois caminhos para o mesmo desenho, e é de propósito — é o que
 * fez esta mudança não precisar converter uma linha do que já estava gravado.
 */
export type EstiloItem = 'grande' | 'metade' | 'metade_alta' | 'meio' | 'botao'


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
  /**
   * Página montada pela Krew e ainda sem dono — uma bio de oferta em aberto.
   *
   * Existe por causa de uma coisa só: ela NÃO é rebaixada para Free (ver
   * `rebaixarBioParaFree`). A conta-fantasma não tem plano porque não tem
   * ninguém, e cortá-la em 3 links faria a vitrine mostrar o produto capado
   * justamente para quem ainda vai decidir se compra.
   *
   * Separado de `pro` de propósito: `pro` também acende o selo de verificado,
   * e uma página de quem não é cliente não pode exibi-lo. Vira falso no
   * momento em que a oferta é aceita, e daí em diante valem as regras de
   * todo mundo.
   *
   * Opcional porque `get_bio_leve` e chamadas antigas não o mandam; ausente
   * é o mesmo que falso.
   */
  oferta?: boolean
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
