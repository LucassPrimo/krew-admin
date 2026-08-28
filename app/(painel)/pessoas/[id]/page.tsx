import Link from 'next/link'
import { notFound } from 'next/navigation'

import { Badge, Card, Vazio } from '@/components/ui'
import { dbRO } from '@/lib/db'
import { data, dataHora, dinheiro, numero, relativo } from '@/lib/format'
import { mascarar } from '@/lib/pii'

export const dynamic = 'force-dynamic'

/**
 * A visão 360 — a tela onde 80% do suporte acontece.
 *
 * Uma página com tudo sobre uma pessoa, porque a alternativa (navegar por seis
 * telas para responder "por que o cliente diz que não vê a campanha dele")
 * é onde o atendimento demora. Tudo aqui é leitura, pela conexão RO.
 *
 * PII: documento e contato aparecem MASCARADOS. Ver o valor inteiro é uma ação
 * com motivo, gravada em admin_audit.pii_access — não um dado que fica na tela
 * de quem abriu por outro motivo.
 */
export default async function Pessoa({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const [perfil] = await dbRO<{
    id: string; nome: string | null; sobrenome: string | null; email: string | null
    email_confirmado: string | null; ultimo_login: string | null; criado_em: string
    whatsapp: string | null; cpf_cnpj: string | null; tipo_pessoa: string | null
    cidade: string | null; estado: string | null; nicho: string | null
    account_type: string; onboarding_step: number | null
  }[]>`
    select p.id, p.full_name as nome, p.sobrenome, u.email,
           u.email_confirmed_at as email_confirmado, u.last_sign_in_at as ultimo_login,
           p.created_at as criado_em, p.whatsapp, p.cpf_cnpj, p.tipo_pessoa,
           p.cidade, p.estado, p.nicho, p.account_type, p.onboarding_step
    from public.profiles p
    left join public.admin_auth_users u on u.id = p.id
    where p.id = ${id}
  `
  if (!perfil) notFound()

  const [assinatura, orgs, pagina, campanhas, propostas, recebiveis, oferta] = await Promise.all([
    dbRO<{ status: string | null; trial_ends_at: string | null; current_period_end: string | null
           cancel_at_period_end: boolean }[]>`
      select status, trial_ends_at, current_period_end, cancel_at_period_end
      from public.subscriptions where user_id = ${id}`,
    dbRO<{ id: string; name: string; tipo: string; papel: string }[]>`
      select o.id, o.name, o.tipo, m.role as papel
      from public.memberships m join public.organizations o on o.id = m.org_id
      where m.user_id = ${id}`,
    dbRO<{ slug: string; bio_ativo: boolean; bio_verificado: boolean; cliques: number }[]>`
      select pp.slug, pp.bio_ativo, pp.bio_verificado,
             coalesce((select sum(cliques) from public.creator_links where user_id = ${id}),0)::int as cliques
      from public.proposal_pages pp where pp.user_id = ${id}`,
    dbRO<{ id: string; nome: string | null; status: string; valor_total: string | null }[]>`
      select id, nome, status, valor_total from public.campaigns
      where user_id = ${id} order by created_at desc limit 10`,
    dbRO<{ id: string; brand_name: string | null; status: string; created_at: string }[]>`
      select id, brand_name, status, created_at from public.partnership_proposals
      where creator_id = ${id} order by created_at desc limit 10`,
    dbRO<{ status: string; total: string | null; qtd: number }[]>`
      select r.status, sum(r.valor) as total, count(*)::int as qtd
      from public.receivables r join public.campaigns c on c.id = r.campaign_id
      where c.user_id = ${id} group by r.status`,
    dbRO<{ page_id: string; aceita_em: string | null }[]>`
      select o.page_id, o.aceita_em from public.bio_ofertas o
      join public.proposal_pages p on p.id = o.page_id where p.user_id = ${id}`,
  ])

  const a = assinatura[0]
  const bio = pagina[0]

  return (
    <>
      <div className="mb-4 flex items-baseline justify-between">
        <div>
          <h1 className="text-lg font-medium">
            {[perfil.nome, perfil.sobrenome].filter(Boolean).join(' ') || '(sem nome)'}
          </h1>
          <p className="font-mono text-xs text-texto-fraco">{perfil.id}</p>
        </div>
        <Link href="/pessoas" className="text-sm text-texto-fraco hover:text-texto">voltar</Link>
      </div>

      {oferta[0] && !oferta[0].aceita_em && (
        <div className="mb-4 rounded-md border border-acento/40 bg-acento/5 px-3 py-2 text-sm">
          Esta é uma <strong>conta de oferta</strong> ainda não reivindicada.{' '}
          <Link href={`/ofertas/${oferta[0].page_id}`} className="text-acento hover:underline">
            abrir a oferta
          </Link>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 text-sm font-medium">Identidade</h2>
          <dl className="grid grid-cols-[10rem_1fr] gap-y-1.5 text-sm">
            <dt className="text-texto-fraco">E-mail</dt>
            <dd>{mascarar('email', perfil.email)}</dd>
            <dt className="text-texto-fraco">E-mail confirmado</dt>
            <dd>
              {perfil.email_confirmado
                ? <Badge tom="ok">{data(perfil.email_confirmado)}</Badge>
                : <Badge tom="perigo">não confirmado</Badge>}
            </dd>
            <dt className="text-texto-fraco">Último login</dt>
            <dd>{perfil.ultimo_login ? relativo(perfil.ultimo_login) : 'nunca'}</dd>
            <dt className="text-texto-fraco">WhatsApp</dt>
            <dd>{mascarar('whatsapp', perfil.whatsapp)}</dd>
            <dt className="text-texto-fraco">Documento</dt>
            <dd>
              {mascarar('cpf_cnpj', perfil.cpf_cnpj)}
              {perfil.cpf_cnpj && (
                <Link href={`/pessoas/${id}/revelar?campo=cpf_cnpj`} className="ml-2 text-xs text-acento hover:underline">
                  revelar
                </Link>
              )}
            </dd>
            <dt className="text-texto-fraco">Tipo</dt>
            <dd>{perfil.tipo_pessoa ?? '—'} · {perfil.account_type}</dd>
            <dt className="text-texto-fraco">Cidade</dt>
            <dd>{[perfil.cidade, perfil.estado].filter(Boolean).join('/') || '—'}</dd>
            <dt className="text-texto-fraco">Nicho</dt>
            <dd>{perfil.nicho ?? '—'}</dd>
            <dt className="text-texto-fraco">Onboarding</dt>
            <dd>passo {perfil.onboarding_step ?? '—'}</dd>
            <dt className="text-texto-fraco">Cadastro</dt>
            <dd title={dataHora(perfil.criado_em)}>{relativo(perfil.criado_em)}</dd>
          </dl>
        </Card>

        <Card>
          <h2 className="mb-3 text-sm font-medium">Assinatura</h2>
          {!a ? (
            <Vazio>Sem linha de assinatura.</Vazio>
          ) : (
            <dl className="grid grid-cols-[10rem_1fr] gap-y-1.5 text-sm">
              <dt className="text-texto-fraco">Status</dt>
              <dd>{a.status ?? '—'}</dd>
              <dt className="text-texto-fraco">Trial até</dt>
              <dd>{a.trial_ends_at ? dataHora(a.trial_ends_at) : '—'}</dd>
              <dt className="text-texto-fraco">Período até</dt>
              <dd>{a.current_period_end ? dataHora(a.current_period_end) : '—'}</dd>
              <dt className="text-texto-fraco">Cancela no fim</dt>
              <dd>{a.cancel_at_period_end ? 'sim' : 'não'}</dd>
            </dl>
          )}

          <h2 className="mb-2 mt-4 text-sm font-medium">Página pública</h2>
          {!bio ? (
            <Vazio>Sem página.</Vazio>
          ) : (
            <dl className="grid grid-cols-[10rem_1fr] gap-y-1.5 text-sm">
              <dt className="text-texto-fraco">Handle</dt>
              <dd className="font-mono text-xs">@{bio.slug}</dd>
              <dt className="text-texto-fraco">No ar</dt>
              <dd>{bio.bio_ativo ? <Badge tom="ok">sim</Badge> : <Badge tom="perigo">não</Badge>}</dd>
              <dt className="text-texto-fraco">Verificado</dt>
              <dd>{bio.bio_verificado ? <Badge tom="ok">sim</Badge> : 'não'}</dd>
              <dt className="text-texto-fraco">Cliques</dt>
              <dd className="tabular-nums">{numero(bio.cliques)}</dd>
            </dl>
          )}
        </Card>

        <Card>
          <h2 className="mb-3 text-sm font-medium">Organizações</h2>
          {orgs.length === 0 ? <Vazio>Nenhuma.</Vazio> : (
            <table className="densa">
              <thead><tr><th>Nome</th><th>Tipo</th><th>Papel</th></tr></thead>
              <tbody>
                {orgs.map((o) => (
                  <tr key={o.id}><td>{o.name}</td><td>{o.tipo}</td><td>{o.papel}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card>
          <h2 className="mb-3 text-sm font-medium">Financeiro</h2>
          {recebiveis.length === 0 ? <Vazio>Sem recebíveis.</Vazio> : (
            <table className="densa">
              <thead><tr><th>Status</th><th>Qtd</th><th>Total</th></tr></thead>
              <tbody>
                {recebiveis.map((r) => (
                  <tr key={r.status}>
                    <td>{r.status}</td>
                    <td className="tabular-nums">{numero(r.qtd)}</td>
                    <td className="tabular-nums">{dinheiro(r.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card>
          <h2 className="mb-3 text-sm font-medium">Campanhas recentes</h2>
          {campanhas.length === 0 ? <Vazio>Nenhuma.</Vazio> : (
            <table className="densa">
              <thead><tr><th>Nome</th><th>Status</th><th>Valor</th></tr></thead>
              <tbody>
                {campanhas.map((c) => (
                  <tr key={c.id}>
                    <td>{c.nome ?? '—'}</td><td>{c.status}</td>
                    <td className="tabular-nums">{dinheiro(c.valor_total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card>
          <h2 className="mb-3 text-sm font-medium">Propostas recebidas</h2>
          {propostas.length === 0 ? <Vazio>Nenhuma.</Vazio> : (
            <table className="densa">
              <thead><tr><th>Marca</th><th>Status</th><th>Quando</th></tr></thead>
              <tbody>
                {propostas.map((p) => (
                  <tr key={p.id}>
                    <td>{p.brand_name ?? '—'}</td><td>{p.status}</td>
                    <td className="text-texto-fraco">{relativo(p.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </>
  )
}
