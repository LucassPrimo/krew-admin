import Link from 'next/link'
import { notFound } from 'next/navigation'

import { Badge, Card } from '@/components/ui'
import { dbRO } from '@/lib/db'
import { donosDasLinhas, nomeDe, pessoasPorId } from '@/lib/identidade'
import { mascarar } from '@/lib/pii'
import { dependentesDe, idCurto, ligacoesDe, rotularIds } from '@/lib/relacoes'
import { REGISTRY, tabelaDoRegistry } from '@/lib/registry'

import { Editor } from './editor'

export const dynamic = 'force-dynamic'

/**
 * A ficha de uma linha.
 *
 * O que ela tem que a grade genérica não tem: um cabeçalho dizendo DE QUEM é a
 * linha antes de qualquer campo, os uuids de FK resolvidos em nome, e a lista
 * do que aponta para cá. Editar `receivables` sabendo que a linha é do
 * @fulano, na campanha "Verão · Nubank", é uma operação diferente de editar
 * uma linha cujo dono é um uuid.
 */
export default async function Registro({
  params,
}: { params: Promise<{ tabela: string; id: string }> }) {
  const { tabela, id } = await params

  const mapa = tabelaDoRegistry(tabela)
  if (!mapa) notFound()

  const [linha] = await dbRO<Record<string, unknown>[]>`
    select * from public.${dbRO(mapa.tabela)} where ${dbRO(mapa.chave)} = ${id}
  `
  if (!linha) notFound()

  const [[dono], ligacoes, dependentes] = await Promise.all([
    donosDasLinhas(tabela, [linha]),
    ligacoesDe(tabela),
    dependentesDe(tabela),
  ])

  /**
   * Nome + destino de cada coluna de FK, para o editor mostrar embaixo do
   * uuid. É o que responde "esse `brand_id` é qual marca?" sem uma segunda
   * aba — e o uuid continua lá, editável, porque é ele que o banco guarda.
   */
  const rotulos: Record<string, { texto: string; href: string }> = {}
  await Promise.all(
    ligacoes.map(async (l) => {
      const valor = linha[l.coluna]
      if (typeof valor !== 'string' || !valor) return
      const alvo = l.alvo.replace(/^public\./, '')
      const ehGente = l.alvo === 'auth.users' || alvo === 'profiles'

      // Pessoa vai para a visão 360, não para a grade: a ficha de /pessoas
      // responde muito mais do que a linha da tabela.
      if (ehGente) {
        const pessoa = (await pessoasPorId([valor])).get(valor)
        if (pessoa) rotulos[l.coluna] = { texto: nomeDe(pessoa), href: `/pessoas/${valor}` }
        return
      }

      const mapaRotulos = await rotularIds(l.alvo, l.colunaAlvo, [valor])
      const texto = mapaRotulos.get(valor)
      if (!texto) return
      rotulos[l.coluna] = {
        texto,
        href:
          Object.hasOwn(REGISTRY, alvo) && l.colunaAlvo === REGISTRY[alvo].chave
            ? `/dados/${alvo}/${valor}`
            : `/dados/${alvo}?col=${l.colunaAlvo}&val=${valor}`,
      }
    }),
  )

  // Só quem aponta para a CHAVE desta linha vira atalho: uma FK para outra
  // coluna não é "o que depende deste registro", e o link filtrado sairia com
  // o valor errado.
  const apontamParaCa = dependentes.filter((d) => d.colunaAlvo === mapa.chave)

  return (
    <>
      <div className="mb-4 flex items-baseline justify-between">
        <div>
          <h1 className="text-lg font-medium">{mapa.rotulo}</h1>
          <p className="font-mono text-xs text-texto-fraco">{tabela} · {id}</p>
        </div>
        <Link href={`/dados/${tabela}`} className="text-sm text-texto-fraco hover:text-texto">
          voltar
        </Link>
      </div>

      {(dono?.pessoa || dono?.org || dono?.pagina) && (
        <Card className="mb-4">
          <h2 className="mb-2 text-sm font-medium">De quem é esta linha</h2>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            {dono.pessoa && (
              <span>
                <Link href={`/pessoas/${dono.pessoa.id}`} className="text-acento hover:underline">
                  {nomeDe(dono.pessoa)}
                </Link>
                {dono.pessoa.email && (
                  <span className="ml-2 text-texto-fraco">{mascarar('email', dono.pessoa.email)}</span>
                )}
                {dono.pessoa.slug && (
                  <span className="ml-2 font-mono text-xs text-texto-fraco">@{dono.pessoa.slug}</span>
                )}
              </span>
            )}
            {dono.org && (
              <span className="text-texto-fraco">
                org:{' '}
                <Link href={`/dados/organizations/${dono.org.id}`} className="text-acento hover:underline">
                  {dono.org.nome}
                </Link>
              </span>
            )}
            {dono.pagina && (
              <span className="text-texto-fraco">
                página:{' '}
                <Link href={`/dados/proposal_pages/${dono.pagina.id}`} className="text-acento hover:underline">
                  @{dono.pagina.slug}
                </Link>
              </span>
            )}
          </div>
        </Card>
      )}

      <Editor tabela={tabela} registroId={id} mapa={mapa} linha={linha} rotulos={rotulos} />

      {apontamParaCa.length > 0 && (
        <Card className="mt-4">
          <h2 className="mb-1 text-sm font-medium">O que aponta para esta linha</h2>
          <p className="mb-3 text-xs text-texto-fraco">
            As tabelas que referenciam <code className="font-mono">{mapa.chave}</code> ={' '}
            <span className="font-mono" title={id}>{idCurto(id)}</span>. Sem contagem de
            propósito: contar em todas elas na abertura da ficha custaria uma varredura
            por tabela — o número se paga no clique.
          </p>
          <div className="flex flex-wrap gap-2">
            {apontamParaCa.map((d) => (
              <Link
                key={`${d.tabela}.${d.coluna}`}
                href={`/dados/${d.tabela}?col=${d.coluna}&val=${id}`}
                className="rounded-md border border-borda px-2 py-1 font-mono text-xs hover:border-acento hover:text-acento"
              >
                {d.tabela}
                <span className="ml-1 text-texto-fraco">.{d.coluna}</span>
                {Object.hasOwn(REGISTRY, d.tabela) && <Badge tom="ok">editável</Badge>}
              </Link>
            ))}
          </div>
        </Card>
      )}
    </>
  )
}
