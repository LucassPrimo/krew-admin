import { dbRO } from './db'

/**
 * As consultas do dashboard, num arquivo só.
 *
 * Definidas aqui e não espalhadas pelas telas porque métrica que muda de
 * sentido conforme a página é pior do que métrica que não existe: duas telas
 * mostrando "contas ativas" com contas diferentes destroem a confiança em
 * todo o resto do painel.
 *
 * Todas na conexão RO — não há caminho daqui para uma escrita.
 */

export type Topo = {
  cadastros_7d: number
  cadastros_30d: number
  onboarding_completo: number
  contas_total: number
  bios_ativas: number
  trials_ativos: number
  assinantes_pagos: number
  propostas_7d: number
  campanhas_abertas: number
  gmv_mes: string | null
  a_receber_vencido: string | null
  ofertas_abertas: number
}

export async function topo(): Promise<Topo> {
  const [linha] = await dbRO<Topo[]>`
    with users_reais as (
      select p.id, p.created_at, p.onboarding_step
      from public.profiles p
      join public.admin_auth_users u on u.id = p.id
      where lower(coalesce(u.email, '')) not like 'oferta+%@bekrew.com'
    )
    select
      (select count(*) from users_reais where created_at > now() - interval '7 days')::int  as cadastros_7d,
      (select count(*) from users_reais where created_at > now() - interval '30 days')::int as cadastros_30d,
      (select count(*) from users_reais where onboarding_step >= 3)::int as onboarding_completo,
      (select count(*) from users_reais)::int as contas_total,
      (select count(*) from public.proposal_pages pp join users_reais ur on ur.id = pp.user_id where pp.bio_ativo)::int as bios_ativas,

      -- Trial ativo e pagante são coisas diferentes e viram decisões
      -- diferentes: um é funil, o outro é receita.
      (select count(*) from public.subscriptions s join users_reais ur on ur.id = s.user_id
        where s.trial_ends_at > now() and s.status is distinct from 'active')::int as trials_ativos,
      (select count(*) from public.subscriptions s join users_reais ur on ur.id = s.user_id where s.status = 'active')::int as assinantes_pagos,

      (select count(*) from public.partnership_proposals
        where created_at > now() - interval '7 days')::int as propostas_7d,
      (select count(*) from public.campaigns where status = 'ativa')::int as campanhas_abertas,

      -- GMV é do CLIENTE (o que os criadores faturam), não a receita da Krew.
      -- Misturar os dois é o erro clássico de dashboard de marketplace.
      (select sum(valor_total) from public.campaigns
        where status in ('ativa','concluida')
          and date_trunc('month', created_at) = date_trunc('month', now())) as gmv_mes,

      (select sum(valor) from public.receivables
        where status <> 'pago' and data_prevista < current_date) as a_receber_vencido,

      (select count(*) from public.bio_ofertas o
        join public.proposal_pages pp on pp.id = o.page_id
        join public.admin_auth_users u on u.id = pp.user_id
        where lower(coalesce(u.email, '')) like 'oferta+%@bekrew.com')::int as ofertas_abertas
  `
  return linha
}

export type PontoDia = { dia: string; total: number }

export type PendenciasOperacionais = {
  ofertas_sem_convite: number
  convites_sem_resposta: number
  trials_terminando: number
  pagamentos_atrasados: number
  emails_com_falha: number
}

/** Contadores da caixa de entrada: cada um possui uma lista de destino. */
export async function pendenciasOperacionais(): Promise<PendenciasOperacionais> {
  const [linha] = await dbRO<PendenciasOperacionais[]>`
    select
      (select count(*) from public.bio_ofertas o
       join public.proposal_pages pp on pp.id = o.page_id
       join public.admin_auth_users u on u.id = pp.user_id
       where lower(coalesce(u.email, '')) like 'oferta+%@bekrew.com'
         and o.convite_enviado_em is null)::int as ofertas_sem_convite,
      (select count(*) from public.bio_ofertas o
       join public.proposal_pages pp on pp.id = o.page_id
       join public.admin_auth_users u on u.id = pp.user_id
       where lower(coalesce(u.email, '')) like 'oferta+%@bekrew.com'
         and o.convite_enviado_em < now() - interval '5 days')::int as convites_sem_resposta,
      (select count(*) from public.subscriptions s
       join public.admin_auth_users u on u.id = s.user_id
       where s.trial_ends_at between now() and now() + interval '3 days'
         and s.status is distinct from 'active'
         and lower(coalesce(u.email, '')) not like 'oferta+%@bekrew.com')::int as trials_terminando,
      (select count(*) from public.subscriptions s
       join public.admin_auth_users u on u.id = s.user_id
       where s.status = 'past_due'
         and lower(coalesce(u.email, '')) not like 'oferta+%@bekrew.com')::int as pagamentos_atrasados,
      (select count(*) from public.email_logs where status = 'failed')::int as emails_com_falha
  `
  return linha
}

export async function cadastrosPorDia(dias = 30): Promise<PontoDia[]> {
  // `generate_series` para não faltar dia no gráfico: sem isso, um dia sem
  // cadastro sumiria do eixo e a linha mentiria sobre o ritmo.
  return dbRO<PontoDia[]>`
    select to_char(d.dia, 'DD/MM') as dia,
           coalesce(count(p.id), 0)::int as total
    from generate_series(current_date - ${dias}::int, current_date, '1 day') d(dia)
    left join (
      select p.* from public.profiles p
      join public.admin_auth_users u on u.id = p.id
      where lower(coalesce(u.email, '')) not like 'oferta+%@bekrew.com'
    ) p on date(p.created_at) = d.dia
    group by d.dia order by d.dia
  `
}

export type PassoFunil = { passo: number; contas: number }

export async function funilOnboarding(): Promise<PassoFunil[]> {
  return dbRO<PassoFunil[]>`
    select p.onboarding_step as passo, count(*)::int as contas
    from public.profiles p join public.admin_auth_users u on u.id = p.id
    where p.onboarding_step is not null
      and lower(coalesce(u.email, '')) not like 'oferta+%@bekrew.com'
    group by p.onboarding_step order by p.onboarding_step
  `
}

export type ComoConheceu = { origem: string; total: number }

export async function comoConheceu(): Promise<ComoConheceu[]> {
  return dbRO<ComoConheceu[]>`
    select coalesce(nullif(onboarding_data->>'como_conheceu',''), 'não informou') as origem,
           count(*)::int as total
    from public.profiles p join public.admin_auth_users u on u.id = p.id
    where lower(coalesce(u.email, '')) not like 'oferta+%@bekrew.com'
    group by 1 order by 2 desc
  `
}

export type LinhaAssinatura = {
  user_id: string
  nome: string | null
  status: string | null
  trial_ends_at: string | null
  current_period_end: string | null
  cancel_at_period_end: boolean
  updated_at: string
}

export async function assinaturas(): Promise<LinhaAssinatura[]> {
  return dbRO<LinhaAssinatura[]>`
    select s.user_id, p.full_name as nome, s.status, s.trial_ends_at,
           s.current_period_end, s.cancel_at_period_end, s.updated_at
    from public.subscriptions s
    left join public.profiles p on p.id = s.user_id
    join public.admin_auth_users u on u.id = s.user_id
    where lower(coalesce(u.email, '')) not like 'oferta+%@bekrew.com'
    order by
      -- Quem precisa de atenção primeiro: pagamento em atraso, depois trial
      -- vencendo, depois o resto.
      case when s.status = 'past_due' then 0
           when s.trial_ends_at between now() and now() + interval '3 days' then 1
           else 2 end,
      s.updated_at desc
  `
}

export type Ativacao = { marco: string; contas: number }

export async function ativacao(): Promise<Ativacao[]> {
  return dbRO<Ativacao[]>`
    with users_reais as (
      select p.id from public.profiles p join public.admin_auth_users u on u.id = p.id
      where lower(coalesce(u.email, '')) not like 'oferta+%@bekrew.com'
    )
    select 'criou 1ª marca' as marco, count(distinct b.user_id)::int as contas
      from public.brands b join users_reais u on u.id = b.user_id
    union all
    select 'publicou a bio', count(distinct p.user_id)::int
      from public.proposal_pages p join users_reais u on u.id = p.user_id where p.bio_ativo
    union all
    select 'recebeu 1ª proposta', count(distinct x.creator_id)::int
      from public.partnership_proposals x join users_reais u on u.id = x.creator_id
    union all
    select 'abriu 1ª campanha', count(distinct c.user_id)::int
      from public.campaigns c join users_reais u on u.id = c.user_id
    union all
    select 'registrou 1º recebível', count(distinct c.user_id)::int
      from public.receivables r join public.campaigns c on c.id = r.campaign_id
      join users_reais u on u.id = c.user_id
  `
}

export type ContaEmRisco = {
  id: string
  nome: string | null
  criado_em: string
  ultima_atividade: string | null
  dias_parado: number | null
}

export async function contasEmRisco(): Promise<ContaEmRisco[]> {
  // "Última atividade" é o maior carimbo entre as coisas que a pessoa faz de
  // propósito. Login não entra: abrir o app e não fazer nada não é atividade,
  // e contaria como saudável justamente quem está prestes a sumir.
  return dbRO<ContaEmRisco[]>`
    with atividade as (
      select p.id, p.full_name, p.created_at,
             greatest(
               coalesce((select max(created_at) from public.campaigns   where user_id = p.id), 'epoch'),
               coalesce((select max(created_at) from public.brands      where user_id = p.id), 'epoch'),
               coalesce((select max(created_at) from public.creator_links where user_id = p.id), 'epoch'),
               coalesce((select max(created_at) from public.partnership_proposals where creator_id = p.id), 'epoch')
             ) as ultima
      from public.profiles p
      join public.admin_auth_users u on u.id = p.id
      where lower(coalesce(u.email, '')) not like 'oferta+%@bekrew.com'
    )
    select id, full_name as nome, created_at as criado_em,
           nullif(ultima, 'epoch') as ultima_atividade,
           case when ultima = 'epoch' then null
                else extract(day from now() - ultima)::int end as dias_parado
    from atividade
    order by ultima asc
    limit 50
  `
}
