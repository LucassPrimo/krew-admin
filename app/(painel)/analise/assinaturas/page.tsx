import Link from 'next/link'

import { Badge, Card, Metrica, Titulo, Vazio } from '@/components/ui'
import { dataHora, numero, relativo } from '@/lib/format'
import { assinaturas } from '@/lib/metricas'

export const dynamic = 'force-dynamic'

/**
 * A receita da Krew — não a dos criadores.
 *
 * Os dados vêm da tabela `subscriptions`, que é o que o webhook do Chargefy
 * grava. É de propósito: o painel mostra exatamente o que o APP enxerga, então
 * uma divergência aqui é a mesma divergência que o cliente está vivendo. Um
 * painel que consultasse o Chargefy ao vivo mostraria a verdade da cobrança e
 * esconderia o bug do webhook — que é justamente o que você precisa achar.
 */
export default async function Assinaturas() {
  const linhas = await assinaturas()

  const agora = Date.now()
  const pagos = linhas.filter((l) => l.status === 'active').length
  const emTeste = linhas.filter(
    (l) => l.trial_ends_at && new Date(l.trial_ends_at).getTime() > agora && l.status !== 'active',
  ).length
  const atrasados = linhas.filter((l) => l.status === 'past_due').length
  const cancelando = linhas.filter((l) => l.cancel_at_period_end).length

  return (
    <>
      <Titulo>Assinaturas</Titulo>

      <section className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metrica rotulo="Pagantes" valor={numero(pagos)} />
        <Metrica rotulo="Em teste" valor={numero(emTeste)} />
        <Metrica rotulo="Pagamento atrasado" valor={numero(atrasados)} alerta={atrasados > 0} />
        <Metrica rotulo="Cancelam no fim do período" valor={numero(cancelando)} alerta={cancelando > 0} />
      </section>

      <Card>
        <p className="mb-3 text-xs text-texto-fraco">
          Ordenado por urgência: atraso de pagamento primeiro, depois trial
          vencendo em até 3 dias, depois o resto por atualização.
        </p>

        {linhas.length === 0 ? (
          <Vazio>Nenhuma assinatura.</Vazio>
        ) : (
          <table className="densa">
            <thead>
              <tr>
                <th>Conta</th><th>Status</th><th>Trial até</th>
                <th>Período até</th><th>Cancela</th><th>Atualizado</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => {
                const trialVencendo =
                  l.trial_ends_at &&
                  new Date(l.trial_ends_at).getTime() > agora &&
                  new Date(l.trial_ends_at).getTime() < agora + 3 * 86400_000

                return (
                  <tr key={l.user_id}>
                    <td>
                      <Link href={`/pessoas/${l.user_id}`} className="text-acento hover:underline">
                        {l.nome ?? '(sem nome)'}
                      </Link>
                    </td>
                    <td>
                      {l.status === 'active' ? <Badge tom="ok">ativo</Badge>
                        : l.status === 'past_due' ? <Badge tom="perigo">atrasado</Badge>
                        : <Badge>{l.status ?? 'sem status'}</Badge>}
                    </td>
                    <td className={trialVencendo ? 'text-aviso' : 'text-texto-fraco'}>
                      {l.trial_ends_at ? relativo(l.trial_ends_at) : '—'}
                    </td>
                    <td className="text-texto-fraco">
                      {l.current_period_end ? relativo(l.current_period_end) : '—'}
                    </td>
                    <td>{l.cancel_at_period_end ? <Badge tom="aviso">sim</Badge> : '—'}</td>
                    <td className="text-texto-fraco" title={dataHora(l.updated_at)}>
                      {relativo(l.updated_at)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </Card>
    </>
  )
}
