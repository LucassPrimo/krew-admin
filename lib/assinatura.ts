/**
 * Quem entra no produto — a regra, num lugar só.
 *
 * É consultada pelo middleware (`proxy.ts`, em toda requisição), pelo layout
 * do dashboard e pela própria tela de assinatura. Manter a decisão aqui é o
 * que impede os três de discordarem: um gate que libera e uma tela que diz
 * "expirado" é pior do que qualquer um dos dois isolado.
 *
 * Sem dependência de `next/*` de propósito — o middleware roda em Edge, onde
 * `next/headers` não existe.
 */

/**
 * A Krew cobra? Sim — ligado de novo.
 *
 * A bio (`/bio`, edição e a página pública `/@handle`) é a exceção
 * deliberada: fica de fora do gate mesmo com a cobrança ligada — ver
 * `LIBERADAS_SEM_ASSINATURA` em `proxy.ts`. O resto do app (propostas,
 * campanhas, financeiro, assistente...) exige assinatura paga de verdade.
 *
 * O teste grátis conta: `ESTADOS_COM_ACESSO` abaixo inclui `'trial'` — os 5
 * dias sem cartão abrem o app inteiro, e no vencimento o paywall fecha
 * sozinho. Além dele, valem `status` `active`/`trialing` da Chargefy e uma
 * assinatura cancelada com período ainda em aberto.
 *
 * Não controla os recursos PRO da bio (`ehPro`, em `lib/plano.ts`) — aquele
 * tiering é freemium e tem o próprio interruptor, independente deste. Esta
 * constante é o gate de tudo-ou-nada do resto do app.
 */
export const COBRANCA_ATIVA = true

/** Só o que o gate precisa saber. Espelha `public.subscriptions`. */
export interface AssinaturaRow {
  status: string | null
  trial_ends_at: string | null
  current_period_end: string | null
  cancel_at_period_end?: boolean | null
}

export type EstadoAssinatura =
  /** Teste grátis correndo, sem cartão. */
  | 'trial'
  /** Pagando. */
  | 'ativa'
  /** Cancelou, mas o período já pago não acabou. */
  | 'cancelada_com_prazo'
  /** Cobrança recusada — copy própria, porque a saída é atualizar o cartão. */
  | 'inadimplente'
  /** Sem acesso. */
  | 'expirada'

// 'trial' voltou: o teste grátis de 5 dias existe para ser usado, e um trial
// que não abre o app é só uma contagem regressiva decorativa. Quando ele vence
// o estado vira 'expirada' sozinho (ver `estadoAssinatura`) e o paywall fecha —
// é o vencimento que cobra, não a ausência de cartão.
const ESTADOS_COM_ACESSO: EstadoAssinatura[] = ['trial', 'ativa', 'cancelada_com_prazo']

/**
 * O gate. É por aqui que passam as três barreiras do produto, e é por isso que
 * desligar a cobrança cabe numa linha só.
 *
 * `estadoAssinatura` continua contando a verdade da linha do banco mesmo com a
 * cobrança desligada — quem decide o que fazer com essa verdade é esta função.
 * Misturar as duas coisas (devolver 'ativa' para todo mundo, por exemplo) faria
 * o perfil anunciar "assinatura ativa" para quem nunca pagou nada.
 */
export function temAcesso(estado: EstadoAssinatura): boolean {
  if (!COBRANCA_ATIVA) return true
  return ESTADOS_COM_ACESSO.includes(estado)
}

function futuro(iso: string | null | undefined, agora: Date): boolean {
  return !!iso && new Date(iso).getTime() > agora.getTime()
}

/**
 * Traduz a linha do banco em estado de acesso.
 *
 * Ordem importa: o que a Chargefy diz vale mais que o trial. Alguém que assinou
 * no terceiro dia de teste está `active` — se o trial fosse checado primeiro,
 * a tela mostraria "restam 4 dias" para quem já está pagando.
 *
 * Status desconhecido cai em `expirada`. É o lado seguro: se a Chargefy criar um
 * status novo amanhã, o pior que acontece é alguém ver a tela de assinatura
 * indevidamente e reclamar — o inverso seria liberar o produto de graça sem
 * ninguém perceber.
 */
export function estadoAssinatura(
  sub: AssinaturaRow | null | undefined,
  agora: Date = new Date()
): EstadoAssinatura {
  if (!sub) {
    // Nenhuma linha: conta criada antes do trigger, ou agência (que não paga e
    // nem chega a ser perguntada). Sem trial registrado não há o que liberar.
    return 'expirada'
  }

  const status = sub.status ?? null

  if (status === 'active' || status === 'trialing') return 'ativa'

  if (status === 'past_due' || status === 'unpaid') return 'inadimplente'

  // Cancelada (pelo portal ou por falta de pagamento) mas com período pago em
  // aberto: o dinheiro já entrou, o acesso vai até o fim.
  if (status === 'canceled' && futuro(sub.current_period_end, agora)) {
    return 'cancelada_com_prazo'
  }

  // `incomplete`, `incomplete_expired`, `paused`, `canceled` vencida e status
  // desconhecido caem aqui — mas antes ainda vale o teste grátis, que existe
  // independentemente da Chargefy.
  if (futuro(sub.trial_ends_at, agora)) return 'trial'

  return 'expirada'
}

/**
 * Dias inteiros que faltam no teste — o número da faixa "restam X dias".
 * Arredonda para cima: com 6h restantes ainda é "1 dia", não "0".
 */
export function diasDeTrialRestantes(
  sub: AssinaturaRow | null | undefined,
  agora: Date = new Date()
): number {
  if (!sub?.trial_ends_at) return 0
  const ms = new Date(sub.trial_ends_at).getTime() - agora.getTime()
  return ms <= 0 ? 0 : Math.ceil(ms / 86_400_000)
}
