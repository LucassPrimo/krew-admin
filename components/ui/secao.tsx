import type { LucideIcon } from 'lucide-react'

/**
 * Um bloco da tela de edição — e cada um corresponde a UM bloco da página
 * pública, na mesma ordem em que ela renderiza. Mesma peça do krew-app, e pelo
 * mesmo motivo.
 *
 * Agrupar pelo QUE MUDA NA PÁGINA, e não por tipo de widget, é o que torna a
 * coluna legível de cima para baixo junto com a prévia ao lado: ler daqui até
 * embaixo é percorrer o celular da direita.
 *
 * `resumo` diz o que aparece na página, não o que o campo faz — é a única
 * frase que conecta o formulário ao resultado sem abrir o link.
 */
export function Secao({
  indice, icone: Icone, titulo, resumo, acao, children,
}: {
  /** Posição do bloco na página pública. Sem índice = não é um bloco, é a
   *  página inteira (o interruptor geral, a cor). */
  indice?: number
  icone: LucideIcon
  titulo: string
  resumo: string
  acao?: React.ReactNode
  children?: React.ReactNode
}) {
  return (
    <section className="rounded-lg border border-borda bg-painel">
      <div className="flex items-center gap-3 p-4">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-painel-2 text-texto-fraco">
          <Icone className="size-4" strokeWidth={1.5} />
        </span>

        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-sm font-medium text-texto">
            {indice !== undefined && (
              <span className="text-xs tabular-nums text-texto-fraco">{indice}</span>
            )}
            {titulo}
          </p>
          <p className="text-xs text-texto-fraco">{resumo}</p>
        </div>

        {acao && <div className="shrink-0">{acao}</div>}
      </div>

      {children && <div className="border-t border-borda p-4">{children}</div>}
    </section>
  )
}
