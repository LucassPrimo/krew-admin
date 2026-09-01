import { ChevronDown, type LucideIcon } from 'lucide-react'

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
  recolhivel = false,
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
  /**
   * Nasce fechado e abre no clique do cabeçalho.
   *
   * Para o bloco que é uma LISTA longa e raramente mexida — as marcas
   * parceiras, que num perfil importado chegam com uma dúzia de logos e
   * empurrariam o resto da tela para fora da vista de quem só veio trocar a
   * capa.
   *
   * `<details>` nativo, e não estado de React: um bloco que abre e fecha não
   * precisa virar componente de cliente (esta tela é servidor), e o elemento
   * já vem com teclado, leitor de tela e o Ctrl+F do navegador — que ABRE a
   * seção fechada ao encontrar texto dentro dela, coisa que nenhuma versão
   * caseira faz.
   *
   * Incompatível com `acao`: o switch ficaria dentro do `<summary>`, e clicar
   * nele abriria e fecharia o bloco junto. Quando o bloco recolhível precisa
   * de um interruptor, ele mora DENTRO — é o que o cartão de marcas faz.
   */
  recolhivel?: boolean
  children?: React.ReactNode
}) {
  const cabecalho = (
    <>
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
    </>
  )

  if (recolhivel) {
    return (
      <details className="group bg-card rounded-lg shadow-card">
        {/* `list-none` + a regra do webkit tiram o triângulo padrão do
            navegador; o chevron abaixo é o indicador, e ele gira ao abrir. */}
        <summary className="flex cursor-pointer list-none items-center gap-3 p-4 [&::-webkit-details-marker]:hidden">
          {cabecalho}
          <ChevronDown
            className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
            aria-hidden
          />
        </summary>

        {children && <div className="border-t border-border p-4">{children}</div>}
      </details>
    )
  }

  return (
    <section className="bg-card rounded-lg shadow-card">
      <div className="flex items-center gap-3 p-4">
        {cabecalho}
        {acao && <div className="shrink-0">{acao}</div>}
      </div>

      {children && <div className="border-t border-border p-4">{children}</div>}
    </section>
  )
}
