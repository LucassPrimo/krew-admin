import Link from 'next/link'
import { notFound } from 'next/navigation'

import { Badge, Card, Vazio } from '@/components/ui'
import { dbRO } from '@/lib/db'
import { colunasDe, tabelaExiste } from '@/lib/introspect'
import { ehPII, mascarar } from '@/lib/pii'
import { tabelaDoRegistry } from '@/lib/registry'

export const dynamic = 'force-dynamic'

const POR_PAGINA = 50

export default async function Tabela({
  params, searchParams,
}: {
  params: Promise<{ tabela: string }>
  searchParams: Promise<{ q?: string; p?: string }>
}) {
  const { tabela } = await params
  const { q, p } = await searchParams

  // A checagem de existência é o que torna seguro interpolar o nome adiante:
  // ele passa a ser um nome que o catálogo do Postgres confirmou, não a string
  // que veio da URL.
  if (!(await tabelaExiste(tabela))) notFound()

  const mapa = tabelaDoRegistry(tabela)
  const colunas = await colunasDe(tabela)
  const pagina = Math.max(Number(p ?? '1') || 1, 1)
  const termo = (q ?? '').trim()

  // Busca só nas colunas que o registry declarou como buscáveis. Sem registry,
  // sem busca — varrer com ILIKE numa tabela arbitrária é como se derruba o
  // banco sem querer.
  const filtro =
    mapa && termo
      ? dbRO`where ${mapa.busca
          .map((c) => dbRO`${dbRO(c)}::text ilike ${'%' + termo + '%'}`)
          .reduce((a, b) => dbRO`${a} or ${b}`)}`
      : dbRO``

  const ordem = mapa ? dbRO`order by ${dbRO.unsafe(mapa.ordem)}` : dbRO``

  const linhas = await dbRO<Record<string, unknown>[]>`
    select * from public.${dbRO(tabela)}
    ${filtro} ${ordem}
    limit ${POR_PAGINA} offset ${(pagina - 1) * POR_PAGINA}
  `

  const mostrar = colunas.slice(0, 8)

  return (
    <>
      <div className="mb-4 flex items-baseline justify-between">
        <div>
          <h1 className="font-mono text-lg font-medium">{tabela}</h1>
          <p className="text-sm text-texto-fraco">
            {mapa ? `${mapa.rotulo} — editável pelo registry` : 'somente leitura'}
          </p>
        </div>
        <Link href="/dados" className="text-sm text-texto-fraco hover:text-texto">voltar</Link>
      </div>

      {mapa && (
        <form className="mb-3">
          <input
            name="q" defaultValue={termo}
            placeholder={`buscar em ${mapa.busca.join(', ')}`}
            className="w-full max-w-md rounded-md border border-borda bg-painel px-3 py-2 text-sm outline-none focus:border-acento"
          />
        </form>
      )}

      <Card>
        {linhas.length === 0 ? <Vazio>Nada aqui.</Vazio> : (
          <div className="overflow-x-auto">
            <table className="densa">
              <thead>
                <tr>
                  {mapa && <th></th>}
                  {mostrar.map((c) => (
                    <th key={c.nome}>
                      {c.nome}
                      {ehPII(c.nome) && <Badge tom="aviso">pii</Badge>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {linhas.map((linha, i) => (
                  <tr key={i}>
                    {mapa && (
                      <td>
                        <Link
                          href={`/dados/${tabela}/${String(linha[mapa.chave])}`}
                          className="text-acento hover:underline"
                        >
                          abrir
                        </Link>
                      </td>
                    )}
                    {mostrar.map((c) => {
                      const valor = linha[c.nome]
                      return (
                        <td key={c.nome} className="max-w-[16rem] truncate font-mono text-[11px]">
                          {valor === null ? <span className="text-texto-fraco">null</span>
                            : ehPII(c.nome) ? mascarar(c.nome, valor)
                            : typeof valor === 'object' ? JSON.stringify(valor)
                            : String(valor)}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="mt-3 flex gap-2 text-sm">
        {pagina > 1 && (
          <Link href={`/dados/${tabela}?p=${pagina - 1}${termo ? `&q=${termo}` : ''}`}
                className="text-acento hover:underline">anterior</Link>
        )}
        {linhas.length === POR_PAGINA && (
          <Link href={`/dados/${tabela}?p=${pagina + 1}${termo ? `&q=${termo}` : ''}`}
                className="text-acento hover:underline">próxima</Link>
        )}
      </div>
    </>
  )
}
