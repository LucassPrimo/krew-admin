'use client'

import { RefreshCw } from 'lucide-react'

/**
 * Estado de "não consegui carregar esta seção", não "não há dados".
 *
 * Cada RPC (`get_bio_resumo`, `get_bio_leve`, `get_bio_geo`) sempre devolve um
 * objeto válido quando termina — nunca `null` por ausência de eventos. Só
 * chega aqui quando a chamada FALHOU de verdade (timeout do role
 * `authenticated`, hoje 8s — ver `postgres_logs`: "canceling statement due to
 * statement timeout"). Ver `lib/bio/use-retry-fetch.ts` para a retentativa,
 * que é POR SEÇÃO — esta seção não arrasta as outras duas.
 */
export function PainelRetry({
  emAutoRetry,
  titulo,
  descricao,
  tentarNovamente,
  aoTentar,
}: {
  emAutoRetry: boolean
  titulo: string
  descricao: string
  tentarNovamente: string
  aoTentar: () => void
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border py-12 text-center">
      <RefreshCw
        className={
          emAutoRetry ? 'size-5 animate-spin text-muted-foreground' : 'size-5 text-muted-foreground'
        }
      />
      <div>
        <p className="text-sm font-medium text-foreground">{titulo}</p>
        <p className="mt-1 text-sm text-muted-foreground">{descricao}</p>
      </div>
      {!emAutoRetry && (
        <button
          type="button"
          onClick={aoTentar}
          className="mt-1 rounded-full border border-border px-4 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
        >
          {tentarNovamente}
        </button>
      )}
    </div>
  )
}
