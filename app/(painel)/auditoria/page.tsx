import Link from 'next/link'
import { exigirAdmin } from '@/lib/auth'
import { sqlRo } from '@/lib/db'
import { dataHora } from '@/lib/format'
import { Badge, Card, Celula, Linha, Tabela, Vazio } from '@/components/ui'

export const dynamic = 'force-dynamic'

/**
 * O que EU fiz aqui dentro.
 *
 * Esta tela é a contrapartida do poder que o painel concentra: se ele pode
 * editar o dado de qualquer cliente, tem que existir um lugar que conte,
 * sem lacuna, tudo o que foi editado. As três tabelas são append-only por
 * GRANT — nem o painel nem quem operá-lo consegue apagar uma linha daqui.
 */

const ABAS = [
  { id: 'mutacoes', rotulo: 'Alterações' },
  { id: 'pii', rotulo: 'Dados sensíveis' },
  { id: 'sessoes', rotulo: 'Sessões' },
] as const

export default async function Auditoria({
  searchParams,
}: {
  searchParams: Promise<{ aba?: string }>
}) {
  await exigirAdmin()
  const { aba } = await searchParams
  const atual = ABAS.find((a) => a.id === aba)?.id ?? 'mutacoes'

  const mutacoes =
    atual === 'mutacoes'
      ? await sqlRo<
          {
            id: string
            ocorrido_em: Date
            tabela: string
            registro_id: string
            acao: string
            antes: Record<string, unknown> | null
            depois: Record<string, unknown> | null
            motivo: string
            ip: string | null
          }[]
        >`
          select id::text, ocorrido_em, tabela, registro_id, acao, antes, depois, motivo, ip::text
          from admin_audit.mutations
          order by ocorrido_em desc
          limit 200
        `
      : []

  const pii =
    atual === 'pii'
      ? await sqlRo<
          {
            id: string
            ocorrido_em: Date
            sujeito_user_id: string | null
            tabela: string
            campo: string
            motivo: string
            ip: string | null
          }[]
        >`
          select id::text, ocorrido_em, sujeito_user_id::text, tabela, campo, motivo, ip::text
          from admin_audit.pii_access
          order by ocorrido_em desc
          limit 200
        `
      : []

  const sessoes =
    atual === 'sessoes'
      ? await sqlRo<
          { id: string; iniciada_em: Date; ip: string | null; user_agent: string | null; aal: string | null }[]
        >`
          select id::text, iniciada_em, ip::text, user_agent, aal
          from admin_audit.sessions
          order by iniciada_em desc
          limit 200
        `
      : []

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Auditoria</h1>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          Registro imutável. Nenhuma linha destas tabelas pode ser alterada ou apagada —
          nem por este painel, nem pela conta que a escreveu.
        </p>
      </div>

      <nav className="flex gap-1">
        {ABAS.map((a) => (
          <Link
            key={a.id}
            href={`/auditoria?aba=${a.id}`}
            className={`rounded-full px-3 py-1.5 text-[13px] ${
              a.id === atual
                ? 'bg-[var(--color-surface-2)] text-[var(--color-ink)]'
                : 'text-[var(--color-muted)] hover:bg-[var(--color-surface-2)]'
            }`}
          >
            {a.rotulo}
          </Link>
        ))}
      </nav>

      <Card>
        {atual === 'mutacoes' &&
          (mutacoes.length === 0 ? (
            <Vazio>Nenhuma alteração feita pelo painel até agora.</Vazio>
          ) : (
            <Tabela cabecalho={['Quando', 'Registro', 'Ação', 'Mudança', 'Motivo', 'IP']}>
              {mutacoes.map((m) => (
                <Linha key={m.id}>
                  <Celula mono>{dataHora(m.ocorrido_em)}</Celula>
                  <Celula>
                    <Link
                      href={`/dados/${m.tabela}/${m.registro_id}`}
                      className="hover:text-[var(--color-accent)]"
                    >
                      {m.tabela}
                    </Link>
                    <div className="tabular text-[10px] text-[var(--color-faint)]">
                      {m.registro_id.slice(0, 8)}…
                    </div>
                  </Celula>
                  <Celula>
                    <Badge tom={m.acao === 'operacional' ? 'info' : 'neutro'}>{m.acao}</Badge>
                  </Celula>
                  <Celula>
                    {Object.keys(m.depois ?? {}).map((campo) => (
                      <div key={campo} className="tabular text-[11px]">
                        <span className="text-[var(--color-faint)]">{campo}: </span>
                        <span className="text-[var(--color-danger)] line-through">
                          {JSON.stringify(m.antes?.[campo] ?? null)}
                        </span>
                        {' → '}
                        <span className="text-[var(--color-ok)]">
                          {JSON.stringify(m.depois?.[campo] ?? null)}
                        </span>
                      </div>
                    ))}
                  </Celula>
                  <Celula>
                    <span className="text-[var(--color-muted)]">{m.motivo}</span>
                  </Celula>
                  <Celula mono>{m.ip ?? '—'}</Celula>
                </Linha>
              ))}
            </Tabela>
          ))}

        {atual === 'pii' &&
          (pii.length === 0 ? (
            <Vazio>Nenhum dado sensível foi revelado.</Vazio>
          ) : (
            <Tabela cabecalho={['Quando', 'Titular', 'Campo', 'Motivo', 'IP']}>
              {pii.map((p) => (
                <Linha key={p.id}>
                  <Celula mono>{dataHora(p.ocorrido_em)}</Celula>
                  <Celula>
                    {p.sujeito_user_id ? (
                      <Link
                        href={`/pessoas/${p.sujeito_user_id}`}
                        className="tabular hover:text-[var(--color-accent)]"
                      >
                        {p.sujeito_user_id.slice(0, 8)}…
                      </Link>
                    ) : (
                      '—'
                    )}
                  </Celula>
                  <Celula>
                    <Badge tom="destaque">{p.campo}</Badge>
                  </Celula>
                  <Celula>
                    <span className="text-[var(--color-muted)]">{p.motivo}</span>
                  </Celula>
                  <Celula mono>{p.ip ?? '—'}</Celula>
                </Linha>
              ))}
            </Tabela>
          ))}

        {atual === 'sessoes' &&
          (sessoes.length === 0 ? (
            <Vazio>Nenhuma sessão registrada.</Vazio>
          ) : (
            <Tabela cabecalho={['Início', 'IP', 'Nível', 'Navegador']}>
              {sessoes.map((s) => (
                <Linha key={s.id}>
                  <Celula mono>{dataHora(s.iniciada_em)}</Celula>
                  <Celula mono>{s.ip ?? '—'}</Celula>
                  <Celula>
                    <Badge tom={s.aal === 'aal2' ? 'ok' : 'alerta'}>{s.aal ?? '—'}</Badge>
                  </Celula>
                  <Celula>
                    <span className="text-[11px] text-[var(--color-faint)]">
                      {s.user_agent?.slice(0, 60) ?? '—'}
                    </span>
                  </Celula>
                </Linha>
              ))}
            </Tabela>
          ))}
      </Card>
    </div>
  )
}
