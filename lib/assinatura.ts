/**
 * Tradução do estado de assinatura — cópia deliberada de
 * `krew/lib/assinatura.ts` (`estadoAssinatura`), não uma reimplementação.
 *
 * O painel só LÊ `public.subscriptions`; quem decide o que cada combinação de
 * `status`/`cancel_at_period_end`/`trial_ends_at` significa é o app principal,
 * porque é ele quem libera ou barra acesso com essa mesma regra. Se as duas
 * cópias divergirem, esta tela mostra "ativo" para alguém que o krew já
 * bloqueou (ou o inverso) — pior do que qualquer um dos dois errar sozinho.
 * Ao mexer numa, mexa na outra.
 */

export interface AssinaturaRow {
  status: string | null
  trial_ends_at: string | Date | null
  current_period_end: string | Date | null
  cancel_at_period_end: boolean | null
}

export type EstadoAssinatura = 'trial' | 'ativa' | 'cancelada_com_prazo' | 'inadimplente' | 'expirada'

export const ROTULO_ESTADO: Record<EstadoAssinatura, string> = {
  trial: 'Trial',
  ativa: 'Ativa',
  cancelada_com_prazo: 'Cancelando',
  inadimplente: 'Inadimplente',
  expirada: 'Expirada',
}

function futuro(valor: string | Date | null, agora: Date): boolean {
  if (!valor) return false
  const d = valor instanceof Date ? valor : new Date(valor)
  return d.getTime() > agora.getTime()
}

export function estadoAssinatura(
  sub: AssinaturaRow | null | undefined,
  agora: Date = new Date()
): EstadoAssinatura {
  if (!sub) return 'expirada'

  const status = sub.status ?? null

  if (status === 'active' || status === 'trialing') return 'ativa'
  if (status === 'past_due' || status === 'unpaid') return 'inadimplente'
  if (status === 'canceled' && futuro(sub.current_period_end, agora)) return 'cancelada_com_prazo'
  if (futuro(sub.trial_ends_at, agora)) return 'trial'

  return 'expirada'
}

/** A data que importa para "perto de vencer" — a que decide quando o acesso acaba. */
export function dataRelevante(sub: AssinaturaRow | null | undefined): Date | null {
  if (!sub) return null
  const estado = estadoAssinatura(sub)
  const valor =
    estado === 'trial'
      ? sub.trial_ends_at
      : estado === 'ativa' || estado === 'cancelada_com_prazo' || estado === 'inadimplente'
        ? sub.current_period_end
        : null
  if (!valor) return null
  return valor instanceof Date ? valor : new Date(valor)
}
