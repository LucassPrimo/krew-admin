import Link from 'next/link'
import { redirect } from 'next/navigation'
import { exigirAdmin, stepUpValido } from '@/lib/auth'
import { dataRelevante, estadoAssinatura, ROTULO_ESTADO, type EstadoAssinatura } from '@/lib/assinatura'
import { sqlRo } from '@/lib/db'
import { env } from '@/lib/env'
import { data, relativo } from '@/lib/format'
import { MutacaoRecusada, presentearAssinatura } from '@/lib/mutate'
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

/** A partir de quando os dias de presente somam: se o trial já corre no
 *  futuro, soma em cima dele; senão, soma a partir de agora. Evita que
 *  presentear duas vezes a mesma pessoa "perca" os dias já concedidos. */
function novaDataPresente(trialAtual: Date | null, dias: number): Date {
  const agora = Date.now()
  const base = trialAtual && trialAtual.getTime() > agora ? trialAtual : new Date(agora)
  return new Date(base.getTime() + dias * 86_400_000)
}

function lerDias(formData: FormData): number {
  const dias = Number(formData.get('dias'))
  if (!Number.isFinite(dias) || dias <= 0) {
    redirect(`/assinaturas?erro=${encodeURIComponent('Dias precisa ser um número positivo.')}`)
  }
  return dias
}

async function presentear(formData: FormData) {
  'use server'
  const admin = await exigirAdmin()

  const userId = String(formData.get('userId') ?? '')
  const dias = lerDias(formData)
  const trialAtualBruto = String(formData.get('trialAtual') ?? '')
  const motivo = String(formData.get('motivo') ?? '')
  const novaData = novaDataPresente(trialAtualBruto ? new Date(trialAtualBruto) : null, dias)

  try {
    await presentearAssinatura(admin, { userId, novaData, motivo })
  } catch (e) {
    if (e instanceof MutacaoRecusada) {
      redirect(`/assinaturas?erro=${encodeURIComponent(e.message)}`)
    }
    throw e
  }

  redirect('/assinaturas?ok=1')
}

async function presentearEmMassa(formData: FormData) {
  'use server'
  const admin = await exigirAdmin()

  const dias = lerDias(formData)
  const motivo = String(formData.get('motivo') ?? '')

  let alvos: { userId: string; trialAtual: string | null }[]
  try {
    alvos = JSON.parse(String(formData.get('alvos') ?? '[]'))
  } catch {
    redirect(`/assinaturas?erro=${encodeURIComponent('Lista de alvos inválida.')}`)
  }

  // Motivo curto ou step-up expirado falha igual pra todo mundo — checar uma
  // vez, com um alvo fictício, evita gastar N transações só para descobrir
  // isso na primeira iteração.
  if (alvos.length > 0) {
    try {
      await presentearAssinatura(admin, {
        userId: alvos[0].userId,
        novaData: novaDataPresente(alvos[0].trialAtual ? new Date(alvos[0].trialAtual) : null, dias),
        motivo,
      })
    } catch (e) {
      if (e instanceof MutacaoRecusada) {
        redirect(`/assinaturas?erro=${encodeURIComponent(e.message)}`)
      }
      throw e
    }
  }

  let sucesso = alvos.length > 0 ? 1 : 0
  let falhas = 0
  for (const alvo of alvos.slice(1)) {
    try {
      await presentearAssinatura(admin, {
        userId: alvo.userId,
        novaData: novaDataPresente(alvo.trialAtual ? new Date(alvo.trialAtual) : null, dias),
        motivo,
      })
      sucesso++
    } catch {
      falhas++
    }
  }

  redirect(`/assinaturas?ok=${sucesso}${falhas > 0 ? `&falhas=${falhas}` : ''}`)
}

export default async function Assinaturas({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string; erro?: string; ok?: string; falhas?: string }>
}) {
  const admin = await exigirAdmin()
  const { estado: filtroBruto, erro, ok, falhas } = await searchParams
  const filtro = ORDEM_TABS.includes(filtroBruto as EstadoAssinatura | 'todos')
    ? (filtroBruto as EstadoAssinatura | 'todos')
    : 'todos'

  const podeEscrever = env.ADMIN_WRITES_ENABLED && stepUpValido(admin)

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

  // Quem já paga não ganha nada com mais dias de trial — o gate nem chega a
  // olhar essa coluna pra quem está `ativa`. Fora da lista de alvos do botão
  // em massa para o log de auditoria não encher de presente que não fez nada.
  const alvosDoBulk = filtradas.filter((l) => l.estado !== 'ativa')

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Assinaturas</h1>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          Espelho de <span className="tabular">public.subscriptions</span>. Só{' '}
          <span className="tabular">trial_ends_at</span> é editável por aqui — o resto vem do
          Stripe e o próximo webhook sobrescreve.
        </p>
      </div>

      {ok && (
        <div className="rounded-[24px] border-[0.5px] border-transparent bg-[var(--color-ok-dim)] px-4 py-3 text-sm text-[var(--color-ok)]">
          {Number(ok) > 1 ? `${ok} pessoas presenteadas.` : 'Presente concedido.'}
          {falhas && ` ${falhas} falharam (veja a auditoria da tabela subscriptions para detalhe).`}
        </div>
      )}
      {erro && (
        <div className="rounded-[24px] border-[0.5px] border-transparent bg-[var(--color-danger-dim)] px-4 py-3 text-sm text-[var(--color-danger-deep)]">
          {erro}
        </div>
      )}

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

      {!podeEscrever && (
        <div className="rounded-[24px] border-[0.5px] border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm text-[var(--color-muted)]">
          {!env.ADMIN_WRITES_ENABLED ? (
            <>
              A escrita está desligada por <code>ADMIN_WRITES_ENABLED=false</code> — sem presentes
              até religar.
            </>
          ) : (
            <>
              Seu segundo fator foi verificado há mais de 15 minutos.{' '}
              <Link href="/mfa" className="text-[var(--color-accent)] hover:underline">
                Confirme o código
              </Link>{' '}
              para presentear alguém.
            </>
          )}
        </div>
      )}

      {podeEscrever && (
        <Card titulo={`Presentear em massa — ${ROTULO_ESTADO[filtro as EstadoAssinatura] ?? 'todos os filtrados'}`}>
          {alvosDoBulk.length === 0 ? (
            <Vazio>Ninguém nesta aba ganha algo com mais dias de trial.</Vazio>
          ) : (
            <form action={presentearEmMassa} className="space-y-3">
              <input
                type="hidden"
                name="alvos"
                value={JSON.stringify(
                  alvosDoBulk.map((l) => ({
                    userId: l.user_id,
                    trialAtual: l.trial_ends_at ? l.trial_ends_at.toISOString() : null,
                  }))
                )}
              />
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <label htmlFor="dias-massa" className="mb-1 block text-xs text-[var(--color-muted)]">
                    Dias de presente
                  </label>
                  <input
                    id="dias-massa"
                    name="dias"
                    type="number"
                    min={1}
                    required
                    defaultValue={30}
                    className="w-28 rounded-[24px] border-[0.5px] border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm"
                  />
                </div>
                <p className="pb-2.5 text-xs text-[var(--color-faint)]">
                  Afeta {alvosDoBulk.length} {alvosDoBulk.length === 1 ? 'pessoa' : 'pessoas'} —
                  quem já paga (status ativo) não entra, extensão de trial não muda nada pra quem
                  já é assinante.
                </p>
              </div>
              <div>
                <label htmlFor="motivo-massa" className="mb-1 block text-xs text-[var(--color-muted)]">
                  Motivo <span className="text-[var(--color-danger)]">*</span>
                </label>
                <textarea
                  id="motivo-massa"
                  name="motivo"
                  rows={2}
                  required
                  minLength={10}
                  placeholder="Ex: campanha de reativação de trials vencidos em agosto/2026."
                  className="w-full rounded-[24px] border-[0.5px] border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm"
                />
              </div>
              <button
                type="submit"
                className="btn-krew-cta rounded-full px-4 py-2 text-sm font-semibold transition-transform active:translate-y-px active:scale-[0.98]"
              >
                Presentear {alvosDoBulk.length} {alvosDoBulk.length === 1 ? 'pessoa' : 'pessoas'}
              </button>
            </form>
          )}
        </Card>
      )}

      <Card>
        {filtradas.length === 0 ? (
          <Vazio>Ninguém nesse estado agora.</Vazio>
        ) : (
          <Tabela
            cabecalho={['Pessoa', 'E-mail', 'Status', 'Vence/renova', 'Cancelamento', 'Stripe', '']}
          >
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
                <Celula>
                  {podeEscrever && l.estado !== 'ativa' && (
                    <details className="relative">
                      <summary className="cursor-pointer list-none rounded-full border-[0.5px] border-[var(--color-border)] px-3 py-1 text-xs text-[var(--color-muted)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-ink)]">
                        Presentear
                      </summary>
                      <form
                        action={presentear}
                        className="absolute right-0 z-10 mt-2 w-72 space-y-2.5 rounded-[24px] border-[0.5px] border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-float)]"
                      >
                        <input type="hidden" name="userId" value={l.user_id} />
                        <input
                          type="hidden"
                          name="trialAtual"
                          value={l.trial_ends_at ? l.trial_ends_at.toISOString() : ''}
                        />
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
                            className="w-full rounded-[16px] border-[0.5px] border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-1.5 text-sm"
                          />
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
                          className="btn-krew-cta w-full rounded-full px-3 py-1.5 text-xs font-semibold transition-transform active:translate-y-px active:scale-[0.98]"
                        >
                          Confirmar presente
                        </button>
                      </form>
                    </details>
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
