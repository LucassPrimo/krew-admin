'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { Check, Loader2, Trash2 } from 'lucide-react'

import { atualizarConfigBio } from '@/app/actions/bio'
import { embedDoSpotify } from '@/lib/bio/spotify'

/**
 * O player do Spotify da bio: o link e a linha acima dele.
 *
 * Dois campos e um botão salvar, como o cartão de identidade — e não gravação
 * a cada tecla: o link do Spotify passa por validação no servidor, e salvar
 * enquanto a pessoa digita significaria recusar `https://open.` antes de ela
 * ter terminado de colar.
 *
 * A prévia é o PRÓPRIO player, aqui dentro, e não uma promessa em texto. É
 * barato (um iframe) e responde à única pergunta que a tela levanta: colei o
 * link certo? A prévia aparece assim que o link vira embed — antes de salvar,
 * porque `embedDoSpotify` é a mesma função que a página usa e roda no
 * navegador sem ir a lugar nenhum.
 */
export function BioSpotifyCard({
  urlInicial,
  tituloInicial,
}: {
  urlInicial: string | null
  tituloInicial: string | null
}) {
  const t = useTranslations('bioConfig')
  const [pending, startTransition] = useTransition()
  const [salvo, setSalvo] = useState(false)
  const [url, setUrl] = useState(urlInicial ?? '')
  const [titulo, setTitulo] = useState(tituloInicial ?? '')
  const [erro, setErro] = useState<string | null>(null)

  const embed = embedDoSpotify(url)
  const sujo = url !== (urlInicial ?? '') || titulo !== (tituloInicial ?? '')
  // Link escrito que ainda não vira player: o aviso aparece antes de salvar, e
  // o botão espera. O caso mais comum é o `spotify.link/...` do botão de
  // compartilhar do celular, que só o Spotify sabe resolver.
  const linkQuebrado = url.trim().length > 0 && !embed

  function salvar() {
    setErro(null)
    startTransition(async () => {
      const r = await atualizarConfigBio('bio_spotify_url', url.trim() || null)
      if (r?.error) {
        setErro(r.error === 'spotify_invalido' ? t('spotifyInvalido') : r.error)
        return
      }
      await atualizarConfigBio('bio_spotify_titulo', titulo.trim() || null)
      setSalvo(true)
      setTimeout(() => setSalvo(false), 1500)
    })
  }

  function remover() {
    setUrl('')
    setTitulo('')
    setErro(null)
    startTransition(async () => {
      await atualizarConfigBio('bio_spotify_url', null)
      await atualizarConfigBio('bio_spotify_titulo', null)
    })
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-foreground">{t('spotifyUrl')}</label>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          inputMode="url"
          placeholder={t('spotifyUrlPlaceholder')}
          className="h-10 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary"
        />
        <p className="text-[11px] text-muted-foreground">{t('spotifyDica')}</p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-foreground">{t('spotifyTitulo')}</label>
        <input
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          maxLength={60}
          placeholder={t('spotifyTituloPlaceholder')}
          className="h-10 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary"
        />
      </div>

      {linkQuebrado && <p className="text-xs text-destructive">{t('spotifyInvalido')}</p>}
      {erro && <p className="text-xs text-destructive">{erro}</p>}

      {embed && (
        <iframe
          src={embed.src}
          height={embed.altura}
          style={{ height: embed.altura }}
          loading="lazy"
          allow="clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          title={titulo || 'Spotify'}
          className="w-full rounded-xl border-0"
        />
      )}

      <div className="flex items-center gap-2">
        <button
          onClick={salvar}
          disabled={pending || !sujo || linkQuebrado}
          className="flex items-center gap-1.5 self-start rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
        >
          {pending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Check className="h-3.5 w-3.5" />
          )}
          {salvo ? t('salvo') : t('salvar')}
        </button>

        {/* Só quando há o que remover: um botão de apagar num bloco vazio é
            uma pergunta sem objeto. */}
        {urlInicial && (
          <button
            onClick={remover}
            disabled={pending}
            className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-destructive disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
            {t('remover')}
          </button>
        )}
      </div>
    </div>
  )
}
