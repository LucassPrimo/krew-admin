'use client'

import { useState, useTransition } from 'react'

import { Badge } from '@/components/ui'
import { acaoDefinirVerificado } from '@/app/(painel)/verificados/acoes'

/**
 * O selo, ligável de onde o suporte já está.
 *
 * A visão 360 é a tela onde a pergunta nasce ("esse aqui é verificado?"), e
 * fazer o caminho de ida e volta até outra tela para responder "não, mas
 * deveria" é onde o gesto se perde. O handle já está resolvido aqui — a página
 * é de UMA pessoa —, então não há o que digitar: o que endereça a ação é o
 * slug que a própria tela está mostrando.
 *
 * A tela de `/verificados` continua sendo o caminho quando você tem só o
 * handle na mão e nem sabe de quem é.
 */
export function Selo({ slug, verificado }: { slug: string; verificado: boolean }) {
  const [pendente, startTransition] = useTransition()
  const [estado, setEstado] = useState(verificado)
  const [erro, setErro] = useState<string | null>(null)

  function alternar() {
    setErro(null)
    startTransition(async () => {
      const r = await acaoDefinirVerificado(slug, !estado)
      if (!r.ok) {
        setErro(r.erro)
        return
      }
      setEstado(r.pagina.bio_verificado)
    })
  }

  return (
    <div className="flex items-center gap-2">
      {estado ? <Badge tom="ok">sim</Badge> : <span>não</span>}
      <button
        type="button"
        onClick={alternar}
        disabled={pendente}
        className="text-xs text-acento hover:underline disabled:opacity-40"
      >
        {pendente ? '…' : estado ? 'remover' : 'verificar'}
      </button>
      {erro && <span className="text-xs text-perigo">{erro}</span>}
    </div>
  )
}
