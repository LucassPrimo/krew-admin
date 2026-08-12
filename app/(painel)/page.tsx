import Link from 'next/link'
import { exigirAdmin } from '@/lib/auth'
import { sqlRo } from '@/lib/db'
import { brl, data, desde, num } from '@/lib/format'
import { Badge, Card, Celula, Linha, Stat, Tabela, Vazio } from '@/components/ui'

export const dynamic = 'force-dynamic'

interface Topo {
  cadastros_semana: string
  onboarding_completo: string
  onboarding_travado: string
  ativos_30d: string
  propostas_semana: string
  campanhas_ativas: string
  gmv_mes: string
  vencido: string
  vencido_qtd: string
  email_nao_confirmado: string
}

export default async function VisaoGeral() {
  await exigirAdmin()

  // Uma consulta só, com subselects, em vez de dez idas ao banco. Nesta escala
  // qualquer um dos dois funciona; a única ida evita que a página fique
  // esperando dez vezes o tempo de rede do pooler.
  const [topo] = await sqlRo<Topo[]>`
    select
      (select count(*) from public.profiles
        where created_at > now() - interval '7 days')                as cadastros_semana,
      (select count(*) from public.profiles
        where onboarding_step >= 3)                                  as onboarding_completo,
      (select count(*) from public.profiles
        where coalesce(onboarding_step, 0) < 3
          and account_type = 'creator'
          and created_at < now() - interval '7 days')                as onboarding_travado,
      (select count(*) from public.admin_auth_users
        where last_sign_in_at > now() - interval '30 days')          as ativos_30d,
      (select count(*) from public.partnership_proposals
        where created_at > now() - interval '7 days')                as propostas_semana,
      (select count(*) from public.campaigns
        where status = 'ativa')                                      as campanhas_ativas,
      (select coalesce(sum(valor_total), 0) from public.campaigns
        where status <> 'cancelada'
          and created_at >= date_trunc('month', now()))              as gmv_mes,
      (select coalesce(sum(valor), 0) from public.receivables
        where status <> 'pago' and data_prevista < current_date)     as vencido,
      (select count(*) from public.receivables
        where status <> 'pago' and data_prevista < current_date)     as vencido_qtd,
      (select count(*) from public.admin_auth_users
        where email_confirmed_at is null
          and created_at < now() - interval '48 hours')              as email_nao_confirmado
  `

  const recentes = await sqlRo<
    {
      id: string
      nome: string | null
      account_type: string
      onboarding_step: number | null
      created_at: Date
      ultimo_login: Date | null
    }[]
  >`
    select p.id,
           nullif(btrim(concat_ws(' ', p.full_name, p.sobrenome)), '') as nome,
           p.account_type,
           p.onboarding_step,
           p.created_at,
           u.last_sign_in_at as ultimo_login
    from public.profiles p
    join public.admin_auth_users u on u.id = p.id
    order by p.created_at desc
    limit 8
  `

  const atencao = await sqlRo<{ titulo: string; qtd: string; rota: string }[]>`
    select 'Cadastros travados no onboarding (7d+)' as titulo,
           count(*)::text as qtd, '/dados/profiles' as rota
      from public.profiles
      where coalesce(onboarding_step, 0) < 3 and account_type = 'creator'
        and created_at < now() - interval '7 days'
    union all
    select 'E-mails não confirmados (48h+)',
           count(*)::text, '/pessoas'
      from public.admin_auth_users where email_confirmed_at is null
        and created_at < now() - interval '48 hours'
    union all
    select 'Recebíveis vencidos ainda pendentes',
           count(*)::text, '/dados/receivables'
      from public.receivables
      where status <> 'pago' and data_prevista < current_date
    union all
    select 'Perfis sem organização (signup quebrado)',
           count(*)::text, '/dados/profiles'
      from public.profiles p
      where not exists (
        select 1 from public.memberships m where m.user_id = p.id
      )
    union all
    select 'E-mails de proposta que falharam',
           count(*)::text, '/dados/email_logs'
      from public.email_logs where status = 'failed'
  `

  const pendencias = atencao.filter((a) => Number(a.qtd) > 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Visão geral</h1>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          Estado do negócio agora. Todo dado desta tela vem da conexão de leitura.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat rotulo="Cadastros (7d)" valor={num(topo.cadastros_semana)} />
        <Stat
          rotulo="Onboarding completo"
          valor={num(topo.onboarding_completo)}
          detalhe={`${num(topo.onboarding_travado)} travados há 7d+`}
          tom={Number(topo.onboarding_travado) > 0 ? 'alerta' : 'normal'}
        />
        <Stat rotulo="Ativos (30d)" valor={num(topo.ativos_30d)} />
        <Stat rotulo="Propostas (7d)" valor={num(topo.propostas_semana)} />
        <Stat rotulo="Campanhas ativas" valor={num(topo.campanhas_ativas)} />
        <Stat rotulo="GMV do mês" valor={brl(topo.gmv_mes)} detalhe="campanhas criadas no mês" />
        <Stat
          rotulo="A receber vencido"
          valor={brl(topo.vencido)}
          detalhe={`${num(topo.vencido_qtd)} recebível(is)`}
          tom={Number(topo.vencido) > 0 ? 'alerta' : 'ok'}
        />
        <Stat
          rotulo="E-mail não confirmado"
          valor={num(topo.email_nao_confirmado)}
          detalhe="há mais de 48h"
          tom={Number(topo.email_nao_confirmado) > 0 ? 'alerta' : 'ok'}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card titulo="Precisa de atenção">
          {pendencias.length === 0 ? (
            <Vazio>Nada pendente. O banco está consistente nos checks conhecidos.</Vazio>
          ) : (
            <ul className="space-y-2">
              {pendencias.map((p) => (
                <li key={p.titulo}>
                  <Link
                    href={p.rota}
                    className="flex items-center justify-between gap-3 rounded-[16px] px-2 py-2 transition-colors hover:bg-[var(--color-surface-2)]"
                  >
                    <span className="text-sm text-[var(--color-ink)]">{p.titulo}</span>
                    <Badge tom="alerta">{p.qtd}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card titulo="Últimos cadastros">
          {recentes.length === 0 ? (
            <Vazio>Nenhum cadastro ainda.</Vazio>
          ) : (
            <Tabela cabecalho={['Pessoa', 'Tipo', 'Onboarding', 'Cadastro', 'Último login']}>
              {recentes.map((p) => (
                <Linha key={p.id}>
                  <Celula>
                    <Link
                      href={`/pessoas/${p.id}`}
                      className="text-[var(--color-ink)] hover:text-[var(--color-accent)]"
                    >
                      {p.nome ?? <span className="text-[var(--color-faint)]">sem nome</span>}
                    </Link>
                  </Celula>
                  <Celula>
                    <Badge tom={p.account_type === 'agency' ? 'info' : 'neutro'}>
                      {p.account_type}
                    </Badge>
                  </Celula>
                  <Celula>
                    {(p.onboarding_step ?? 0) >= 3 ? (
                      <Badge tom="ok">completo</Badge>
                    ) : (
                      <Badge tom="alerta">passo {p.onboarding_step ?? 0}/3</Badge>
                    )}
                  </Celula>
                  <Celula mono>{data(p.created_at)}</Celula>
                  <Celula mono>{desde(p.ultimo_login)}</Celula>
                </Linha>
              ))}
            </Tabela>
          )}
        </Card>
      </div>
    </div>
  )
}
