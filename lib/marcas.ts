import type { TransactionSql } from 'postgres'

import { dbRO, dbRW } from './db'
import { escritaLigada } from './env'
import { registrarAcao } from './mutate'

/**
 * Marcas e assessorias no painel (plano 2 de `krew-app/docs`).
 *
 * O piloto do produto da marca é liberado por convite: o time cria aqui um
 * acesso (e-mail + nome da marca) e manda o link. Quem aceita no app vira
 * dona da organização da marca — a organização só nasce no aceite, pela
 * função `marca_aceitar_acesso`, que confere o e-mail da conta. O painel não
 * cria organização nem membership por conta própria: isso exigiria mexer em
 * `auth.users`, e o aceite é o que prova que a pessoa certa entrou.
 */

export { linkDeAcesso } from './marcas-link'

export interface OrgMarca {
  id: string
  nome: string
  criada_em: string
  dono_email: string | null
  membros: number
  projetos: number
  participacoes_aceitas: number
  convites_pendentes: number
  para_aprovar: number
}

export interface AcessoMarca {
  id: string
  token: string
  email: string
  nome_marca: string
  status: 'pendente' | 'aceito' | 'cancelado'
  expires_at: string
  created_at: string
  accepted_org_id: string | null
}

export interface Assessoria {
  id: string
  nome: string
  criada_em: string
  dono_email: string | null
  membros: number
  criadores: number
  campanhas_ativas: number
}

export async function listarMarcas(): Promise<OrgMarca[]> {
  return dbRO<OrgMarca[]>`
    select o.id, o.name as nome, o.created_at as criada_em, u.email as dono_email,
      (select count(*)::int from public.memberships m where m.org_id = o.id) as membros,
      (select count(*)::int from public.brand_projects p where p.brand_org_id = o.id) as projetos,
      (select count(*)::int from public.brand_participations x where x.brand_org_id = o.id and x.status = 'aceita') as participacoes_aceitas,
      (select count(*)::int from public.brand_participations x where x.brand_org_id = o.id and x.status = 'convidada') as convites_pendentes,
      (select count(*)::int from public.brand_participations x
         join public.deliverables d on d.campaign_id = x.campaign_id
        where x.brand_org_id = o.id and x.status = 'aceita'
          and (d.status = 'em_aprovacao' or d.roteiro_status = 'em_aprovacao')) as para_aprovar
    from public.organizations o
    left join public.admin_auth_users u on u.id = o.owner_user_id
    where o.tipo = 'brand'
    order by o.created_at desc
  `
}

export async function listarAcessos(): Promise<AcessoMarca[]> {
  return dbRO<AcessoMarca[]>`
    select id, token, email, nome_marca, status, expires_at, created_at, accepted_org_id
    from public.brand_access_invites
    order by (status = 'pendente') desc, created_at desc
    limit 200
  `
}

export async function listarAssessorias(): Promise<Assessoria[]> {
  return dbRO<Assessoria[]>`
    select o.id, o.name as nome, o.created_at as criada_em, u.email as dono_email,
      (select count(*)::int from public.memberships m where m.org_id = o.id) as membros,
      (select count(*)::int from public.agency_creators ac where ac.agency_org_id = o.id) as criadores,
      (select count(*)::int from public.agency_creators ac
         join public.campaigns c on c.org_id = ac.creator_org_id and c.status = 'ativa'
        where ac.agency_org_id = o.id) as campanhas_ativas
    from public.organizations o
    left join public.admin_auth_users u on u.id = o.owner_user_id
    where o.tipo = 'agency'
    order by o.created_at desc
  `
}

type Ctx = { atorId: string; ip: string | null; userAgent: string | null }
type Resultado<T> = { ok: true; valor: T } | { ok: false; erro: string }

/** Libera o piloto para uma marca. Um convite pendente por e-mail. */
export async function criarAcesso(email: string, nomeMarca: string, ctx: Ctx): Promise<Resultado<AcessoMarca>> {
  if (!escritaLigada) return { ok: false, erro: 'Escrita desligada neste deploy (ADMIN_WRITES_ENABLED).' }
  const e = email.trim().toLowerCase()
  const nome = nomeMarca.trim()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return { ok: false, erro: 'Confira o e-mail.' }
  if (!nome) return { ok: false, erro: 'Escreva o nome da marca.' }

  try {
    return await dbRW.begin(async (tx: TransactionSql) => {
      const [existente] = await tx<{ id: string }[]>`
        select id from public.brand_access_invites
        where lower(email) = ${e} and status = 'pendente' and expires_at > now()
        for update
      `
      if (existente) throw new Error('Já existe um acesso pendente para este e-mail. Copie o link na lista.')

      const [criado] = await tx<AcessoMarca[]>`
        insert into public.brand_access_invites (email, nome_marca, criado_por)
        values (${e}, ${nome}, ${ctx.atorId})
        returning id, token, email, nome_marca, status, expires_at, created_at, accepted_org_id
      `
      await registrarAcao(tx, {
        atorId: ctx.atorId,
        tabela: 'brand_access_invites',
        registroId: criado.id,
        detalhe: { acao: 'acesso_marca_criado', email: e, nome_marca: nome },
        motivo: `Acesso ao piloto de marcas liberado para ${nome}`,
        ip: ctx.ip,
        userAgent: ctx.userAgent,
      })
      return { ok: true as const, valor: criado }
    })
  } catch (err) {
    return { ok: false, erro: (err as Error).message }
  }
}

export async function cancelarAcesso(id: string, ctx: Ctx): Promise<Resultado<null>> {
  if (!escritaLigada) return { ok: false, erro: 'Escrita desligada neste deploy (ADMIN_WRITES_ENABLED).' }
  try {
    return await dbRW.begin(async (tx: TransactionSql) => {
      const [antes] = await tx<{ id: string; status: string; nome_marca: string }[]>`
        select id, status, nome_marca from public.brand_access_invites where id = ${id} for update
      `
      if (!antes) throw new Error('Acesso não encontrado.')
      if (antes.status !== 'pendente') throw new Error('Só dá para cancelar um acesso pendente.')
      await tx`update public.brand_access_invites set status = 'cancelado' where id = ${id}`
      await registrarAcao(tx, {
        atorId: ctx.atorId,
        tabela: 'brand_access_invites',
        registroId: id,
        detalhe: { acao: 'acesso_marca_cancelado', nome_marca: antes.nome_marca },
        motivo: `Acesso ao piloto de marcas cancelado (${antes.nome_marca})`,
        ip: ctx.ip,
        userAgent: ctx.userAgent,
      })
      return { ok: true as const, valor: null }
    })
  } catch (err) {
    return { ok: false, erro: (err as Error).message }
  }
}
