import Link from 'next/link'
import { notFound } from 'next/navigation'

import { dbRO } from '@/lib/db'
import { tabelaDoRegistry } from '@/lib/registry'
import { Editor } from './editor'

export const dynamic = 'force-dynamic'

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

      <Editor tabela={tabela} registroId={id} mapa={mapa} linha={linha} />
    </>
  )
}
