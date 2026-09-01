'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { atualizarConfigBio, type ConfigBio } from '@/app/actions/bio'

type CampoBooleano = Extract<
  keyof ConfigBio,
  | 'bio_ativo'
  | 'bio_mostrar_seguidores'
  | 'bio_mostrar_propostas'
  | 'bio_esconder_marca'
  | 'bio_marcas_nome'
>

/**
 * Um liga/desliga da bio, para morar dentro da seção que ele afeta.
 *
 * Herdou o comportamento do antigo `BioConfigCard`, que juntava os quatro num
 * cartão só: grava sozinho, sem botão salvar (é uma decisão binária, que já é a
 * própria confirmação), e o estado local muda ANTES da resposta do servidor —
 * um switch que só se mexe depois do round-trip parece quebrado no 4G, e o
 * custo de errar é baixo: se a gravação falhar, o valor volta.
 */
export function ToggleBio({
  campo,
  inicial,
  pro = false,
  temPro = true,
  rotulo,
}: {
  campo: CampoBooleano
  inicial: boolean
  /** Recurso pago: desenha o selo e trava o switch para quem não assina. */
  pro?: boolean
  temPro?: boolean
  rotulo: string
}) {
  const t = useTranslations('bioConfig')
  const [, startTransition] = useTransition()
  const [valor, setValor] = useState(inicial)

  const bloqueado = pro && !temPro

  // Bloqueado desenha DESLIGADO mesmo com `true` guardado no banco — e é o
  // certo, não um detalhe visual: sem plano a página já está rebaixada
  // (`rebaixarBioParaFree`, em `lib/plano.ts`), então um switch ligado estaria
  // afirmando um recurso que a bio não tem mais. O valor guardado não é
  // apagado: assinando de novo, o switch volta ligado sozinho.
  const exibido = bloqueado ? false : valor

  function alternar(proximo: boolean) {
    const anterior = valor
    setValor(proximo)
    startTransition(async () => {
      const r = await atualizarConfigBio(campo, proximo)
      if (r?.error) setValor(anterior)
    })
  }

  return (
    <div className="flex items-center gap-2">
      {pro && <Badge className="h-4 px-1.5 text-[10px]">{t('pro')}</Badge>}
      <Switch
        checked={exibido}
        disabled={bloqueado}
        onCheckedChange={alternar}
        aria-label={rotulo}
      />
    </div>
  )
}
