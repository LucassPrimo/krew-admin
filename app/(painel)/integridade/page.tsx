import { Badge, Card, Titulo } from '@/components/ui'
import { numero } from '@/lib/format'
import { rodarChecks } from '@/lib/integridade'

export const dynamic = 'force-dynamic'

export default async function Integridade() {
  const checks = await rodarChecks()
  const comProblema = checks.filter((c) => c.total > 0)

  return (
    <>
      <Titulo>Integridade</Titulo>

      <p className="mb-4 text-sm text-texto-fraco">
        {comProblema.length === 0
          ? 'Todos os checks passaram.'
          : `${comProblema.length} de ${checks.length} checks encontraram algo.`}
      </p>

      <div className="flex flex-col gap-3">
        {checks.map((c) => (
          <Card key={c.nome}>
            <div className="mb-1 flex items-baseline justify-between gap-3">
              <h2 className="text-sm font-medium">{c.nome}</h2>
              {c.total === 0
                ? <Badge tom="ok">ok</Badge>
                : <Badge tom="aviso">{numero(c.total)}</Badge>}
            </div>

            {c.total > 0 && (
              <>
                <p className="text-xs text-texto-fraco">{c.dor}</p>
                <p className="mt-1 text-xs">
                  <span className="text-texto-fraco">Como resolver: </span>{c.conserto}
                </p>

                <details className="mt-2">
                  <summary className="cursor-pointer text-xs text-acento">
                    ver amostra ({Math.min(c.total, 5)} de {numero(c.total)})
                  </summary>
                  <pre className="mt-2 overflow-x-auto rounded-md bg-fundo p-2 font-mono text-[11px] text-texto-fraco">
                    {JSON.stringify(c.amostra, null, 2)}
                  </pre>
                </details>
              </>
            )}
          </Card>
        ))}
      </div>
    </>
  )
}
