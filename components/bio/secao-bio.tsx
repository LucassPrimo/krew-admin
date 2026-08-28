import type { LucideIcon } from 'lucide-react'

/**
 * Um bloco da tela de edição da bio — e cada um corresponde a UM bloco da
 * página pública, na mesma ordem em que ela renderiza.
 *
 * Antes os controles eram agrupados por tipo de widget: os quatro liga/desliga
 * moravam juntos num cartão "Configurações rápidas", longe do campo que eles
 * afetavam. Quem queria esconder o total de seguidores precisava saber que
 * isso era uma "configuração", não parte do bloco de seguidores. Agrupar pelo
 * QUE MUDA NA PÁGINA torna a tela legível de cima para baixo junto com a
 * prévia ao lado.
 *
 * `resumo` diz o que aparece na página, não o que o campo faz. É a única frase
 * que conecta o formulário ao resultado sem a pessoa ter que abrir o link.
 */
export function SecaoBio({
  indice,
  icone: Icone,
  titulo,
  resumo,
  acao,
  children,
}: {
  /** Posição do bloco na página pública. É o que amarra as duas telas.
   *  Sem índice = não é um bloco da página (o interruptor geral). */
  indice?: number
  icone: LucideIcon
  titulo: string
  resumo: string
  /** Encaixe à direita do título — um switch, normalmente. */
  acao?: React.ReactNode
  children?: React.ReactNode
}) {
  return (
    <section className="bg-card rounded-lg shadow-card">
      <div className="flex items-center gap-3 p-4">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
          <Icone className="size-4" />
        </span>

        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
            {indice !== undefined && (
              <span className="text-xs tabular-nums text-muted-foreground">{indice}</span>
            )}
            {titulo}
          </p>
          <p className="text-xs text-muted-foreground">{resumo}</p>
        </div>

        {acao && <div className="shrink-0">{acao}</div>}
      </div>

      {children && <div className="border-t border-border p-4">{children}</div>}
    </section>
  )
}
