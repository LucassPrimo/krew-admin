import { Card, Metrica, Titulo, Vazio } from '@/components/ui'
import { dbRO } from '@/lib/db'
import { dinheiro, numero } from '@/lib/format'

export const dynamic = 'force-dynamic'

/**
 * Uso do produto: a bio, as propostas e as campanhas.
 *
 * São os três lugares onde o cliente passa tempo. Se um deles está parado
 * enquanto os cadastros crescem, o problema não é aquisição.
 */
export default async function Uso() {
  const [bios, funilPropostas, campanhas, topLinks] = await Promise.all([
    dbRO<{ ativas: number; verificadas: number; com_links: number; cliques: string | null }[]>`
      select
        (select count(*) from public.proposal_pages where bio_ativo)::int as ativas,
        (select count(*) from public.proposal_pages where bio_verificado)::int as verificadas,
        (select count(distinct user_id) from public.creator_links where ativo)::int as com_links,
        (select sum(cliques) from public.creator_links) as cliques`,
    dbRO<{ status: string; total: number }[]>`
      select status, count(*)::int as total from public.partnership_proposals
      group by status order by total desc`,
    dbRO<{ status: string; total: number; valor: string | null }[]>`
      select status, count(*)::int as total, sum(valor_total) as valor
      from public.campaigns group by status order by total desc`,
    dbRO<{ titulo: string; slug: string | null; cliques: number }[]>`
      select l.titulo, p.slug, l.cliques
      from public.creator_links l
      left join public.proposal_pages p on p.user_id = l.user_id
      where l.cliques > 0 order by l.cliques desc limit 15`,
  ])

  const b = bios[0]

  return (
    <>
      <Titulo>Uso do produto</Titulo>

      <section className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metrica rotulo="Bios no ar" valor={numero(b.ativas)} />
        <Metrica rotulo="Com pelo menos 1 link" valor={numero(b.com_links)} />
        <Metrica rotulo="Verificadas" valor={numero(b.verificadas)} />
        <Metrica rotulo="Cliques totais" valor={numero(b.cliques)} />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 text-sm font-medium">Propostas por estágio</h2>
          {funilPropostas.length === 0 ? <Vazio>Nenhuma proposta ainda.</Vazio> : (
            <table className="densa">
              <thead><tr><th>Estágio</th><th>Total</th></tr></thead>
              <tbody>
                {funilPropostas.map((f) => (
                  <tr key={f.status}>
                    <td>{f.status}</td>
                    <td className="tabular-nums">{numero(f.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card>
          <h2 className="mb-3 text-sm font-medium">Campanhas</h2>
          {campanhas.length === 0 ? <Vazio>Nenhuma campanha.</Vazio> : (
            <table className="densa">
              <thead><tr><th>Status</th><th>Qtd</th><th>Valor</th></tr></thead>
              <tbody>
                {campanhas.map((c) => (
                  <tr key={c.status}>
                    <td>{c.status}</td>
                    <td className="tabular-nums">{numero(c.total)}</td>
                    <td className="tabular-nums">{dinheiro(c.valor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card className="lg:col-span-2">
          <h2 className="mb-3 text-sm font-medium">Links mais clicados</h2>
          {topLinks.length === 0 ? <Vazio>Nenhum clique registrado.</Vazio> : (
            <table className="densa">
              <thead><tr><th>Link</th><th>Página</th><th>Cliques</th></tr></thead>
              <tbody>
                {topLinks.map((l, i) => (
                  <tr key={i}>
                    <td>{l.titulo}</td>
                    <td className="font-mono text-xs text-texto-fraco">
                      {l.slug ? `@${l.slug}` : '—'}
                    </td>
                    <td className="tabular-nums">{numero(l.cliques)}</td>
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
