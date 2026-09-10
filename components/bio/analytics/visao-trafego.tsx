'use client'

import { useMemo } from 'react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis } from 'recharts'
import { BarChart3 } from 'lucide-react'

import { CartaoPainel, estiloTooltip } from '@/components/bio/analytics/painel-ui'

/**
 * Acessos e cliques ao longo do período, em área empilhável.
 *
 * Substitui a barra por dia do painel antigo: com 30 pontos as barras ficavam
 * finas demais para comparar, e a área lê a FORMA do período (subiu, caiu,
 * teve um pico) que é a pergunta desta seção. O ranking de quem clicou em quê
 * fica logo abaixo, em `LinksClicados`.
 */
export function VisaoTrafego({
  dados,
  textos,
}: {
  dados: { dia: string; views: number; cliques: number }[]
  textos: {
    titulo: string
    intervalo: string
    acessos: string
    cliques: string
    vazio: string
  }
}) {
  const pontos = useMemo(
    () =>
      dados.map((d) => ({
        ...d,
        // `T00:00` força hora local: `new Date('2026-08-21')` é lido como UTC e
        // vira dia 20 à noite em qualquer fuso a oeste.
        rotulo: new Date(`${d.dia}T00:00`).toLocaleDateString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
        }),
      })),
    [dados]
  )

  const totalViews = dados.reduce((s, d) => s + d.views, 0)
  const totalCliques = dados.reduce((s, d) => s + d.cliques, 0)

  return (
    <CartaoPainel
      icone={BarChart3}
      titulo={textos.titulo}
      subtitulo={textos.intervalo}
      acao={
        <div className="flex gap-5 text-right">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {textos.acessos}
            </p>
            <p className="text-sm font-bold tabular-figures text-foreground">{totalViews}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {textos.cliques}
            </p>
            <p className="text-sm font-bold tabular-figures text-foreground">{totalCliques}</p>
          </div>
        </div>
      }
    >
      {pontos.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">{textos.vazio}</p>
      ) : (
        <>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={pontos} margin={{ top: 4, right: 8, bottom: 0, left: 4 }}>
                <defs>
                  <linearGradient id="grad-views" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-chart-1)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--color-chart-1)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="grad-cliques" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-chart-2)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--color-chart-2)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="var(--color-border)" strokeDasharray="3 3" />
                <XAxis
                  dataKey="rotulo"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }}
                  interval="preserveStartEnd"
                  minTickGap={24}
                />
                <Tooltip
                  {...estiloTooltip}
                  formatter={(valor, chave) => [
                    valor,
                    chave === 'views' ? textos.acessos : textos.cliques,
                  ]}
                />
                <Area
                  type="monotone"
                  dataKey="views"
                  stroke="var(--color-chart-1)"
                  strokeWidth={2}
                  fill="url(#grad-views)"
                  isAnimationActive={false}
                />
                <Area
                  type="monotone"
                  dataKey="cliques"
                  stroke="var(--color-chart-2)"
                  strokeWidth={2}
                  fill="url(#grad-cliques)"
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-[var(--color-chart-1)]" aria-hidden />
              {textos.acessos}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-[var(--color-chart-2)]" aria-hidden />
              {textos.cliques}
            </span>
          </div>
        </>
      )}
    </CartaoPainel>
  )
}
