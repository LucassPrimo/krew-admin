'use client'

import { useCallback, useEffect, useState } from 'react'

/**
 * Busca + retentativa ISOLADA por seção.
 *
 * Antes, a retentativa era `router.refresh()` — reexecutava a PÁGINA inteira,
 * ou seja, as três seções (resumo, leve, geo) de novo, mesmo as que já tinham
 * dado certo. Sob um banco pequeno (poucas conexões disponíveis), isso vira
 * uma bola de neve: cada retentativa da seção mais lenta gera carga extra nas
 * outras duas, que não precisavam de nada.
 *
 * Este hook busca só o que ESTA seção pede, e só tenta de novo até dar certo
 * — nunca arrasta as vizinhas. Backoff crescente (3s, 6s, 12s, 24s, 48s) em
 * vez de intervalo fixo: se o banco está mesmo sobrecarregado, bater de novo
 * a cada 4s é parte do problema, não da solução.
 */
const ATRASOS_MS = [3000, 6000, 12000, 24000, 48000]

export type EstadoRetry<T> =
  | { status: 'carregando' }
  | { status: 'ok'; dados: T }
  | { status: 'tentando'; tentativa: number }
  | { status: 'falhou' }

export function useRetryFetch<T>(
  buscar: () => Promise<T | null>,
  chaveDeps: unknown[]
): [EstadoRetry<T>, () => void] {
  const [estado, setEstado] = useState<EstadoRetry<T>>({ status: 'carregando' })
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    let vivo = true
    let tentativa = 0
    let timer: ReturnType<typeof setTimeout> | null = null

    async function tentar() {
      const dados = await buscar().catch(() => null)
      if (!vivo) return

      if (dados !== null) {
        setEstado({ status: 'ok', dados })
        return
      }

      if (tentativa >= ATRASOS_MS.length) {
        setEstado({ status: 'falhou' })
        return
      }

      const atraso = ATRASOS_MS[tentativa]
      tentativa += 1
      setEstado({ status: 'tentando', tentativa })
      timer = setTimeout(tentar, atraso)
    }

    setEstado({ status: 'carregando' })
    void tentar()

    return () => {
      vivo = false
      if (timer) clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nonce, ...chaveDeps])

  const tentarDeNovo = useCallback(() => setNonce((n) => n + 1), [])
  return [estado, tentarDeNovo]
}
