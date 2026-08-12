import Link from 'next/link'
import { Badge, Mascarado } from './ui'
import { brl, data, dataHora, idCurto, num } from '@/lib/format'
import { mascarar } from '@/lib/pii'
import type { Coluna } from '@/lib/registry'

/**
 * Como um valor do banco vira algo legível na tela.
 *
 * A ordem dos testes importa: PII primeiro, antes de qualquer formatação. Se a
 * checagem de máscara viesse depois de "é texto? mostra o texto", bastaria uma
 * coluna sensível cair no ramo errado para o documento aparecer inteiro. O caso
 * seguro vem sempre antes.
 */
export function Valor({
  valor,
  coluna,
  tabela,
}: {
  valor: unknown
  coluna?: Coluna
  tabela?: string
}) {
  if (coluna?.pii) {
    return <Mascarado>{mascarar(coluna.pii, valor)}</Mascarado>
  }

  if (valor === null || valor === undefined || valor === '') {
    return <span className="text-[var(--color-faint)]">—</span>
  }

  if (typeof valor === 'boolean') {
    return <Badge tom={valor ? 'ok' : 'neutro'}>{valor ? 'sim' : 'não'}</Badge>
  }

  switch (coluna?.tipo) {
    case 'money':
      return <span className="tabular">{brl(valor)}</span>
    case 'percent':
      return <span className="tabular">{num(valor)}%</span>
    case 'number':
      return <span className="tabular">{num(valor)}</span>
    case 'date':
      return <span className="tabular">{data(valor)}</span>
    case 'timestamp':
      return <span className="tabular">{dataHora(valor)}</span>
    case 'enum':
      return <Badge>{String(valor)}</Badge>
    case 'uuid': {
      const texto = String(valor)
      // Uuid de chave estrangeira vira link quando dá para adivinhar o destino:
      // navegar entre registros relacionados é metade do trabalho de investigar
      // um problema.
      const destino = tabela ? `/dados/${tabela}/${texto}` : null
      return destino ? (
        <Link href={destino} className="tabular text-[var(--color-info)] hover:underline">
          {idCurto(texto)}
        </Link>
      ) : (
        <span className="tabular text-[var(--color-muted)]" title={texto}>
          {idCurto(texto)}
        </span>
      )
    }
    case 'json':
    case 'array':
      return (
        <span className="tabular text-[var(--color-muted)]">
          {JSON.stringify(valor).slice(0, 60)}
          {JSON.stringify(valor).length > 60 ? '…' : ''}
        </span>
      )
  }

  if (valor instanceof Date) return <span className="tabular">{dataHora(valor)}</span>
  if (typeof valor === 'object') {
    return (
      <span className="tabular text-[var(--color-muted)]">
        {JSON.stringify(valor).slice(0, 60)}
      </span>
    )
  }

  const texto = String(valor)
  // Uuid sem declaração no registry ainda merece encurtamento — senão a tabela
  // fica ilegível por causa de uma coluna.
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(texto)) {
    return (
      <span className="tabular text-[var(--color-muted)]" title={texto}>
        {idCurto(texto)}
      </span>
    )
  }

  return <span title={texto.length > 80 ? texto : undefined}>{texto.slice(0, 80)}{texto.length > 80 ? '…' : ''}</span>
}
