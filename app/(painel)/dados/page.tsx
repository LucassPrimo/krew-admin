import Link from 'next/link'

import { Badge, Card, Titulo } from '@/components/ui'
import { numero } from '@/lib/format'
import { listarTabelas } from '@/lib/introspect'
import { REGISTRY } from '@/lib/registry'

export const dynamic = 'force-dynamic'

export default async function Dados() {
  const tabelas = await listarTabelas()

  return (
    <>
      <Titulo>Dados</Titulo>

      <p className="mb-4 max-w-2xl text-sm text-texto-fraco">
        Todas as tabelas de <code className="font-mono">public</code>. As
        marcadas como editáveis estão declaradas no registry — só nelas o painel
        grava, campo a campo, com diff e auditoria. O resto é leitura.
      </p>

      <Card>
        <table className="densa">
          <thead>
            <tr><th>Tabela</th><th>Tipo</th><th>Linhas (aprox.)</th><th>Edição</th></tr>
          </thead>
          <tbody>
            {tabelas.map((t) => {
              const mapeada = Object.hasOwn(REGISTRY, t.nome)
              return (
                <tr key={t.nome}>
                  <td>
                    <Link href={`/dados/${t.nome}`} className="font-mono text-xs text-acento hover:underline">
                      {t.nome}
                    </Link>
                  </td>
                  <td className="text-texto-fraco">{t.tipo}</td>
                  <td className="tabular-nums">{numero(t.linhas)}</td>
                  <td>
                    {mapeada
                      ? <Badge tom="ok">{REGISTRY[t.nome].rotulo}</Badge>
                      : <Badge>somente leitura</Badge>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </Card>
    </>
  )
}
