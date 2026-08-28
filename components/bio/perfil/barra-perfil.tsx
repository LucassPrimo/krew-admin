'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Check, Copy, ExternalLink, Pencil } from 'lucide-react'

import { BIO_HOST, bioUrl, bioUrlDisplay } from '@/lib/app-url'
import { updateCreatorSlug } from '@/app/actions/proposals'
import { cn } from '@/lib/utils'

/**
 * A barra do topo da tela de perfil.
 *
 * Fixa porque a coluna de edição é longa, e o endereço da página é o que mais
 * se procura no meio dela: copiar para colar na bio do Instagram, abrir para
 * conferir, trocar o handle. Num cartão no alto da lista, cada uma dessas
 * coisas custava rolar a tela de volta.
 *
 * O `-mx` devolve a barra às bordas da tela por cima do respiro da página, e o
 * desfoque impede que os cartões passem legíveis por baixo dela.
 */
export function BarraPerfil({ slug, titulo }: { slug: string; titulo: string }) {
  return (
    <header className="sticky top-0 z-20 -mx-5 mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-border/50 bg-background/80 px-5 py-3 backdrop-blur-md md:-mx-8 md:px-8">
      <h1 className="text-xl font-bold tracking-tight text-foreground">{titulo}</h1>
      <PilulaDoLink slug={slug} />
    </header>
  )
}

/**
 * O endereço da bio, no topo: copiar, abrir e trocar o handle.
 *
 * Reúne o que era o cartão `BioLinkCard` numa pílula, porque nesta tela o link
 * não é mais um dos vários blocos de configuração — é a identidade da página
 * que está logo abaixo. Continua usando `updateCreatorSlug`: a validação de
 * tamanho, colisão e slug reservado mora lá, e o handle é o mesmo de `/publi`
 * e `/kit` — um criador, um handle.
 */
function PilulaDoLink({ slug }: { slug: string }) {
  const t = useTranslations('bioConfig')
  const [atual, setAtual] = useState(slug)
  const [editando, setEditando] = useState(false)
  const [rascunho, setRascunho] = useState(slug)
  const [erro, setErro] = useState<string | null>(null)
  const [copiado, setCopiado] = useState(false)
  const [salvando, setSalvando] = useState(false)

  function copiar() {
    navigator.clipboard.writeText(bioUrl(atual))
    setCopiado(true)
    setTimeout(() => setCopiado(false), 1500)
  }

  async function salvar() {
    setErro(null)
    setSalvando(true)
    const r = await updateCreatorSlug(rascunho)
    setSalvando(false)
    if (r?.error) {
      setErro(
        r.error === 'too_short' ? t('linkTooShort') : r.error === 'in_use' ? t('linkInUse') : r.error
      )
      return
    }
    if (r?.slug) {
      setAtual(r.slug)
      setRascunho(r.slug)
    }
    setEditando(false)
  }

  if (editando) {
    return (
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-1.5 rounded-pill border border-border bg-card px-3 py-1.5">
          <span className="shrink-0 text-sm text-muted-foreground">{BIO_HOST}/@</span>
          <input
            autoFocus
            value={rascunho}
            onChange={(e) => setRascunho(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void salvar()
              if (e.key === 'Escape') {
                setRascunho(atual)
                setErro(null)
                setEditando(false)
              }
            }}
            className="w-32 bg-transparent text-sm text-foreground outline-none"
          />
          <button
            onClick={() => void salvar()}
            disabled={salvando}
            className="text-xs font-semibold text-mint disabled:opacity-50"
          >
            {t('salvar')}
          </button>
        </div>
        {erro && <p className="text-center text-xs text-destructive">{erro}</p>}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1 rounded-pill border border-border bg-card px-3 py-1.5 shadow-card">
      <span className="text-xs font-medium text-muted-foreground">{t('linkLabel')}</span>
      <span aria-hidden className="mx-1 h-4 w-px bg-border" />
      <a
        href={bioUrl(atual)}
        target="_blank"
        rel="noreferrer"
        className="flex items-center gap-1 text-sm font-semibold text-foreground transition-colors hover:text-mint"
      >
        <span className="max-w-[16rem] truncate">{bioUrlDisplay(atual)}</span>
        <ExternalLink className="size-3.5 shrink-0" />
      </a>
      <BotaoIcone rotulo={copiado ? t('copiado') : t('copiar')} aoClicar={copiar}>
        {copiado ? <Check className="size-3.5 text-mint" /> : <Copy className="size-3.5" />}
      </BotaoIcone>
      <BotaoIcone rotulo={t('editar')} aoClicar={() => setEditando(true)}>
        <Pencil className="size-3.5" />
      </BotaoIcone>
    </div>
  )
}

function BotaoIcone({
  rotulo,
  aoClicar,
  children,
}: {
  rotulo: string
  aoClicar: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={aoClicar}
      aria-label={rotulo}
      title={rotulo}
      className={cn(
        'flex size-7 items-center justify-center rounded-full text-muted-foreground',
        'transition-colors hover:bg-muted hover:text-foreground'
      )}
    >
      {children}
    </button>
  )
}
