/**
 * Lista simples de proporção — serve dispositivo, país, operadora e referrer.
 *
 * Quatro blocos com a mesma forma seriam quatro componentes quase idênticos e
 * já dessincronizados no primeiro ajuste de espaçamento. O que muda entre eles
 * é só o título e os rótulos, então o que varia entrou como prop.
 */
export function Distribuicao({
  titulo,
  itens,
  vazio,
  nota,
}: {
  titulo: string
  itens: { rotulo: string; valor: number }[]
  vazio: string
  /** Linha de ressalva abaixo do título, quando o dado precisa de contexto. */
  nota?: string
}) {
  const total = itens.reduce((s, i) => s + i.valor, 0)

  return (
    <section className="bg-card rounded-2xl p-5 shadow-card">
      <h2 className="text-sm font-bold tracking-tight text-foreground">{titulo}</h2>
      {nota && <p className="mt-0.5 mb-2 text-xs text-muted-foreground">{nota}</p>}

      {itens.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">{vazio}</p>
      ) : (
        <ul className={`flex flex-col gap-2 ${nota ? '' : 'mt-3'}`}>
          {itens.map((i, idx) => (
            // Índice na chave, não só `rotulo`: duas linhas podem legitimamente
            // ter o mesmo texto (ex.: duas cidades que agrupam igual antes de
            // uma correção de dado do lado do servidor) — a chave não pode
            // depender de unicidade que o dado não garante.
            <li key={`${i.rotulo}-${idx}`} className="flex items-center gap-3">
              <span className="min-w-0 flex-1 truncate text-sm text-foreground">{i.rotulo}</span>
              <span className="shrink-0 text-xs tabular-figures text-muted-foreground">
                {i.valor} · {total > 0 ? Math.round((i.valor / total) * 100) : 0}%
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
