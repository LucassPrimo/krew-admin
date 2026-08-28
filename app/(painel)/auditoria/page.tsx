import { Badge, Card, Titulo, Vazio } from '@/components/ui'
import { dbRO } from '@/lib/db'
import { dataHora, relativo } from '@/lib/format'

export const dynamic = 'force-dynamic'

/**
 * Tudo que foi feito aqui dentro.
 *
 * A tabela é append-only por GRANT (INSERT sem UPDATE nem DELETE, para
 * ninguém) — é justamente quando alguém quer mudar o passado que o log precisa
 * estar íntegro.
 */
export default async function Auditoria() {
  const [mutacoes, revelacoes] = await Promise.all([
    dbRO<{
      id: string; ocorrido_em: string; tabela: string; registro_id: string
      acao: string; antes: unknown; depois: unknown; motivo: string; ip: string | null
    }[]>`
      select id, ocorrido_em, tabela, registro_id, acao, antes, depois, motivo, ip
      from admin_audit.mutations order by ocorrido_em desc limit 100`,
    dbRO<{
      id: string; ocorrido_em: string; tabela: string; campo: string
      sujeito_user_id: string | null; motivo: string
    }[]>`
      select id, ocorrido_em, tabela, campo, sujeito_user_id, motivo
      from admin_audit.pii_access order by ocorrido_em desc limit 50`,
  ])

  return (
    <>
      <Titulo>Auditoria</Titulo>

      <Card className="mb-4">
        <h2 className="mb-3 text-sm font-medium">Alterações ({mutacoes.length})</h2>
        {mutacoes.length === 0 ? <Vazio>Nada gravado ainda.</Vazio> : (
          <table className="densa">
            <thead>
              <tr><th>Quando</th><th>Tabela</th><th>Ação</th><th>Motivo</th><th>Diff</th></tr>
            </thead>
            <tbody>
              {mutacoes.map((m) => (
                <tr key={m.id}>
                  <td className="text-texto-fraco" title={dataHora(m.ocorrido_em)}>
                    {relativo(m.ocorrido_em)}
                  </td>
                  <td className="font-mono text-xs">{m.tabela}</td>
                  <td>
                    {m.acao === 'update'
                      ? <Badge tom="aviso">update</Badge>
                      : <Badge>{m.acao}</Badge>}
                  </td>
                  <td className="max-w-xs">{m.motivo}</td>
                  <td>
                    <details>
                      <summary className="cursor-pointer text-xs text-acento">ver</summary>
                      <pre className="mt-1 overflow-x-auto rounded bg-fundo p-2 font-mono text-[11px]">
{JSON.stringify({ antes: m.antes, depois: m.depois }, null, 2)}
                      </pre>
                    </details>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card>
        <h2 className="mb-1 text-sm font-medium">Revelações de PII ({revelacoes.length})</h2>
        <p className="mb-3 text-xs text-texto-fraco">
          Quem viu qual dado sensível, de quem, e por quê.
        </p>
        {revelacoes.length === 0 ? <Vazio>Nenhuma revelação.</Vazio> : (
          <table className="densa">
            <thead>
              <tr><th>Quando</th><th>Campo</th><th>Sujeito</th><th>Motivo</th></tr>
            </thead>
            <tbody>
              {revelacoes.map((r) => (
                <tr key={r.id}>
                  <td className="text-texto-fraco">{dataHora(r.ocorrido_em)}</td>
                  <td className="font-mono text-xs">{r.tabela}.{r.campo}</td>
                  <td className="font-mono text-[11px] text-texto-fraco">{r.sujeito_user_id ?? '—'}</td>
                  <td>{r.motivo}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  )
}
