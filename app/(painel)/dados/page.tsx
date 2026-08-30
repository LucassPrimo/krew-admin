import Link from 'next/link'

import { Badge, Card, Titulo } from '@/components/ui'
import { numero } from '@/lib/format'
import { caminhosDeDono } from '@/lib/identidade'
import { listarTabelas } from '@/lib/introspect'
import { REGISTRY } from '@/lib/registry'

export const dynamic = 'force-dynamic'

/**
 * O índice do banco — com a coluna que o editor genérico não tem: por onde
 * cada tabela se liga a uma PESSOA.
 *
 * Ela responde, antes de você abrir qualquer coisa, se aquela tabela guarda
 * dado de cliente (e por qual coluna) ou se é infraestrutura. Sai de graça: o
 * grafo de FKs já foi lido uma vez e vive em memória do processo (ver
 * `lib/relacoes.ts`), então são zero consultas a mais.
 */
export default async function Dados() {
  const tabelas = await listarTabelas()
  const caminhos = new Map(
    await Promise.all(
      tabelas.map(async (t) => [t.nome, await caminhosDeDono(t.nome)] as const),
    ),
  )

  return (
    <>
      <Titulo>Dados</Titulo>

      <p className="mb-4 max-w-2xl text-sm text-texto-fraco">
        Todas as tabelas de <code className="font-mono">public</code>. As
        marcadas como editáveis estão declaradas no registry — só nelas o painel
        grava, campo a campo, com diff e auditoria. O resto é leitura. A coluna{' '}
        <strong>de quem</strong> mostra por qual chave estrangeira a tabela chega
        a uma pessoa: é ela que faz a listagem trocar uuid por nome.
      </p>

      <Card>
        <table className="densa">
          <thead>
            <tr><th>Tabela</th><th>Tipo</th><th>Linhas (aprox.)</th><th>De quem</th><th>Edição</th></tr>
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
                  <td className="font-mono text-[11px] text-texto-fraco">
                    {(() => {
                      const c = caminhos.get(t.nome)
                      const partes = [c?.pessoa, c?.pagina && `via ${c.pagina}`, c?.org]
                        .filter(Boolean)
                      return partes.length ? partes.join(' · ') : '—'
                    })()}
                  </td>
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
