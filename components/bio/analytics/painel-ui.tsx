'use client'

import { createContext, useContext } from 'react'
import { TrendingDown, TrendingUp } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import { cn } from '@/lib/utils'

/**
 * As peças repetidas do painel de Analytics.
 *
 * O layout do painel é uma grade de cartões que compartilham cabeçalho, chip
 * de variação e estado vazio. Quatro arquivos com a mesma casca ficariam
 * dessincronizados no primeiro ajuste de raio ou de espaçamento, então a casca
 * mora aqui e o que varia entra por prop.
 */

/**
 * O balãozinho do recharts, legível nos dois temas.
 *
 * O padrão do recharts pinta o texto de quase preto e NÃO segue a superfície:
 * com `contentStyle` trocando só o fundo, o modo escuro ficava com texto preto
 * sobre cartão preto — o balão aparecia vazio. As três partes (moldura, rótulo
 * e itens) precisam declarar a cor, porque cada uma tem seu padrão próprio, e
 * herdar não resolve: o recharts escreve estilo inline em todas.
 *
 * A cor de cada série continua sendo dita pela bolinha da legenda e pelo
 * próprio traço — o texto do balão prioriza ser lido.
 */
export const estiloTooltip = {
  contentStyle: {
    background: 'var(--color-card)',
    border: '1px solid var(--color-border)',
    borderRadius: 12,
    fontSize: 12,
    color: 'var(--color-foreground)',
    boxShadow: '0 8px 24px rgb(0 0 0 / 0.12)',
  },
  labelStyle: { color: 'var(--color-foreground)', fontWeight: 600 },
  itemStyle: { color: 'var(--color-foreground)' },
} as const

/** Variação percentual entre dois períodos, já pronta para o chip. */
export function variacao(atual: number, anterior: number): number {
  if (anterior === 0) return atual === 0 ? 0 : 100
  return ((atual - anterior) / anterior) * 100
}

/**
 * O chip de "subiu/desceu X%".
 *
 * Zero é NEUTRO, não verde: pintar "0,0%" de verde afirma uma melhora que não
 * houve. Só sai da cor neutra quando há movimento de verdade.
 */
export function ChipVariacao({ valor, className }: { valor: number; className?: string }) {
  const parado = Math.abs(valor) < 0.05
  const subiu = valor > 0
  const Icone = subiu ? TrendingUp : TrendingDown

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-pill px-1.5 py-0.5 text-[11px] font-semibold tabular-figures',
        parado && 'bg-muted text-muted-foreground',
        !parado && subiu && 'bg-mint/15 text-mint',
        !parado && !subiu && 'bg-danger/15 text-danger',
        className
      )}
    >
      {!parado && <Icone className="size-3" aria-hidden />}
      {Math.abs(valor).toFixed(1)}%
    </span>
  )
}

/** O selo "ao vivo" — ponto pulsante e a palavra, nada mais. */
export function SeloAoVivo({ rotulo }: { rotulo: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-pill border border-mint/30 bg-mint/10 px-2.5 py-1 text-xs font-semibold text-mint">
      <span className="relative flex size-1.5">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-mint opacity-75 motion-reduce:hidden" />
        <span className="relative inline-flex size-1.5 rounded-full bg-mint" />
      </span>
      {rotulo}
    </span>
  )
}

/**
 * A casca de todo cartão do painel: ícone em chip, título, subtítulo e uma
 * ação opcional à direita.
 */
/**
 * O painel inteiro em modo BORRADO — o que o Free vê.
 *
 * Contexto, e não uma prop descendo por cinco níveis: o borrão vale para todo
 * cartão do painel, e prop-drilling até o último gráfico significa acrescentar
 * `blurNumeros` em toda seção nova que alguém escrever, com o esquecimento
 * passando despercebido justamente no caso que ninguém testa (o do Free).
 *
 * O borrão é só o AVISO de que ali existe um número. O cadeado está no
 * servidor: as actions de analytics devolvem zeros para quem não assina (ver
 * `semAcessoPago` em `app/actions/bio-analytics.ts`), então não há nada de
 * verdadeiro por baixo do desfoque.
 */
const ContextoBorrado = createContext(false)

export function ProvedorBorrado({
  borrado,
  children,
}: {
  borrado: boolean
  children: React.ReactNode
}) {
  return <ContextoBorrado.Provider value={borrado}>{children}</ContextoBorrado.Provider>
}

export function useBorrado() {
  return useContext(ContextoBorrado)
}

export function CartaoPainel({
  icone: Icone,
  titulo,
  subtitulo,
  acao,
  children,
  className,
}: {
  icone?: LucideIcon
  titulo?: string
  subtitulo?: string
  acao?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  const borrado = useBorrado()

  return (
    <section className={cn('bg-card rounded-2xl p-5 shadow-card', className)}>
      {(titulo || acao) && (
        <header className="mb-4 flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            {Icone && (
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-mint/12 text-mint">
                <Icone className="size-4.5" aria-hidden />
              </span>
            )}
            <div className="min-w-0">
              {titulo && (
                <h2 className="truncate text-sm font-bold tracking-tight text-foreground">{titulo}</h2>
              )}
              {subtitulo && <p className="truncate text-xs text-muted-foreground">{subtitulo}</p>}
            </div>
          </div>
          {acao && <div className="shrink-0">{acao}</div>}
        </header>
      )}
      {/* O borrão pega o CONTEÚDO, não o cabeçalho: o título e o subtítulo
          dizem o que existe ali, e é isso que faz o convite para assinar ter
          sentido. `pointer-events-none` porque um tooltip de gráfico
          entregaria em texto nítido o que o desfoque esconde. */}
      {borrado ? (
        <div aria-hidden className="pointer-events-none blur-sm select-none">
          {children}
        </div>
      ) : (
        children
      )}
    </section>
  )
}

/**
 * O vazio explicado.
 *
 * Um cartão em branco é indistinguível de um cartão quebrado, e "0" sozinho
 * não diz se ninguém veio ou se a medição falhou. Por isso todo vazio do
 * painel diz o que apareceria ali quando houver dado.
 */
export function PainelVazio({
  icone: Icone,
  titulo,
  descricao,
}: {
  icone: LucideIcon
  titulo: string
  descricao: string
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border px-6 py-12 text-center">
      <Icone className="size-6 text-muted-foreground/50" aria-hidden />
      <p className="text-sm font-semibold text-foreground">{titulo}</p>
      <p className="max-w-xs text-xs text-muted-foreground text-balance">{descricao}</p>
    </div>
  )
}
