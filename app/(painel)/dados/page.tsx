import Link from 'next/link'
import { exigirAdmin } from '@/lib/auth'
import { listarTabelas } from '@/lib/introspect'
import { num } from '@/lib/format'
import { Badge, Card, Celula, Linha, Tabela } from '@/components/ui'

export const dynamic = 'force-dynamic'

export default async function Dados() {
  await exigirAdmin()
  const tabelas = await listarTabelas()

  const mapeadas = tabelas.filter((t) => t.noRegistry).length
  const pendentes = tabelas.filter((t) => t.noRegistry && t.colunasNaoMapeadas > 0)

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Dados</h1>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          As {tabelas.length} tabelas do schema. Todas podem ser lidas; {mapeadas} estão no
          registry e têm campos editáveis.
        </p>
      </div>

      {pendentes.length > 0 && (
        <div className="rounded-[24px] border-[0.5px] border-transparent bg-[var(--color-accent-dim)] px-4 py-3 text-sm text-[var(--color-accent)]">
          <strong>{pendentes.length} tabela(s)</strong> ganharam colunas que o registry não
          conhece — elas aparecem na tela, mas não são editáveis até serem declaradas em{' '}
          <code>lib/registry.ts</code>: {pendentes.map((p) => p.nome).join(', ')}.
        </div>
      )}

      <Card>
        <Tabela cabecalho={['Tabela', 'Linhas', 'Edição', 'Colunas não mapeadas']}>
          {tabelas.map((t) => (
            <Linha key={t.nome}>
              <Celula>
                <Link
                  href={`/dados/${t.nome}`}
                  className="font-medium hover:text-[var(--color-accent)]"
                >
                  {t.rotulo}
                </Link>
                {t.rotulo !== t.nome && (
                  <div className="tabular text-[11px] text-[var(--color-faint)]">{t.nome}</div>
                )}
              </Celula>
              <Celula mono>{num(t.linhas)}</Celula>
              <Celula>
                {t.noRegistry ? (
                  <Badge tom="ok">no registry</Badge>
                ) : (
                  <Badge tom="neutro">somente leitura</Badge>
                )}
              </Celula>
              <Celula mono>
                {t.colunasNaoMapeadas > 0 ? (
                  <span className="text-[var(--color-muted)]">{t.colunasNaoMapeadas}</span>
                ) : (
                  '—'
                )}
              </Celula>
            </Linha>
          ))}
        </Tabela>
      </Card>
    </div>
  )
}
