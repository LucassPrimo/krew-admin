import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'

/**
 * Contexto de organização (Bloco 2 da verticalização).
 *
 * A posse de todo dado do app é `org_id`, não `user_id` — quem decide isso é a
 * RLS, desde o Bloco 1. Este módulo responde a pergunta que a RLS não responde:
 * **em qual org o usuário está agora**, quando ele pertence a mais de uma.
 *
 * Para 95% dos usuários existe uma org só (a pessoal, criada no signup) e nada
 * disso aparece na interface — é a decisão D3 do ESTADO.md.
 */

export const ORG_COOKIE = 'krew_org'

/**
 * Usado quando não há org ativa (situação que não deveria acontecer: o signup
 * cria org + membership). É um uuid válido que não casa com nada, então a
 * query devolve zero linhas.
 *
 * O que NÃO fazer: `.eq('org_id', orgId ?? '')`. String vazia numa coluna uuid
 * é erro de sintaxe no Postgres, não zero linhas — a página quebraria em vez
 * de aparecer vazia.
 */
export const NO_ORG = '00000000-0000-0000-0000-000000000000'

export type OrgRole = 'owner' | 'manager' | 'editor' | 'accountant' | 'viewer'

/**
 * O que a CONTA é, não o que ela tem — `profiles.account_type`.
 *
 * Não dá para inferir isso de `role`: o trigger de signup dá a todo mundo uma
 * org pessoal como `owner`, inclusive a quem só administra creators. Por isso
 * o roteamento (dashboard vs. /agencia) olha esta coluna, e não a membership.
 */
export type AccountType = 'creator' | 'agency'

export interface Membership {
  orgId: string
  orgName: string
  role: OrgRole
}

/** Papéis que podem escrever. Espelha o `fn_has_role` das policies. */
const WRITE_ROLES: OrgRole[] = ['owner', 'manager', 'editor']

export function canWrite(role: OrgRole) {
  return WRITE_ROLES.includes(role)
}

/**
 * Todas as memberships do usuário logado, com o nome da org.
 * A RLS de `memberships` já limita ao próprio usuário e aos colegas de org;
 * o `.eq('user_id')` aqui é para pegar só as DELE, não as dos colegas.
 */
export async function getMemberships(): Promise<Membership[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('memberships')
    .select('org_id, role, organizations(name)')
    .eq('user_id', user.id)
    .order('created_at')

  if (error || !data) return []

  return data.map((m) => ({
    orgId: m.org_id,
    orgName: (m.organizations as unknown as { name: string } | null)?.name ?? '',
    role: m.role as OrgRole,
  }))
}

/**
 * A org da AGÊNCIA a que o usuário pertence, ou `null` se ele não trabalha em
 * nenhuma.
 *
 * A agência é uma `organizations` com `tipo = 'agency'`, e quem trabalha nela
 * entra por `memberships` como em qualquer org — é o que permite vários
 * assessores na mesma casa, e faz o convite de colega (`org_invites`)
 * funcionar sem nada novo.
 */
export async function getAgencyOrg(): Promise<Membership | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('memberships')
    .select('org_id, role, organizations!inner(name, tipo)')
    .eq('user_id', user.id)
    .eq('organizations.tipo', 'agency')
    .order('created_at')
    .limit(1)
    .maybeSingle()

  if (!data) return null

  return {
    orgId: data.org_id,
    orgName: (data.organizations as unknown as { name: string } | null)?.name ?? '',
    role: data.role as OrgRole,
  }
}

/**
 * Os creators da carteira da agência.
 *
 * Vem de `agency_creators`, não de `memberships`: o vínculo é entre
 * ORGANIZAÇÕES. Antes cada assessor precisaria da própria membership no org de
 * cada creator — não escala com dois funcionários, e a comissão ficava presa à
 * pessoa em vez de ser da casa.
 *
 * O `role` devolvido é o poder da AGÊNCIA sobre aquele creator. O que cada
 * funcionário faz dentro disso é limitado pelo papel dele na agência — quem
 * cruza os dois é `fn_has_role`, na RLS.
 */
export async function getManagedMemberships(): Promise<Membership[]> {
  const agencia = await getAgencyOrg()
  if (!agencia) return []

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('agency_creators')
    .select('creator_org_id, role, organizations!agency_creators_creator_org_id_fkey(name)')
    .eq('agency_org_id', agencia.orgId)
    .order('created_at')

  if (error || !data) return []

  return data.map((v) => ({
    orgId: v.creator_org_id as string,
    orgName: (v.organizations as unknown as { name: string } | null)?.name ?? '',
    role: v.role as OrgRole,
  }))
}

/**
 * O creator que a agência está operando agora, ou `null` se ela ainda não
 * escolheu um.
 *
 * É a org ativa (cookie `krew_org`) — mas só vale se for uma org ADMINISTRADA.
 * A org pessoal vazia da própria agência não conta: entrar no dashboard com ela
 * selecionada mostraria uma operação sem dono e sem dados.
 */
export async function getCreatorEmOperacao(): Promise<Membership | null> {
  const atual = await getCurrentOrg()
  if (!atual || atual.role === 'owner') return null
  return atual
}

/**
 * Tipo da conta logada. `null` só sem sessão.
 *
 * Contas anteriores à coluna (default 'creator') e perfis que por algum motivo
 * não existam caem em 'creator' — o lado seguro: no pior caso a pessoa vê o
 * dashboard da própria org, que é o comportamento de sempre.
 */
export async function getAccountType(): Promise<AccountType | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('profiles')
    .select('account_type')
    .eq('id', user.id)
    .maybeSingle()

  return data?.account_type === 'agency' ? 'agency' : 'creator'
}

/**
 * A org ativa. Lê o cookie `krew_org` e **valida que o usuário pertence a ela**
 * — o cookie é do cliente, então nunca é confiável por si só. Se o cookie
 * estiver ausente, inválido, ou apontar para uma org da qual o usuário saiu,
 * cai na primeira membership.
 *
 * Devolve `null` só quando não há usuário logado ou nenhuma membership (o que
 * não deveria acontecer: o signup cria org + membership).
 */
export async function getCurrentOrg(): Promise<Membership | null> {
  const memberships = await getMemberships()

  const cookieStore = await cookies()
  const preferred = cookieStore.get(ORG_COOKIE)?.value

  const direta = memberships.find((m) => m.orgId === preferred)
  if (direta) return direta

  // O cookie pode apontar para um creator da carteira, que não é uma
  // membership direta: a agência alcança o org do creator pelo vínculo entre
  // organizações. Sem esta segunda busca, operar um creator seria impossível —
  // a org ativa cairia sempre na própria agência.
  //
  // A consulta só acontece quando o cookie não bate com nenhuma membership,
  // então o creator comum (95% dos casos) não paga por ela.
  if (preferred) {
    const administradas = await getManagedMemberships()
    const gerida = administradas.find((m) => m.orgId === preferred)
    if (gerida) return gerida
  }

  return memberships[0] ?? null
}

/**
 * O `org_id` para gravar num insert. Serve às server actions, que precisam do
 * id e não do resto.
 *
 * Existe um trigger `trg_default_org_id` no banco que preenche `org_id` sozinho
 * quando o insert vem sem ele — andaime do Bloco 1.5. Com esta função em uso, o
 * andaime fica inerte e pode ser derrubado. A diferença prática é que o trigger
 * sempre escolhe a org que o usuário POSSUI, e esta função respeita a org que
 * ele SELECIONOU: para quem assessora outro criador, é a diferença entre a
 * campanha nascer na carteira certa ou na errada.
 */
export async function getCurrentOrgId(): Promise<string | null> {
  return (await getCurrentOrg())?.orgId ?? null
}

/**
 * `org_id` para FILTRAR uma leitura. Igual ao de cima, mas o nome existe para
 * marcar a intenção nos call sites — e para carregar este comentário:
 *
 * **A RLS não faz esse filtro por você.** Ela autoriza tudo de TODA org em que
 * você é membro. Para quem tem uma org só — 95% dos usuários — dá no mesmo, e
 * é por isso que a armadilha é fácil de não ver. Mas para um assessor com dois
 * criadores, um `select * from brands` sem `.eq('org_id', ...)` devolve as
 * marcas dos dois misturadas, e o seletor de criador vira enfeite.
 *
 * Regra: toda leitura de LISTA filtra por org. Leitura de linha única por `id`
 * não precisa — o id já é específico e a RLS impede pegar de fora.
 *
 * Tabelas-filhas (`deliverables`, `receivables`) não têm `org_id`: filtram
 * pelo pai, com `campaigns!inner(org_id)` + `.eq('campaigns.org_id', orgId)`.
 */
export async function getOrgFilterId(): Promise<string | null> {
  return getCurrentOrgId()
}
