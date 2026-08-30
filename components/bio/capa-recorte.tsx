'use client'

import { useCallback, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import Cropper, { type Area } from 'react-easy-crop'
import {
  Check,
  FlipHorizontal2,
  FlipVertical2,
  Loader2,
  RotateCw,
  X,
  ZoomIn,
} from 'lucide-react'

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

/** Espelhamento pedido pela pessoa, em cada eixo. */
interface Espelho {
  horizontal: boolean
  vertical: boolean
}

/**
 * Redesenha o recorte num canvas e devolve o arquivo final.
 *
 * O `image-orientation: from-image` do navegador já resolve o EXIF na
 * exibição, mas o canvas desenha o bitmap cru — sem `createImageBitmap` com
 * `imageOrientation`, foto de celular na vertical sobe deitada.
 *
 * ---------------------------------------------------------------------------
 * Por que dois canvas, e não um `drawImage` com a área de origem
 * ---------------------------------------------------------------------------
 * Antes dava para recortar direto do bitmap, porque o retângulo que o cropper
 * devolve era, sem mais, um pedaço do arquivo. Com giro e espelho ele deixa de
 * ser: `croppedAreaPixels` sai em coordenadas da imagem JÁ TRANSFORMADA — é o
 * contrato do react-easy-crop, e um `sx/sy` no bitmap cru pegaria o pedaço
 * errado a cada 90°.
 *
 * Então o primeiro canvas materializa a transformação: a imagem inteira, girada
 * e espelhada, dentro da caixa que ela ocupa depois de girar. É nesse plano que
 * o retângulo do cropper significa o que ele diz, e o segundo canvas só copia o
 * pedaço e o reduz ao tamanho de entrega.
 *
 * O espelho entra aqui e NÃO no `rotation` da biblioteca porque ela não tem
 * essa prop — na tela ele é um `scaleX/scaleY` empurrado pelo `transform`, que
 * ela desconhece ao calcular a área. Como a conta dela ignora o espelho e este
 * canvas o aplica, os dois se encontram: o pedaço copiado é exatamente o que
 * estava sob a moldura.
 */
async function recortar(
  arquivo: File,
  area: Area,
  proporcao: number,
  rotacao: number,
  espelho: Espelho
): Promise<File> {
  const bitmap = await createImageBitmap(arquivo, { imageOrientation: 'from-image' })

  // A caixa da imagem girada. Em 90° e 270° largura e altura trocam de lugar, e
  // é por isso que ela não pode ser o tamanho do bitmap: o giro estouraria as
  // bordas e o recorte sairia com faixa transparente.
  const rad = (rotacao * Math.PI) / 180
  const cos = Math.abs(Math.cos(rad))
  const sen = Math.abs(Math.sin(rad))
  const caixaL = bitmap.width * cos + bitmap.height * sen
  const caixaA = bitmap.width * sen + bitmap.height * cos

  const plano = document.createElement('canvas')
  plano.width = Math.round(caixaL)
  plano.height = Math.round(caixaA)

  const pctx = plano.getContext('2d')
  if (!pctx) throw new Error('sem canvas')

  // Gira e espelha em torno do CENTRO: a origem vai para o meio da caixa, a
  // imagem é desenhada recuada por metade dela própria. Espelhar é um `scale`
  // negativo — e ele vem depois do `rotate` para espelhar o resultado do giro,
  // que é o que a pessoa vê na tela.
  pctx.translate(caixaL / 2, caixaA / 2)
  pctx.rotate(rad)
  pctx.scale(espelho.horizontal ? -1 : 1, espelho.vertical ? -1 : 1)
  pctx.translate(-bitmap.width / 2, -bitmap.height / 2)
  pctx.drawImage(bitmap, 0, 0)
  bitmap.close()

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
    plano,
    area.x, area.y, area.width, area.height,
    0, 0, largura, altura
  )

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
  const [blobUrl] = useState(() => URL.createObjectURL(arquivo))
  const [url, setUrl] = useState(blobUrl)
  const [posicao, setPosicao] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [rotacao, setRotacao] = useState(0)
  const [espelho, setEspelho] = useState<Espelho>({ horizontal: false, vertical: false })
  const [area, setArea] = useState<Area | null>(null)
  const [processando, setProcessando] = useState(false)
  const [falhou, setFalhou] = useState(false)
  const tentouDataUrl = useRef(false)

  const aoCompletar = useCallback((_: Area, pixels: Area) => setArea(pixels), [])

  /**
   * A prévia não carregou — e o que se via até aqui era um retângulo PRETO sem
   * uma palavra de explicação, porque o cropper desenha a moldura mesmo com a
   * imagem quebrada (sem tamanho natural, o `<img>` estica até o contêiner, e é
   * daí que vinha a moldura grande demais para a foto).
   *
   * Antes de desistir, tenta a mesma imagem como `data:`. O motivo conhecido de
   * uma `blob:` morrer aqui é CSP — `img-src` sem `blob:` derruba a prévia em
   * silêncio, e é uma linha de header que só existe no painel, num arquivo que
   * ninguém lembra de olhar quando a foto some. `data:` está liberado em todo
   * ambiente, então a prévia volta sozinha em vez de virar chamado.
   *
   * O corte em si nunca dependeu disto: `recortar` lê o File pelo
   * `createImageBitmap`, sem passar por URL nenhuma.
   */
  function aoFalharPrevia() {
    if (tentouDataUrl.current) {
      setFalhou(true)
      return
    }
    tentouDataUrl.current = true
    const leitor = new FileReader()
    leitor.onload = () => setUrl(String(leitor.result))
    leitor.onerror = () => setFalhou(true)
    leitor.readAsDataURL(arquivo)
  }

  async function confirmar() {
    if (!area) return
    setProcessando(true)
    try {
      onConfirmar(await recortar(arquivo, area, proporcao, rotacao, espelho))
    } finally {
      setProcessando(false)
      URL.revokeObjectURL(blobUrl)
    }
  }

  function cancelar() {
    URL.revokeObjectURL(blobUrl)
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
            rotation={rotacao}
            aspect={proporcao}
            onCropChange={setPosicao}
            onZoomChange={setZoom}
            onRotationChange={setRotacao}
            onCropComplete={aoCompletar}
            showGrid={false}
            mediaProps={{ onError: aoFalharPrevia }}
            // A biblioteca não tem prop de espelho, então reescrevemos o
            // `transform` dela inteiro — o começo é cópia fiel do padrão, para
            // arrasto e zoom continuarem batendo com o que ela calcula.
            //
            // Os `scale` do espelho vêm por ÚLTIMO, ou seja: aplicados primeiro
            // à imagem, antes de girar e de posicionar. É o que mantém o
            // arrasto natural — o `translate` continua acontecendo no espaço
            // da moldura, então puxar para a esquerda leva a foto para a
            // esquerda mesmo com ela espelhada.
            transform={
              `translate(${posicao.x}px, ${posicao.y}px) rotate(${rotacao}deg) scale(${zoom}) ` +
              `scaleX(${espelho.horizontal ? -1 : 1}) scaleY(${espelho.vertical ? -1 : 1})`
            }
          />
        </div>

        <div className="flex flex-col gap-3 p-4">
          <div className="flex items-center gap-2">
            <BotaoAjuste
              rotulo={t('recorteGirar')}
              onClick={() => setRotacao((r) => (r + 90) % 360)}
            >
              <RotateCw className="size-4" />
            </BotaoAjuste>
            <BotaoAjuste
              rotulo={t('recorteEspelharH')}
              ativo={espelho.horizontal}
              onClick={() => setEspelho((e) => ({ ...e, horizontal: !e.horizontal }))}
            >
              <FlipHorizontal2 className="size-4" />
            </BotaoAjuste>
            <BotaoAjuste
              rotulo={t('recorteEspelharV')}
              ativo={espelho.vertical}
              onClick={() => setEspelho((e) => ({ ...e, vertical: !e.vertical }))}
            >
              <FlipVertical2 className="size-4" />
            </BotaoAjuste>
          </div>

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

          {falhou ? (
            <p className="text-xs text-destructive">{t('recorteFalhou')}</p>
          ) : (
            <p className="text-xs text-muted-foreground">{t('recorteDica')}</p>
          )}

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
              disabled={processando || falhou || !area}
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

/**
 * Botão de ajuste da imagem.
 *
 * Só ícone, com o nome no `title`/`aria-label`: são três controles numa faixa
 * estreita, acima de um cropper que já ocupa a tela do celular inteira, e
 * rótulo escrito ali empurraria o zoom para fora do polegar.
 *
 * `ativo` é `undefined` no giro de propósito — girar é uma AÇÃO, que acumula a
 * cada toque; espelhar é um estado ligado/desligado. Quem não recebe `ativo`
 * não ganha `aria-pressed`, e o leitor de tela anuncia cada um pelo que ele é.
 */
function BotaoAjuste({
  rotulo,
  ativo,
  onClick,
  children,
}: {
  rotulo: string
  ativo?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={rotulo}
      aria-label={rotulo}
      aria-pressed={ativo}
      className={`flex size-9 items-center justify-center rounded-full border transition-colors ${
        ativo
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-border text-muted-foreground hover:bg-secondary hover:text-foreground'
      }`}
    >
      {children}
    </button>
  )
}
