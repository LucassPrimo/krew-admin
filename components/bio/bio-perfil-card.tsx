'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { Check, Loader2 } from 'lucide-react'
import { atualizarConfigBio } from '@/app/actions/bio'
import { CapaPicker } from '@/components/bio/capa-picker'
import { PROPORCAO_CAPA_PERFIL } from '@/components/bio/capa-recorte'

/**
 * Identidade da página de bio.
 *
 * A CAPA é editável aqui, a FOTO DE PERFIL não. A divisão não é arbitrária:
 * são imagens com exigências opostas. O avatar é um rosto de 30px recortado em
 * círculo no menu do app; a capa é uma imagem de tela cheia com o nome, o @ e a
 * fileira de redes por cima do pé dela. Trocar uma pela outra estraga a que
 * ficou. `AvatarUpload` continua morando em `/config/editar`, com o atalho ao
 * lado da miniatura.
 *
 * Sem capa própria, a página usa a foto de perfil — que é o que ela sempre fez.
 * A miniatura mostra a foto esmaecida nesse caso: é o que vai ao ar, sem se
 * passar por uma escolha que ninguém fez.
 *
 * `headline` e `texto` são da bio (não reusam `welcome_message`) porque as
 * mensagens têm públicos diferentes: `welcome_message` fala com a marca que já
 * decidiu pedir uma proposta; a chamada da bio fala com quem acabou de sair do
 * Instagram e não sabe quem você é.
 */
export function BioPerfilCard({
  userId,
  avatarUrl,
  capaUrl,
  nome,
  headline,
  texto,
}: {
  userId: string
  avatarUrl: string | null
  capaUrl: string | null
  nome: string | null
  headline: string | null
  texto: string | null
}) {
  const t = useTranslations('bioConfig')
  const [pending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)
  const [headlineInput, setHeadlineInput] = useState(headline ?? '')
  const [textoInput, setTextoInput] = useState(texto ?? '')
  const [capa, setCapa] = useState(capaUrl)

  /** Grava na hora, sem passar pelo botão salvar: o upload já aconteceu quando
   *  a pessoa confirmou o recorte, e deixar a URL só no estado local
   *  significaria um arquivo no bucket que a página não conhece se ela sair da
   *  tela sem salvar o texto. */
  function trocarCapa(url: string | null) {
    setCapa(url)
    startTransition(async () => {
      await atualizarConfigBio('bio_capa_url', url)
    })
  }

  const sujo = headlineInput !== (headline ?? '') || textoInput !== (texto ?? '')

  function handleSave() {
    startTransition(async () => {
      await atualizarConfigBio('bio_headline', headlineInput)
      await atualizarConfigBio('bio_texto', textoInput)
      setSaved(true)
      setTimeout(() => setSaved(false), 1500)
    })
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start gap-3">
        {/* Miniatura na proporção da capa (566×546 no desktop, 1:1 no celular),
            e não redonda: um círculo aqui prometeria um avatar que a página não
            desenha mais. A forma é a mesma do recorte, então o que se vê é o
            enquadramento que vai ao ar. */}
        <CapaPicker
          userId={userId}
          capaUrl={capa}
          previewUrl={avatarUrl}
          proporcao={PROPORCAO_CAPA_PERFIL}
          largura={80}
          onChange={trocarCapa}
        />

        <div className="min-w-0 flex flex-col gap-0.5">
          <p className="text-sm font-semibold text-foreground truncate">{nome}</p>
          <p className="text-xs text-muted-foreground">
            {capa ? t('capaPropriaDica') : t('capaDoPerfilDica')}
          </p>
          <Link href="/config/editar" className="text-xs font-medium text-primary hover:underline w-fit">
            {t('editarPerfil')}
          </Link>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-foreground">{t('headline')}</label>
        <input
          value={headlineInput}
          onChange={(e) => setHeadlineInput(e.target.value)}
          maxLength={80}
          placeholder={t('headlinePlaceholder')}
          className="h-10 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-foreground">{t('texto')}</label>
        <textarea
          value={textoInput}
          onChange={(e) => setTextoInput(e.target.value)}
          maxLength={280}
          rows={3}
          placeholder={t('textoPlaceholder')}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary resize-none"
        />
      </div>

      <button
        onClick={handleSave}
        disabled={pending || !sujo}
        className="flex items-center gap-1.5 self-start text-xs font-semibold bg-primary text-primary-foreground rounded-full px-3 py-1.5 disabled:opacity-50"
      >
        {pending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
        {saved ? t('salvo') : t('salvar')}
      </button>
    </div>
  )
}
