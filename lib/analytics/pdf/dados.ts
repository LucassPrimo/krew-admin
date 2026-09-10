import type { PainelBio } from '@/app/actions/bio-analytics'
import type { Periodo } from '@/lib/bio/periodo'

export const PERIODOS_PDF = ['30d', '7d', 'hoje'] as const
export const ROTULOS_PDF: Record<Periodo, string> = {
  '30d': 'Últimos 30 dias', '7d': 'Últimos 7 dias', hoje: 'Hoje',
}
export const FUSO = 'America/Sao_Paulo'

export interface RelatorioAnalytics {
  nome: string
  slug: string
  periodo: Periodo
  desde: string
  ate: string
  painel: PainelBio
}

/** Uma única referência de tempo para os dados, a comparação e a capa. */
export function janelaRelatorio(periodo: Periodo, agora = new Date()) {
  const ate = agora.toISOString()
  if (periodo === 'hoje') {
    const partes = new Intl.DateTimeFormat('en-CA', {
      timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(agora)
    const parte = (tipo: string) => partes.find((p) => p.type === tipo)!.value
    const desde = new Date(`${parte('year')}-${parte('month')}-${parte('day')}T00:00:00-03:00`).toISOString()
    return { desde, ate }
  }
  return { desde: new Date(agora.getTime() - (periodo === '7d' ? 7 : 30) * 86_400_000).toISOString(), ate }
}

export function periodoPdf(valor: string | null): Periodo | null {
  if (valor === null) return '30d'
  return PERIODOS_PDF.includes(valor as Periodo) ? valor as Periodo : null
}

export const numeroPdf = (valor: number) => valor.toLocaleString('pt-BR', { maximumFractionDigits: 1 })
export const dataPdf = (valor: string) => new Intl.DateTimeFormat('pt-BR', {
  timeZone: FUSO, day: '2-digit', month: 'short', year: 'numeric',
}).format(new Date(valor))
export const percentualPdf = (valor: number, total: number) => `${numeroPdf(total > 0 ? valor / total * 100 : 0)}%`

/** Sem base anterior, não inventa uma porcentagem de crescimento. */
export function variacaoPdf(atual: number, anterior: number) {
  if (anterior === 0) return atual === 0 ? 'Sem variação' : 'Sem base anterior'
  const delta = (atual - anterior) / anterior * 100
  return `${delta > 0 ? '+' : ''}${numeroPdf(delta)}% vs. anterior`
}

export function nomeArquivoPdf(slug: string, periodo: Periodo, ate: string) {
  const seguro = slug.normalize('NFKD').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80) || 'criador'
  return `krew-analytics-${seguro}-${periodo}-${ate.slice(0, 10)}.pdf`
}

/** Rankings sinalizam o restante para não sugerir que o top é o total. */
export function rankingPdf(linhas: { nome: string; valor: number }[], limite = 8) {
  const ordenadas = [...linhas].sort((a, b) => b.valor - a.valor)
  const total = ordenadas.reduce((s, l) => s + l.valor, 0)
  return { linhas: ordenadas.slice(0, limite), total, restantes: ordenadas.length - Math.min(limite, ordenadas.length) }
}
