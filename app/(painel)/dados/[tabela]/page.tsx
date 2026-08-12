import Link from 'next/link'
import { notFound } from 'next/navigation'
import { exigirAdmin } from '@/lib/auth'
import { sqlRo } from '@/lib/db'
import { chavePrimaria, colunasDe, tabelaExiste } from '@/lib/introspect'
import { num } from '@/lib/format'
import { REGISTRY } from '@/lib/registry'
import { Badge, Card, Celula, Linha, Tabela, Vazio } from '@/components/ui'
import { Valor } from '@/components/valor'

export const dynamic = 'force-dynamic'

const POR_PAGINA = 50

/**
 * `ordemPadrao` do registry ("created_at desc") virando ORDER BY.
 *
 * A coluna é conferida contra as colunas REAIS da tabela e passa como
 * identificador escapado; a direção é reduzida a um booleano. Nada de string
 * concatenada em SQL, nem mesmo vinda do nosso próprio código — a diferença
 * entre "é seguro porque a origem é confiável" e "é seguro porque não há como
 * ser outra coisa" é a que sobrevive à próxima refatoração.
 */
function ordemSegura(
  ordem: string | undefined,
  colunasValidas: string[],
  fallback: string
): { coluna: string; desc: boolean } {
  const [coluna, direcao] = (ordem ?? '').trim().split(/\s+/)
  if (coluna && colunasValidas.includes(coluna)) {
    return { coluna, desc: direcao?.toLowerCase() === 'desc' }
  }
  return { coluna: fallback, desc: true }
}

export default async function ExplorarTabela({
  params,
  searchParams,
}: {
  params: Promise<{ tabela: string }>
  searchParams: Promise<{ q?: string; p?: string }>
}) {
  await exigirAdmin()
  const { tabela } = await params
  const { q, p } = await searchParams

  if (!(await tabelaExiste(tabela))) notFound()

  const definicao = REGISTRY[tabela]
  const colunasBanco = await colunasDe(tabela)
  const chave = (await chavePrimaria(tabela)) ?? colunasBanco[0]?.nome

  // Quando a tabela está no registry, ele decide o que aparece e em que ordem.
  // Fora dele, mostra o que o banco tem — cobertura sem promessa de curadoria.
  const nomesColunas = definicao
    ? Object.keys(definicao.colunas).filter((c) => colunasBanco.some((cb) => cb.nome === c))
    : colunasBanco.map((c) => c.nome)

  const termo = (q ?? '').trim()
  const pagina = Math.max(1, Number(p) || 1)
  const ordem = ordemSegura(
    definicao?.ordemPadrao,
    colunasBanco.map((c) => c.nome),
    chave
  )
  const camposBusca = definicao?.busca ?? []

  const filtro =
    termo && camposBusca.length > 0
      ? sqlRo`where ${camposBusca
          .map((campo) => sqlRo`lower(coalesce(${sqlRo(campo)}::text, '')) like ${`%${termo.toLowerCase()}%`}`)
          .reduce((acc, cond) => sqlRo`${acc} or ${cond}`)}`
      : sqlRo``

  const [contagem] = await sqlRo<{ total: string }[]>`
    select count(*)::text as total from ${sqlRo(tabela)} ${filtro}
  `
  const total = Number(contagem?.total ?? 0)

  const linhas = await sqlRo<Record<string, unknown>[]>`
    select * from ${sqlRo(tabela)}
    ${filtro}
    order by ${sqlRo(ordem.coluna)} ${ordem.desc ? sqlRo`desc` : sqlRo`asc`}
    limit ${POR_PAGINA} offset ${(pagina - 1) * POR_PAGINA}
  `

  const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA))
  const editaveis = definicao
    ? Object.values(definicao.colunas).filter((c) => c.editavel).length
    : 0

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/dados" className="text-xs text-[var(--color-muted)] hover:underline">
            ← Dados
          </Link>
          <h1 className="mt-1 text-xl font-semibold">{definicao?.rotulo ?? tabela}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-[var(--color-muted)]">
            <span className="tabular">{tabela}</span>
            <span>·</span>
            <span>{num(total)} linha(s)</span>
            <span>·</span>
            {definicao ? (
              <Badge tom="ok">{editaveis} campo(s) editável(is)</Badge>
            ) : (
              <Badge tom="neutro">somente leitura</Badge>
            )}
          </p>
          {definicao?.descricao && (
            <p className="mt-1 text-xs text-[var(--color-faint)]">{definicao.descricao}</p>
          )}
        </div>
      </div>

      {camposBusca.length > 0 && (
        <form method="get" className="flex gap-2">
          <input
            name="q"
            defaultValue={termo}
            placeholder={`Buscar em ${camposBusca.join(', ')}…`}
            className="w-full max-w-md rounded-[24px] border-[0.5px] border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm outline-none focus-visible:border-[var(--color-accent)]"
          />
          <button
            type="submit"
            className="rounded-full border-[0.5px] border-[var(--color-border-strong)] px-4 py-2 text-sm transition-transform active:translate-y-px active:scale-[0.98]"
          >
            Buscar
          </button>
        </form>
      )}

      <Card>
        {linhas.length === 0 ? (
          <Vazio>{termo ? 'Nada encontrado.' : 'Tabela vazia.'}</Vazio>
        ) : (
          <Tabela
            cabecalho={[
              '',
              ...nomesColunas.map((c) => definicao?.colunas[c]?.rotulo ?? c),
            ]}
          >
            {linhas.map((linha, i) => (
              <Linha key={String(linha[chave] ?? i)}>
                <Celula>
                  <Link
                    href={`/dados/${tabela}/${String(linha[chave])}`}
                    className="text-[11px] text-[var(--color-accent)] hover:underline"
                  >
                    abrir
                  </Link>
                </Celula>
                {nomesColunas.map((c) => (
                  <Celula key={c}>
                    <Valor valor={linha[c]} coluna={definicao?.colunas[c]} />
                  </Celula>
                ))}
              </Linha>
            ))}
          </Tabela>
        )}
      </Card>

      {totalPaginas > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-[var(--color-muted)]">
            Página {pagina} de {totalPaginas}
          </span>
          <div className="flex gap-2">
            {pagina > 1 && (
              <Link
                href={`/dados/${tabela}?p=${pagina - 1}${termo ? `&q=${encodeURIComponent(termo)}` : ''}`}
                className="rounded-full border-[0.5px] border-[var(--color-border)] px-3 py-1.5 transition-colors hover:border-[var(--color-border-strong)]"
              >
                Anterior
              </Link>
            )}
            {pagina < totalPaginas && (
              <Link
                href={`/dados/${tabela}?p=${pagina + 1}${termo ? `&q=${encodeURIComponent(termo)}` : ''}`}
                className="rounded-full border-[0.5px] border-[var(--color-border)] px-3 py-1.5 transition-colors hover:border-[var(--color-border-strong)]"
              >
                Próxima
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
