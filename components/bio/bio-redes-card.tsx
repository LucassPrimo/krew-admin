'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { Check, Loader2, Trash2 } from 'lucide-react'

import { cn } from '@/lib/utils'
import { saveSocialNetworks } from '@/app/actions/social-networks'
import {
  PLATFORMS,
  PlatformIcon,
  normalizarHandle,
  normalizarUrl,
  type PlatformId,
} from '@/components/bio/platforms'

interface RedeEditavel {
  platform: string
  handle: string
  url: string | null
  ordem?: number | null
  ativo?: boolean | null
}

/**
 * As redes da bio: uma fileira de bolinhas, e o campo abre na que se clica.
 *
 * O desenho é a própria fileira da página pública — as mesmas marcas, na mesma
 * forma redonda. Quem já está preenchido aparece em cor cheia; o resto fica
 * apagado e sem cor. Assim a pergunta "o que falta?" se responde olhando, sem
 * ler uma lista de "tal rede → tal link" embaixo, que era a mesma informação
 * escrita duas vezes.
 *
 * O campo abre INLINE, logo abaixo da bolinha clicada, e não num diálogo: um
 * modal cobre justamente a fileira que dá o contexto ("já pus Instagram e
 * TikTok, falta o YouTube"), e fecha a cada rede, o que transforma preencher
 * três redes em três aberturas e três fechamentos.
 *
 * Salva o conjunto INTEIRO a cada confirmação, porque é isso que
 * `saveSocialNetworks` faz (ver a action): ela troca a lista toda de uma vez.
 * Por isso o estado local carrega todas as redes, e não só a que está aberta.
 */
export function BioRedesCard({ redesIniciais }: { redesIniciais: RedeEditavel[] }) {
  const t = useTranslations('bioConfig')
  const [pendente, iniciar] = useTransition()
  const [salvo, setSalvo] = useState(false)
  const [redes, setRedes] = useState<RedeEditavel[]>(
    redesIniciais.map((r) => ({ ...r, url: r.url ?? '' }))
  )

  const [aberta, setAberta] = useState<PlatformId | null>(null)
  const [valor, setValor] = useState('')

  const def = aberta ? (PLATFORMS.find((p) => p.id === aberta) ?? null) : null
  // `href` é o que separa as duas famílias: rede com endereço previsível pede
  // só o @; site e afins pedem a URL inteira. Ver `platforms.tsx`.
  const pedeHandle = !!def?.href

  function abrir(id: PlatformId) {
    if (aberta === id) {
      setAberta(null)
      return
    }
    const atual = redes.find((r) => r.platform === id)
    const defDaRede = PLATFORMS.find((p) => p.id === id)
    setValor(atual ? (defDaRede?.href ? atual.handle : (atual.url ?? '')) : '')
    setAberta(id)
  }

  /** Devolve a lista com esta rede aplicada — vazia significa remover. */
  function comRede(lista: RedeEditavel[], id: PlatformId, bruto: string) {
    const defDaRede = PLATFORMS.find((p) => p.id === id)
    const ehHandle = !!defDaRede?.href
    const limpo = ehHandle ? normalizarHandle(bruto) : normalizarUrl(bruto)

    if (!limpo) return lista.filter((r) => r.platform !== id)

    const nova: RedeEditavel = {
      platform: id,
      handle: ehHandle ? limpo : '',
      url: ehHandle ? null : limpo,
      ativo: true,
    }
    return lista.some((r) => r.platform === id)
      ? lista.map((r) => (r.platform === id ? { ...r, ...nova } : r))
      : [...lista, nova]
  }

  function confirmar(bruto: string) {
    if (!aberta) return
    const proxima = comRede(redes, aberta, bruto)
    setRedes(proxima)
    setAberta(null)
    gravar(proxima)
  }

  function gravar(lista: RedeEditavel[]) {
    iniciar(async () => {
      await saveSocialNetworks(
        lista.map((r, i) => ({
          platform: r.platform,
          handle: r.handle,
          url: r.url || null,
          ordem: i,
          ativo: true,
        }))
      )
      setSalvo(true)
      setTimeout(() => setSalvo(false), 1500)
    })
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {PLATFORMS.map((p) => {
          const r = redes.find((x) => x.platform === p.id)
          const preenchida = !!(r?.handle || r?.url)

          return (
            <button
              key={p.id}
              type="button"
              onClick={() => abrir(p.id)}
              aria-pressed={preenchida}
              aria-expanded={aberta === p.id}
              // O nome só no `title`/`aria-label`: o rótulo embaixo de cada
              // bolinha dobrava a altura da fileira para repetir o que o
              // desenho da marca já diz.
              aria-label={p.label}
              title={p.label}
              className={cn(
                'relative rounded-full transition-all duration-200',
                preenchida
                  ? 'opacity-100 hover:scale-105'
                  : 'opacity-40 grayscale hover:opacity-100 hover:grayscale-0',
                aberta === p.id && 'ring-2 ring-primary ring-offset-2 ring-offset-card'
              )}
            >
              <PlatformIcon def={p} className="size-11 rounded-full" />
              {preenchida && (
                <span className="absolute -right-0.5 -bottom-0.5 rounded-full bg-card p-[2px]">
                  <span className="flex size-4 items-center justify-center rounded-full bg-emerald-500 text-white">
                    <Check className="size-2.5" />
                  </span>
                </span>
              )}
            </button>
          )
        })}
      </div>

      {def && (
        <div className="flex flex-col gap-2 rounded-xl border border-border bg-background p-3">
          <div className="flex items-center gap-2">
            <PlatformIcon def={def} className="size-6 rounded-full" />
            <span className="text-sm font-semibold text-foreground">{def.label}</span>
            {redes.some((r) => r.platform === def.id) && (
              <button
                type="button"
                onClick={() => confirmar('')}
                aria-label={t('remover')}
                title={t('remover')}
                className="ml-auto flex size-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
              >
                <Trash2 className="size-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <input
              autoFocus
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') confirmar(valor)
                if (e.key === 'Escape') setAberta(null)
              }}
              placeholder={pedeHandle ? t('handlePlaceholder') : t('urlPlaceholder')}
              inputMode={pedeHandle ? 'text' : 'url'}
              className="h-10 flex-1 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary"
            />
            <button
              type="button"
              onClick={() => confirmar(valor)}
              disabled={pendente}
              className="flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-primary px-3 text-xs font-semibold text-primary-foreground disabled:opacity-50"
            >
              {pendente ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Check className="size-3.5" />
              )}
              {t('salvar')}
            </button>
          </div>

          <p className="text-[11px] text-muted-foreground">{t('colarUsuarioDica')}</p>
        </div>
      )}

      {/* Sem botão de salvar geral: cada rede grava ao confirmar, e o aviso
          abaixo é o recibo. Um "salvar" no pé da seção prometeria que o resto
          da tela também espera por ele — e não espera, tudo aqui grava sozinho. */}
      <p className="flex h-4 items-center gap-1.5 text-[11px] text-muted-foreground">
        {pendente && (
          <>
            <Loader2 className="size-3 animate-spin" />
            {t('salvando')}
          </>
        )}
        {!pendente && salvo && (
          <>
            <Check className="size-3 text-emerald-500" />
            {t('salvo')}
          </>
        )}
        {!pendente && !salvo && redes.length === 0 && t('redesVazio')}
      </p>
    </div>
  )
}
