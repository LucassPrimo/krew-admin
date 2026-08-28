'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { Check, ChevronLeft, ChevronRight, Loader2, Trash2 } from 'lucide-react'

import { cn } from '@/lib/utils'
import { saveSocialNetworks } from '@/app/actions/social-networks'
import {
  CATEGORIAS,
  PLATFORMS,
  PlatformIcon,
  normalizarHandle,
  normalizarUrl,
  type Categoria,
  type PlatformId,
} from '@/components/bio/platforms'

/**
 * A chave de tradução de cada gaveta.
 *
 * Um mapa explícito, e não `` `categoria${cat}` ``: chave montada por
 * concatenação some do `grep`, e o dia em que uma categoria for renomeada o
 * rótulo simplesmente vira a própria chave em tela, sem erro de build.
 */
const ROTULO_CATEGORIA: Record<Categoria, string> = {
  social: 'categoriaSocial',
  negocios: 'categoriaNegocios',
  musica: 'categoriaMusica',
  pagamento: 'categoriaPagamento',
  entretenimento: 'categoriaEntretenimento',
  estilo: 'categoriaEstilo',
  outros: 'categoriaOutros',
}

function rotuloCategoria(cat: Categoria) {
  return ROTULO_CATEGORIA[cat]
}

/**
 * Uma bolinha da fileira.
 *
 * Extraída porque ela aparece em DOIS lugares — nas redes já escolhidas e
 * dentro da gaveta aberta — e duas cópias do mesmo botão divergiriam no
 * primeiro ajuste de estado visual.
 */
function Bolinha({
  def,
  preenchida,
  aberta,
  aoClicar,
}: {
  def: (typeof PLATFORMS)[number]
  preenchida: boolean
  aberta: boolean
  aoClicar: (id: PlatformId) => void
}) {
  return (
    <button
      type="button"
      onClick={() => aoClicar(def.id)}
      aria-pressed={preenchida}
      aria-expanded={aberta}
      // O nome só no `title`/`aria-label`: o rótulo embaixo de cada bolinha
      // dobrava a altura da fileira para repetir o que o desenho da marca já
      // diz.
      aria-label={def.label}
      title={def.label}
      className={cn(
        // `shrink-0`: a fileira é `flex`, e sem isto o navegador encolhe as
        // bolinhas para caber mais numa linha — com muitas redes elas saíam de
        // tamanhos diferentes, e não é o desenho que muda, é o layout cedendo.
        //
        // O `p-1` fica SEMPRE, ligado ou não. Ele é a folga onde o anel de
        // seleção cabe: como o anel era desenhado do lado de fora
        // (`ring-offset`), a bolinha da ponta tinha o próprio contorno cortado
        // pelo recorte do carrossel. Padding constante também garante que
        // selecionar não mexa em milímetro nenhum da fileira.
        'relative shrink-0 rounded-full p-1 transition-all duration-200',
        preenchida
          ? 'opacity-100 hover:scale-105'
          : 'opacity-40 grayscale hover:opacity-100 hover:grayscale-0',
        aberta && 'ring-2 ring-primary',
      )}
    >
      <PlatformIcon def={def} className="size-11 rounded-full" />
      {preenchida && (
        <span className="absolute right-0.5 bottom-0.5 rounded-full bg-card p-[2px]">
          <span className="flex size-4 items-center justify-center rounded-full bg-emerald-500 text-white">
            <Check className="size-2.5" />
          </span>
        </span>
      )}
    </button>
  )
}

interface RedeEditavel {
  platform: string
  handle: string
  url: string | null
  ordem?: number | null
  ativo?: boolean | null
}

/**
 * As redes da bio: uma fileira de bolinhas, e o campo abre na que se clica.
 *
 * O desenho é a própria fileira da página pública — as mesmas marcas, na mesma
 * forma redonda. Quem já está preenchido aparece em cor cheia; o resto fica
 * apagado e sem cor. Assim a pergunta "o que falta?" se responde olhando, sem
 * ler uma lista de "tal rede → tal link" embaixo, que era a mesma informação
 * escrita duas vezes.
 *
 * O campo abre INLINE, logo abaixo da bolinha clicada, e não num diálogo: um
 * modal cobre justamente a fileira que dá o contexto ("já pus Instagram e
 * TikTok, falta o YouTube"), e fecha a cada rede, o que transforma preencher
 * três redes em três aberturas e três fechamentos.
 *
 * Salva o conjunto INTEIRO a cada confirmação, porque é isso que
 * `saveSocialNetworks` faz (ver a action): ela troca a lista toda de uma vez.
 * Por isso o estado local carrega todas as redes, e não só a que está aberta.
 */
export function BioRedesCard({ redesIniciais }: { redesIniciais: RedeEditavel[] }) {
  const t = useTranslations('bioConfig')
  const [pendente, iniciar] = useTransition()
  const [salvo, setSalvo] = useState(false)
  const [redes, setRedes] = useState<RedeEditavel[]>(
    redesIniciais.map((r) => ({ ...r, url: r.url ?? '' }))
  )

  const [aberta, setAberta] = useState<PlatformId | null>(null)
  /** A categoria em tela. Índice em `grupos`, não a chave: o carrossel anda de
   *  um em um, e é a posição que ele precisa saber para ir ao lado. */
  const [indice, setIndice] = useState(0)
  const trilho = useRef<HTMLDivElement>(null)
  /** Ponteiro em cima ou foco dentro: o giro espera. */
  const [pausado, setPausado] = useState(false)
  /** Depois de a pessoa navegar por conta própria, o giro não volta. */
  const [assumido, setAssumido] = useState(false)
  const [valor, setValor] = useState('')

  const def = aberta ? (PLATFORMS.find((p) => p.id === aberta) ?? null) : null
  // `href` é o que separa as duas famílias: rede com endereço previsível pede
  // só o @; site e afins pedem a URL inteira. Ver `platforms.tsx`.
  const pedeHandle = !!def?.href

  function abrir(id: PlatformId) {
    if (aberta === id) {
      setAberta(null)
      return
    }
    const atual = redes.find((r) => r.platform === id)
    const defDaRede = PLATFORMS.find((p) => p.id === id)
    setValor(atual ? (defDaRede?.href ? atual.handle : (atual.url ?? '')) : '')
    setAberta(id)
  }

  /** Devolve a lista com esta rede aplicada — vazia significa remover. */
  function comRede(lista: RedeEditavel[], id: PlatformId, bruto: string) {
    const defDaRede = PLATFORMS.find((p) => p.id === id)
    const ehHandle = !!defDaRede?.href
    const limpo = ehHandle ? normalizarHandle(bruto) : normalizarUrl(bruto)

    if (!limpo) return lista.filter((r) => r.platform !== id)

    const nova: RedeEditavel = {
      platform: id,
      handle: ehHandle ? limpo : '',
      url: ehHandle ? null : limpo,
      ativo: true,
    }
    return lista.some((r) => r.platform === id)
      ? lista.map((r) => (r.platform === id ? { ...r, ...nova } : r))
      : [...lista, nova]
  }

  function confirmar(bruto: string) {
    if (!aberta) return
    const proxima = comRede(redes, aberta, bruto)
    setRedes(proxima)
    setAberta(null)
    gravar(proxima)
  }

  function gravar(lista: RedeEditavel[]) {
    iniciar(async () => {
      await saveSocialNetworks(
        lista.map((r, i) => ({
          platform: r.platform,
          handle: r.handle,
          url: r.url || null,
          ordem: i,
          ativo: true,
        }))
      )
      setSalvo(true)
      setTimeout(() => setSalvo(false), 1500)
    })
  }

  /**
   * As bolinhas agrupadas por categoria, na ordem de `CATEGORIAS`.
   *
   * Com uma dezena de redes a fileira única funcionava: cabia em duas linhas e
   * dava para varrer de olho. Com quase sessenta ela virou um paredão em que
   * achar o Spotify custa mais do que digitar o endereço dele à mão — que é o
   * oposto do que a fileira existe para fazer.
   *
   * A contagem ao lado do título é o que já está PREENCHIDO naquela gaveta, e
   * não o total dela. O total é a mesma informação que as bolinhas visíveis já
   * dão; o preenchido responde "falta alguma coisa aqui?" sem abrir nada.
   */
  // Na ordem do PRÓPRIO criador (`ordem` da rede), e não na ordem do catálogo:
  // esta fileira é a página dele, e vê-la fora de ordem aqui atrapalharia
  // justamente quem veio conferir como ela ficou.
  const escolhidas = redes
    .filter((r) => r.handle || r.url)
    .map((r) => PLATFORMS.find((p) => p.id === r.platform))
    .filter((p): p is (typeof PLATFORMS)[number] => !!p)

  /**
   * Leva o trilho até a categoria `i`, dando a volta nas pontas.
   *
   * Circular e não travado: uma seta desabilitada na primeira e na última
   * categoria transforma sete passos em "ir até o fim e voltar catando", e
   * aqui não há começo nem fim de verdade — é uma lista de gavetas, não uma
   * sequência com ordem própria.
   *
   * Quem manda no estado é a ROLAGEM (`aoRolar`), não este clique: se o
   * `setIndice` viesse daqui, arrastar com o dedo deixaria o título falando
   * de uma categoria e o trilho mostrando outra.
   */
  function irPara(i: number, manual = true) {
    const el = trilho.current
    if (!el) return
    if (manual) setAssumido(true)
    const total = grupos.length
    const alvo = ((i % total) + total) % total
    el.scrollTo({ left: alvo * el.clientWidth, behavior: 'smooth' })
  }

  function aoRolar() {
    const el = trilho.current
    if (!el || el.clientWidth === 0) return
    // Preso ao intervalo: no iOS a rolagem elástica passa do fim e devolveria
    // um índice fora da lista, que quebraria o título.
    const bruto = Math.round(el.scrollLeft / el.clientWidth)
    const i = Math.min(Math.max(bruto, 0), grupos.length - 1)
    setIndice((atual) => (atual === i ? atual : i))
  }

  /**
   * Realinha o trilho quando a LARGURA dele muda.
   *
   * A posição de uma categoria é `índice × clientWidth`, em pixels. Abrir o
   * campo de uma rede faz o cartão crescer, o que pode fazer a página ganhar
   * barra de rolagem e a coluna encolher alguns pixels — e a posição guardada
   * deixa de cair na fronteira entre dois painéis. O resultado é meia
   * categoria de cada lado, que é o "tamanho bugando" ao clicar.
   *
   * Sem `smooth`: isto é correção de alinhamento, não navegação. Uma animação
   * aqui pareceria a tela se mexendo sozinha.
   */
  useEffect(() => {
    const el = trilho.current
    if (!el) return
    const obs = new ResizeObserver(() => {
      el.scrollTo({ left: indice * el.clientWidth, behavior: 'auto' })
    })
    obs.observe(el)
    return () => obs.disconnect()
  }, [indice])

  /**
   * O giro automático.
   *
   * Ele existe para MOSTRAR que há mais categorias do lado: um carrossel
   * parado na primeira gaveta parece uma fileira comum, e a pessoa nunca
   * descobre que Música e Pagamento existem. Passando sozinho, devagar, a
   * descoberta acontece sem ninguém precisar clicar em nada.
   *
   * Ele para em quatro situações, e cada uma tem um motivo diferente:
   *
   *   - `aberta` — há um campo aberto. Girar tiraria da tela a bolinha que a
   *     pessoa acabou de clicar, no meio da digitação;
   *   - `pausado` — o ponteiro está em cima ou o foco está dentro. Quem está
   *     lendo a fileira não quer que ela ande;
   *   - `assumido` — a pessoa navegou por conta própria (seta, ponto, arrasto).
   *     Daí em diante ela manda, e o giro não volta: um carrossel que retoma
   *     depois de você escolher uma categoria é briga por controle;
   *   - `prefers-reduced-motion` — movimento automático é exatamente o que
   *     essa preferência pede para não acontecer.
   *
   * Sete segundos: tempo de ler a fileira inteira antes de ela trocar.
   */
  useEffect(() => {
    if (aberta || pausado || assumido) return
    if (typeof window === 'undefined') return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const id = setInterval(() => {
      const el = trilho.current
      if (!el || el.clientWidth === 0) return
      // A posição atual vem do DOM, e não do estado: assim o intervalo não
      // precisa ser recriado a cada passada, e um giro em andamento nunca é
      // contado duas vezes.
      const atual = Math.round(el.scrollLeft / el.clientWidth)
      irPara(atual + 1, false)
    }, 7000)

    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberta, pausado, assumido])

  const grupos = CATEGORIAS.map((cat) => {
    const itens = PLATFORMS.filter((p) => p.categoria === cat)
    const preenchidas = itens.filter((p) => {
      const r = redes.find((x) => x.platform === p.id)
      return !!(r?.handle || r?.url)
    }).length
    return { cat, itens, preenchidas }
  }).filter((g) => g.itens.length > 0)

  return (
    <div className="flex flex-col gap-3">
      {/* O que JÁ está na página, sempre à mão.
          Sem isto, editar o Instagram que você acabou de pôr custaria lembrar
          em qual gaveta ele mora — e as redes preenchidas são justamente as
          que se mexe de novo. Elas aparecem aqui além de aparecerem na
          gaveta delas; é repetição de propósito, porque as duas perguntas
          ("o que já tem?" e "onde acho o X?") são diferentes. */}
      {escolhidas.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {escolhidas.map((p) => (
            <Bolinha key={p.id} def={p} preenchida aberta={aberta === p.id} aoClicar={abrir} />
          ))}
        </div>
      )}

      {/* O carrossel das categorias.
          Uma por vez, e passa para o lado — nem o paredão de sessenta
          bolinhas nem a lista de gavetas que obrigava a entrar e voltar para
          espiar o que tem dentro de cada uma. Aqui o conteúdo está sempre em
          tela e a navegação é um gesto.
          É rolagem de VERDADE com `scroll-snap`, e não um `translateX`
          calculado: assim o dedo arrasta no celular sem nenhum código de
          toque, o teclado navega com as setas nativas, e as flechas viram um
          atalho para quem está no mouse — em vez de serem a única saída. */}
      <div
        className="flex flex-col gap-1.5"
        onPointerEnter={() => setPausado(true)}
        onPointerLeave={() => setPausado(false)}
        onFocusCapture={() => setPausado(true)}
        onBlurCapture={() => setPausado(false)}
        // Arrastar com o dedo é navegar: `pointerleave` não chega no toque, e
        // sem isto o giro voltaria a empurrar a fileira logo depois.
        onPointerDown={() => setAssumido(true)}
      >
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => irPara(indice - 1)}
            aria-label={t('redesAnterior')}
            className="flex size-6 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ChevronLeft className="size-4" />
          </button>

          <p className="flex flex-1 items-center justify-center gap-1.5 text-[11px] font-semibold tracking-wide text-foreground uppercase">
            {t(rotuloCategoria(grupos[indice].cat))}
            {grupos[indice].preenchidas > 0 && (
              <span className="rounded-full bg-primary/10 px-1.5 text-[10px] font-semibold text-primary">
                {grupos[indice].preenchidas}
              </span>
            )}
          </p>

          <button
            type="button"
            onClick={() => irPara(indice + 1)}
            aria-label={t('redesProxima')}
            className="flex size-6 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>

        <div
          ref={trilho}
          onScroll={aoRolar}
          // `snap-mandatory` e não `proximity`: a parada tem que cair sempre
          // numa categoria inteira, senão sobra meia fileira de cada lado e
          // a pessoa não sabe qual das duas está lendo.
          // `scrollbar-none` só esconde a barra — a rolagem continua.
          className="flex snap-x snap-mandatory overflow-x-auto motion-safe:scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {grupos.map(({ cat, itens }) => (
            // `w-full shrink-0`: cada painel ocupa a largura do cartão, que é
            // o que faz um snap valer uma categoria. A altura do trilho é a
            // da MAIOR delas, e isso é de propósito — sem uma altura estável
            // o cartão pularia a cada passada.
            <div key={cat} className="flex w-full shrink-0 snap-center flex-wrap content-start gap-2">
              {itens.map((p) => {
                const r = redes.find((x) => x.platform === p.id)
                return (
                  <Bolinha
                    key={p.id}
                    def={p}
                    preenchida={!!(r?.handle || r?.url)}
                    aberta={aberta === p.id}
                    aoClicar={abrir}
                  />
                )
              })}
            </div>
          ))}
        </div>

        {/* Os pontos dizem onde se está e quanto falta. Sem eles o carrossel
            não tem borda visível: passa-se para o lado sem saber se ainda há
            lado. Clicáveis porque um ponto que marca posição e não leva até
            ela é enfeite. */}
        <div className="flex justify-center gap-1.5 pt-0.5">
          {grupos.map(({ cat }, i) => (
            <button
              key={cat}
              type="button"
              onClick={() => irPara(i)}
              aria-label={t(rotuloCategoria(cat))}
              aria-current={i === indice}
              className={cn(
                'size-1.5 rounded-full transition-colors',
                i === indice ? 'bg-primary' : 'bg-border hover:bg-muted-foreground',
              )}
            />
          ))}
        </div>
      </div>

      {def && (
        <div className="flex flex-col gap-2 rounded-xl border border-border bg-background p-3">
          <div className="flex items-center gap-2">
            <PlatformIcon def={def} className="size-6 rounded-full" />
            <span className="text-sm font-semibold text-foreground">{def.label}</span>
            {redes.some((r) => r.platform === def.id) && (
              <button
                type="button"
                onClick={() => confirmar('')}
                aria-label={t('remover')}
                title={t('remover')}
                className="ml-auto flex size-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
              >
                <Trash2 className="size-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <input
              autoFocus
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') confirmar(valor)
                if (e.key === 'Escape') setAberta(null)
              }}
              placeholder={pedeHandle ? t('handlePlaceholder') : t('urlPlaceholder')}
              inputMode={pedeHandle ? 'text' : 'url'}
              className="h-10 flex-1 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary"
            />
            <button
              type="button"
              onClick={() => confirmar(valor)}
              disabled={pendente}
              className="flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-primary px-3 text-xs font-semibold text-primary-foreground disabled:opacity-50"
            >
              {pendente ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Check className="size-3.5" />
              )}
              {t('salvar')}
            </button>
          </div>

          <p className="text-[11px] text-muted-foreground">{t('colarUsuarioDica')}</p>
        </div>
      )}

      {/* Sem botão de salvar geral: cada rede grava ao confirmar, e o aviso
          abaixo é o recibo. Um "salvar" no pé da seção prometeria que o resto
          da tela também espera por ele — e não espera, tudo aqui grava sozinho. */}
      <p className="flex h-4 items-center gap-1.5 text-[11px] text-muted-foreground">
        {pendente && (
          <>
            <Loader2 className="size-3 animate-spin" />
            {t('salvando')}
          </>
        )}
        {!pendente && salvo && (
          <>
            <Check className="size-3 text-emerald-500" />
            {t('salvo')}
          </>
        )}
        {!pendente && !salvo && redes.length === 0 && t('redesVazio')}
      </p>
    </div>
  )
}
