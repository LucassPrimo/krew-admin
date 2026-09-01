'use client'

import { useTranslations } from 'next-intl'
import {
  AlertTriangle,
  RectangleHorizontal,
  RectangleVertical,
  Square,
  SquareDashed,
} from 'lucide-react'

import { GENERICO_ID, estiloSobreBranco, iconeDoLink } from '@/components/bio/icone-do-link'
import { capaDoLink } from '@/lib/bio/youtube'
import type { EstiloItem } from '@/lib/bio/tipos'
import { cn } from '@/lib/utils'

/**
 * Os quatro formatos que a pessoa escolhe, e como eles caem no banco.
 *
 * Os quatro são estilos DE VERDADE em `creator_links.estilo` (ver o CHECK, e a
 * migration `20260828120000_estilo_botao`). `botao` é o mais novo, e o único
 * que não fala de largura: ele manda não desenhar a imagem.
 *
 * Ele já foi o contrário disso — "Botão" gravava `capa = null`, porque a
 * página desenhava botão por ausência de imagem e um quarto valor pareceu
 * duplicação. O que essa economia custava só aparecia usando: pôr um link como
 * botão exigia APAGAR a arte dele, e voltar atrás exigia reenviá-la. Quem
 * importa um perfil inteiro do link.me esbarra nisso na primeira limpeza da
 * página.
 *
 * A leitura por ausência continua valendo — item sem capa é botão em qualquer
 * estilo —, e é o que fez a mudança não precisar converter nada do que já
 * estava gravado. `precisaImagem` é o que separa os dois casos: os três
 * formatos de card precisam da imagem e avisam quando ela falta; o botão não.
 */
export const FORMATOS = [
  { chave: 'grande', rotulo: 'formatoGrande', icone: Square, precisaImagem: true },
  { chave: 'meio', rotulo: 'formatoMedio', icone: RectangleHorizontal, precisaImagem: true },
  { chave: 'metade', rotulo: 'formatoDividido', icone: SquareDashed, precisaImagem: true },
  { chave: 'metade_alta', rotulo: 'formatoDivididoAlto', icone: RectangleVertical, precisaImagem: true },
  { chave: 'botao', rotulo: 'formatoBotao', icone: RectangleHorizontal, precisaImagem: false },
] as const

export type Formato = (typeof FORMATOS)[number]['chave']

/**
 * A proporção da imagem de cada formato — a tabela que a PRÉVIA desenha e o
 * RECORTE usa.
 *
 * Um lugar só, e é o ponto todo: enquadrar a foto num quadro e desenhá-la em
 * outro é a definição de recorte frustrado — a pessoa centraliza o rosto, salva
 * e a página corta a cabeça. Com a tabela aqui, mudar a forma de um formato é
 * mudar um número, e as duas telas mudam juntas.
 *
 * `botao` não desenha imagem; fica de fora e o recorte cai no padrão.
 *
 * Os dois divididos têm a proporção DECLARADA na página (`.cardMetade` e
 * `.cardMetadeAlta` em `bio-perfil.module.css`), então neles o que se recorta é
 * exatamente o que se vê. `grande` ainda tem altura fixa e largura fluida, e
 * por isso a forma real dele muda um pouco com a largura da tela — o número
 * abaixo é a forma de referência, e o `object-fit: cover` reenquadra o resto.
 */
export const PROPORCOES: Record<Exclude<Formato, 'botao'>, number> = {
  grande: 4 / 3,
  metade: 16 / 9,
  metade_alta: 4 / 5,
  // A faixa do card médio mostra a capa numa miniatura quadrada ao lado do
  // título — o resto do card é a mesma imagem desfocada, onde forma não conta.
  meio: 1,
}

/** A proporção do formato, com o padrão de quem não desenha imagem. */
export function proporcaoDoFormato(formato: Formato): number {
  return formato === 'botao' ? PROPORCOES.grande : PROPORCOES[formato]
}

/**
 * O formato escolhido a partir do que está gravado.
 *
 * Devolve o ESTILO, e nada além dele. Havia aqui um `if (!capa) return 'botao'`
 * — a leitura de que sem imagem o item "é" um botão —, e ela transformava o
 * seletor num controle morto: como o valor exibido era recalculado deste par,
 * clicar em "Grande" sem ter capa devolvia 'botao' na volta e o clique parecia
 * não ter acontecido. No formulário de criação isso era permanente, porque a
 * capa automática do link só é buscada no servidor, depois de salvar.
 *
 * O que aquela linha dizia continua verdade e continua dito — só que no lugar
 * certo: `PreviaItem` desenha o botão quando não há imagem, e o aviso embaixo
 * do seletor explica. A diferença é que agora a ESCOLHA fica gravada, e passa a
 * valer sozinha no instante em que a capa aparece.
 */
export function formatoDoItem(estilo: EstiloItem | string, _capa?: string | null): Formato {
  if (estilo === 'botao') return 'botao'
  return (FORMATOS.find((f) => f.chave === estilo)?.chave ?? 'grande') as Formato
}

/**
 * Escolher o formato vendo o card, e não adivinhando por um ícone de 16px.
 *
 * Os quatro botões mais a prévia que eles redesenham. Fica INLINE, dentro do
 * item da lista — o formato é um atributo daquele link, e mandá-lo para uma
 * gaveta separava a escolha do card que ela muda.
 */
export function SeletorFormato({
  formato,
  titulo,
  capa,
  url,
  aoEscolher,
}: {
  formato: Formato
  titulo: string
  capa: string | null
  url: string | null
  aoEscolher: (formato: Formato) => void
}) {
  const t = useTranslations('bioConfig')
  const escolhido = FORMATOS.find((f) => f.chave === formato)!
  // A capa que vale: a escolhida, e na falta dela a que o próprio link fornece
  // (hoje, o YouTube). Resolver isto aqui é o que faz a prévia e o aviso
  // dizerem a verdade DURANTE a digitação — o servidor só vai buscar a capa
  // automática ao salvar, e até lá a tela não teria como saber que ela existe.
  const capaEfetiva = capa ?? capaDoLink(url)
  // O aviso é honesto: sem imagem nenhuma a página desenha o bloco tingido, que
  // é o botão — independente do estilo escolhido aqui.
  const viraBotao = escolhido.precisaImagem && !capaEfetiva

  return (
    <div className="flex flex-col gap-2">
      <PreviaItem formato={formato} titulo={titulo} capa={capaEfetiva} url={url} />

      {/* Cinco colunas desde que o dividido ganhou a versão em pé. Uma linha
          só, e não duas de duas: os formatos são alternativas entre si, e uma
          quebra de linha sugere agrupamento que não existe. */}
      <div className="grid grid-cols-5 gap-1.5">
        {FORMATOS.map((f) => (
          <button
            key={f.chave}
            type="button"
            onClick={() => aoEscolher(f.chave)}
            aria-pressed={formato === f.chave}
            className={cn(
              'flex flex-col items-center gap-1 rounded-lg border p-2 transition-colors',
              formato === f.chave
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border text-muted-foreground hover:bg-muted'
            )}
          >
            <f.icone className="size-3.5" aria-hidden />
            <span className="text-[10px] font-medium">{t(f.rotulo)}</span>
          </button>
        ))}
      </div>

      {viraBotao && (
        <p className="flex items-start gap-2 rounded-lg border border-yellow-500/40 bg-yellow-500/10 p-2 text-[11px] text-foreground">
          <AlertTriangle className="mt-px size-3.5 shrink-0 text-yellow-600" />
          {t('avisoSemImagem')}
        </p>
      )}
    </div>
  )
}

/**
 * O card como a página vai desenhá-lo, redesenhado a cada troca de formato.
 *
 * As medidas saem de `bio-perfil.module.css` — raio de 20px, miniatura de 64px,
 * véu de 30%, desfoque de 20px no fundo do card médio. Não é o CSS de lá
 * importado (a página se pinta com a cor de fundo do criador, e as variáveis
 * dela não existem aqui), mas é o mesmo desenho: uma prévia que erra o formato
 * é pior que nenhuma, porque ela é justamente o que se olha para escolher.
 */
export function PreviaItem({
  formato,
  titulo,
  capa,
  url,
}: {
  formato: Formato
  titulo: string
  capa: string | null
  url: string | null
}) {
  const icone = iconeDoLink(url)
  const Glifo = icone.icone
  const paleta = estiloSobreBranco(icone.cor)
  const generico = icone.id === GENERICO_ID
  // Sem imagem a página desenha o botão, qualquer que seja o estilo.
  const semImagem = formato === 'botao' || !capa

  const selo = (
    <span
      aria-hidden
      className={cn(
        'flex size-7 shrink-0 items-center justify-center rounded-full [&>svg]:size-3.5',
        generico && 'bg-transparent text-white'
      )}
      style={generico ? undefined : paleta}
    >
      <Glifo />
    </span>
  )

  if (semImagem) {
    return (
      <div className="flex h-11 items-center justify-center gap-2 rounded-full bg-foreground text-background px-4">
        <Glifo className="h-4 w-4 shrink-0" />
        <span className="truncate text-sm font-bold">
          {titulo}
        </span>
      </div>
    )
  }

  if (formato === 'meio') {
    // A faixa da página: o fundo é a PRÓPRIA capa, desfocada e ampliada, com um
    // véu escuro por cima e a miniatura nítida ao lado. É o que diferencia este
    // formato do card grande — ele não mostra a foto, ele se tinge com ela.
    return (
      <div className="relative overflow-hidden rounded-[20px]">
        <span
          aria-hidden
          className="absolute -inset-10 scale-[1.2] bg-cover bg-center blur-[20px]"
          style={{ backgroundImage: `url(${capa})` }}
        />
        <span aria-hidden className="absolute inset-0 bg-black/30" />

        <div className="relative flex items-center gap-3 p-3">
          <span className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white/20">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={capa!} alt="" className="h-full w-full object-cover" />
          </span>
          <span className="min-w-0 flex-1 truncate text-base font-semibold text-white">
            {titulo}
          </span>
        </div>
      </div>
    )
  }

  // `grande` e os dois divididos compartilham a anatomia — imagem, selo no
  // canto, título no pé sobre a foto. O que muda é a largura e, no dividido em
  // pé, também a proporção. É exatamente o que se quer ver antes de escolher.
  const dividido = formato === 'metade' || formato === 'metade_alta'
  return (
    <div className={cn('mx-auto', dividido ? 'w-1/2' : 'w-full')}>
      {/* `style` e não classe: o scanner estático do Tailwind v4 não vê classe
          montada em tempo de execução, e `aspect-[${n}]` sumiria no build. */}
      <div
        className="relative overflow-hidden rounded-[20px] bg-muted"
        style={{ aspectRatio: proporcaoDoFormato(formato) }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={capa!} alt="" className="absolute inset-0 h-full w-full object-cover" />
        {/* O MESMO véu da página (`.card::after`): 10% chapado na foto inteira
            e uma rampa de 45% a 25% no pé, onde o título mora. Escrito à mão
            porque o degradê de quatro paradas não cabe numa classe do Tailwind
            — e prévia que desenha um contraste e página que entrega outro é
            pior do que não ter prévia. */}
        <span
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(to top, rgb(0 0 0 / 0.45) 0%, rgb(0 0 0 / 0.25) 32%, rgb(0 0 0 / 0.1) 55%, rgb(0 0 0 / 0.1) 100%)',
          }}
        />
        <span className="absolute top-2 left-2">{selo}</span>
        <span className="absolute inset-x-0 bottom-0 px-3 pb-3">
          <span
            className="block truncate text-center text-base font-bold text-white"
            style={{ textShadow: '0 1px 3px rgb(0 0 0 / 0.45)' }}
          >
            {titulo}
          </span>
        </span>
      </div>
    </div>
  )
}
