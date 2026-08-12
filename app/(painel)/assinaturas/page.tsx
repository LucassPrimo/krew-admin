import Link from 'next/link'
import { exigirAdmin } from '@/lib/auth'
import { dataRelevante, estadoAssinatura, ROTULO_ESTADO, type EstadoAssinatura } from '@/lib/assinatura'
import { sqlRo } from '@/lib/db'
import { data, relativo } from '@/lib/format'
import { Badge, Card, Celula, Linha, Tabela, Vazio } from '@/components/ui'

export const dynamic = 'force-dynamic'

interface LinhaAssinatura {
  user_id: string
  nome: string | null
  email: string
  status: string | null
  cancel_at_period_end: boolean | null
  current_period_end: Date | null
  trial_ends_at: Date | null
  stripe_customer_id: string | null
}

const TOM_ESTADO: Record<EstadoAssinatura, 'ok' | 'info' | 'alerta' | 'neutro'> = {
  ativa: 'ok',
  trial: 'info',
  cancelada_com_prazo: 'alerta',
  inadimplente: 'alerta',
  expirada: 'neutro',
}

const ORDEM_TABS: (EstadoAssinatura | 'todos')[] = [
  'todos',
  'ativa',
  'trial',
  'cancelada_com_prazo',
  'inadimplente',
  'expirada',
]

export default async function Assinaturas({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string }>
}) {
  await exigirAdmin()
  const { estado: filtroBruto } = await searchParams
  const filtro = ORDEM_TABS.includes(filtroBruto as EstadoAssinatura | 'todos')
    ? (filtroBruto as EstadoAssinatura | 'todos')
    : 'todos'

  // `left join`: creator sem linha em `subscriptions` (conta antes do trigger
  // existir) precisa aparecer como "expirada", não sumir da lista — é
  // exatamente esse alguém que ninguém está cobrando por engano.
  const linhas = await sqlRo<LinhaAssinatura[]>`
    select
      p.id as user_id,
      nullif(btrim(concat_ws(' ', p.full_name, p.sobrenome)), '') as nome,
      u.email,
      s.status,
      s.cancel_at_period_end,
      s.current_period_end,
      s.trial_ends_at,
      s.stripe_customer_id
    from public.profiles p
    join public.admin_auth_users u on u.id = p.id
    left join public.subscriptions s on s.user_id = p.id
    where p.account_type = 'creator'
  `

  const comEstado = linhas.map((l) => ({
    ...l,
    estado: estadoAssinatura(l),
    vence: dataRelevante(l),
  }))

  const contagens = ORDEM_TABS.reduce(
    (acc, t) => {
      acc[t] = t === 'todos' ? comEstado.length : comEstado.filter((l) => l.estado === t).length
      return acc
    },
    {} as Record<string, number>
  )

  const filtradas = (filtro === 'todos' ? comEstado : comEstado.filter((l) => l.estado === filtro))
    // Quem tem data de vencimento sobe pro topo, mais cedo primeiro — é a
    // pergunta que esta tela existe para responder. Quem não tem (expirada,
    // nunca assinou) fica no fim, sem ordem particular.
    .sort((a, b) => {
      if (a.vence && b.vence) return a.vence.getTime() - b.vence.getTime()
      if (a.vence) return -1
      if (b.vence) return 1
      return (a.nome ?? a.email).localeCompare(b.nome ?? b.email)
    })

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Assinaturas</h1>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          Espelho de <span className="tabular">public.subscriptions</span>, escrita só pelo webhook
          do Stripe. Esta tela é somente leitura.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {ORDEM_TABS.map((t) => (
          <Link
            key={t}
            href={t === 'todos' ? '/assinaturas' : `/assinaturas?estado=${t}`}
            className={`rounded-full border-[0.5px] px-3 py-1.5 text-[13px] transition-colors ${
              filtro === t
                ? 'border-transparent bg-[var(--color-accent)] text-white'
                : 'border-[var(--color-border)] text-[var(--color-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-ink)]'
            }`}
          >
            {t === 'todos' ? 'Todos' : ROTULO_ESTADO[t]}
            <span className="ml-1.5 opacity-70">{contagens[t]}</span>
          </Link>
        ))}
      </div>

      <Card>
        {filtradas.length === 0 ? (
          <Vazio>Ninguém nesse estado agora.</Vazio>
        ) : (
          <Tabela cabecalho={['Pessoa', 'E-mail', 'Status', 'Vence/renova', 'Cancelamento', 'Stripe']}>
            {filtradas.map((l) => (
              <Linha key={l.user_id}>
                <Celula>
                  <Link
                    href={`/pessoas/${l.user_id}`}
                    className="text-[var(--color-ink)] hover:text-[var(--color-accent)]"
                  >
                    {l.nome ?? <span className="text-[var(--color-faint)]">sem nome</span>}
                  </Link>
                </Celula>
                <Celula className="text-[var(--color-muted)]">{l.email}</Celula>
                <Celula>
                  <Badge tom={TOM_ESTADO[l.estado]}>{ROTULO_ESTADO[l.estado]}</Badge>
                </Celula>
                <Celula mono>
                  {l.vence ? (
                    <>
                      {data(l.vence)}
                      <span className="ml-1.5 text-[var(--color-faint)]">({relativo(l.vence)})</span>
                    </>
                  ) : (
                    '—'
                  )}
                </Celula>
                <Celula>
                  {l.cancel_at_period_end ? (
                    <Badge tom="alerta">agendado</Badge>
                  ) : (
                    <span className="text-[var(--color-faint)]">—</span>
                  )}
                </Celula>
                <Celula>
                  {l.stripe_customer_id ? (
                    <Badge tom="neutro">cliente</Badge>
                  ) : (
                    <span className="text-[var(--color-faint)]">nunca assinou</span>
                  )}
                </Celula>
              </Linha>
            ))}
          </Tabela>
        )}
      </Card>
    </div>
  )
}
