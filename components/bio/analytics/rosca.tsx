'use client'

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'

import { estiloTooltip } from '@/components/bio/analytics/painel-ui'

/**
 * Rosca de proporção — serve fontes de tráfego e distribuição de atividade.
 *
 * Rosca e não pizza: o buraco no meio evita a comparação de ângulos no centro,
 * que é onde a pizza engana mais, e sobra espaço para o total sem uma legenda
 * extra.
 *
 * As cores saem dos tokens de gráfico do tema (mint, lime e os três de apoio),
 * então a rosca acompanha claro/escuro sem uma paleta paralela para manter.
 */
const CORES = [
  'var(--color-chart-1)',
  'var(--color-chart-2)',
  'var(--color-chart-3)',
  'var(--color-chart-4)',
  'var(--color-chart-5)',
]

export function Rosca({
  itens,
  legenda = true,
}: {
  itens: { rotulo: string; valor: number }[]
  legenda?: boolean
}) {
  const total = itens.reduce((s, i) => s + i.valor, 0)

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="h-52 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={itens}
              dataKey="valor"
              nameKey="rotulo"
              innerRadius="58%"
              outerRadius="86%"
              paddingAngle={2}
              stroke="none"
              isAnimationActive={false}
            >
              {itens.map((_, i) => (
                <Cell key={i} fill={CORES[i % CORES.length]} />
              ))}
            </Pie>
            <Tooltip
              {...estiloTooltip}
              formatter={(valor, nome) => [
                `${valor} · ${total > 0 ? Math.round((Number(valor) / total) * 100) : 0}%`,
                nome,
              ]}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {legenda && (
        <ul className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5">
          {itens.map((i, idx) => (
            <li key={`${i.rotulo}-${idx}`} className="flex items-center gap-1.5 text-xs">
              <span
                aria-hidden
                className="size-2 shrink-0 rounded-full"
                style={{ background: CORES[idx % CORES.length] }}
              />
              <span className="max-w-[12rem] truncate text-muted-foreground">{i.rotulo}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
