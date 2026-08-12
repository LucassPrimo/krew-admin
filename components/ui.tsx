import type { ReactNode } from 'react'

/**
 * Primitivas de UI escritas à mão, e não trazidas de uma biblioteca.
 *
 * Não é NIH: §10 do plano trata cada dependência como uma chave a mais na
 * fechadura. Um painel que edita o dado de todos os clientes não deveria
 * carregar dezenas de pacotes de UI transitivos para desenhar uma tabela e um
 * card. São ~80 linhas; a conta fecha a favor de escrever.
 */

export function Card({
  titulo,
  acao,
  children,
  className = '',
}: {
  titulo?: string
  acao?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section
      className={`rounded-[24px] border-[0.5px] border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-card)] ${className}`}
    >
      {titulo && (
        <header className="flex items-center justify-between gap-3 border-b border-[var(--color-border)] px-5 py-3.5">
          <h2 className="text-[13px] font-semibold tracking-wide text-[var(--color-muted)] uppercase">
            {titulo}
          </h2>
          {acao}
        </header>
      )}
      <div className="p-5">{children}</div>
    </section>
  )
}

export function Stat({
  rotulo,
  valor,
  detalhe,
  tom = 'normal',
}: {
  rotulo: string
  valor: string
  detalhe?: string
  tom?: 'normal' | 'alerta' | 'ok'
}) {
  const cor =
    tom === 'alerta'
      ? 'text-[var(--color-danger)]'
      : tom === 'ok'
        ? 'text-[var(--color-ok)]'
        : 'text-[var(--color-ink)]'
  return (
    <div className="rounded-[24px] border-[0.5px] border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-card)]">
      <div className="text-[13px] font-medium tracking-wide text-[var(--color-muted)] uppercase">
        {rotulo}
      </div>
      <div className={`mt-1.5 text-[1.75rem] font-extrabold tabular-nums ${cor}`}>{valor}</div>
      {detalhe && <div className="mt-1 text-xs text-[var(--color-muted)]">{detalhe}</div>}
    </div>
  )
}

const TONS = {
  neutro: 'bg-[var(--color-surface-2)] text-[var(--color-muted)] border-[var(--color-border)]',
  ok: 'bg-[var(--color-ok-dim)] text-[var(--color-ok)] border-transparent',
  alerta: 'bg-[var(--color-danger-dim)] text-[var(--color-danger-deep)] border-transparent',
  info: 'bg-[var(--color-info-dim)] text-[var(--color-info)] border-transparent',
  destaque: 'bg-[var(--color-accent-dim)] text-[var(--color-accent)] border-transparent',
} as const

export function Badge({
  children,
  tom = 'neutro',
}: {
  children: ReactNode
  tom?: keyof typeof TONS
}) {
  return (
    <span
      className={`inline-flex h-5 items-center rounded-full border-[0.5px] px-2.5 text-[11px] font-semibold ${TONS[tom]}`}
    >
      {children}
    </span>
  )
}

export function Vazio({ children }: { children: ReactNode }) {
  return (
    <div className="px-4 py-10 text-center text-sm text-[var(--color-faint)]">{children}</div>
  )
}

export function Tabela({ cabecalho, children }: { cabecalho: string[]; children: ReactNode }) {
  return (
    // Tabela larga rola dentro do próprio container; a página nunca rola na
    // horizontal.
    <div className="-m-5 overflow-x-auto">
      <table className="w-full min-w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-[var(--color-border)]">
            {cabecalho.map((c) => (
              <th
                key={c}
                className="px-5 py-2.5 text-left text-[11px] font-medium tracking-wider whitespace-nowrap text-[var(--color-faint)] uppercase"
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}

export function Linha({ children }: { children: ReactNode }) {
  return (
    <tr className="border-b border-[var(--color-border)] transition-colors last:border-0 hover:bg-[var(--color-surface-2)]">
      {children}
    </tr>
  )
}

export function Celula({
  children,
  mono = false,
  className = '',
}: {
  children: ReactNode
  mono?: boolean
  className?: string
}) {
  return (
    <td className={`px-5 py-2.5 align-middle ${mono ? 'tabular' : ''} ${className}`}>
      {children}
    </td>
  )
}

/**
 * Rótulo de dado sensível mascarado. O olho precisa reconhecer na hora que
 * aquilo ali não é o valor real — senão a máscara vira armadilha, com alguém
 * lendo `•••.•••.•••-42` no telefone como se fosse o documento.
 */
export function Mascarado({ children }: { children: ReactNode }) {
  return (
    <span
      className="tabular text-[var(--color-muted)] underline decoration-dotted decoration-[var(--color-faint)] underline-offset-4"
      title="Dado sensível mascarado. Revelar é ação registrada."
    >
      {children}
    </span>
  )
}
