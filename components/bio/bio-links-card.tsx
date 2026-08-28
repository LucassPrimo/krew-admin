'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import {
  GripVertical,
  Heading,
  Loader2,
  Plus,
  Rows3,
  Square,
  RectangleHorizontal,
  Trash2,
} from 'lucide-react'
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

import {
  atualizarLinkBio,
  criarLinkBio,
  removerLinkBio,
  reordenarLinksBio,
} from '@/app/actions/bio'
import type { EstiloItem } from '@/lib/bio/tipos'
import { LIMITE_LINKS_FREE, LIMITE_SECOES_FREE } from '@/lib/plano'
import { CapaPicker } from '@/components/bio/capa-picker'
import { FORMATOS, SeletorFormato, formatoDoItem } from '@/components/bio/formato-item'
import { Badge } from '@/components/ui/badge'

interface ItemBio {
  id: string
  titulo: string
  url: string | null
  capa_url: string | null
  /** Capa automática (og:image do site). Só vale quando não há capa própria. */
  preview_url: string | null
  tipo: 'link' | 'divisor'
  estilo: EstiloItem
  ordem: number
  ativo: boolean
}

/**
 * Os três formatos de card, com o ícone que os representa no seletor.
 *
 * A ordem aqui é a ordem dos botões, e ela vai do maior para o menor de
 * propósito: é a mesma leitura de "quanto espaço este link ocupa".
 */
/**
 * A aparência dos dois campos editáveis de cada item.
 *
 * Invisíveis em repouso e acesos ao passar o mouse ou focar: é o que anuncia
 * "isto se edita" sem encher a lista de molduras. O `-mx` devolve o `px` para
 * o texto ficar alinhado com o resto da linha quando o fundo está apagado.
 */
const ESTILO_CAMPO =
  'rounded-md -mx-1.5 px-1.5 py-0.5 bg-transparent outline-none transition-colors hover:bg-muted focus:bg-muted cursor-text'

/**
 * A lista da bio: links e divisores de seção, numa ordem só, arrastável.
 *
 * UMA lista e não uma por seção, porque na página pública não existem seções —
 * existe uma sequência onde um divisor é o item que começa um bloco. Arrastar
 * um link de baixo de "PODCAST" para baixo de "FOLLOW ME" é a operação mais
 * comum desta tela, e ela só é possível se os dois estiverem na mesma lista.
 *
 * `activationConstraint: { distance: 6 }` existe porque a lista é tocável no
 * celular — sem essa folga, rolar a página pelo item viraria arrasto e o
 * usuário reordenaria a lista sem querer toda vez que fosse descer a tela.
 *
 * O estado local é atualizado ANTES da action responder (a lista já ficou na
 * ordem certa; esperar o servidor só faria o item voltar e pular de novo). Se
 * a gravação falhar, o `router.refresh` implícito do `revalidatePath` traz a
 * ordem real de volta.
 */
export function BioLinksCard({
  userId,
  linksIniciais,
  cliques,
  pro,
}: {
  userId: string
  linksIniciais: ItemBio[]
  /** Cliques por link, medidos em `link_bio_events`. O contador antigo
   *  (`creator_links.cliques`) deixou de ser escrito na Etapa 3. */
  cliques: Record<string, number>
  /** Free trava em 1 seção e 3 links (ver `lib/plano.ts`); Pro é ilimitado. */
  pro: boolean
}) {
  const t = useTranslations('bioConfig')
  const [pending, startTransition] = useTransition()
  const [itens, setItens] = useState(linksIniciais)
  const [titulo, setTitulo] = useState('')
  const [url, setUrl] = useState('')
  const [capa, setCapa] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const totalLinks = itens.filter((i) => i.tipo === 'link').length
  const totalSecoes = itens.filter((i) => i.tipo === 'divisor').length
  const linkBloqueado = !pro && totalLinks >= LIMITE_LINKS_FREE
  const secaoBloqueada = !pro && totalSecoes >= LIMITE_SECOES_FREE

  function criar(tipo: 'link' | 'divisor') {
    setErro(null)
    startTransition(async () => {
      const r = await criarLinkBio(titulo, url, capa, tipo, 'grande')
      if (r?.error) {
        setErro(
          r.error === 'url_invalida'
            ? t('urlInvalida')
            : r.error === 'titulo_vazio'
              ? t('tituloVazio')
              : r.error === 'limite_links'
                ? t('limiteLinks')
                : r.error === 'limite_secoes'
                  ? t('limiteSecoes')
                  : r.error
        )
        return
      }
      if (r?.link) setItens((atual) => [...atual, r.link as ItemBio])
      setTitulo('')
      setUrl('')
      setCapa(null)
    })
  }

  function handleRemover(id: string) {
    setItens((atual) => atual.filter((l) => l.id !== id))
    startTransition(async () => {
      await removerLinkBio(id)
    })
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const de = itens.findIndex((l) => l.id === active.id)
    const para = itens.findIndex((l) => l.id === over.id)
    const nova = arrayMove(itens, de, para)
    setItens(nova)

    startTransition(async () => {
      await reordenarLinksBio(nova.map((l) => l.id))
    })
  }

  return (
    <div className="flex flex-col gap-3">
      {itens.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t('linksVazio')}</p>
      ) : (
        <>
          {/* A frase existe porque a descoberta falhou na prática: os campos são
            editáveis desde sempre, mas sem moldura ninguém tenta clicar. */}
          <p className="text-xs text-muted-foreground">{t('editarItemDica')}</p>
          <DndContext
            // O `id` é fixo de propósito: sem ele o dnd-kit numera o contexto
            // com um contador de módulo, que anda em ritmos diferentes no
            // servidor e no cliente — e o `aria-describedby` das alças chega
            // com números trocados, quebrando a hidratação.
            id="bio-links-dnd"
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={itens.map((l) => l.id)} strategy={verticalListSortingStrategy}>
              <ul className="flex flex-col gap-2">
                {itens.map((item) => (
                  <ItemArrastavel
                    key={item.id}
                    item={item}
                    userId={userId}
                    t={t}
                    cliquesDoLink={cliques[item.id] ?? 0}
                    onEstilo={(estilo) => {
                      setItens((atual) =>
                        atual.map((x) => (x.id === item.id ? { ...x, estilo } : x))
                      )
                      startTransition(async () => {
                        await atualizarLinkBio(item.id, { estilo })
                      })
                    }}
                    onCapa={(capaUrl) => {
                      setItens((atual) =>
                        atual.map((x) => (x.id === item.id ? { ...x, capa_url: capaUrl } : x))
                      )
                      startTransition(async () => {
                        await atualizarLinkBio(item.id, { capaUrl })
                      })
                    }}
                    onRemover={() => handleRemover(item.id)}
                    onRenomear={(novo) => {
                      setItens((atual) =>
                        atual.map((x) => (x.id === item.id ? { ...x, titulo: novo } : x))
                      )
                    }}
                    onSalvarTitulo={(novo) => {
                      startTransition(async () => {
                        await atualizarLinkBio(item.id, { titulo: novo })
                      })
                    }}
                    onSalvarUrl={async (nova) => {
                      const r = await atualizarLinkBio(item.id, { url: nova })
                      if (r?.error) return r.error === 'url_invalida' ? t('urlInvalida') : r.error
                      // A action normaliza (`https://` na frente, barra no fim) e
                      // troca a prévia do site junto. Ler de volta o que o
                      // servidor gravou evita a lista mostrar o texto cru
                      // enquanto a página pública já mostra outro.
                      setItens((atual) =>
                        atual.map((x) => (x.id === item.id ? { ...x, url: nova } : x))
                      )
                      return null
                    }}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        </>
      )}

      <div className="flex flex-col gap-2 border-t border-border pt-3">
        <div className="flex items-start gap-2">
          <CapaPicker userId={userId} capaUrl={capa} onChange={setCapa} />
          <div className="flex flex-1 flex-col gap-2">
            <input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              maxLength={80}
              placeholder={t('tituloPlaceholder')}
              className="h-9 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary"
            />
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              inputMode="url"
              placeholder={t('urlPlaceholder')}
              className="h-9 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary"
            />
          </div>
        </div>

        {erro && <p className="text-xs text-destructive">{erro}</p>}

        {/* Dois botões, um campo. O divisor ignora a URL e a capa — é só o
            título — e por isso não precisa de um formulário próprio: precisa de
            um segundo verbo sobre o mesmo campo. */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => criar('link')}
            disabled={pending || !titulo.trim() || !url.trim() || linkBloqueado}
            title={linkBloqueado ? t('limiteLinks') : undefined}
            className="flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
          >
            {pending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Plus className="h-3.5 w-3.5" />
            )}
            {t('adicionarLink')}
          </button>
          {linkBloqueado && <Badge className="h-4 px-1.5 text-[10px]">{t('pro')}</Badge>}

          <button
            onClick={() => criar('divisor')}
            disabled={pending || !titulo.trim() || secaoBloqueada}
            title={secaoBloqueada ? t('limiteSecoes') : t('adicionarDivisorDica')}
            className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-foreground disabled:opacity-50"
          >
            <Heading className="h-3.5 w-3.5" />
            {t('adicionarDivisor')}
          </button>
          {secaoBloqueada && <Badge className="h-4 px-1.5 text-[10px]">{t('pro')}</Badge>}
        </div>
      </div>
    </div>
  )
}

function ItemArrastavel({
  item,
  userId,
  t,
  cliquesDoLink,
  onEstilo,
  onRemover,
  onRenomear,
  onSalvarTitulo,
  onSalvarUrl,
  onCapa,
}: {
  item: ItemBio
  userId: string
  t: (chave: string) => string
  cliquesDoLink: number
  onEstilo: (estilo: EstiloItem) => void
  onRemover: () => void
  onRenomear: (valor: string) => void
  onSalvarTitulo: (valor: string) => void
  /** Devolve a mensagem de erro, ou `null` se gravou. */
  onSalvarUrl: (valor: string) => Promise<string | null>
  onCapa: (url: string | null) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  })
  const ehDivisor = item.tipo === 'divisor'

  // A URL tem estado PRÓPRIO, ao contrário do título: ela pode ser recusada
  // (`url_invalida`), e o campo precisa de um valor para onde voltar quando
  // isso acontece. O título, que a action só apara, escreve direto na lista.
  const [urlInput, setUrlInput] = useState(item.url ?? '')
  const [erroUrl, setErroUrl] = useState<string | null>(null)
  const [formatoAberto, setFormatoAberto] = useState(false)

  // O formato mostrado sai do PAR (estilo, capa), não só do estilo: um card
  // sem capa sai como botão na página, e dizer "Grande" aqui seria mentir
  // sobre o que está publicado.
  const formatoAtual = formatoDoItem(item.estilo, item.capa_url ?? item.preview_url)
  const formatoAtualDef = FORMATOS.find((f) => f.chave === formatoAtual)!
  const FormatoIcone = formatoAtualDef.icone

  async function salvarUrl() {
    const nova = urlInput.trim()
    if (!nova || nova === (item.url ?? '')) {
      // Campo esvaziado ou intocado: nada a gravar. Voltar ao valor atual é o
      // que impede um blur acidental de apagar a URL do card.
      setUrlInput(item.url ?? '')
      setErroUrl(null)
      return
    }
    const erro = await onSalvarUrl(nova)
    setErroUrl(erro)
    if (erro) setUrlInput(item.url ?? '')
  }

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex flex-col gap-2 rounded-lg border px-2 py-2 ${
        // O divisor é visualmente diferente na lista porque é diferente na
        // página: fundo sólido e sem capa, para a coluna de edição ler como a
        // coluna publicada.
        ehDivisor ? 'border-transparent bg-muted' : 'border-border bg-background'
      } ${isDragging ? 'opacity-60 shadow-card' : ''}`}
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label={t('arrastar')}
          className="cursor-grab touch-none text-muted-foreground active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>

        {!ehDivisor && (
          <CapaPicker
            userId={userId}
            capaUrl={item.capa_url}
            previewUrl={item.preview_url}
            onChange={onCapa}
          />
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Os dois campos não têm moldura em repouso — uma lista de caixas
            brigaria com os cards que ela representa —, mas acendem no hover e
            no foco. Sem isso, texto sem borda lê como rótulo, e ninguém
            descobre que dá para clicar: foi exatamente o que aconteceu. */}
          <input
            value={item.titulo}
            onChange={(e) => onRenomear(e.target.value)}
            onBlur={(e) => onSalvarTitulo(e.target.value)}
            maxLength={80}
            title={t('editarCampoDica')}
            className={`${ESTILO_CAMPO} text-sm ${
              ehDivisor ? 'font-bold tracking-wide uppercase' : 'font-medium'
            }`}
          />
          {/* Era um `<span>` só de leitura: dava para trocar o título, a capa e o
            formato do card, mas não o destino — e link colado errado só tinha
            saída pelo apagar e recriar, que leva junto os cliques já medidos.
            Mesmo padrão do título: grava ao sair do campo, sem botão. */}
          {!ehDivisor && (
            <input
              value={urlInput}
              onChange={(e) => {
                setUrlInput(e.target.value)
                setErroUrl(null)
              }}
              onBlur={salvarUrl}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.currentTarget.blur()
                if (e.key === 'Escape') {
                  setUrlInput(item.url ?? '')
                  setErroUrl(null)
                }
              }}
              inputMode="url"
              placeholder={t('urlPlaceholder')}
              aria-label={t('urlLink')}
              aria-invalid={!!erroUrl}
              title={t('editarCampoDica')}
              className={`${ESTILO_CAMPO} truncate text-xs ${
                erroUrl ? 'text-destructive' : 'text-muted-foreground focus:text-foreground'
              }`}
            />
          )}
          {erroUrl && <span className="text-[11px] text-destructive">{erroUrl}</span>}
        </div>

        {!ehDivisor && cliquesDoLink > 0 && (
          <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
            {cliquesDoLink}
          </span>
        )}

        {/* Um botão só, com o formato ATUAL escrito nele — e a escolha abre
          embaixo, dentro do próprio item. Os três ícones de 16px que moravam
          aqui pediam para adivinhar a diferença entre "grande" e "médio" por
          um desenho de retângulo; o seletor de baixo mostra o card. */}
        {!ehDivisor && (
          <button
            type="button"
            onClick={() => setFormatoAberto((v) => !v)}
            aria-expanded={formatoAberto}
            title={t('formatoDica')}
            className={`flex shrink-0 items-center gap-1 rounded-pill border px-2 py-1 text-[11px] font-medium transition-colors ${
              formatoAberto
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            <FormatoIcone className="h-3.5 w-3.5" />
            {t(formatoAtualDef.rotulo)}
          </button>
        )}

        <button
          type="button"
          onClick={onRemover}
          aria-label={t('remover')}
          className="shrink-0 p-1 text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {formatoAberto && !ehDivisor && (
        <div className="border-t border-border pt-2">
          <SeletorFormato
            formato={formatoAtual}
            titulo={item.titulo}
            capa={item.capa_url ?? item.preview_url}
            url={item.url}
            // Os quatro formatos gravam estilo, o botão inclusive — e por
            // isso escolhê-lo NÃO apaga mais a capa. A arte fica guardada e
            // volta a aparecer ao trocar para qualquer card, que é o que
            // torna a escolha reversível sem reenviar imagem.
            aoEscolher={onEstilo}
          />
        </div>
      )}
    </li>
  )
}
