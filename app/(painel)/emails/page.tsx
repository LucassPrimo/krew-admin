import { Badge, Card, Metrica, Titulo, Vazio } from '@/components/ui'
import { dbRO } from '@/lib/db'
import { dataHora, numero, relativo } from '@/lib/format'

export const dynamic = 'force-dynamic'

/**
 * E-mails transacionais.
 *
 * Uma falha aqui é silenciosa para você e barulhenta para o cliente: a marca
 * mandou proposta e não recebeu confirmação, e quem descobre é ele.
 */
export default async function Emails() {
  const [resumo, falhas, recentes] = await Promise.all([
    dbRO<{ status: string; total: number }[]>`
      select status, count(*)::int as total from public.email_logs
      group by status order by total desc`,
    dbRO<{ id: string; type: string; created_at: string; provider_response: unknown }[]>`
      select id, type, created_at, provider_response from public.email_logs
      where status = 'failed' order by created_at desc limit 30`,
    dbRO<{ id: string; type: string; status: string; created_at: string }[]>`
      select id, type, status, created_at from public.email_logs
      order by created_at desc limit 40`,
  ])

  const total = resumo.reduce((s, r) => s + r.total, 0)
  const falhou = resumo.find((r) => r.status === 'failed')?.total ?? 0

  return (
    <>
      <Titulo>E-mails</Titulo>

      <section className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metrica rotulo="Total enviados" valor={numero(total)} />
        <Metrica rotulo="Falhas" valor={numero(falhou)} alerta={falhou > 0} />
        <Metrica
          rotulo="Taxa de falha"
          valor={total > 0 ? `${((falhou / total) * 100).toFixed(1)}%` : '—'}
          alerta={total > 0 && falhou / total > 0.05}
        />
      </section>

      {falhas.length > 0 && (
        <Card className="mb-4">
          <h2 className="mb-3 text-sm font-medium">Falhas — com a resposta do provedor</h2>
          <table className="densa">
            <thead><tr><th>Quando</th><th>Tipo</th><th>Erro</th></tr></thead>
            <tbody>
              {falhas.map((f) => (
                <tr key={f.id}>
                  <td className="text-texto-fraco" title={dataHora(f.created_at)}>
                    {relativo(f.created_at)}
                  </td>
                  <td>{f.type}</td>
                  <td className="max-w-md truncate font-mono text-[11px] text-perigo">
                    {JSON.stringify(f.provider_response)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <Card>
        <h2 className="mb-3 text-sm font-medium">Últimos envios</h2>
        {recentes.length === 0 ? <Vazio>Nenhum e-mail registrado.</Vazio> : (
          <table className="densa">
            <thead><tr><th>Quando</th><th>Tipo</th><th>Status</th></tr></thead>
            <tbody>
              {recentes.map((e) => (
                <tr key={e.id}>
                  <td className="text-texto-fraco">{relativo(e.created_at)}</td>
                  <td>{e.type}</td>
                  <td>
                    {e.status === 'failed'
                      ? <Badge tom="perigo">falhou</Badge>
                      : <Badge tom="ok">{e.status}</Badge>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  )
}
