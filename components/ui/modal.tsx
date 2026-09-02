'use client'

import { useEffect } from 'react'
import { X } from 'lucide-react'

/**
 * O modal do editor — a caixa que os botões de "adicionar" abrem.
 *
 * Sobreposição própria, e não o Dialog de uma lib: o admin não carrega Radix
 * (ver `package.json`), e o recorte de capa já resolve o mesmo problema do
 * mesmo jeito (`capa-recorte.tsx`). Um componente para os dois cartões de bio,
 * porque marcas e links pedem exatamente a mesma caixa: título, campos, dois
 * botões no pé.
 *
 * Fechar tem três saídas — o X, o clique fora e o Esc. As três chamam
 * `aoFechar`, que é sempre um cancelamento: quem cria confirma pelo botão do
 * rodapé, e nunca por sair da caixa.
 */
export function Modal({
  aberto,
  aoFechar,
  titulo,
  rotuloFechar,
  children,
}: {
  aberto: boolean
  aoFechar: () => void
  titulo: string
  rotuloFechar: string
  children: React.ReactNode
}) {
  useEffect(() => {
    if (!aberto) return
    function aoTeclar(e: KeyboardEvent) {
      if (e.key === 'Escape') aoFechar()
    }
    document.addEventListener('keydown', aoTeclar)
    // A página por baixo para de rolar enquanto a caixa está aberta: no celular
    // o gesto sobre a sobreposição rolaria a lista atrás dela, e o formulário
    // pareceria colar no meio de um conteúdo que anda sozinho.
    const overflowAnterior = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', aoTeclar)
      document.body.style.overflow = overflowAnterior
    }
  }, [aberto, aoFechar])

  if (!aberto) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={aoFechar}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[85vh] w-full max-w-md flex-col gap-3 overflow-y-auto rounded-2xl border border-border bg-card p-4 shadow-lg"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-sm font-semibold text-foreground">{titulo}</h2>
          <button
            type="button"
            onClick={aoFechar}
            aria-label={rotuloFechar}
            className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

/** O pé da caixa: cancelar à esquerda, confirmar à direita. */
export function ModalRodape({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center justify-end gap-2 pt-1">{children}</div>
}
