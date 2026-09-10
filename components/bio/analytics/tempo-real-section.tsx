'use client'

import { useMemo } from 'react'
import { Activity, MousePointerClick, PieChart, Users, Zap } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts'

import type { TempoRealBio } from '@/app/actions/bio-analytics'
import { CartaoPainel, PainelVazio, SeloAoVivo, estiloTooltip } from '@/components/bio/analytics/painel-ui'
import { agruparFontes } from '@/lib/analytics/fontes'

interface TempoRealTextos {
  titulo: string
  subtitulo: string
  aoVivo: string
  visitas: string
  cliques: string
  atividade: string
  porMinuto: string
  legendaVisitas: string
  legendaCliques: string
  fontes: string
  fontesVazioTitulo: string
  fontesVazioDesc: string
  origemDireta: string
}

/**
 * Os últimos 30 minutos, minuto a minuto.
 *
 * Janela fixa, independente do período escolhido acima: "agora" não muda de
 * significado quando alguém troca a visão para 30 dias. Quem busca é
 * `PainelAnalytics`, numa leitura só com o resto do painel.
 *
 * Não tem estado vazio próprio nos três totais — zero é uma resposta legítima
 * e informativa aqui ("ninguém na página neste instante"), diferente de um
 * ranking vazio, que precisa explicar o que apareceria ali.
 */
export function TempoRealSection({
  dados,
  textos,
}: {
  dados: TempoRealBio
  textos: TempoRealTextos
}) {
  const pontos = useMemo(
    () =>
      dados.porMinuto.map((p) => ({
        ...p,
        rotulo: new Date(p.minuto).toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit',
        }),
      })),
    [dados.porMinuto]
  )

  const porMinuto = (n: number) => (dados.minutos > 0 ? (n / dados.minutos).toFixed(1) : '0')

  const totais: { icone: LucideIcon; rotulo: string; valor: number }[] = [
    { icone: Users, rotulo: textos.visitas, valor: dados.visitas },
    { icone: MousePointerClick, rotulo: textos.cliques, valor: dados.cliques },
    { icone: Zap, rotulo: textos.atividade, valor: dados.total },
  ]

  const totalFontes = dados.fontes.reduce((s, f) => s + f.eventos, 0)
  const fontes = agruparFontes(dados.fontes)

  return (
    <div className="flex flex-col gap-3">
      <CartaoPainel
        icone={Activity}
        titulo={textos.titulo}
        subtitulo={textos.subtitulo}
        acao={<SeloAoVivo rotulo={textos.aoVivo} />}
      >
        <div className="grid gap-3 sm:grid-cols-3">
          {totais.map((t) => (
            <div key={t.rotulo} className="rounded-xl border border-border p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm text-muted-foreground">{t.rotulo}</p>
                  <p className="mt-0.5 text-2xl font-bold tabular-figures text-foreground">
                    {t.valor.toLocaleString('pt-BR')}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {porMinuto(t.valor)} {textos.porMinuto}
                  </p>
                </div>
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-mint/12 text-mint">
                  <t.icone className="size-4" aria-hidden />
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-5 flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-[var(--color-chart-1)]" aria-hidden />
            {textos.legendaVisitas}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-[var(--color-chart-2)]" aria-hidden />
            {textos.legendaCliques}
          </span>
        </div>

        <div className="mt-3 h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={pontos} margin={{ top: 4, right: 8, bottom: 0, left: 4 }}>
              <CartesianGrid vertical={false} stroke="var(--color-border)" strokeDasharray="3 3" />
              <XAxis
                dataKey="rotulo"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 10, fill: 'var(--color-muted-foreground)' }}
                interval="preserveStartEnd"
                minTickGap={28}
              />
              <Tooltip
                {...estiloTooltip}
                formatter={(valor, chave) => [
                  valor,
                  chave === 'views' ? textos.legendaVisitas : textos.legendaCliques,
                ]}
              />
              <Line
                type="monotone"
                dataKey="views"
                stroke="var(--color-chart-1)"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="cliques"
                stroke="var(--color-chart-2)"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CartaoPainel>

      <CartaoPainel
        icone={PieChart}
        titulo={textos.fontes}
        subtitulo={textos.subtitulo}
        acao={<SeloAoVivo rotulo={textos.aoVivo} />}
      >
        {fontes.length === 0 ? (
          <PainelVazio
            icone={PieChart}
            titulo={textos.fontesVazioTitulo}
            descricao={textos.fontesVazioDesc}
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {fontes.map((f, i) => (
              <li key={`${f.referrer}-${i}`} className="flex items-center gap-3">
                <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                  {f.referrer === 'direto' ? textos.origemDireta : f.referrer}
                </span>
                <span className="shrink-0 text-xs tabular-figures text-muted-foreground">
                  {f.eventos} · {totalFontes > 0 ? Math.round((f.eventos / totalFontes) * 100) : 0}%
                </span>
              </li>
            ))}
          </ul>
        )}
      </CartaoPainel>
    </div>
  )
}
