import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { exigirAdmin, stepUpValido } from '@/lib/auth'
import { dataRelevante, estadoAssinatura, ROTULO_ESTADO, type EstadoAssinatura } from '@/lib/assinatura'
import { sqlRo } from '@/lib/db'
import { env } from '@/lib/env'
import { brl, data, dataHora, desde, relativo, num } from '@/lib/format'
import { MutacaoRecusada, presentearAssinatura } from '@/lib/mutate'
import { mascararBancario, mascararDocumento, mascararEmail, mascararTelefone } from '@/lib/pii'
import { Badge, Card, Celula, Linha, Mascarado, Stat, Tabela, Vazio } from '@/components/ui'

export const dynamic = 'force-dynamic'

const TOM_ESTADO: Record<EstadoAssinatura, 'ok' | 'info' | 'alerta' | 'neutro'> = {
  ativa: 'ok',
  trial: 'info',
  cancelada_com_prazo: 'alerta',
  inadimplente: 'alerta',
  expirada: 'neutro',
}

/**
 * Visão 360 — a tela onde 80% do atendimento acontece.
 *
 * A regra que organiza tudo aqui: a POSSE do dado é `org_id`, não `user_id`
 * (decisão D1 da verticalização do produto). Então "os dados dessa pessoa" são
 * os dados das orgs em que ela é membro — e não as linhas onde o `user_id` é
 * ela, que hoje significa apenas AUTORIA. Filtrar por `user_id` aqui mostraria
 * um retrato errado justamente nos casos difíceis: creator gerido por agência,
 * dado criado por um assessor.
 */

function Campo({
  rotulo,
  children,
  href,
}: {
  rotulo: string
  children: React.ReactNode
  href?: string
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-[var(--color-border)] py-2 last:border-0">
      <span className="text-xs text-[var(--color-faint)]">{rotulo}</span>
      <span className="text-right text-sm">
        {children}
        {href && (
          <Link
            href={href}
            className="ml-2 text-[11px] text-[var(--color-accent)] hover:underline"
          >
            revelar
          </Link>
        )}
      </span>
    </div>
  )
}

async function presentear(id: string, formData: FormData) {
  'use server'
  const admin = await exigirAdmin()

  const dias = Number(formData.get('dias'))
  if (!Number.isFinite(dias) || dias <= 0) {
    redirect(`/pessoas/${id}?erro=${encodeURIComponent('Dias precisa ser um número positivo.')}`)
  }

  const trialAtualBruto = String(formData.get('trialAtual') ?? '')
  const trialAtual = trialAtualBruto ? new Date(trialAtualBruto) : null
  const agora = Date.now()
  const base = trialAtual && trialAtual.getTime() > agora ? trialAtual : new Date(agora)
  const novaData = new Date(base.getTime() + dias * 86_400_000)

  try {
    await presentearAssinatura(admin, {
      userId: id,
      novaData,
      motivo: String(formData.get('motivo') ?? ''),
    })
  } catch (e) {
    if (e instanceof MutacaoRecusada) {
      redirect(`/pessoas/${id}?erro=${encodeURIComponent(e.message)}`)
    }
    throw e
  }

  redirect(`/pessoas/${id}?ok=1`)
}

export default async function Pessoa({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ erro?: string; ok?: string }>
}) {
  const admin = await exigirAdmin()
  const { id } = await params
  const { erro, ok } = await searchParams
  const podeEscrever = env.ADMIN_WRITES_ENABLED && stepUpValido(admin)

  const [pessoa] = await sqlRo<
    {
      id: string
      full_name: string | null
      sobrenome: string | null
      email: string
      whatsapp: string | null
      cpf_cnpj: string | null
      dados_bancarios: unknown
      tipo_pessoa: string | null
      account_type: string
      nicho: string | null
      cidade: string | null
      estado: string | null
      iss_aliquota: string | null
      onboarding_step: number | null
      onboarding_data: Record<string, unknown> | null
      created_at: Date
      email_confirmado: Date | null
      ultimo_login: Date | null
      provider: string | null
    }[]
  >`
    select p.*, u.email, u.email_confirmed_at as email_confirmado,
           u.last_sign_in_at as ultimo_login,
           u.raw_app_meta_data->>'provider' as provider
    from public.profiles p
    join public.admin_auth_users u on u.id = p.id
    where p.id = ${id}
  `

  if (!pessoa) notFound()

  const orgs = await sqlRo<
    { org_id: string; nome: string; tipo: string; role: string; eh_dono: boolean }[]
  >`
    select o.id as org_id, o.name as nome, o.tipo, m.role,
           (o.owner_user_id = ${id}) as eh_dono
    from public.memberships m
    join public.organizations o on o.id = m.org_id
    where m.user_id = ${id}
    order by m.created_at
  `

  const orgIds = orgs.map((o) => o.org_id)

  // Sem org não há dado operacional. Sair cedo evita `in ()` vazio, que no
  // Postgres é erro de sintaxe — e não zero linhas, como se espera.
  const temOrg = orgIds.length > 0

  const [operacao] = temOrg
    ? await sqlRo<
        {
          marcas: string
          deals: string
          campanhas: string
          campanhas_ativas: string
          entregaveis: string
          entregaveis_pendentes: string
          propostas: string
          propostas_inbox: string
        }[]
      >`
        select
          (select count(*) from public.brands where org_id = any(${orgIds}))    as marcas,
          (select count(*) from public.deals where org_id = any(${orgIds}))     as deals,
          (select count(*) from public.campaigns where org_id = any(${orgIds})) as campanhas,
          (select count(*) from public.campaigns
            where org_id = any(${orgIds}) and status = 'ativa')                 as campanhas_ativas,
          (select count(*) from public.deliverables d
            join public.campaigns c on c.id = d.campaign_id
            where c.org_id = any(${orgIds}))                                    as entregaveis,
          (select count(*) from public.deliverables d
            join public.campaigns c on c.id = d.campaign_id
            where c.org_id = any(${orgIds})
              and d.status in ('a_gravar', 'em_aprovacao'))                     as entregaveis_pendentes,
          (select count(*) from public.partnership_proposals
            where creator_id = ${id})                                           as propostas,
          (select count(*) from public.partnership_proposals
            where creator_id = ${id} and status = 'inbox')                      as propostas_inbox
      `
    : [null]

  const [financeiro] = temOrg
    ? await sqlRo<
        {
          a_receber: string
          recebido: string
          vencido: string
          despesas: string
          contratos: string
          notas: string
        }[]
      >`
        select
          (select coalesce(sum(valor), 0) from public.receivables
            where org_id = any(${orgIds}) and status = 'pendente')           as a_receber,
          (select coalesce(sum(valor), 0) from public.receivables
            where org_id = any(${orgIds}) and status = 'pago')               as recebido,
          (select coalesce(sum(valor), 0) from public.receivables
            where org_id = any(${orgIds}) and status <> 'pago'
              and data_prevista < current_date)                              as vencido,
          (select coalesce(sum(valor), 0) from public.expenses
            where org_id = any(${orgIds}))                                   as despesas,
          (select count(*) from public.contracts where org_id = any(${orgIds})) as contratos,
          (select count(*) from public.invoices where org_id = any(${orgIds})) as notas
      `
    : [null]

  const pagina = await sqlRo<
    { slug: string; availability_status: string; min_budget_cents: number | null; theme: string }[]
  >`
    select slug, availability_status, min_budget_cents, theme
    from public.proposal_pages where user_id = ${id}
  `

  const redes = await sqlRo<{ platform: string; handle: string; followers: number | null }[]>`
    select s.platform, s.handle, m.followers
    from public.creator_social_networks s
    left join public.creator_metrics m
      on m.user_id = s.user_id and m.platform = s.platform
    where s.user_id = ${id}
    order by s.platform
  `

  const campanhas = temOrg
    ? await sqlRo<
        { id: string; nome: string | null; status: string; valor_total: string; marca: string | null }[]
      >`
        select c.id, c.nome, c.status, c.valor_total, b.nome as marca
        from public.campaigns c
        left join public.brands b on b.id = c.brand_id
        where c.org_id = any(${orgIds})
        order by c.created_at desc
        limit 10
      `
    : []

  const emails = await sqlRo<{ type: string; status: string; created_at: Date }[]>`
    select e.type, e.status, e.created_at
    from public.email_logs e
    join public.partnership_proposals pp on pp.id = e.proposal_id
    where pp.creator_id = ${id}
    order by e.created_at desc
    limit 10
  `

  const [assinatura] = await sqlRo<
    {
      status: string | null
      cancel_at_period_end: boolean | null
      current_period_end: Date | null
      trial_ends_at: Date | null
      stripe_customer_id: string | null
    }[]
  >`
    select status, cancel_at_period_end, current_period_end, trial_ends_at, stripe_customer_id
    from public.subscriptions where user_id = ${id}
  `
  const estado = estadoAssinatura(assinatura ?? null)
  const vence = dataRelevante(assinatura ?? null)

  const nome = [pessoa.full_name, pessoa.sobrenome].filter(Boolean).join(' ') || 'sem nome'

  return (
    <div className="space-y-6">
      {ok && (
        <div className="rounded-[24px] border-[0.5px] border-transparent bg-[var(--color-ok-dim)] px-4 py-3 text-sm text-[var(--color-ok)]">
          Presente concedido.
        </div>
      )}
      {erro && (
        <div className="rounded-[24px] border-[0.5px] border-transparent bg-[var(--color-danger-dim)] px-4 py-3 text-sm text-[var(--color-danger-deep)]">
          {erro}
        </div>
      )}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/pessoas" className="text-xs text-[var(--color-muted)] hover:underline">
            ← Pessoas
          </Link>
          <h1 className="mt-1 text-xl font-semibold">{nome}</h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <Badge tom={pessoa.account_type === 'agency' ? 'info' : 'neutro'}>
              {pessoa.account_type}
            </Badge>
            {(pessoa.onboarding_step ?? 0) >= 3 ? (
              <Badge tom="ok">onboarding completo</Badge>
            ) : (
              <Badge tom="alerta">onboarding {pessoa.onboarding_step ?? 0}/3</Badge>
            )}
            {!pessoa.email_confirmado && <Badge tom="alerta">e-mail não confirmado</Badge>}
            <span className="tabular text-[11px] text-[var(--color-faint)]">{pessoa.id}</span>
          </div>
        </div>
        <Link
          href={`/dados/profiles/${pessoa.id}`}
          className="rounded-full border-[0.5px] border-[var(--color-border-strong)] px-4 py-2 text-sm transition-colors hover:border-[var(--color-accent)]"
        >
          Editar perfil
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card titulo="Identidade">
          <Campo rotulo="E-mail">
            <Mascarado>{mascararEmail(pessoa.email)}</Mascarado>
          </Campo>
          <Campo rotulo="Confirmado em">
            {pessoa.email_confirmado ? dataHora(pessoa.email_confirmado) : '—'}
          </Campo>
          <Campo rotulo="WhatsApp" href={`/pessoas/${id}/revelar?campo=whatsapp`}>
            <Mascarado>{mascararTelefone(pessoa.whatsapp)}</Mascarado>
          </Campo>
          <Campo rotulo="CPF/CNPJ" href={`/pessoas/${id}/revelar?campo=cpf_cnpj`}>
            <Mascarado>{mascararDocumento(pessoa.cpf_cnpj)}</Mascarado>
          </Campo>
          <Campo rotulo="Dados bancários" href={`/pessoas/${id}/revelar?campo=dados_bancarios`}>
            <Mascarado>{mascararBancario(pessoa.dados_bancarios)}</Mascarado>
          </Campo>
          <Campo rotulo="Tipo de pessoa">{pessoa.tipo_pessoa ?? '—'}</Campo>
          <Campo rotulo="Nicho">{pessoa.nicho ?? '—'}</Campo>
          <Campo rotulo="Local">
            {pessoa.cidade ? `${pessoa.cidade}${pessoa.estado ? `/${pessoa.estado}` : ''}` : '—'}
          </Campo>
          <Campo rotulo="Cadastro">{dataHora(pessoa.created_at)}</Campo>
          <Campo rotulo="Último login">{desde(pessoa.ultimo_login)}</Campo>
        </Card>

        <Card titulo="Organizações">
          {orgs.length === 0 ? (
            <Vazio>
              Nenhuma organização. O trigger de signup falhou — esta conta está quebrada
              e não consegue usar o app.
            </Vazio>
          ) : (
            <ul className="space-y-2">
              {orgs.map((o) => (
                <li
                  key={o.org_id}
                  className="rounded-[16px] border-[0.5px] border-[var(--color-border)] px-3 py-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm">{o.nome}</span>
                    <Badge tom={o.tipo === 'agency' ? 'info' : 'neutro'}>{o.tipo}</Badge>
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-[11px] text-[var(--color-faint)]">
                    <span>papel: {o.role}</span>
                    {o.eh_dono && <Badge tom="destaque">dona</Badge>}
                  </div>
                  <div className="tabular mt-1 text-[10px] text-[var(--color-faint)]">
                    {o.org_id}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card titulo="Página pública e redes">
          {pagina[0] ? (
            <>
              <Campo rotulo="Slug">/{pagina[0].slug}</Campo>
              <Campo rotulo="Disponibilidade">
                <Badge tom={pagina[0].availability_status === 'open' ? 'ok' : 'neutro'}>
                  {pagina[0].availability_status}
                </Badge>
              </Campo>
              <Campo rotulo="Orçamento mínimo">
                {pagina[0].min_budget_cents
                  ? brl(pagina[0].min_budget_cents / 100)
                  : '—'}
              </Campo>
            </>
          ) : (
            <Vazio>Sem página pública.</Vazio>
          )}

          <div className="mt-3 space-y-1">
            {redes.length === 0 ? (
              <div className="text-xs text-[var(--color-faint)]">Nenhuma rede cadastrada.</div>
            ) : (
              redes.map((r) => (
                <div key={r.platform} className="flex justify-between text-sm">
                  <span className="text-[var(--color-muted)]">{r.platform}</span>
                  <span>
                    {r.handle}
                    {r.followers != null && (
                      <span className="ml-2 text-[var(--color-faint)]">
                        {num(r.followers)} seg.
                      </span>
                    )}
                  </span>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      {pessoa.account_type === 'creator' && (
        <Card titulo="Assinatura">
          <div className="grid gap-5 lg:grid-cols-2">
            <div>
              <Campo rotulo="Status">
                <Badge tom={TOM_ESTADO[estado]}>{ROTULO_ESTADO[estado]}</Badge>
              </Campo>
              <Campo rotulo="Vence/renova">
                {vence ? (
                  <>
                    {data(vence)}{' '}
                    <span className="text-[var(--color-faint)]">({relativo(vence)})</span>
                  </>
                ) : (
                  '—'
                )}
              </Campo>
              <Campo rotulo="Cancelamento agendado">
                {assinatura?.cancel_at_period_end ? (
                  <Badge tom="alerta">sim</Badge>
                ) : (
                  <span className="text-[var(--color-faint)]">não</span>
                )}
              </Campo>
              <Campo rotulo="Cliente Stripe">
                {assinatura?.stripe_customer_id ? (
                  <span className="tabular text-xs">{assinatura.stripe_customer_id}</span>
                ) : (
                  <span className="text-[var(--color-faint)]">nunca assinou</span>
                )}
              </Campo>
            </div>

            <div>
              {estado === 'ativa' ? (
                <p className="text-sm text-[var(--color-muted)]">
                  Já é assinante ativo — presentear dias de trial não muda nada, o gate nem
                  chega a olhar essa coluna enquanto o Stripe disser <code>active</code>.
                </p>
              ) : !env.ADMIN_WRITES_ENABLED ? (
                <p className="text-sm text-[var(--color-muted)]">
                  A escrita está desligada por <code>ADMIN_WRITES_ENABLED=false</code>.
                </p>
              ) : !podeEscrever ? (
                <div className="space-y-2">
                  <p className="text-sm text-[var(--color-muted)]">
                    Seu segundo fator foi verificado há mais de 15 minutos.
                  </p>
                  <Link
                    href="/mfa"
                    className="btn-krew-cta inline-block rounded-full px-4 py-2 text-sm font-semibold"
                  >
                    Confirmar código
                  </Link>
                </div>
              ) : (
                <form action={presentear.bind(null, id)} className="space-y-2.5">
                  <input
                    type="hidden"
                    name="trialAtual"
                    value={assinatura?.trial_ends_at ? assinatura.trial_ends_at.toISOString() : ''}
                  />
                  <div className="flex items-end gap-2">
                    <div>
                      <label className="mb-1 block text-xs text-[var(--color-muted)]">
                        Dias de presente
                      </label>
                      <input
                        name="dias"
                        type="number"
                        min={1}
                        required
                        defaultValue={30}
                        className="w-24 rounded-[16px] border-[0.5px] border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-1.5 text-sm"
                      />
                    </div>
                    <span className="pb-2 text-xs text-[var(--color-faint)]">
                      soma em cima do trial atual, se ele ainda estiver no futuro
                    </span>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-[var(--color-muted)]">
                      Motivo <span className="text-[var(--color-danger)]">*</span>
                    </label>
                    <textarea
                      name="motivo"
                      rows={2}
                      required
                      minLength={10}
                      placeholder="Ex: creator pediu mais tempo pra decidir, ticket #48."
                      className="w-full rounded-[16px] border-[0.5px] border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-1.5 text-sm"
                    />
                  </div>
                  <button
                    type="submit"
                    className="btn-krew-cta rounded-full px-4 py-1.5 text-sm font-semibold transition-transform active:translate-y-px active:scale-[0.98]"
                  >
                    Presentear
                  </button>
                </form>
              )}
            </div>
          </div>
        </Card>
      )}

      {operacao && financeiro && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat rotulo="Marcas" valor={num(operacao.marcas)} />
            <Stat rotulo="Negociações" valor={num(operacao.deals)} />
            <Stat
              rotulo="Campanhas"
              valor={num(operacao.campanhas)}
              detalhe={`${num(operacao.campanhas_ativas)} ativas`}
            />
            <Stat
              rotulo="Entregáveis"
              valor={num(operacao.entregaveis)}
              detalhe={`${num(operacao.entregaveis_pendentes)} pendentes`}
            />
            <Stat
              rotulo="Propostas recebidas"
              valor={num(operacao.propostas)}
              detalhe={`${num(operacao.propostas_inbox)} na inbox`}
            />
            <Stat rotulo="A receber" valor={brl(financeiro.a_receber)} />
            <Stat
              rotulo="Vencido"
              valor={brl(financeiro.vencido)}
              tom={Number(financeiro.vencido) > 0 ? 'alerta' : 'ok'}
            />
            <Stat rotulo="Recebido" valor={brl(financeiro.recebido)} tom="ok" />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card titulo="Campanhas recentes">
              {campanhas.length === 0 ? (
                <Vazio>Nenhuma campanha.</Vazio>
              ) : (
                <Tabela cabecalho={['Campanha', 'Marca', 'Status', 'Valor']}>
                  {campanhas.map((c) => (
                    <Linha key={c.id}>
                      <Celula>
                        <Link
                          href={`/dados/campaigns/${c.id}`}
                          className="hover:text-[var(--color-accent)]"
                        >
                          {c.nome ?? 'sem nome'}
                        </Link>
                      </Celula>
                      <Celula>{c.marca ?? '—'}</Celula>
                      <Celula>
                        <Badge tom={c.status === 'ativa' ? 'ok' : 'neutro'}>{c.status}</Badge>
                      </Celula>
                      <Celula mono>{brl(c.valor_total)}</Celula>
                    </Linha>
                  ))}
                </Tabela>
              )}
            </Card>

            <Card titulo="E-mails enviados">
              {emails.length === 0 ? (
                <Vazio>Nenhum e-mail registrado.</Vazio>
              ) : (
                <Tabela cabecalho={['Tipo', 'Status', 'Quando']}>
                  {emails.map((e, i) => (
                    <Linha key={i}>
                      <Celula>{e.type}</Celula>
                      <Celula>
                        <Badge tom={e.status === 'sent' ? 'ok' : 'alerta'}>{e.status}</Badge>
                      </Celula>
                      <Celula mono>{data(e.created_at)}</Celula>
                    </Linha>
                  ))}
                </Tabela>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
