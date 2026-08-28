'use client'

import { useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Crop, ImagePlus, Loader2, X } from 'lucide-react'

import { removerCapaDaOferta, subirImagemDaOferta } from '@/app/actions/upload-oferta'
import { CapaRecorte, PROPORCAO_CAPA } from '@/components/bio/capa-recorte'
import {
  BUCKET_CAPAS,
  TIPOS_CAPA,
  montarPathCapa,
  pathDaCapa,
  validarCapa,
} from '@/lib/capa-link'

/**
 * Escolha da capa de um link.
 *
 * O upload vai direto do navegador para o Storage, sem passar pelo servidor da
 * Krew — mesma estratégia do avatar (`components/perfil/avatar-upload.tsx`). A
 * policy do bucket autoriza pelo path (`{user_id}/…`), então o cliente não
 * precisa de nenhum poder que já não tenha, e um arquivo de 3 MB não vira
 * argumento de server action.
 *
 * Entre escolher e enviar entra o RECORTE (`CapaRecorte`): a foto que a pessoa
 * tem quase nunca tem a forma do card, e sem recorte é o `object-cover` que
 * decide o que cortar, sempre pelo centro. O que sobe é só o pedaço escolhido,
 * já em WebP — o arquivo original nunca viaja.
 *
 * Sobe ao confirmar o recorte, não no "salvar" do formulário: o arquivo não
 * cabe no fluxo de texto sem transformar tudo em upload, e confirmar o corte já
 * é a confirmação que a pessoa espera.
 *
 * O arquivo antigo é apagado DEPOIS de o novo subir. Ao contrário: uma falha no
 * upload deixaria o link sem capa nenhuma.
 */
export function CapaPicker({
  userId,
  capaUrl,
  previewUrl = null,
  proporcao = PROPORCAO_CAPA,
  largura = 96,
  onChange,
  className = '',
}: {
  userId: string
  capaUrl: string | null
  /** Imagem que a página usa enquanto não há capa própria: a prévia do site no
   *  card de link, a foto de perfil na capa do topo. Aparece esmaecida — mostra
   *  o que vai ao ar sem se passar por escolha da pessoa. */
  previewUrl?: string | null
  /** Forma do recorte E da miniatura. As duas juntas de propósito: uma
   *  miniatura de outra forma recortaria de novo aqui, e a prévia mostraria um
   *  enquadramento que não é o publicado. */
  proporcao?: number
  /** Largura da miniatura em px. A altura sai da proporção. */
  largura?: number
  onChange: (url: string | null) => void
  className?: string
}) {
  const t = useTranslations('bioConfig')
  const inputRef = useRef<HTMLInputElement>(null)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [paraRecortar, setParaRecortar] = useState<File | null>(null)

  function selecionar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    // Zera o input já: sem isso, escolher o MESMO arquivo de novo depois de um
    // erro não dispara `change` e a tela fica parada sem explicação.
    e.target.value = ''
    if (!file) return

    // A validação de tamanho vale sobre o ORIGINAL: é o que o navegador vai
    // ter que ler na memória para recortar. O resultado do corte é sempre menor.
    const invalido = validarCapa(file)
    if (invalido) {
      setErro(invalido === 'muito_grande' ? t('capaGrande') : t('capaTipo'))
      return
    }

    setErro(null)
    setParaRecortar(file)
  }

  async function enviar(file: File) {
    setParaRecortar(null)
    setEnviando(true)

    // ÚNICA diferença em relação ao krew-app: lá o upload vai direto do
    // navegador para o Storage, porque a policy do bucket autoriza pelo path
    // (`{auth.uid()}/…`). No painel quem está logado é o admin e a pasta é a do
    // criador, então a policy negaria — o arquivo passa pelo servidor, que
    // grava no mesmo path com a chave de serviço.
    const form = new FormData()
    form.set('arquivo', file)

    const r = await subirImagemDaOferta('capa', form, capaUrl)
    if (!r.ok) {
      setErro(r.erro)
      setEnviando(false)
      return
    }

    onChange(r.url)
    setEnviando(false)
  }

  /**
   * Reabre o recorte sobre a imagem que já está no ar.
   *
   * Existe porque o enquadramento só era decidível no instante do upload:
   * errou o corte, só trocando o arquivo — e quem subiu do celular muitas
   * vezes nem tem mais a foto original à mão. Aqui a fonte é a própria imagem
   * publicada, baixada de volta como arquivo.
   *
   * Vale também para a imagem de RESERVA (a foto de perfil na capa do topo, a
   * prévia do site no card): recortá-la produz uma capa própria a partir dela,
   * sem mexer no original. O arquivo antigo só é apagado se for do bucket
   * `capas` — `pathDaCapa` devolve `null` para qualquer outra origem, e é isso
   * que impede o recorte de levar junto a foto de perfil.
   *
   * Recorte sobre recorte perde qualidade, e é aceitável: o que está no ar tem
   * no máximo 1280px de largura, e o resultado ainda é maior que o maior lugar
   * onde ele aparece.
   */
  async function ajustar() {
    const alvo = capaUrl ?? previewUrl
    if (!alvo) return

    setErro(null)
    setEnviando(true)
    try {
      const resposta = await fetch(alvo)
      if (!resposta.ok) throw new Error('sem imagem')
      const blob = await resposta.blob()
      setParaRecortar(new File([blob], 'capa-atual', { type: blob.type }))
    } catch {
      setErro(t('recorteFalhou'))
    } finally {
      setEnviando(false)
    }
  }

  async function remover() {
    // Mesma razão do `enviar`: apagar no Storage também passa pela policy de
    // path, que o painel não satisfaz. A limpeza do arquivo antigo acontece no
    // servidor, junto do próximo upload — aqui só tiramos a URL da página.
    onChange(null)
    await removerCapaDaOferta(capaUrl)
  }

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <div className="relative">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={enviando}
          aria-label={capaUrl ? t('trocarCapa') : t('adicionarCapa')}
          style={{ width: largura, aspectRatio: proporcao }}
          className="relative flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-dashed border-border bg-muted/40 text-muted-foreground transition-colors hover:bg-muted disabled:opacity-60"
        >
          {(capaUrl || previewUrl) && (
            // A prévia automática entra esmaecida: mostra o que vai aparecer na
            // página sem se passar por escolha da pessoa.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={capaUrl ?? previewUrl ?? ''}
              alt=""
              className={`absolute inset-0 h-full w-full object-cover ${capaUrl ? '' : 'opacity-60'}`}
            />
          )}
          {enviando ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            !capaUrl && <ImagePlus className="h-4 w-4 relative" />
          )}
        </button>

        {capaUrl && !enviando && (
          <button
            type="button"
            onClick={remover}
            aria-label={t('removerCapa')}
            className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-background text-muted-foreground shadow-card hover:text-destructive"
          >
            <X className="h-3 w-3" />
          </button>
        )}

        {/* Canto oposto ao do X, e só quando há imagem: o botão diz "mexer
            nesta", enquanto tocar a miniatura continua sendo "trocar por
            outra". Duas ações diferentes sobre a mesma foto precisam de dois
            alvos, senão a única saída para um corte errado é subir tudo de
            novo. */}
        {(capaUrl || previewUrl) && !enviando && (
          <button
            type="button"
            onClick={ajustar}
            aria-label={t('ajustarRecorte')}
            title={t('ajustarRecorte')}
            className="absolute -right-1.5 -bottom-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-background text-muted-foreground shadow-card hover:text-foreground"
          >
            <Crop className="h-3 w-3" />
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={TIPOS_CAPA.join(',')}
        onChange={selecionar}
        className="hidden"
      />

      {erro && <p className="text-[11px] text-destructive">{erro}</p>}

      {paraRecortar && (
        <CapaRecorte
          arquivo={paraRecortar}
          proporcao={proporcao}
          onCancelar={() => setParaRecortar(null)}
          onConfirmar={enviar}
        />
      )}
    </div>
  )
}
