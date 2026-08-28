import Link from 'next/link'

import { Card, Titulo, Vazio } from '@/components/ui'
import { dbRO } from '@/lib/db'
import { data, numero, relativo } from '@/lib/format'
import { contasEmRisco } from '@/lib/metricas'

export const dynamic = 'force-dynamic'

/**
 * Retenção: coorte por mês de cadastro e a lista de quem parou.
 *
 * A lista importa mais do que o número. "12% de churn" não dá o que fazer
 * amanhã; "estas seis pessoas não fazem nada há 40 dias" é uma lista de
 * ligação.
 */
export default async function Retencao() {
  const [coortes, parados] = await Promise.all([
    dbRO<{ mes: string; contas: number; ativas: number }[]>`
      select to_char(date_trunc('month', p.created_at), 'MM/YYYY') as mes,
             count(*)::int as contas,
             count(*) filter (
               where exists (select 1 from public.campaigns c
                             where c.user_id = p.id and c.created_at > now() - interval '30 days')
                  or exists (select 1 from public.creator_links l
                             where l.user_id = p.id and l.created_at > now() - interval '30 days')
             )::int as ativas
      from public.profiles p
      group by date_trunc('month', p.created_at)
      order by date_trunc('month', p.created_at) desc`,
    contasEmRisco(),
  ])

  return (
    <>
      <Titulo>Retenção</Titulo>

      <Card className="mb-4">
        <h2 className="mb-1 text-sm font-medium">Coortes por mês de cadastro</h2>
        <p className="mb-3 text-xs text-texto-fraco">
          "Ativas" = fez alguma coisa (campanha ou link) nos últimos 30 dias.
        </p>
        {coortes.length === 0 ? <Vazio>Sem dados.</Vazio> : (
          <table className="densa">
            <thead><tr><th>Mês</th><th>Cadastros</th><th>Ativas (30d)</th><th>%</th></tr></thead>
            <tbody>
              {coortes.map((c) => (
                <tr key={c.mes}>
                  <td>{c.mes}</td>
                  <td className="tabular-nums">{numero(c.contas)}</td>
                  <td className="tabular-nums">{numero(c.ativas)}</td>
                  <td className="tabular-nums">
                    {c.contas > 0 ? `${Math.round((c.ativas / c.contas) * 100)}%` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card>
        <h2 className="mb-1 text-sm font-medium">Contas paradas</h2>
        <p className="mb-3 text-xs text-texto-fraco">
          Ordenadas pela última ação de verdade. É lista de ligação, não número
          de slide.
        </p>
        {parados.length === 0 ? <Vazio>Nenhuma conta.</Vazio> : (
          <table className="densa">
            <thead><tr><th>Conta</th><th>Cadastro</th><th>Última atividade</th><th>Dias parada</th></tr></thead>
            <tbody>
              {parados.map((c) => (
                <tr key={c.id}>
                  <td>
                    <Link href={`/pessoas/${c.id}`} className="text-acento hover:underline">
                      {c.nome ?? '(sem nome)'}
                    </Link>
                  </td>
                  <td className="text-texto-fraco">{data(c.criado_em)}</td>
                  <td>{c.ultima_atividade ? relativo(c.ultima_atividade) : 'nunca'}</td>
                  <td className={`tabular-nums ${c.dias_parado !== null && c.dias_parado > 30 ? 'text-perigo' : ''}`}>
                    {c.dias_parado ?? '—'}
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
