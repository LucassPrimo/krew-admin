import Link from 'next/link'
import { notFound } from 'next/navigation'

import { Badge, Card, Vazio } from '@/components/ui'
import { dbRO } from '@/lib/db'
import { donosDasLinhas, nomeDe, caminhosDeDono, pessoasPorId } from '@/lib/identidade'
import { colunasDe, tabelaExiste } from '@/lib/introspect'
import { ehPII, mascarar } from '@/lib/pii'
import { idCurto, ligacoesDe, rotularIds } from '@/lib/relacoes'
import { REGISTRY, tabelaDoRegistry } from '@/lib/registry'

export const dynamic = 'force-dynamic'

const POR_PAGINA = 50

/**
 * A listagem de uma tabela — e a diferença entre isto e o editor do Supabase.
 *
 * Duas coisas, e as duas são a mesma ideia: **linha de banco não é linha de
 * gente até alguém dizer de quem ela é**.
 *
 * 1. **A coluna "de quem".** Resolvida antes de desenhar, a partir das FOREIGN
 *    KEYS reais (ver `lib/identidade.ts`), com nome, @handle e link para a
 *    visão 360. Sem ela, responder "essas 40 linhas são de quem?" custava
 *    copiar uuid, abrir outra aba e procurar em `profiles`.
 * 2. **Todo uuid de FK vira nome.** `brand_id` mostra a marca, `campaign_id`
 *    mostra a campanha. O uuid continua disponível no título do elemento, para
 *    quando você precisar dele de verdade.
 *
 * E o filtro `?col=&val=`, que é o que fecha o ciclo: da visão 360 você chega
 * aqui já vendo só as linhas daquela pessoa. A coluna do filtro é conferida
 * contra as FKs da tabela — não é qualquer coluna que a URL mandar.
 */
export default async function Tabela({
  params, searchParams,
}: {
  params: Promise<{ tabela: string }>
  searchParams: Promise<{ q?: string; p?: string; col?: string; val?: string }>
}) {
  const { tabela } = await params
  const { q, p, col, val } = await searchParams

  // A checagem de existência é o que torna seguro interpolar o nome adiante:
  // ele passa a ser um nome que o catálogo do Postgres confirmou, não a string
  // que veio da URL.
  if (!(await tabelaExiste(tabela))) notFound()

  const mapa = tabelaDoRegistry(tabela)
  const [colunas, ligacoes] = await Promise.all([colunasDe(tabela), ligacoesDe(tabela)])
  const pagina = Math.max(Number(p ?? '1') || 1, 1)
  const termo = (q ?? '').trim()

  // Filtrar só por coluna que é FK: o valor vem da URL, mas o NOME da coluna
  // vem do catálogo. É a mesma regra que já protegia a busca — sem isso, a
  // query string escolheria em que coluna varrer.
  const filtroCol = ligacoes.find((l) => l.coluna === col)?.coluna ?? null
  const filtroVal = filtroCol ? (val ?? '').trim() : ''
  const filtroLigado = Boolean(filtroCol && filtroVal)

  // Busca só nas colunas que o registry declarou como buscáveis. Sem registry,
  // sem busca — varrer com ILIKE numa tabela arbitrária é como se derruba o
  // banco sem querer.
  const buscaSql =
    mapa && termo
      ? mapa.busca
          .map((c) => dbRO`${dbRO(c)}::text ilike ${'%' + termo + '%'}`)
          .reduce((a, b) => dbRO`${a} or ${b}`)
      : null

  const where = filtroLigado
    ? buscaSql
      ? dbRO`where ${dbRO(filtroCol as string)}::text = ${filtroVal} and (${buscaSql})`
      : dbRO`where ${dbRO(filtroCol as string)}::text = ${filtroVal}`
    : buscaSql
      ? dbRO`where ${buscaSql}`
      : dbRO``

  const ordem = mapa ? dbRO`order by ${dbRO.unsafe(mapa.ordem)}` : dbRO``

  const linhas = await dbRO<Record<string, unknown>[]>`
    select * from public.${dbRO(tabela)}
    ${where} ${ordem}
    limit ${POR_PAGINA} offset ${(pagina - 1) * POR_PAGINA}
  `

  const [donos, caminho] = await Promise.all([
    donosDasLinhas(tabela, linhas),
    caminhosDeDono(tabela),
  ])
  const temDono = donos.some((d) => d.pessoa || d.org)

  /**
   * As colunas de dono somem da grade quando a coluna "de quem" já as resolve.
   * Repetir o uuid ao lado do nome não acrescenta nada e gasta a largura que
   * as colunas com informação precisam.
   */
  const resolvidas = new Set(
    temDono ? [caminho.pessoa, caminho.org, caminho.pagina].filter(Boolean) as string[] : [],
  )
  const mostrar = colunas.filter((c) => !resolvidas.has(c.nome)).slice(0, 8)

  /**
   * Um lote por tabela-alvo, para as FKs que sobraram na grade.
   *
   * As colunas de GENTE que não são a do dono (`org_invites.invited_by`,
   * `documents.created_by`) passam por `pessoasPorId`, e não por `rotularIds`:
   * o nome de uma pessoa é perfil + e-mail + handle, e não uma coluna só. Sem
   * isso, "quem convidou" continuaria sendo um uuid — que é exatamente a
   * pergunta que essas colunas existem para responder.
   */
  const rotulos = new Map<string, Map<string, string>>()
  await Promise.all(
    ligacoes
      .filter((l) => mostrar.some((c) => c.nome === l.coluna))
      .map(async (l) => {
        const ids = linhas
          .map((linha) => linha[l.coluna])
          .filter((v): v is string => typeof v === 'string' && v.length > 0)
        if (ids.length === 0) return

        const ehGente = l.alvo === 'auth.users' || l.alvo.replace(/^public\./, '') === 'profiles'
        const mapaRotulos = ehGente
          ? new Map([...(await pessoasPorId(ids))].map(([id, p]) => [id, nomeDe(p)]))
          : await rotularIds(l.alvo, l.colunaAlvo, ids)
        if (mapaRotulos.size) rotulos.set(l.coluna, mapaRotulos)
      }),
  )

  function destino(alvo: string, colunaAlvo: string, id: string): string {
    const nome = alvo.replace(/^public\./, '')
    // Linha específica quando a tabela é editável; senão, a listagem já
    // filtrada — que funciona para qualquer tabela, inclusive as sem registry.
    return Object.hasOwn(REGISTRY, nome) && colunaAlvo === REGISTRY[nome].chave
      ? `/dados/${nome}/${id}`
      : `/dados/${nome}?col=${colunaAlvo}&val=${id}`
  }

  const queryBase = [
    termo ? `q=${encodeURIComponent(termo)}` : '',
    filtroLigado ? `col=${filtroCol}&val=${encodeURIComponent(filtroVal)}` : '',
  ].filter(Boolean).join('&')

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

      {filtroLigado && (
        <div className="mb-3 flex items-center gap-2 rounded-md border border-acento/40 bg-acento/5 px-3 py-2 text-sm">
          <span>
            Só as linhas com <code className="font-mono text-xs">{filtroCol}</code> ={' '}
            <span className="font-mono text-xs" title={filtroVal}>{idCurto(filtroVal)}</span>
            {donos[0]?.pessoa && <> — <strong>{nomeDe(donos[0].pessoa)}</strong></>}
          </span>
          <Link href={`/dados/${tabela}`} className="text-xs text-acento hover:underline">limpar</Link>
        </div>
      )}

      {mapa && (
        <form className="mb-3">
          {filtroLigado && (
            <>
              <input type="hidden" name="col" value={filtroCol as string} />
              <input type="hidden" name="val" value={filtroVal} />
            </>
          )}
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
                  {temDono && <th>de quem</th>}
                  {mostrar.map((c) => (
                    <th key={c.nome}>
                      {c.nome}
                      {ehPII(c.nome) && <Badge tom="aviso">pii</Badge>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {linhas.map((linha, i) => {
                  const dono = donos[i] ?? { pessoa: null, org: null, pagina: null }
                  return (
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
                      {temDono && (
                        <td className="max-w-[14rem]">
                          {!dono.pessoa ? (
                            <span className="text-texto-fraco">—</span>
                          ) : dono.pessoa.temPerfil ? (
                            <Link
                              href={`/pessoas/${dono.pessoa.id}`}
                              className="block truncate hover:underline"
                              title={dono.pessoa.email ?? dono.pessoa.id}
                            >
                              {nomeDe(dono.pessoa)}
                              {dono.pessoa.slug && (
                                <span className="ml-1 font-mono text-[10px] text-texto-fraco">
                                  @{dono.pessoa.slug}
                                </span>
                              )}
                            </Link>
                          ) : (
                            <span
                              className="block truncate"
                              title="conta sem linha em profiles — a visão 360 não abre"
                            >
                              {nomeDe(dono.pessoa)}
                              <span className="ml-1 text-[10px] text-texto-fraco">sem perfil</span>
                            </span>
                          )}
                          {dono.org && (
                            <span className="block truncate text-[10px] text-texto-fraco">
                              {dono.org.nome}
                            </span>
                          )}
                        </td>
                      )}
                      {mostrar.map((c) => {
                        const valor = linha[c.nome]
                        const rotulo =
                          typeof valor === 'string' ? rotulos.get(c.nome)?.get(valor) : undefined
                        const ligacao = ligacoes.find((l) => l.coluna === c.nome)

                        return (
                          <td key={c.nome} className="max-w-[16rem] truncate font-mono text-[11px]">
                            {valor === null || valor === undefined ? (
                              <span className="text-texto-fraco">null</span>
                            ) : ehPII(c.nome) ? (
                              mascarar(c.nome, valor)
                            ) : rotulo && ligacao ? (
                              <Link
                                href={destino(ligacao.alvo, ligacao.colunaAlvo, String(valor))}
                                title={String(valor)}
                                className="hover:underline"
                              >
                                {rotulo}
                              </Link>
                            ) : typeof valor === 'object' ? (
                              JSON.stringify(valor)
                            ) : (
                              String(valor)
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="mt-3 flex gap-2 text-sm">
        {pagina > 1 && (
          <Link href={`/dados/${tabela}?p=${pagina - 1}${queryBase ? `&${queryBase}` : ''}`}
                className="text-acento hover:underline">anterior</Link>
        )}
        {linhas.length === POR_PAGINA && (
          <Link href={`/dados/${tabela}?p=${pagina + 1}${queryBase ? `&${queryBase}` : ''}`}
                className="text-acento hover:underline">próxima</Link>
        )}
      </div>
    </>
  )
}
