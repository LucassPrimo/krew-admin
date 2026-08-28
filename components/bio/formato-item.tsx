'use client'

import { useTranslations } from 'next-intl'
import { AlertTriangle, RectangleHorizontal, Square, SquareDashed } from 'lucide-react'

import { GENERICO_ID, estiloSobreBranco, iconeDoLink } from '@/components/bio/icone-do-link'
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
  { chave: 'metade', rotulo: 'formatoPequeno', icone: SquareDashed, precisaImagem: true },
  { chave: 'botao', rotulo: 'formatoBotao', icone: RectangleHorizontal, precisaImagem: false },
] as const

export type Formato = (typeof FORMATOS)[number]['chave']

/**
 * O formato escolhido a partir do que está gravado.
 *
 * A ordem importa e é a mesma da página pública (`bio-perfil.tsx`): o estilo
 * `botao` manda primeiro, mesmo havendo capa — é uma escolha explícita, e a
 * arte guardada não pode desfazê-la. Só depois vale a ausência de imagem, que
 * é o caminho antigo e cobre tudo que já estava no banco.
 */
export function formatoDoItem(estilo: EstiloItem | string, capa: string | null): Formato {
  if (estilo === 'botao') return 'botao'
  if (!capa) return 'botao'
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
  // O aviso é honesto: sem imagem a página desenha o bloco tingido, que é o
  // botão — independente do estilo escolhido aqui.
  const viraBotao = escolhido.precisaImagem && !capa

  return (
    <div className="flex flex-col gap-2">
      <PreviaItem formato={formato} titulo={titulo} capa={capa} url={url} />

      <div className="grid grid-cols-4 gap-1.5">
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

  // `grande` e `metade` dividem a mesma anatomia — imagem, selo no canto,
  // título no pé. O que muda é a largura, e é exatamente o que se quer ver.
  return (
    <div className={cn('mx-auto', formato === 'metade' ? 'w-1/2' : 'w-full')}>
      <div className="relative aspect-[4/3] overflow-hidden rounded-[20px] bg-muted">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={capa!} alt="" className="absolute inset-0 h-full w-full object-cover" />
        <span className="absolute top-2 left-2">{selo}</span>
        <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-3 pt-8 pb-3">
          <span className="block truncate text-center text-base font-bold text-white">
            {titulo}
          </span>
        </span>
      </div>
    </div>
  )
}
