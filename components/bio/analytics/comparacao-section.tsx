'use client'

import { useMemo } from 'react'
import { Activity, BarChart3, CalendarDays, PieChart, TrendingUp } from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from 'recharts'

import type { ComparacaoBio } from '@/app/actions/bio-analytics'
import { CartaoPainel, ChipVariacao, estiloTooltip, variacao } from '@/components/bio/analytics/painel-ui'
import { Rosca } from '@/components/bio/analytics/rosca'

interface ComparacaoTextos {
  titulo: string
  subtitulo: string
  visitas: string
  cliques: string
  atividade: string
  anteriorPrefixo: string
  visaoGeral: string
  distribuicao: string
  padraoHorario: string
  periodoAtual: string
  periodoAnterior: string
  diasAtivos: string
  mediaDiaria: string
  crescimento: string
}

/**
 * Período contra período: os mesmos números, lado a lado com a janela
 * anterior de mesma duração.
 *
 * É a seção que responde "melhorou?" — e por isso todo número aqui vem
 * acompanhado do seu par anterior, nunca sozinho.
 *
 * Recebe `dados` de `PainelAnalytics`: é a mesma leitura que desenha o topo
 * da tela, e buscá-la de novo aqui era pedir ao banco duas vezes a resposta
 * que já estava na mão.
 */
export function ComparacaoSection({
  dados,
  textos,
}: {
  dados: ComparacaoBio
  textos: ComparacaoTextos
}) {
  const { atual, anterior } = dados

  const tiles = [
    { rotulo: textos.visitas, atual: atual.views, anterior: anterior.views },
    { rotulo: textos.cliques, atual: atual.cliques, anterior: anterior.cliques },
    { rotulo: textos.atividade, atual: atual.total, anterior: anterior.total },
  ]

  const barras = [
    { nome: textos.visitas, atual: atual.views, anterior: anterior.views },
    { nome: textos.cliques, atual: atual.cliques, anterior: anterior.cliques },
    { nome: textos.atividade, atual: atual.total, anterior: anterior.total },
  ]

  const distribuicao = useMemo(
    () =>
      [
        { rotulo: textos.visitas, valor: atual.views },
        { rotulo: textos.cliques, valor: atual.cliques },
      ].filter((i) => i.valor > 0),
    [atual.views, atual.cliques, textos.visitas, textos.cliques]
  )

  const horas = useMemo(
    () =>
      dados.porHora.map((h) => ({
        ...h,
        // `h` de 0..23 vira "00h", "13h" — rótulo curto o bastante para 24
        // marcas caberem sem girar o texto.
        rotulo: `${String(h.hora).padStart(2, '0')}h`,
      })),
    [dados.porHora]
  )

  const eixo = {
    tickLine: false,
    axisLine: false,
    tick: { fontSize: 11, fill: 'var(--color-muted-foreground)' },
  } as const

  const crescimento = variacao(atual.total, anterior.total)

  return (
    <CartaoPainel icone={Activity} titulo={textos.titulo} subtitulo={textos.subtitulo}>
      <div className="grid gap-3 sm:grid-cols-3">
        {tiles.map((t) => (
          <div key={t.rotulo} className="rounded-xl border border-border p-4">
            <p className="text-sm text-muted-foreground">{t.rotulo}</p>
            <div className="mt-0.5 flex items-center gap-2">
              <span className="text-2xl font-bold tabular-figures text-foreground">
                {t.atual.toLocaleString('pt-BR')}
              </span>
              <ChipVariacao valor={variacao(t.atual, t.anterior)} />
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {textos.anteriorPrefixo} {t.anterior.toLocaleString('pt-BR')}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <div className="rounded-xl border border-border p-4">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-bold tracking-tight text-foreground">
            <BarChart3 className="size-4 text-mint" aria-hidden />
            {textos.visaoGeral}
          </h3>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barras} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
                <CartesianGrid vertical={false} stroke="var(--color-border)" strokeDasharray="3 3" />
                <XAxis dataKey="nome" {...eixo} />
                <Tooltip cursor={{ fill: 'var(--color-muted)', opacity: 0.4 }} {...estiloTooltip} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar
                  dataKey="atual"
                  name={textos.periodoAtual}
                  fill="var(--color-chart-1)"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={40}
                />
                <Bar
                  dataKey="anterior"
                  name={textos.periodoAnterior}
                  fill="var(--color-muted-foreground)"
                  fillOpacity={0.45}
                  radius={[6, 6, 0, 0]}
                  maxBarSize={40}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-border p-4">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-bold tracking-tight text-foreground">
            <PieChart className="size-4 text-mint" aria-hidden />
            {textos.distribuicao}
          </h3>
          {/* Sem dado nenhum a rosca não é desenhada: um anel vazio ou um
              círculo cheio de uma cor só sugere uma proporção que não existe. */}
          {distribuicao.length === 0 ? (
            <div className="flex h-52 items-center justify-center text-sm text-muted-foreground">
              —
            </div>
          ) : (
            <Rosca itens={distribuicao} />
          )}
        </div>
      </div>

      <div className="mt-3 rounded-xl border border-border p-4">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-bold tracking-tight text-foreground">
          <Activity className="size-4 text-mint" aria-hidden />
          {textos.padraoHorario}
        </h3>
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={horas} margin={{ top: 4, right: 8, bottom: 0, left: 4 }}>
              <CartesianGrid vertical={false} stroke="var(--color-border)" strokeDasharray="3 3" />
              <XAxis dataKey="rotulo" {...eixo} interval="preserveStartEnd" minTickGap={20} />
              <Tooltip {...estiloTooltip} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line
                type="monotone"
                dataKey="atual"
                name={textos.periodoAtual}
                stroke="var(--color-chart-1)"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="anterior"
                name={textos.periodoAnterior}
                stroke="var(--color-muted-foreground)"
                strokeWidth={1.5}
                strokeDasharray="4 4"
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="mt-3 grid gap-3 rounded-xl border border-border p-4 sm:grid-cols-3">
        <Rodape icone={CalendarDays} rotulo={textos.diasAtivos} valor={String(dados.diasAtivos)} />
        <Rodape
          icone={Activity}
          rotulo={textos.mediaDiaria}
          valor={dados.mediaDiaria.toLocaleString('pt-BR')}
        />
        <Rodape
          icone={TrendingUp}
          rotulo={textos.crescimento}
          valor={`${crescimento > 0 ? '+' : ''}${crescimento.toFixed(1)}%`}
          destaque={Math.abs(crescimento) >= 0.05 ? (crescimento > 0 ? 'alta' : 'baixa') : undefined}
        />
      </div>
    </CartaoPainel>
  )
}

function Rodape({
  icone: Icone,
  rotulo,
  valor,
  destaque,
}: {
  icone: typeof Activity
  rotulo: string
  valor: string
  destaque?: 'alta' | 'baixa'
}) {
  return (
    <div className="flex flex-col items-center gap-1 text-center">
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icone className="size-3.5" aria-hidden />
        {rotulo}
      </span>
      <span
        className={
          'text-2xl font-bold tabular-figures ' +
          (destaque === 'alta'
            ? 'text-mint'
            : destaque === 'baixa'
              ? 'text-danger'
              : 'text-foreground')
        }
      >
        {valor}
      </span>
    </div>
  )
}
