'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { Loader2, Pipette, RotateCcw } from 'lucide-react'

import { atualizarConfigBio } from '@/app/actions/bio'
import {
  CORES_FUNDO_BIO,
  COR_FUNDO_PADRAO,
  corDeFundoBio,
  corDoTexto,
} from '@/lib/bio/cores'
import { cn } from '@/lib/utils'

/**
 * A cor de fundo da página pública.
 *
 * Grava no clique, sem botão salvar — igual aos liga/desliga da tela, e pela
 * mesma razão: escolher a cor JÁ é a confirmação, e a prévia ao lado recarrega
 * com o `revalidatePath('/profile')` da action. Um "salvar" no meio faria a pessoa
 * escolher, esperar e só então descobrir que não gostou.
 *
 * O estado local muda antes da resposta do servidor e volta se a gravação
 * falhar. É o padrão de `ToggleBio`.
 *
 * As amostras NÃO são as únicas cores possíveis: o `<input type="color">` ao
 * lado abre o seletor do sistema. A fileira existe para dispensar a decisão,
 * não para limitá-la — e o contraste do texto não depende do que for escolhido
 * ali, porque ele é derivado do fundo (`corDoTexto`), nunca digitado.
 */
/**
 * Espera entre a última mexida e a gravação.
 *
 * O `<input type="color">` dispara `change` a CADA movimento do cursor dentro
 * do seletor do sistema — são dezenas por segundo. Gravando na hora, cada um
 * virava uma server action com `revalidatePath('/profile')`, que rerenderiza a
 * tela e recarrega o iframe da prévia: a página inteira travava enquanto a
 * pessoa arrastava. Meio segundo depois de parar é imperceptível para quem
 * escolhe e reduz o arrasto inteiro a UMA gravação.
 */
const ESPERA_MS = 500

export function BioCorFundo({ inicial }: { inicial: string | null }) {
  const t = useTranslations('bioConfig')
  const [, startTransition] = useTransition()
  const [cor, setCor] = useState(corDeFundoBio(inicial))
  const [salvando, setSalvando] = useState(false)

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  /** A última cor que o servidor confirmou. É para onde a tela volta se a
   *  gravação falhar — `cor` já mudou várias vezes até lá. */
  const salva = useRef(corDeFundoBio(inicial))

  // Um arrasto interrompido por uma navegação deixaria o timer pendente.
  useEffect(() => () => clearTimeout(timer.current ?? undefined), [])

  function escolher(proxima: string) {
    const valida = corDeFundoBio(proxima)
    if (valida === cor) return

    // O estado local anda na frente: a tira de prévia e a amostra reagem ao
    // vivo, enquanto a gravação espera a pessoa parar de escolher.
    setCor(valida)
    setSalvando(true)

    clearTimeout(timer.current ?? undefined)
    timer.current = setTimeout(() => {
      startTransition(async () => {
        const r = await atualizarConfigBio('bio_bg_color', valida)
        if (r?.error) setCor(salva.current)
        else salva.current = valida
        setSalvando(false)
      })
    }, ESPERA_MS)
  }

  const personalizada = !CORES_FUNDO_BIO.some((c) => c.valor === cor)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {CORES_FUNDO_BIO.map((c) => {
          const ativa = cor === c.valor
          return (
            <button
              key={c.valor}
              type="button"
              onClick={() => escolher(c.valor)}
              aria-pressed={ativa}
              aria-label={c.nome}
              style={{ backgroundColor: c.valor }}
              className={cn(
                // Borda em toda amostra, não só nas claras: sem ela o branco
                // some no cartão branco e o preto some no tema escuro do app —
                // a fileira ficaria com buracos dependendo do tema de quem edita.
                'size-7 rounded-full border border-border transition-transform',
                ativa
                  ? 'ring-2 ring-foreground ring-offset-2 ring-offset-card scale-110'
                  : 'hover:scale-110'
              )}
            />
          )
        })}

        {/* O seletor do sistema entra como uma amostra a mais, do tamanho das
            outras: o `<input type="color">` cru desenha um campo de formulário
            que não tem nada a ver com a fileira. Ele fica por cima, invisível,
            e o botão embaixo é o que se vê. */}
        <label
          className={cn(
            'relative flex size-7 cursor-pointer items-center justify-center rounded-full border border-border transition-transform hover:scale-110',
            personalizada && 'ring-2 ring-foreground ring-offset-2 ring-offset-card scale-110'
          )}
          style={{ backgroundColor: personalizada ? cor : 'transparent' }}
          title={t('corFundoPersonalizada')}
        >
          <Pipette
            className="size-3.5"
            style={{ color: personalizada ? corDoTexto(cor) : undefined }}
          />
          <span className="sr-only">{t('corFundoPersonalizada')}</span>
          <input
            type="color"
            value={cor}
            onChange={(e) => escolher(e.target.value)}
            className="absolute inset-0 size-full cursor-pointer opacity-0"
          />
        </label>

        {salvando && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
      </div>

      {/* A tira de prévia repete o que a página faz com a cor: fundo escolhido,
          texto derivado. É aqui que "branco sobre branco não acontece" fica
          visível — a pessoa vê o texto virar escuro quando escolhe um tom claro,
          em vez de ter que abrir o link para descobrir. */}
      <div
        className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5"
        style={{ backgroundColor: cor, color: corDoTexto(cor) }}
      >
        <span className="text-xs font-semibold">{t('corFundoPrevia')}</span>
        <span className="font-mono text-[11px] uppercase opacity-60">{cor}</span>
      </div>

      {cor !== COR_FUNDO_PADRAO && (
        <button
          type="button"
          onClick={() => escolher(COR_FUNDO_PADRAO)}
          className="flex w-fit items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          <RotateCcw className="size-3.5" />
          {t('corFundoPadrao')}
        </button>
      )}
    </div>
  )
}
