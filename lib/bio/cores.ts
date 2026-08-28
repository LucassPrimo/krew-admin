/**
 * A cor de fundo da página `/@handle`.
 *
 * ---------------------------------------------------------------------------
 * Por que existe, depois de `20260817181701_bio_tema_proprio.sql` ter recusado
 * ---------------------------------------------------------------------------
 * Aquela migration deixou `bio_bg_color` de fora com um argumento correto: um
 * hex livre reabre a porta para texto branco sobre fundo branco, e a bio é a
 * vitrine mais pública do produto — não pode depender de a pessoa escolher bem.
 *
 * O que mudou não é o apetite por risco, é de onde sai o texto. Antes o branco
 * era CONSTANTE no CSS; agora ele é DERIVADO do fundo (`corDoTexto`). Com a
 * cor do texto amarrada à luminância do fundo, "branco sobre branco" deixa de
 * ser um estado alcançável — escolher #FFFFFF produz texto quase preto, não um
 * texto invisível. A escolha vale para o fundo; o contraste não é escolha de
 * ninguém.
 *
 * Todo o resto da paleta (superfícies, degradês, barra do topo) passa a sair
 * daqui pelos mesmos dois números — ver `variaveisDaPagina`.
 */

/** Mesmo formato do CHECK da coluna. Validado de novo aqui porque o valor vai
 *  direto para um `style` do navegador — nunca confiar no que veio do banco só
 *  porque veio do banco. Ver `lib/campanha-cores.ts`, mesma regra. */
const HEX = /^#[0-9A-Fa-f]{6}$/

/** O preto da referência, e o que toda página tinha antes desta funcionalidade.
 *  `bio_bg_color` nulo cai aqui — é o que mantém a página de quem nunca abriu
 *  este controle exatamente como estava. */
export const COR_FUNDO_PADRAO = '#000000'

/**
 * As amostras oferecidas na tela de edição.
 *
 * Escuras na maioria, e isso é a opinião do produto: a capa é uma foto de tela
 * cheia com o nome por cima, e o degradê que funde a foto no fundo tem muito
 * mais para onde ir a partir de um tom escuro. O branco está lá porque quem
 * quer uma página clara quer branco, não "quase branco" — mas ele é o último.
 *
 * Não é a lista de valores VÁLIDOS: o campo aceita qualquer hex (o seletor do
 * navegador está logo ao lado). É a lista de valores que dispensam decisão.
 */
export const CORES_FUNDO_BIO = [
  { valor: '#000000', nome: 'preto' },
  { valor: '#0B0B0C', nome: 'grafite' },
  { valor: '#12212B', nome: 'petroleo' },
  { valor: '#1B1230', nome: 'ameixa' },
  { valor: '#2A1114', nome: 'vinho' },
  { valor: '#0E2018', nome: 'floresta' },
  { valor: '#F2EDE4', nome: 'areia' },
  { valor: '#FFFFFF', nome: 'branco' },
] as const

/** A cor válida, ou o preto padrão. Ponto único de entrada — página pública e
 *  prévia chamam esta, nunca o campo cru. */
export function corDeFundoBio(cor?: string | null): string {
  return cor && HEX.test(cor) ? cor.toUpperCase() : COR_FUNDO_PADRAO
}

/** `#RRGGBB` → `[r, g, b]`. Assume hex já validado por `corDeFundoBio`. */
function canais(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/**
 * Luminância relativa (WCAG), 0 = preto, 1 = branco.
 *
 * A fórmula com gama, e não a média dos canais: verde pesa quase 7× o azul na
 * percepção. Pela média, um azul-marinho e um verde-limão de mesmo valor RGB
 * receberiam o mesmo texto — e um dos dois ficaria ilegível.
 */
export function luminancia(hex: string): number {
  const [r, g, b] = canais(hex).map((c) => {
    const v = c / 255
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/**
 * O ponto em que o preto passa a contrastar melhor que o branco.
 *
 * Não é um gosto: é onde as duas razões de contraste da WCAG se cruzam.
 * Contraste do branco sobre o fundo é `1.05 / (L + 0.05)`; o do preto é
 * `(L + 0.05) / 0.05`. Igualando os dois, `L = sqrt(1.05 × 0.05) − 0.05`.
 *
 * Estava 0.45 aqui, escolhido a olho para puxar o resultado para o texto
 * claro. O efeito era que TODO tom médio — um azul, um verde, um vinho —
 * continuava com texto branco, mesmo já sendo claro demais para isso. Meio
 * caminho não existe nesta decisão: ou o preto contrasta mais, ou o branco.
 */
const CORTE_CLARO = Math.sqrt(1.05 * 0.05) - 0.05

/** `true` quando o fundo pede texto escuro. */
export function fundoEhClaro(hex: string): boolean {
  return luminancia(hex) > CORTE_CLARO
}

/** Preto ou branco sobre o fundo — o que garante que "branco sobre branco" não
 *  seja um estado possível, por pior que seja a cor escolhida. */
export function corDoTexto(hex: string): string {
  return fundoEhClaro(hex) ? '#101012' : '#FFFFFF'
}

/**
 * As variáveis que a página inteira consome, derivadas dos dois hexes.
 *
 * Vão como `style` inline na raiz porque a cor só é conhecida em tempo de
 * execução, e o CSS Module é estático. `--fundo-rgb`/`--texto-rgb` são canais
 * soltos, não cores prontas: os degradês da capa precisam do MESMO tom com
 * alfa variável (`rgb(var(--fundo-rgb) / 0.88)`), e isso não se faz a partir
 * de um `#RRGGBB`.
 */
export function variaveisDaPagina(cor?: string | null): React.CSSProperties {
  const fundo = corDeFundoBio(cor)
  const texto = corDoTexto(fundo)
  return {
    '--fundo-rgb': canais(fundo).join(' '),
    '--texto-rgb': canais(texto).join(' '),
  } as React.CSSProperties
}
