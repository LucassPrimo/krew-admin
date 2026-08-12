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

const ID_FORM_MASSA = 'form-presentear-massa'

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

/** Ação em massa mexe em várias contas de uma vez — dinheiro de verdade se
 *  usada sem pensar. Digitar isto é o freio de mão: ninguém erra por engano
 *  a ponto de teclar uma frase inteira sem perceber o que está confirmando. */
const FRASE_CONFIRMACAO_MASSA = 'PRESENTEAR'

/** A partir de quando os dias de presente somam: se o trial já corre no
 *  futuro, soma em cima dele; senão, soma a partir de agora. Evita que
 *  presentear duas vezes a mesma pessoa "perca" os dias já concedidos. */
function novaDataPresente(trialAtual: Date | null, dias: number): Date {
  const agora = Date.now()
  const base = trialAtual && trialAtual.getTime() > agora ? trialAtual : new Date(agora)
  return new Date(base.getTime() + dias * 86_400_000)
}

async function presentearEmMassa(formData: FormData) {
  'use server'
  const admin = await exigirAdmin()

  // Antes de qualquer outra checagem: sem a frase digitada certinha, nada
  // acontece. Motivo e step-up ainda são checados dentro de
  // `presentearAssinatura()` — isto aqui é só a barreira extra que uma ação
  // que toca várias contas de uma vez precisa ter, e que uma edição
  // individual não precisa.
  const confirmacao = String(formData.get('confirmacao') ?? '').trim()
  if (confirmacao !== FRASE_CONFIRMACAO_MASSA) {
    redirect(
      `/assinaturas?erro=${encodeURIComponent(
        `Digite exatamente "${FRASE_CONFIRMACAO_MASSA}" para confirmar a ação em massa.`
      )}`
    )
  }

  const dias = Number(formData.get('dias'))
  if (!Number.isFinite(dias) || dias <= 0) {
    redirect(`/assinaturas?erro=${encodeURIComponent('Dias precisa ser um número positivo.')}`)
  }
  const motivo = String(formData.get('motivo') ?? '')

  const selecionados = formData.getAll('userIds').map(String)
  if (selecionados.length === 0) {
    redirect(`/assinaturas?erro=${encodeURIComponent('Selecione ao menos uma pessoa.')}`)
  }

  let mapaTrial: Record<string, string | null>
  try {
    mapaTrial = JSON.parse(String(formData.get('mapaTrial') ?? '{}'))
  } catch {
    redirect(`/assinaturas?erro=${encodeURIComponent('Dados inválidos — recarregue a página.')}`)
  }

  // O primeiro alvo, fora do loop: motivo curto ou step-up expirado falha
  // igual pra todo mundo, e checar isso uma vez só evita abrir N transações
  // pra descobrir o mesmo erro N vezes.
  try {
    await presentearAssinatura(admin, {
      userId: selecionados[0],
      novaData: novaDataPresente(
        mapaTrial[selecionados[0]] ? new Date(mapaTrial[selecionados[0]]!) : null,
        dias
      ),
      motivo,
    })
  } catch (e) {
    if (e instanceof MutacaoRecusada) {
      redirect(`/assinaturas?erro=${encodeURIComponent(e.message)}`)
    }
    throw e
  }

  let sucesso = 1
  let falhas = 0
  for (const userId of selecionados.slice(1)) {
    try {
      await presentearAssinatura(admin, {
        userId,
        novaData: novaDataPresente(mapaTrial[userId] ? new Date(mapaTrial[userId]!) : null, dias),
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
  searchParams: Promise<{ estado?: string; erro?: string; ok?: string; falhas?: string; marcar?: string }>
}) {
  const admin = await exigirAdmin()
  const { estado: filtroBruto, erro, ok, falhas, marcar } = await searchParams
  const filtro = ORDEM_TABS.includes(filtroBruto as EstadoAssinatura | 'todos')
    ? (filtroBruto as EstadoAssinatura | 'todos')
    : 'todos'
  const marcarTodos = marcar === '1'

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
  // olhar essa coluna pra quem está `ativa`. Sem checkbox pra essas linhas:
  // não dá pra selecionar por engano quem a ação não afeta.
  const selecionaveis = filtradas.filter((l) => l.estado !== 'ativa')

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Assinaturas</h1>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          Espelho de <span className="tabular">public.subscriptions</span>. Só{' '}
          <span className="tabular">trial_ends_at</span> é editável por aqui — o resto vem do
          Stripe e o próximo webhook sobrescreve. Presente individual fica na página de cada
          pessoa.
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

      {podeEscrever && selecionaveis.length > 0 && (
        <Card titulo="Presentear em massa">
          <form id={ID_FORM_MASSA} action={presentearEmMassa} className="space-y-3">
            <input
              type="hidden"
              name="mapaTrial"
              value={JSON.stringify(
                Object.fromEntries(
                  selecionaveis.map((l) => [
                    l.user_id,
                    l.trial_ends_at ? l.trial_ends_at.toISOString() : null,
                  ])
                )
              )}
            />

            <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--color-muted)]">
              <span>Marcar:</span>
              <Link
                href={`/assinaturas${filtro !== 'todos' ? `?estado=${filtro}&` : '?'}marcar=1`}
                className="text-[var(--color-accent)] hover:underline"
              >
                todos visíveis
              </Link>
              <span>·</span>
              <Link
                href={filtro !== 'todos' ? `/assinaturas?estado=${filtro}` : '/assinaturas'}
                className="text-[var(--color-accent)] hover:underline"
              >
                nenhum
              </Link>
            </div>

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
                Aplica só a quem estiver marcado na tabela abaixo.
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

            <div>
              <label htmlFor="confirmacao-massa" className="mb-1 block text-xs text-[var(--color-muted)]">
                Digite{' '}
                <code className="text-[var(--color-accent)]">{FRASE_CONFIRMACAO_MASSA}</code> para
                confirmar
              </label>
              <input
                id="confirmacao-massa"
                name="confirmacao"
                required
                autoComplete="off"
                className="w-full max-w-xs rounded-[24px] border-[0.5px] border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm"
              />
            </div>

            <button
              type="submit"
              className="btn-krew-cta rounded-full px-4 py-2 text-sm font-semibold transition-transform active:translate-y-px active:scale-[0.98]"
            >
              Presentear selecionados
            </button>
          </form>
        </Card>
      )}

      <Card>
        {filtradas.length === 0 ? (
          <Vazio>Ninguém nesse estado agora.</Vazio>
        ) : (
          <Tabela
            cabecalho={[
              podeEscrever && selecionaveis.length > 0 ? '' : undefined,
              'Pessoa',
              'E-mail',
              'Status',
              'Vence/renova',
              'Cancelamento',
              'Stripe',
            ].filter((c): c is string => c !== undefined)}
          >
            {filtradas.map((l) => (
              <Linha key={l.user_id}>
                {podeEscrever && selecionaveis.length > 0 && (
                  <Celula>
                    {l.estado !== 'ativa' && (
                      <input
                        type="checkbox"
                        name="userIds"
                        value={l.user_id}
                        form={ID_FORM_MASSA}
                        defaultChecked={marcarTodos}
                        className="h-4 w-4 accent-[var(--color-accent)]"
                      />
                    )}
                  </Celula>
                )}
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
