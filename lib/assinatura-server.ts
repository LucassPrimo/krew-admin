import { createClient } from '@/lib/supabase/server'
import type { AssinaturaRow } from '@/lib/assinatura'

/**
 * Leitura da assinatura no servidor (Server Components e actions).
 *
 * Separado de `lib/assinatura.ts` porque aquele módulo é importado pelo
 * middleware, que roda em Edge: `next/headers` — que o cliente Supabase de
 * servidor usa — não existe lá, e o import derrubaria toda requisição.
 */

const CAMPOS = 'status, trial_ends_at, current_period_end, cancel_at_period_end, chargefy_customer_id, chargefy_subscription_id, price_id'

export interface AssinaturaCompleta extends AssinaturaRow {
  chargefy_customer_id: string | null
  chargefy_subscription_id: string | null
  price_id: string | null
}

/**
 * `legivel: false` significa que a CONSULTA falhou (tabela ausente, RLS
 * mudada, banco fora do ar) — não que a pessoa esteja sem assinatura. Quem
 * bloqueia acesso precisa dessa diferença: tratar erro de infraestrutura como
 * "não pagou" tranca a base inteira por um problema que não é de ninguém.
 */
export interface LeituraAssinatura {
  assinatura: AssinaturaCompleta | null
  legivel: boolean
}

/** A assinatura do usuário logado (ou de `userId`, quando informado). */
export async function getAssinatura(userId?: string): Promise<LeituraAssinatura> {
  const supabase = await createClient()

  let id = userId
  if (!id) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { assinatura: null, legivel: true }
    id = user.id
  }

  const { data, error } = await supabase
    .from('subscriptions')
    .select(CAMPOS)
    .eq('user_id', id)
    .maybeSingle()

  if (error) {
    console.error('[assinatura] leitura falhou', error.message)
    return { assinatura: null, legivel: false }
  }

  return { assinatura: (data as AssinaturaCompleta | null) ?? null, legivel: true }
}

/**
 * A assinatura do dono de uma organização — usada quando a agência abre o
 * dashboard de um creator da carteira. A posse do dado é da org; quem paga é a
 * pessoa que a criou (`owner_user_id`).
 */
export async function getAssinaturaDaOrg(orgId: string): Promise<LeituraAssinatura> {
  const supabase = await createClient()

  const { data: org, error } = await supabase
    .from('organizations')
    .select('owner_user_id')
    .eq('id', orgId)
    .maybeSingle()

  // Sem conseguir descobrir o dono, não dá para afirmar nada sobre a
  // assinatura dele — e afirmar "não pagou" aqui bloquearia a agência.
  if (error || !org?.owner_user_id) return { assinatura: null, legivel: false }

  return getAssinatura(org.owner_user_id)
}
