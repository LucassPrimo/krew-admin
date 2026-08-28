'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { ExternalLink, RotateCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MolduraCelular } from '@/components/preview/moldura-celular'

export interface AbaPreview {
  chave: string
  label: string
  /** Caminho RELATIVO (`/@slug`), nunca a URL absoluta — ver o comentário abaixo. */
  url: string
}

/**
 * Prévia das páginas públicas, no formato de celular.
 *
 * É um IFRAME da página pública de verdade, não uma reconstrução do layout.
 * Reconstruir seria mais "reativo" (mudaria a cada tecla digitada), mas a
 * prévia deixaria de responder à pergunta que ela existe para responder —
 * "como isso vai ficar publicado" — no dia em que os dois layouts divergissem.
 * E divergiriam: são dois arquivos com a mesma regra escrita duas vezes.
 *
 * O preço é que a prévia mostra o que está SALVO, não o que está sendo
 * digitado. Isso é aceitável e até correto: é a página publicada que importa.
 * Para que a atualização não dependa do usuário lembrar de recarregar, o
 * servidor manda `versao` a cada render — e como toda action destas telas
 * chama `revalidatePath`, salvar qualquer coisa já traz uma versão nova.
 *
 * `key={versao}` em vez de `iframe.contentWindow.location.reload()`: remontar
 * é a forma que não depende de acessar o documento de dentro do iframe, o que
 * é frágil e some se um dia a prévia apontar para outro host (`bekrew.com`).
 *
 * Com mais de uma aba vira o painel de /config/aparencia: o mesmo tema pinta três
 * páginas diferentes, e trocar de aba é a única forma de ver isso sem publicar
 * e abrir três links.
 */
export function PreviewPublica({ abas, versao }: { abas: AbaPreview[]; versao: string }) {
  const t = useTranslations('bioConfig')
  const [chave, setChave] = useState(versao)
  const [aba, setAba] = useState(abas[0]?.chave)

  useEffect(() => {
    setChave(versao)
  }, [versao])

  const atual = abas.find((a) => a.chave === aba) ?? abas[0]
  if (!atual) return null

  return (
    // Escondida SÓ no celular: ali a pessoa já está vendo o resultado no
    // tamanho real, e uma maquete de celular dentro de um celular rouba espaço
    // da tela que importa, a de edição. No tablet (`md`) esse argumento não
    // vale — sobra largura, a prévia entra abaixo dos cartões e é onde a
    // mudança aparece.
    <aside className="hidden md:flex lg:sticky lg:top-8 h-fit flex-col items-center gap-3">
      <div className="flex w-full items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {t('previewLabel')}
        </p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setChave(`${Date.now()}`)}
            aria-label={t('previewAtualizar')}
            title={t('previewAtualizar')}
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <RotateCw className="h-3.5 w-3.5" />
          </button>
          <a
            href={atual.url}
            target="_blank"
            rel="noreferrer"
            aria-label={t('abrir')}
            title={t('abrir')}
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>

      {abas.length > 1 && (
        <div className="flex w-full rounded-md border border-border p-1">
          {abas.map((a) => (
            <button
              key={a.chave}
              type="button"
              onClick={() => setAba(a.chave)}
              className={cn(
                'flex-1 rounded py-1.5 text-xs transition-colors',
                a.chave === atual.chave
                  ? 'bg-primary/10 text-foreground font-semibold'
                  : 'text-muted-foreground'
              )}
            >
              {a.label}
            </button>
          ))}
        </div>
      )}

      {/* 680px de moldura dão uma tela de ~296×646 — a mesma ordem de grandeza
          do quadro de 320×640 que existia aqui antes, que é a largura em que a
          página cai no layout de celular sozinha. Altura fixa, e não a da
          janela: esta prévia divide uma coluna que rola com os cartões de
          edição, então esticá-la até o fim da tela empurraria os cartões. */}
      <MolduraCelular className="h-[680px]">
        <iframe
          // A aba entra na key junto da versão: trocar de página é remontar o
          // iframe, senão o histórico do frame acumularia navegações.
          key={`${atual.chave}-${chave}`}
          src={atual.url}
          title={atual.label}
          className="h-full w-full border-0"
          // A prévia é da própria conta e o conteúdo é público — mesmo assim
          // o sandbox limita o que a página pode fazer dentro do dashboard.
          sandbox="allow-scripts allow-same-origin allow-popups"
        />
      </MolduraCelular>

      <p className="text-center text-[11px] text-muted-foreground">{t('previewDica')}</p>
    </aside>
  )
}
