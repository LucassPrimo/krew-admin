import { dbRO } from './db'

export type EtapaUser = 'novo' | 'ativando' | 'ativo' | 'em_risco' | 'inativo'

export type UserListado = {
  id: string
  nome: string | null
  email: string | null
  whatsapp: string | null
  avatar_url: string | null
  account_type: string
  onboarding_step: number | null
  criado_em: string
  slug: string | null
  bio_ativo: boolean | null
  bio_verificado: boolean | null
  status_assinatura: string | null
  trial_ends_at: string | null
  origem: 'oferta' | 'organico'
  oferta_aceita_em: string | null
  links: number
  redes: number
  marcas: number
  propostas: number
  campanhas: number
  ultima_atividade: string | null
  etapa: EtapaUser
}

export type FiltrosUsers = {
  q?: string
  etapa?: string
  plano?: string
  origem?: string
  bio?: string
}

/**
 * Users reais do produto.
 *
 * O prefixo de e-mail é a fronteira principal. O NOT EXISTS complementar é
 * necessário enquanto `enviarConvite` troca o e-mail interno antes do aceite:
 * sem ele, uma oferta apenas convidada apareceria como cliente real.
 */
export async function listarUsers(filtros: FiltrosUsers): Promise<UserListado[]> {
  const q = filtros.q?.trim() ?? ''
  const etapa = filtros.etapa ?? 'todos'
  const plano = filtros.plano ?? 'todos'
  const origem = filtros.origem ?? 'todos'
  const bio = filtros.bio ?? 'todos'

  return dbRO<UserListado[]>`
    with base as (
      select
        p.id::text,
        nullif(trim(concat_ws(' ', p.full_name, p.sobrenome)), '') as nome,
        u.email,
        p.whatsapp,
        p.avatar_url,
        p.account_type,
        p.onboarding_step,
        p.created_at as criado_em,
        pagina.slug,
        pagina.bio_ativo,
        pagina.bio_verificado,
        s.status as status_assinatura,
        s.trial_ends_at,
        case when oferta.page_id is not null then 'oferta' else 'organico' end as origem,
        oferta.aceita_em as oferta_aceita_em,
        coalesce(uso.links, 0)::int as links,
        coalesce(uso.redes, 0)::int as redes,
        coalesce(uso.marcas, 0)::int as marcas,
        coalesce(uso.propostas, 0)::int as propostas,
        coalesce(uso.campanhas, 0)::int as campanhas,
        nullif(greatest(
          coalesce(uso.ultimo_link, 'epoch'),
          coalesce(uso.ultima_rede, 'epoch'),
          coalesce(uso.ultima_marca, 'epoch'),
          coalesce(uso.ultima_proposta, 'epoch'),
          coalesce(uso.ultima_campanha, 'epoch')
        ), 'epoch') as ultima_atividade
      from public.profiles p
      join public.admin_auth_users u on u.id = p.id
      left join lateral (
        select pp.id, pp.slug, pp.bio_ativo, pp.bio_verificado
        from public.proposal_pages pp
        where pp.user_id = p.id
        order by pp.created_at desc
        limit 1
      ) pagina on true
      left join public.subscriptions s on s.user_id = p.id
      left join lateral (
        select o.page_id, o.aceita_em
        from public.bio_ofertas o
        join public.proposal_pages op on op.id = o.page_id
        where op.user_id = p.id
        order by o.criada_em desc
        limit 1
      ) oferta on true
      left join lateral (
        select
          (select count(*) from public.creator_links x where x.user_id = p.id)::int as links,
          (select max(created_at) from public.creator_links x where x.user_id = p.id) as ultimo_link,
          (select count(*) from public.creator_social_networks x where x.user_id = p.id)::int as redes,
          (select max(created_at) from public.creator_social_networks x where x.user_id = p.id) as ultima_rede,
          (select count(*) from public.brands x where x.user_id = p.id)::int as marcas,
          (select max(created_at) from public.brands x where x.user_id = p.id) as ultima_marca,
          (select count(*) from public.partnership_proposals x where x.creator_id = p.id)::int as propostas,
          (select max(created_at) from public.partnership_proposals x where x.creator_id = p.id) as ultima_proposta,
          (select count(*) from public.campaigns x where x.user_id = p.id)::int as campanhas,
          (select max(created_at) from public.campaigns x where x.user_id = p.id) as ultima_campanha
      ) uso on true
      where lower(coalesce(u.email, '')) not like 'oferta+%@bekrew.com'
        and not exists (
          select 1
          from public.bio_ofertas aberta
          join public.proposal_pages ap on ap.id = aberta.page_id
          where ap.user_id = p.id and aberta.aceita_em is null
        )
    ), classificados as (
      select base.*,
        case
          when ultima_atividade is not null and ultima_atividade < now() - interval '45 days' then 'inativo'
          when ultima_atividade is not null and ultima_atividade < now() - interval '21 days' then 'em_risco'
          when onboarding_step >= 3 and bio_ativo and (links + redes + marcas) > 0
               and ultima_atividade >= now() - interval '21 days' then 'ativo'
          when onboarding_step >= 1 or bio_ativo or (links + redes + marcas) > 0 then 'ativando'
          else 'novo'
        end as etapa
      from base
    )
    select * from classificados
    where (${q} = '' or nome ilike ${'%' + q + '%'} or email ilike ${'%' + q + '%'}
      or whatsapp ilike ${'%' + q + '%'} or slug ilike ${'%' + q.replace(/^@/, '') + '%'}
      or id = ${q})
      and (${etapa} = 'todos' or etapa = ${etapa})
      and (${origem} = 'todos' or origem = ${origem})
      and (${bio} = 'todos'
        or (${bio} = 'ativa' and bio_ativo)
        or (${bio} = 'inativa' and bio_ativo is false)
        or (${bio} = 'sem_bio' and slug is null))
      and (${plano} = 'todos'
        or (${plano} = 'pago' and status_assinatura = 'active')
        or (${plano} = 'trial' and trial_ends_at > now() and status_assinatura is distinct from 'active')
        or (${plano} = 'atrasado' and status_assinatura = 'past_due')
        or (${plano} = 'free' and status_assinatura is distinct from 'active' and trial_ends_at is not null and trial_ends_at <= now()))
    order by
      case etapa when 'em_risco' then 0 when 'novo' then 1 when 'ativando' then 2 when 'inativo' then 3 else 4 end,
      criado_em desc
    limit 200
  `
}

export async function buscarUser(id: string): Promise<UserListado | null> {
  const users = await listarUsers({ q: id })
  return users.find((u) => u.id === id) ?? null
}

export type EventoUser = {
  tipo: string
  titulo: string
  detalhe: string | null
  ocorrido_em: string
}

/** Timeline derivada apenas de fatos que as tabelas atuais conseguem provar. */
export async function timelineUser(id: string): Promise<EventoUser[]> {
  return dbRO<EventoUser[]>`
    select * from (
      select 'conta' as tipo, 'Conta criada' as titulo, null::text as detalhe,
             p.created_at as ocorrido_em
      from public.profiles p where p.id = ${id}
      union all
      select 'oferta', 'Oferta de bio criada', '@' || pp.slug,
             o.criada_em
      from public.bio_ofertas o join public.proposal_pages pp on pp.id = o.page_id
      where pp.user_id = ${id}
      union all
      select 'oferta', 'Convite da oferta enviado', o.email_convite,
             o.convite_enviado_em
      from public.bio_ofertas o join public.proposal_pages pp on pp.id = o.page_id
      where pp.user_id = ${id} and o.convite_enviado_em is not null
      union all
      select 'oferta', 'Oferta aceita', '@' || pp.slug,
             o.aceita_em
      from public.bio_ofertas o join public.proposal_pages pp on pp.id = o.page_id
      where pp.user_id = ${id} and o.aceita_em is not null
      union all
      select 'produto', 'Link adicionado', l.titulo, l.created_at
      from public.creator_links l where l.user_id = ${id}
      union all
      select 'produto', 'Marca criada', b.nome, b.created_at
      from public.brands b where b.user_id = ${id}
      union all
      select 'produto', 'Campanha criada', c.nome, c.created_at
      from public.campaigns c where c.user_id = ${id}
      union all
      select 'produto', 'Proposta recebida', null::text, x.created_at
      from public.partnership_proposals x where x.creator_id = ${id}
    ) eventos
    order by ocorrido_em desc
    limit 100
  `
}
