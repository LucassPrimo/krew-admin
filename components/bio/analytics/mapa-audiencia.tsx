'use client'

import { memo, useEffect, useMemo, useRef, useState } from 'react'

import type { GeoBio } from '@/app/actions/bio-analytics'

/**
 * Mapa da audiência — um país pintado por intensidade de acessos.
 *
 * ---------------------------------------------------------------------------
 * Por que não é mais mancha de calor por cidade
 * ---------------------------------------------------------------------------
 * Era Leaflet com tiles da Carto e uma camada de calor plotada por lat/lng. O
 * desenho novo é o `simple-world-map`: um SVG estático em que cada país é um
 * path com `id` no padrão ISO 3166-1 alpha-2. Ele é um mapa ESTILIZADO, não
 * uma projeção — medido, ajustando a projeção por mínimos quadrados contra as
 * próprias fronteiras do arquivo, só 37 de 70 cidades de coordenada conhecida
 * caem dentro do país certo, com erro de 4 a 17px (~200 a 800km). São Paulo
 * cai no Atlântico.
 *
 * Então ponto por coordenada está fora: o resto desta feature foi construída
 * para o mapa não afirmar precisão que o dado não tem (o piso de k-anonimato,
 * o CHECK que proíbe `neighborhood`, `numeric(5,2)` no lat/lng), e plotar
 * cidade num mapa que erra 500km desmentiria tudo isso de uma vez.
 *
 * A troca também mostra MAIS dado: `porPais` conta todo acesso com país,
 * inclusive aquele cuja precisão parou em `region`/`country` e que nunca teve
 * cidade nem coordenada — em IP móvel brasileiro isso é comum, e essa faixa
 * inteira não aparecia em mapa nenhum.
 *
 * ---------------------------------------------------------------------------
 * O SVG vem por `fetch`, não por import
 * ---------------------------------------------------------------------------
 * São 73KB de path. No bundle, pesariam no JS de quem abre o painel; no HTML
 * (server component), viajariam de novo a cada visita, já que a página é
 * dinâmica. Como arquivo de `public/` ele é buscado uma vez e fica no cache do
 * navegador — e esta seção já é carregada sob demanda (`mapa-carregador`).
 *
 * `dangerouslySetInnerHTML` com arquivo NOSSO, estático, servido do próprio
 * domínio: não há entrada de terceiro no caminho.
 *
 * Crédito obrigatório (CC BY-SA 3.0): Al MacDonald / Fritz Lekschas —
 * github.com/flekschas/simple-world-map. Ver o rodapé do card.
 */

const ARQUIVO = '/mapa-mundi.svg'

/**
 * A rampa, em seis degraus de mint — quanto mais acesso, mais fundo o mint.
 *
 * Discreta e não contínua porque o mapa é lido comparando país com país, e
 * degraus nomeados na legenda dizem "quanto"; um gradiente contínuo obriga a
 * adivinhar. A rampa é a MESMA nos dois temas, e de propósito: ela vai de um
 * quase-branco esverdeado ao mint profundo da marca, e essa faixa toda destaca
 * tanto sobre o card claro quanto sobre o `#101312` do escuro. Amarrar a rampa
 * aos tokens de tema faria o degrau mais fraco encostar no fundo justamente no
 * tema em que ele precisa aparecer.
 */
const DEGRAUS = ['#E4F3EE', '#BEE4D9', '#88CFBD', '#46B49B', '#0A9A7D', '#046A56']

/**
 * Escala logarítmica, e isso não é preciosismo.
 *
 * A audiência de um criador brasileiro é ~95% Brasil. Numa escala linear, o BR
 * fica no topo e TODO o resto do mundo cai no degrau mais fraco — o mapa passa
 * a dizer só "eu sou do Brasil", que é a única coisa que a pessoa já sabia. Em
 * log, a cauda (os 8 acessos de Portugal, os 3 do Japão) se separa do zero, que
 * é justamente a leitura interessante.
 */
function degrau(eventos: number, maximo: number, mostrarTodasCidades?: boolean): number {
  // Hide locations with fewer than 3 distinct visitors unless the admin flag is set.
  if (!mostrarTodasCidades && (eventos < 3 || maximo <= 0)) return -1
  const t = Math.log1p(eventos) / Math.log1p(maximo)
  return Math.min(DEGRAUS.length - 1, Math.floor(t * DEGRAUS.length))
}

/**
 * O SVG, isolado num componente memoizado — e isso É o conserto do hover.
 *
 * O React 19 mudou a comparação de props: `updateProperties` compara a
 * REFERÊNCIA de cada prop e chama `setProp` quando ela muda. E
 * `dangerouslySetInnerHTML={{ __html: markup }}` cria um objeto novo a cada
 * render, então a referência muda SEMPRE — mesmo com a string idêntica. O
 * resultado é um `setInnerHTML` a cada render: o `<svg>` inteiro é jogado fora
 * e remontado do texto.
 *
 * Como o `pointermove` guarda a posição do balão em estado, passar o mouse
 * disparava dezenas de renders por segundo, e cada um apagava a árvore que o
 * efeito de pintura tinha acabado de decorar — o `--f` e o `data-pais` iam
 * junto. Daí a cor sumir no hover e não voltar: o efeito de pintura não roda
 * de novo (as dependências dele não mudaram), então ninguém repinta o mapa
 * recém-nascido.
 *
 * Com `memo` e uma prop que é só a string, um render do pai que não mexe no
 * `markup` não chega aqui, e o SVG no DOM é o mesmo do primeiro parto —
 * decorado uma vez, para sempre.
 */
const MapaSvg = memo(function MapaSvg({ markup }: { markup: string }) {
  return <div data-mapa dangerouslySetInnerHTML={{ __html: markup }} />
})

export interface MapaTextos {
  menos: string
  mais: string
  acessos: string
  /** Rótulo do país desconhecido pelo `Intl.DisplayNames`. */
  paisDesconhecido: string
  credito: string
}

interface Dado {
  nome: string
  eventos: number
  fatia: number
  cor: string
}

interface Foco extends Dado {
  x: number
  y: number
  /** Abaixo do cursor quando não há espaço acima — perto da borda de cima. */
  abaixo: boolean
}

export function MapaAudiencia({
  paises,
  locale,
  textos,
  mostrarTodasCidades,
}: {
  paises: GeoBio['porPais']
  locale: string
  textos: MapaTextos
  mostrarTodasCidades?: boolean
}) {
  const [markup, setMarkup] = useState<string | null>(null)
  const [erro, setErro] = useState(false)
  const [foco, setFoco] = useState<Foco | null>(null)
  const caixa = useRef<HTMLDivElement>(null)

  // `Intl.DisplayNames` resolve o nome do país no idioma do painel a partir do
  // código ISO — os oito idiomas do app saem de graça, sem uma linha nova em
  // `messages/`.
  const nomeDoPais = useMemo(() => {
    try {
      const dn = new Intl.DisplayNames([locale], { type: 'region' })
      return (cc: string) => {
        try {
          return dn.of(cc.toUpperCase()) ?? cc.toUpperCase()
        } catch {
          return cc.toUpperCase()
        }
      }
    } catch {
      return (cc: string) => cc.toUpperCase()
    }
  }, [locale])

  const maximo = useMemo(() => Math.max(0, ...paises.map((p) => p.eventos)), [paises])
  const total = useMemo(() => paises.reduce((s, p) => s + p.eventos, 0), [paises])

  /**
   * O que o tooltip mostra, indexado pelo código ISO em minúsculo — a mesma
   * chave que vira `data-pais` no SVG. Existe para o hover ser uma consulta e
   * não uma varredura: o `pointermove` é delegado, dispara dezenas de vezes
   * por segundo, e só faz um `closest()` e um lookup.
   */
  const porCodigo = useMemo(() => {
    const m = new Map<string, Dado>()
    for (const p of paises) {
      const d = degrau(p.eventos, maximo, mostrarTodasCidades)
      if (d < 0) continue
      m.set(p.country.toLowerCase(), {
        nome: nomeDoPais(p.country) || textos.paisDesconhecido,
        eventos: p.eventos,
        fatia: total > 0 ? p.eventos / total : 0,
        cor: DEGRAUS[d],
      })
    }
    return m
  }, [paises, maximo, total, nomeDoPais, textos.paisDesconhecido])

  useEffect(() => {
    let vivo = true
    fetch(ARQUIVO)
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error(String(r.status)))))
      .then((t) => {
        if (vivo) setMarkup(t)
      })
      .catch(() => {
        if (vivo) setErro(true)
      })
    return () => {
      vivo = false
    }
  }, [])

  // Pintura: roda quando o SVG entra no DOM e a cada troca de período.
  useEffect(() => {
    const raiz = caixa.current?.querySelector('svg')
    if (!raiz) return

    const pintados: SVGElement[] = []

    for (const [cc, dado] of porCodigo) {
      // Minúsculo porque o banco guarda o ISO como a borda da Vercel e o
      // GeoLite2 entregam (`BR`), e o SVG usa `id="br"`. País que o desenho
      // não tem (território pequeno, código que ele não cobre) simplesmente
      // não pinta — e continua contado em tudo que é número.
      const alvo = raiz.querySelector<SVGElement>(`#${CSS.escape(cc)}`)
      if (!alvo) continue

      // A cor entra como CUSTOM PROPERTY, não como `fill` inline, e o `fill`
      // real sai da folha de estilo abaixo. É o que conserta o hover: uma
      // regra `:hover` no CSS não tem como vencer um `style="fill:..."` no
      // elemento, então o jeito antigo obrigava o hover a mexer no fill por
      // JS — e qualquer repintura no meio do caminho deixava o país sem cor.
      // Com a variável, hover e cor do dado moram na mesma cascata.
      alvo.style.setProperty('--f', dado.cor)
      alvo.setAttribute('data-pais', cc)
      pintados.push(alvo)
    }

    return () => {
      for (const el of pintados) {
        el.style.removeProperty('--f')
        el.removeAttribute('data-pais')
      }
    }
  }, [markup, porCodigo])

  if (erro) return null

  if (!markup) {
    return <div className="h-[240px] animate-pulse rounded-2xl bg-secondary" aria-hidden />
  }

  const topo = paises[0]

  return (
    <div>
      <div
        ref={caixa}
        className="relative [&_svg]:h-auto [&_svg]:w-full"
        role="img"
        aria-label={
          topo ? `${textos.acessos}: ${nomeDoPais(topo.country)} ${topo.eventos}` : textos.acessos
        }
        // Um único listener na caixa, em vez de dois por país. Além de mais
        // barato, mata o piscar do desenho antigo: o `pointerleave` por país
        // disparava nos vãos entre os paths de um mesmo território (ilha,
        // fiorde, buraco no traçado), e o tooltip sumia e voltava a cada
        // milímetro. Aqui só sai do foco quem sai do card.
        onPointerMove={(ev) => {
          const alvo = (ev.target as Element).closest?.('[data-pais]')
          const cc = alvo?.getAttribute('data-pais')
          const dado = cc ? porCodigo.get(cc) : undefined
          if (!dado) {
            setFoco(null)
            return
          }
          const r = ev.currentTarget.getBoundingClientRect()
          const y = ev.clientY - r.top
          setFoco({
            ...dado,
            // Preso à caixa para o balão não vazar pelas laterais num país de
            // borda (Nova Zelândia, Alasca).
            x: Math.min(Math.max(ev.clientX - r.left, 78), Math.max(r.width - 78, 78)),
            y,
            abaixo: y < 58,
          })
        }}
        onPointerLeave={() => setFoco(null)}
      >
        {/* O `fill` padrão vai no <svg> e desce por HERANÇA — não nos paths.
            É o que faz a pintura funcionar: quem recebe a cor do dado é o
            elemento com o id do país (quase sempre um <g>), e o filho só herda
            se não tiver declaração própria. Uma regra `path { fill: ... }`
            solta aqui venceria a herança e o mapa ficaria cinza inteiro — por
            isso a regra dos filhos é restrita a `[data-pais] path` e é um
            `inherit` explícito, que reafirma a herança em vez de disputá-la. */}
        <style>{`
          [data-mapa] svg { fill: var(--color-secondary); }
          [data-mapa] svg path {
            stroke: var(--color-card);
            stroke-width: 0.4;
            transition: fill .25s ease, stroke .15s ease;
          }
          [data-mapa] [data-pais] { fill: var(--f); cursor: pointer; }
          [data-mapa] [data-pais] path { fill: inherit; }
          /* O foco ESCURECE o país em vez de clarear: no degrau mais forte da
             rampa não sobra para onde subir, e um "brilho" ali viraria perda
             de cor — que é exatamente o que se queria consertar. */
          [data-mapa] [data-pais]:hover {
            fill: color-mix(in oklab, var(--f) 76%, #02352A);
          }
          [data-mapa] [data-pais]:hover path {
            stroke: #02352A;
            stroke-width: 1;
            paint-order: stroke fill;
          }
          /* E o resto do mundo recua. O seletor é por PATH, não por filho
             direto do <svg>: o arquivo embrulha o mundo inteiro num único <g>,
             então esmaecer um filho direto do svg apagaria junto o país em foco. */
          [data-mapa]:has([data-pais]:hover) svg path {
            opacity: .4;
            transition: opacity .2s ease;
          }
          [data-mapa]:has([data-pais]:hover) [data-pais]:hover path,
          [data-mapa]:has([data-pais]:hover) path[data-pais]:hover { opacity: 1; }
          @media (prefers-reduced-motion: reduce) {
            [data-mapa] svg path { transition: none; }
          }
        `}</style>
        <MapaSvg markup={markup} />

        {foco && (
          <div
            className={`pointer-events-none absolute z-10 -translate-x-1/2 rounded-xl border border-border bg-popover px-3 py-2 shadow-card ${
              foco.abaixo ? 'translate-y-[10px]' : '-translate-y-[calc(100%+10px)]'
            }`}
            style={{ left: foco.x, top: foco.y }}
          >
            <div className="flex items-center gap-1.5">
              <span
                className="size-2.5 shrink-0 rounded-full ring-1 ring-border"
                style={{ background: foco.cor }}
                aria-hidden
              />
              <span className="text-xs font-medium text-foreground">{foco.nome}</span>
            </div>
            <div className="mt-0.5 flex items-baseline gap-1.5 pl-4">
              <span className="tabular-figures text-sm font-semibold text-foreground">
                {foco.eventos.toLocaleString(locale)}
              </span>
              <span className="text-[11px] text-muted-foreground">
                {textos.acessos.toLowerCase()}
              </span>
              {foco.fatia > 0 && (
                <span className="tabular-figures ml-auto text-[11px] text-muted-foreground">
                  {(foco.fatia * 100).toLocaleString(locale, { maximumFractionDigits: 1 })}%
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="text-xs text-muted-foreground">{textos.menos}</span>
        <div
          className="flex overflow-hidden rounded-full ring-1 ring-border/60 shadow-[0_1px_2px_rgba(0,0,0,.06)]"
          aria-hidden
        >
          {DEGRAUS.map((cor, i) => (
            <span key={i} className="h-3.5 w-6" style={{ background: cor }} />
          ))}
        </div>
        <span className="text-xs text-muted-foreground">
          {textos.mais}
          {maximo > 0 && ` (${maximo.toLocaleString(locale)})`}
        </span>
        <span className="ml-auto text-[10px] text-muted-foreground/70">{textos.credito}</span>
      </div>
    </div>
  )
}
