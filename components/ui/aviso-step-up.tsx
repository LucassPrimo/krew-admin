'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ShieldAlert } from 'lucide-react'
import { useEffect, useState } from 'react'

/**
 * O aviso de que o código do autenticador caiu (ou está prestes a cair).
 *
 * ---------------------------------------------------------------------------
 * O problema que ele resolve
 * ---------------------------------------------------------------------------
 * A janela de step-up é de 15 minutos (`STEP_UP_MAX_MS`), e o painel só
 * contava isso ao RECUSAR: você abria uma linha em /dados, mudava três campos,
 * escrevia o motivo, clicava em gravar — e só aí a tela dizia "confirme o
 * código". O trabalho não se perdia, mas a descoberta acontecia no pior
 * momento, e o caminho para revalidar nem era oferecido: era voltar para /mfa
 * na mão e depois refazer a navegação inteira.
 *
 * Agora o vencimento é informação da casca, visível em qualquer tela, com o
 * link que revalida e VOLTA para onde você estava (`?voltar=`).
 *
 * ---------------------------------------------------------------------------
 * Por que a conta é feita no cliente
 * ---------------------------------------------------------------------------
 * O instante de expiração vem do servidor a cada navegação (o layout é
 * `force-dynamic`), mas o tempo passa enquanto a tela fica aberta — e é
 * justamente parada numa tela que a janela vence. O relógio local só faz a
 * subtração; quem decide se a escrita passa continua sendo `autorizarEscrita()`
 * no servidor, que não confia em nada daqui.
 */

/** A partir de quando o aviso aparece: 3 minutos ainda dá tempo de gravar. */
const AVISAR_ABAIXO_DE = 3 * 60 * 1000

export function AvisoStepUp({ expiraEm }: { expiraEm: number | null }) {
  const pathname = usePathname()
  const [agora, setAgora] = useState(() => Date.now())

  useEffect(() => {
    // 10 em 10 segundos: o suficiente para o contador não mentir, longe de
    // ser um timer por segundo repintando a casca inteira à toa.
    const t = setInterval(() => setAgora(Date.now()), 10_000)
    return () => clearInterval(t)
  }, [])

  if (expiraEm === null) return null

  const restante = expiraEm - agora
  if (restante > AVISAR_ABAIXO_DE) return null

  const expirou = restante <= 0
  const minutos = Math.floor(Math.max(restante, 0) / 60_000)
  const segundos = Math.floor((Math.max(restante, 0) % 60_000) / 1000)

  // `voltar` sempre relativo, e conferido de novo na tela do MFA: um caminho
  // vindo da URL que pudesse virar host externo seria redirecionamento aberto
  // dentro do painel que enxerga o banco inteiro.
  const voltar = `/mfa?voltar=${encodeURIComponent(pathname)}`

  return (
    <div
      role="status"
      className={`flex flex-wrap items-center gap-x-3 gap-y-1 border-b px-4 py-2 text-sm ${
        expirou
          ? 'border-perigo/40 bg-perigo-fundo text-perigo'
          : 'border-aviso/40 bg-aviso/5 text-aviso'
      }`}
    >
      <ShieldAlert className="size-4 shrink-0" strokeWidth={1.5} />
      {expirou ? (
        <span>
          O código do autenticador expirou. Ler continua liberado; <strong>gravar
          em /dados</strong> vai ser recusado até você confirmar um código novo.
        </span>
      ) : (
        <span>
          O código do autenticador expira em{' '}
          <strong className="tabular-nums">
            {minutos}:{String(segundos).padStart(2, '0')}
          </strong>
          . Depois disso, gravar em /dados pede um novo.
        </span>
      )}
      <Link href={voltar} className="font-medium underline underline-offset-2">
        confirmar agora
      </Link>
    </div>
  )
}
