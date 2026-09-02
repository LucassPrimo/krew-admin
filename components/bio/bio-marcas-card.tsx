'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { GripVertical, Loader2, Plus, Trash2 } from 'lucide-react'
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
import { CapaPicker } from '@/components/bio/capa-picker'
import { ToggleBio } from '@/components/bio/toggle-bio'
import { Modal, ModalRodape } from '@/components/ui/modal'

/**
 * Proporção do recorte da logo: a mesma do card do carrossel.
 *
 * Recortar numa forma e desenhar em outra é a definição de recorte frustrado —
 * é o mesmo raciocínio do `proporcaoDoFormato` na lista de links. Aqui ela
 * pesa mais do que lá: a arte da marca PREENCHE o card (`object-fit: cover`,
 * ver `.cardMarca` em `bio-perfil.module.css`), então tudo que sobrar da
 * proporção é cortado na página. Recortando neste mesmo formato, quem sobe a
 * arte vê no editor exatamente o pedaço que vai ao ar.
 */
const PROPORCAO_LOGO = 125 / 67

interface MarcaBio {
  id: string
  titulo: string
  url: string | null
  capa_url: string | null
  ordem: number
  ativo: boolean
}

/**
 * As marcas parceiras — o carrossel que fica acima da lista na `/@handle`.
 *
 * Lista PRÓPRIA, separada da de links, ainda que as duas morem na mesma tabela
 * (`creator_links`, com `tipo = 'marca'` — ver a migration `20260901120000`).
 * Juntá-las numa lista só arrastável seria oferecer uma operação que a página
 * não sabe cumprir: arrastar uma logo para o meio dos cards não a move para
 * lugar nenhum, porque o carrossel é um bloco fixo da página. Duas listas, dois
 * arrastes, cada ordem valendo dentro do próprio bloco.
 *
 * Cópia do arquivo do krew-app, sem alteração — mesma regra dos outros
 * componentes de bio deste painel (ver o cabeçalho de
 * `app/(painel)/ofertas/[id]/page.tsx`): as duas telas editam a MESMA tabela,
 * e código copiado que volta igual é código que não diverge. O `CapaPicker`
 * daqui é que difere, e ele já resolve o upload pelo servidor.
 *
 * A logo é obrigatória, e a trava real está na action: uma marca sem imagem
 * fica gravada e invisível — some do carrossel (a consulta a ignora) sem sumir
 * do editor, que é o pior dos dois mundos. Aqui o botão só acende com os três
 * campos, e o erro devolvido pelo servidor é traduzido logo abaixo dele.
 */
export function BioMarcasCard({
  userId,
  marcasIniciais,
  cliques,
  mostrarNomeInicial,
}: {
  userId: string
  marcasIniciais: MarcaBio[]
  /** Cliques por logo, medidos em `link_bio_events` — o mesmo `button_id` dos
   *  links, que é justamente o que a marca ganha por morar naquela tabela. */
  cliques: Record<string, number>
  /** `bio_marcas_nome`: desenhar o nome sobre a logo no carrossel. */
  mostrarNomeInicial: boolean
}) {
  const t = useTranslations('bioConfig')
  const [pending, startTransition] = useTransition()
  const [itens, setItens] = useState(marcasIniciais)
  const [nome, setNome] = useState('')
  const [url, setUrl] = useState('')
  const [logo, setLogo] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [aberto, setAberto] = useState(false)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  function criar() {
    setErro(null)
    startTransition(async () => {
      // `estilo` vai 'grande' e fica inerte no banco: o carrossel desenha todas
      // as logos do mesmo tamanho, então não há formato a escolher aqui.
      const r = await criarLinkBio(nome, url, logo, 'marca', 'grande')
      if (r?.error) {
        setErro(
          r.error === 'url_invalida'
            ? t('urlInvalida')
            : r.error === 'titulo_vazio'
              ? t('tituloVazio')
              : r.error === 'logo_obrigatoria'
                ? t('logoObrigatoria')
                : r.error
        )
        return
      }
      if (r?.link) setItens((atual) => [...atual, r.link as MarcaBio])
      setNome('')
      setUrl('')
      setLogo(null)
      setAberto(false)
    })
  }

  /**
   * Abre o modal com os campos em branco.
   *
   * Limpar na ABERTURA, e não ao fechar: quem cancela no meio pode ter fechado
   * sem querer, e reabrir devolvendo o formulário vazio seria perder o que já
   * tinha sido digitado por um clique fora. Aqui o vazio é escolha de quem
   * pediu uma marca nova.
   */
  function abrirNovo() {
    setNome('')
    setUrl('')
    setLogo(null)
    setErro(null)
    setAberto(true)
  }

  function handleRemover(id: string) {
    setItens((atual) => atual.filter((m) => m.id !== id))
    startTransition(async () => {
      await removerLinkBio(id)
    })
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const de = itens.findIndex((m) => m.id === active.id)
    const para = itens.findIndex((m) => m.id === over.id)
    const nova = arrayMove(itens, de, para)
    setItens(nova)

    // Só os ids DESTA lista. `reordenarLinksBio` grava `ordem` pelo índice do
    // array, e a consulta da página ordena dentro de cada tipo — links e
    // marcas compartilham a numeração sem nunca disputarem a mesma fila.
    startTransition(async () => {
      await reordenarLinksBio(nova.map((m) => m.id))
    })
  }

  return (
    <div className="flex flex-col gap-3">
      {/* O interruptor mora DENTRO do cartão, e não na barra da seção como os
          outros: esta seção é recolhível (`<details>`), e um switch no
          cabeçalho abriria e fecharia o bloco a cada clique. É também a mesma
          regra do estilo dos logos, que vive dentro do bloco de redes: é o
          desenho DESTA fileira, e quem vem mexer nas marcas é quem repara
          nele. */}
      <div className="flex items-center justify-between gap-3 rounded-lg bg-secondary/50 px-3 py-2">
        <div className="min-w-0">
          <p className="text-xs font-medium text-foreground">{t('marcasNome')}</p>
          <p className="text-[11px] text-muted-foreground">{t('marcasNomeDesc')}</p>
        </div>
        <ToggleBio
          campo="bio_marcas_nome"
          inicial={mostrarNomeInicial}
          rotulo={t('marcasNome')}
        />
      </div>

      {itens.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t('marcasVazio')}</p>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">{t('editarMarcaDica')}</p>
          <DndContext
            // Fixo pelo mesmo motivo do `bio-links-dnd`: sem id, o dnd-kit
            // numera o contexto com um contador de módulo que anda em ritmos
            // diferentes no servidor e no cliente, e o `aria-describedby` das
            // alças chega trocado, quebrando a hidratação.
            id="bio-marcas-dnd"
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={itens.map((m) => m.id)} strategy={verticalListSortingStrategy}>
              <ul className="flex flex-col gap-2">
                {itens.map((marca) => (
                  <MarcaArrastavel
                    key={marca.id}
                    marca={marca}
                    userId={userId}
                    t={t}
                    cliquesDaMarca={cliques[marca.id] ?? 0}
                    onLogo={(capaUrl) => {
                      // Sem logo a marca sairia do ar sem sair da lista, então
                      // a action recusa — e o estado local só muda quando o
                      // servidor aceita.
                      startTransition(async () => {
                        const r = await atualizarLinkBio(marca.id, { capaUrl })
                        if (r?.error) {
                          setErro(
                            r.error === 'logo_obrigatoria' ? t('logoObrigatoria') : r.error
                          )
                          return
                        }
                        setErro(null)
                        setItens((atual) =>
                          atual.map((x) => (x.id === marca.id ? { ...x, capa_url: capaUrl } : x))
                        )
                      })
                    }}
                    onRemover={() => handleRemover(marca.id)}
                    onRenomear={(novo) => {
                      setItens((atual) =>
                        atual.map((x) => (x.id === marca.id ? { ...x, titulo: novo } : x))
                      )
                    }}
                    onSalvarNome={(novo) => {
                      startTransition(async () => {
                        await atualizarLinkBio(marca.id, { titulo: novo })
                      })
                    }}
                    onSalvarUrl={async (nova) => {
                      const r = await atualizarLinkBio(marca.id, { url: nova })
                      if (r?.error) return r.error === 'url_invalida' ? t('urlInvalida') : r.error
                      setItens((atual) =>
                        atual.map((x) => (x.id === marca.id ? { ...x, url: nova } : x))
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

      {/* O formulário mora num modal, e não aberto embaixo da lista. Dois
          campos vazios e um seletor de logo permanentes eram ruído fixo para
          uma ação ocasional — e, com a lista crescendo acima deles, o que se
          via ao rolar até o fim era sempre um formulário em branco. O botão
          anuncia a ação; o formulário só existe enquanto ela dura. */}
      <div className="border-t border-border pt-3">
        <button
          type="button"
          onClick={abrirNovo}
          className="flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
        >
          <Plus className="h-3.5 w-3.5" />
          {t('adicionarMarca')}
        </button>
      </div>

      <Modal
        aberto={aberto}
        aoFechar={() => setAberto(false)}
        titulo={t('adicionarMarca')}
        rotuloFechar={t('cancelar')}
      >
        <div className="flex items-start gap-2">
          <CapaPicker
            userId={userId}
            capaUrl={logo}
            proporcao={PROPORCAO_LOGO}
            largura={104}
            onChange={setLogo}
          />
          <div className="flex flex-1 flex-col gap-2">
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              maxLength={80}
              autoFocus
              placeholder={t('marcaNomePlaceholder')}
              className="h-9 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary"
            />
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              inputMode="url"
              placeholder={t('marcaUrlPlaceholder')}
              className="h-9 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary"
            />
          </div>
        </div>

        {erro && <p className="text-xs text-destructive">{erro}</p>}

        <ModalRodape>
          <button
            type="button"
            onClick={() => setAberto(false)}
            className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-foreground"
          >
            {t('cancelar')}
          </button>
          <button
            type="button"
            onClick={criar}
            disabled={pending || !nome.trim() || !url.trim() || !logo}
            title={!logo ? t('logoObrigatoria') : undefined}
            className="flex items-center justify-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
          >
            {pending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Plus className="h-3.5 w-3.5" />
            )}
            {t('adicionarMarca')}
          </button>
        </ModalRodape>
      </Modal>
    </div>
  )
}

function MarcaArrastavel({
  marca,
  userId,
  t,
  cliquesDaMarca,
  onLogo,
  onRemover,
  onRenomear,
  onSalvarNome,
  onSalvarUrl,
}: {
  marca: MarcaBio
  userId: string
  t: (chave: string) => string
  cliquesDaMarca: number
  onLogo: (url: string | null) => void
  onRemover: () => void
  onRenomear: (valor: string) => void
  onSalvarNome: (valor: string) => void
  /** Devolve a mensagem de erro, ou `null` se gravou. */
  onSalvarUrl: (valor: string) => Promise<string | null>
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: marca.id,
  })

  // A URL tem estado próprio, ao contrário do nome: ela pode ser RECUSADA
  // (`url_invalida`), e o campo precisa de um valor para onde voltar.
  const [url, setUrl] = useState(marca.url ?? '')
  const [erroUrl, setErroUrl] = useState<string | null>(null)

  const campo =
    'rounded-md -mx-1.5 px-1.5 py-0.5 bg-transparent outline-none transition-colors hover:bg-muted focus:bg-muted cursor-text'

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-2 rounded-lg border border-border bg-background p-2 ${
        isDragging ? 'opacity-60' : ''
      }`}
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab touch-none text-muted-foreground"
        aria-label={t('arrastar')}
      >
        <GripVertical className="h-4 w-4" />
      </button>

      {/* O mesmo seletor do formulário: trocar a logo é a edição mais provável
          desta lista (a marca refez a identidade visual), e mandar a pessoa
          apagar e recriar levaria junto os cliques já medidos. */}
      <CapaPicker
        userId={userId}
        capaUrl={marca.capa_url}
        proporcao={PROPORCAO_LOGO}
        largura={64}
        onChange={onLogo}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <input
          value={marca.titulo}
          onChange={(e) => onRenomear(e.target.value)}
          onBlur={(e) => onSalvarNome(e.target.value)}
          maxLength={80}
          aria-label={t('marcaNomePlaceholder')}
          className={`${campo} truncate text-sm font-medium text-foreground`}
        />
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onBlur={async () => {
            const valor = url.trim()
            if (!valor || valor === (marca.url ?? '')) return
            const erro = await onSalvarUrl(valor)
            if (erro) {
              setErroUrl(erro)
              setUrl(marca.url ?? '')
              return
            }
            setErroUrl(null)
          }}
          inputMode="url"
          aria-label={t('urlLink')}
          className={`${campo} truncate text-xs text-muted-foreground`}
        />
        {erroUrl && <span className="px-1.5 text-[11px] text-destructive">{erroUrl}</span>}
      </div>

      {/* O número só aparece depois do primeiro clique: um "0" fixo ao lado de
          cada logo transformaria a lista num placar de derrota para quem
          acabou de publicar. */}
      {cliquesDaMarca > 0 && (
        <span className="shrink-0 text-[11px] tabular-figures text-muted-foreground">
          {cliquesDaMarca}
        </span>
      )}

      <button
        onClick={onRemover}
        className="shrink-0 text-muted-foreground transition-colors hover:text-destructive"
        aria-label={t('remover')}
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </li>
  )
}
