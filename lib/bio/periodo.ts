/**
 * A janela de tempo do painel de Analytics.
 *
 * Mora aqui, e não em `app/actions/bio-analytics.ts`, por uma razão do
 * runtime: aquele arquivo é `'use server'`, e um módulo de Server Actions só
 * pode exportar funções `async`. `intervaloDoPeriodo` é síncrona (a tela
 * precisa do rótulo "18 de ago – 25 de ago" durante o render, não depois de um
 * await), então as duas não cabem no mesmo arquivo.
 */

export type Periodo = 'hoje' | '7d' | '30d'

const DIAS: Record<Periodo, number> = { hoje: 1, '7d': 7, '30d': 30 }

/**
 * Os extremos da janela.
 *
 * `hoje` é o dia corrente a partir da meia-noite LOCAL, não as últimas 24h:
 * "Hoje" na tela é o dia do calendário de quem lê, e uma janela deslizante
 * mostraria movimento de ontem à noite sob esse rótulo. Os outros são janelas
 * deslizantes de N dias, que é como "últimos 7 dias" se entende.
 */
export function intervaloDoPeriodo(periodo: Periodo): { desde: Date; ate: Date } {
  const ate = new Date()

  if (periodo === 'hoje') {
    const desde = new Date(ate)
    desde.setHours(0, 0, 0, 0)
    return { desde, ate }
  }

  return { desde: new Date(ate.getTime() - DIAS[periodo] * 24 * 60 * 60 * 1000), ate }
}

/** A mesma janela, em ISO — o formato que os RPCs esperam. */
export function janela(periodo: Periodo): { desde: string; ate: string } {
  const { desde, ate } = intervaloDoPeriodo(periodo)
  return { desde: desde.toISOString(), ate: ate.toISOString() }
}
