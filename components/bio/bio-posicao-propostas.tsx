'use client'

import { useRef, useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { Check, Loader2 } from 'lucide-react'

import { atualizarConfigBio } from '@/app/actions/bio'
import type { PosicaoPropostas } from '@/lib/bio/tipos'
import { cn } from '@/lib/utils'

/**
 * Onde o botão de proposta fica na página pública: acima ou abaixo dos links.
 *
 * Dois cartões com uma MINIATURA da página em vez de duas linhas escritas
 * "acima" e "abaixo" — mesma razão do `BioEstiloLogos`: a escolha é sobre
 * ordem visual, e um rádio com o nome da opção obriga a abrir a prévia para
 * descobrir o que muda, que é a única coisa que importa aqui.
 *
 * Grava no clique, sem botão salvar, com o estado local andando na frente e
 * voltando se a gravação falhar: o padrão de `BioCorFundo`, `BioEstiloLogos` e
 * `ToggleBio`.
 *
 * Fica ligado mesmo com o botão de propostas DESLIGADO, de propósito. O campo é
 * inerte nesse caso (a página não desenha o CTA em lugar nenhum), e travá-lo
 * exigiria que este componente escutasse o switch que mora no cabeçalho da
 * seção — acoplamento de cliente para impedir uma escolha que não faz mal
 * nenhum guardada. Quem liga o botão depois já encontra a posição escolhida.
 */
export function BioPosicaoPropostas({ inicial }: { inicial: PosicaoPropostas | null }) {
  const t = useTranslations('bioConfig')
  const [, startTransition] = useTransition()
  const [posicao, setPosicao] = useState<PosicaoPropostas>(inicial ?? 'abaixo')
  const [salvando, setSalvando] = useState(false)
  const salvo = useRef<PosicaoPropostas>(inicial ?? 'abaixo')

  function escolher(proxima: PosicaoPropostas) {
    if (proxima === posicao) return
    setPosicao(proxima)
    setSalvando(true)
    startTransition(async () => {
      const r = await atualizarConfigBio('bio_propostas_posicao', proxima)
      if (r?.error) setPosicao(salvo.current)
      else salvo.current = proxima
      setSalvando(false)
    })
  }

  const opcoes: { valor: PosicaoPropostas; rotulo: string }[] = [
    { valor: 'acima', rotulo: t('propostasAcima') },
    { valor: 'abaixo', rotulo: t('propostasAbaixo') },
  ]

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted-foreground">{t('propostasPosicaoDica')}</p>

      <div className="grid grid-cols-2 gap-3">
        {opcoes.map((o) => {
          const ativa = posicao === o.valor
          return (
            <button
              key={o.valor}
              type="button"
              onClick={() => escolher(o.valor)}
              aria-pressed={ativa}
              className={cn(
                'flex flex-col items-center gap-2.5 rounded-xl border p-3 transition-colors',
                ativa ? 'border-foreground bg-muted/50' : 'border-border hover:border-foreground/40'
              )}
            >
              <Miniatura posicao={o.valor} />

              <span className="flex items-center gap-1.5 text-xs font-medium">
                {ativa && <Check className="size-3.5" />}
                {o.rotulo}
              </span>
            </button>
          )
        })}
      </div>

      {salvando && (
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" />
        </span>
      )}
    </div>
  )
}

/**
 * A página em miniatura: a pílula do CTA entre as barras dos links.
 *
 * Fundo escuro pela mesma razão da amostra de ícones — é o fundo padrão da
 * bio, e a pílula clara só se lê sobre ele. Puramente decorativo: o rótulo
 * abaixo do cartão é o que o leitor de tela anuncia, daí `aria-hidden`.
 */
function Miniatura({ posicao }: { posicao: PosicaoPropostas }) {
  const pilula = <span className="h-2 w-3/4 rounded-full bg-white" />
  const barras = (
    <>
      <span className="h-2 w-full rounded-[3px] bg-white/25" />
      <span className="h-2 w-full rounded-[3px] bg-white/25" />
      <span className="h-2 w-full rounded-[3px] bg-white/25" />
    </>
  )

  return (
    <span
      aria-hidden
      className="flex w-full flex-col items-center gap-1.5 rounded-lg bg-neutral-900 px-3 py-2.5"
    >
      {/* O ponto é o avatar: sem ele as duas miniaturas não dizem onde é o
          "alto" da página, e "acima" e "abaixo" ficam relativos a nada. */}
      <span className="mb-0.5 size-3 rounded-full bg-white/40" />
      {posicao === 'acima' ? (
        <>
          {pilula}
          {barras}
        </>
      ) : (
        <>
          {barras}
          {pilula}
        </>
      )}
    </span>
  )
}
