import { exigirAdmin } from '@/lib/auth'
import { sqlRo } from '@/lib/db'
import { Card, Celula, Linha, Tabela, Vazio } from '@/components/ui'

export const dynamic = 'force-dynamic'

const LIMITE_LINHAS = 200

/**
 * Console SQL — somente leitura, e de verdade.
 *
 * A garantia não vem daqui: vem do role. `krew_admin_ro` não tem GRANT de
 * INSERT, UPDATE nem DELETE em nenhuma tabela, então um `update` digitado nesta
 * caixa recebe "permission denied" do Postgres antes de tocar em qualquer
 * linha. Se este arquivo inteiro fosse deletado por engano e substituído por um
 * `sql.unsafe(qualquerCoisa)`, o banco ainda recusaria a escrita.
 *
 * As checagens abaixo existem para dar erro claro e evitar acidente óbvio — não
 * são a defesa. Defesa que mora na camada que você está tentando proteger não é
 * defesa.
 */
function recusar(consulta: string): string | null {
  const limpa = consulta
    .replace(/--.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .trim()
    .replace(/;$/, '')

  if (!limpa) return 'Escreva uma consulta.'
  if (!/^(select|with)\b/i.test(limpa)) {
    return 'Só SELECT e WITH. Alteração de dado se faz pelo registry, com motivo e auditoria.'
  }
  // Uma consulta, não um lote: `select 1; update ...` é o truque mais velho do
  // repertório.
  if (limpa.includes(';')) return 'Uma consulta por vez (sem ponto e vírgula no meio).'

  return null
}

export default async function Console({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  await exigirAdmin()
  const { q } = await searchParams
  const consulta = q ?? ''

  let erro: string | null = null
  let colunas: string[] = []
  let linhas: Record<string, unknown>[] = []
  let truncado = false

  if (consulta.trim()) {
    erro = recusar(consulta)
    if (!erro) {
      try {
        const resultado = await sqlRo.unsafe<Record<string, unknown>[]>(consulta)
        linhas = resultado.slice(0, LIMITE_LINHAS)
        truncado = resultado.length > LIMITE_LINHAS
        colunas = linhas[0] ? Object.keys(linhas[0]) : []
      } catch (e) {
        // O erro do Postgres vai inteiro para a tela: quem escreve SQL aqui é
        // quem consegue lê-lo, e esconder a mensagem só aumentaria o número de
        // tentativas às cegas.
        erro = e instanceof Error ? e.message : 'Erro ao executar.'
      }
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Console SQL</h1>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          Conexão <code>krew_admin_ro</code> — sem permissão de escrita, com limite de 5
          segundos por consulta. Máximo de {LIMITE_LINHAS} linhas exibidas.
        </p>
      </div>

      <form method="get" className="space-y-2">
        <textarea
          name="q"
          rows={6}
          defaultValue={consulta}
          spellCheck={false}
          placeholder="select status, count(*) from receivables group by 1 order by 2 desc"
          className="tabular w-full rounded-[24px] border-[0.5px] border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm outline-none focus-visible:border-[var(--color-accent)]"
        />
        <button
          type="submit"
          className="btn-krew-cta rounded-full px-4 py-2 text-sm font-semibold transition-transform active:translate-y-px active:scale-[0.98]"
        >
          Executar
        </button>
      </form>

      {erro && (
        <div className="tabular rounded-[24px] border-[0.5px] border-transparent bg-[var(--color-danger-dim)] px-4 py-3 text-sm break-all text-[var(--color-danger-deep)]">
          {erro}
        </div>
      )}

      {!erro && consulta.trim() && (
        <Card
          titulo={`${linhas.length} linha(s)${truncado ? ` — truncado em ${LIMITE_LINHAS}` : ''}`}
        >
          {linhas.length === 0 ? (
            <Vazio>A consulta não devolveu linhas.</Vazio>
          ) : (
            <Tabela cabecalho={colunas}>
              {linhas.map((linha, i) => (
                <Linha key={i}>
                  {colunas.map((c) => (
                    <Celula key={c} mono>
                      {linha[c] === null || linha[c] === undefined ? (
                        <span className="text-[var(--color-faint)]">null</span>
                      ) : typeof linha[c] === 'object' ? (
                        JSON.stringify(linha[c])
                      ) : (
                        String(linha[c])
                      )}
                    </Celula>
                  ))}
                </Linha>
              ))}
            </Tabela>
          )}
        </Card>
      )}
    </div>
  )
}
