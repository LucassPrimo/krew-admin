'use client'

import { useCallback, useState } from 'react'
import { useTranslations } from 'next-intl'
import Cropper, { type Area } from 'react-easy-crop'
import { Check, Loader2, X, ZoomIn } from 'lucide-react'

/**
 * Recorte da capa, entre escolher o arquivo e enviar.
 *
 * Existe porque a foto que a pessoa tem quase nunca tem a forma do card. Sem
 * recorte, o `object-cover` do card decide sozinho o que cortar — sempre pelo
 * centro —, e é assim que rosto vira testa e logo vira metade de logo.
 *
 * Proporção 16:9 e não a exata dos cards: são DOIS formatos na página (o largo
 * do destaque e o quadrado-ish da grade), e um recorte só serve os dois se
 * ficar no meio do caminho. O `object-cover` termina o ajuste em cada um.
 *
 * A capa do PERFIL usa outra proporção (`PROPORCAO_CAPA_PERFIL`, quase
 * quadrada) — daí `proporcao` ser um parâmetro. É o mesmo recorte, com outra
 * moldura: duplicar o componente só para trocar um número traria junto o
 * canvas, o EXIF e o WebP.
 *
 * O corte acontece no NAVEGADOR, num canvas, e o que sobe é só o resultado:
 * o arquivo original nunca viaja. Isso corta o tempo de upload no 4G e evita
 * guardar no bucket uma foto de 3 MB da qual só um pedaço é usado.
 */

export const PROPORCAO_CAPA = 16 / 9

/**
 * A capa do topo da `/@handle`: 566×546 no desktop, quadrada no celular
 * (`bio-perfil.module.css`). O recorte fica no meio dos dois — o `object-cover`
 * acerta o resto, como nos cards.
 */
export const PROPORCAO_CAPA_PERFIL = 566 / 546

/**
 * Redesenha o recorte num canvas e devolve o arquivo final.
 *
 * O `image-orientation: from-image` do navegador já resolve o EXIF na
 * exibição, mas o canvas desenha o bitmap cru — sem `createImageBitmap` com
 * `imageOrientation`, foto de celular na vertical sobe deitada.
 */
async function recortar(arquivo: File, area: Area, proporcao: number): Promise<File> {
  const bitmap = await createImageBitmap(arquivo, { imageOrientation: 'from-image' })

  // Teto de largura: acima disso é peso de upload sem ganho — o elemento mais
  // largo da bio é a capa do topo, com 566px de CSS, então 1280 já cobre telas
  // de alta densidade.
  const largura = Math.min(Math.round(area.width), 1280)
  const altura = Math.round(largura / proporcao)

  const canvas = document.createElement('canvas')
  canvas.width = largura
  canvas.height = altura

  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('sem canvas')

  ctx.drawImage(
    bitmap,
    area.x, area.y, area.width, area.height,
    0, 0, largura, altura
  )
  bitmap.close()

  const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, 'image/webp', 0.9))
  if (!blob) throw new Error('sem blob')

  // WebP com nome coerente: o bucket valida por MIME, e um `.jpg` contendo
  // webp confundiria qualquer um que fosse depurar isso depois.
  return new File([blob], 'capa.webp', { type: 'image/webp' })
}

export function CapaRecorte({
  arquivo,
  proporcao = PROPORCAO_CAPA,
  onCancelar,
  onConfirmar,
}: {
  arquivo: File
  /** Forma da moldura. Default: a dos cards. */
  proporcao?: number
  onCancelar: () => void
  onConfirmar: (recortado: File) => void
}) {
  const t = useTranslations('bioConfig')
  const [url] = useState(() => URL.createObjectURL(arquivo))
  const [posicao, setPosicao] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [area, setArea] = useState<Area | null>(null)
  const [processando, setProcessando] = useState(false)

  const aoCompletar = useCallback((_: Area, pixels: Area) => setArea(pixels), [])

  async function confirmar() {
    if (!area) return
    setProcessando(true)
    try {
      onConfirmar(await recortar(arquivo, area, proporcao))
    } finally {
      setProcessando(false)
      URL.revokeObjectURL(url)
    }
  }

  function cancelar() {
    URL.revokeObjectURL(url)
    onCancelar()
  }

  return (
    // Sobreposição própria em vez do Dialog do projeto: o cropper precisa de
    // altura fixa e de capturar arrasto, e um contêiner que rola por baixo
    // rouba o gesto no celular.
    <div className="fixed inset-0 z-50 flex flex-col justify-center bg-black/80 p-4">
      <div className="mx-auto w-full max-w-md overflow-hidden rounded-2xl bg-card">
        <div className="relative h-64 w-full bg-black">
          <Cropper
            image={url}
            crop={posicao}
            zoom={zoom}
            aspect={proporcao}
            onCropChange={setPosicao}
            onZoomChange={setZoom}
            onCropComplete={aoCompletar}
            showGrid={false}
          />
        </div>

        <div className="flex flex-col gap-3 p-4">
          <label className="flex items-center gap-2">
            <ZoomIn className="size-4 shrink-0 text-muted-foreground" />
            <span className="sr-only">{t('recorteZoom')}</span>
            <input
              type="range"
              min={1}
              max={3}
              step={0.01}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="w-full accent-primary"
            />
          </label>

          <p className="text-xs text-muted-foreground">{t('recorteDica')}</p>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={cancelar}
              disabled={processando}
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              <X className="size-3.5" />
              {t('cancelar')}
            </button>
            <button
              type="button"
              onClick={confirmar}
              disabled={processando || !area}
              className="flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
            >
              {processando ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Check className="size-3.5" />
              )}
              {t('recorteConfirmar')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
