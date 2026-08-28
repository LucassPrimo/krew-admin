'use client'

import { ChevronDown, ChevronUp, ImageOff, Plus, Trash2 } from 'lucide-react'

import type { EstiloItem } from '@/lib/bio/tipos'

/**
 * A lista de links, no formato do produto: um card por link, com a arte à
 * esquerda.
 *
 * Era um textarea de "Título | url" por linha. Funcionava enquanto o link
 * tinha dois campos; quando a importação passou a trazer a CAPA, um formato de
 * uma linha só deixou de dar conta — e inventar um terceiro separador seria
 * pedir para alguém colar uma URL com barra vertical dentro e quebrar tudo.
 *
 * A miniatura não é enfeite: na página pública o formato do card sai do par
 * (estilo, capa) — link COM capa vira card grande, link SEM capa vira botão.
 * Ver a miniatura vazia aqui é ver que aquele link vai sair como botão lá.
 */
export type LinkEditavel = {
  /** Presente = link que já existe no banco. Ausente = ainda vai nascer. */
  id?: string
  titulo: string
  url: string
  capaUrl: string | null
  estilo: EstiloItem
}

export function ListaLinks({
  links, aoMudar,
}: {
  links: LinkEditavel[]
  aoMudar: (links: LinkEditavel[]) => void
}) {
  function alterar(i: number, campo: 'titulo' | 'url' | 'capaUrl', valor: string) {
    aoMudar(links.map((l, j) => (j === i ? { ...l, [campo]: campo === 'capaUrl' ? valor || null : valor } : l)))
  }

  function trocarEstilo(i: number, estilo: EstiloItem) {
    aoMudar(links.map((l, j) => (j === i ? { ...l, estilo } : l)))
  }

  function mover(i: number, delta: number) {
    const j = i + delta
    if (j < 0 || j >= links.length) return
    const copia = [...links]
    ;[copia[i], copia[j]] = [copia[j], copia[i]]
    aoMudar(copia)
  }

  const campo =
    'h-8 w-full rounded-md border border-border bg-background px-2 text-sm outline-none focus:border-primary'

  return (
    <div className="flex flex-col gap-2">
      {links.length === 0 && (
        <p className="text-xs text-muted-foreground">
          Nenhum link ainda. Importe de um link.me ou adicione um abaixo.
        </p>
      )}

      {links.map((link, i) => (
        <div key={i} className="flex items-start gap-2 rounded-lg border border-border bg-background p-2">
          <div className="flex flex-col gap-0.5 pt-1">
            <button type="button" onClick={() => mover(i, -1)} disabled={i === 0} title="Subir"
                    className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-25">
              <ChevronUp className="size-3.5" strokeWidth={2} />
            </button>
            <button type="button" onClick={() => mover(i, 1)} disabled={i === links.length - 1} title="Descer"
                    className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-25">
              <ChevronDown className="size-3.5" strokeWidth={2} />
            </button>
          </div>

          <div className="size-12 shrink-0 overflow-hidden rounded-md border border-border bg-muted">
            {link.capaUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={link.capaUrl} alt="" className="size-full object-cover" />
            ) : (
              <div className="flex size-full items-center justify-center text-muted-foreground/40"
                   title="Sem capa — este link sai como botão na página">
                <ImageOff className="size-4" strokeWidth={1.5} />
              </div>
            )}
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <input value={link.titulo} onChange={(e) => alterar(i, 'titulo', e.target.value)}
                   placeholder="Título" className={campo} />
            <input value={link.url} onChange={(e) => alterar(i, 'url', e.target.value)}
                   placeholder="https://…" className={`${campo} font-mono text-xs`} />
            <input value={link.capaUrl ?? ''} onChange={(e) => alterar(i, 'capaUrl', e.target.value)}
                   placeholder="URL da capa — vazio vira botão"
                   className={`${campo} font-mono text-xs`} />

            {/* Os dois formatos de card precisam de imagem — sem capa a
                página desenha botão, e oferecer "Card grande" ali seria
                mentir. "Botão" aparece sempre, porque agora ele é estilo de
                verdade: dá para pôr um link como botão SEM perder a arte, e
                voltar atrás depois. */}
            <div className="flex gap-1">
              {(link.capaUrl
                ? ([['grande', 'Card grande'], ['metade', 'Compacto'], ['botao', 'Botão']] as const)
                : ([['botao', 'Botão']] as const)
              ).map(([v, r]) => (
                <button
                  key={v} type="button" onClick={() => trocarEstilo(i, v)}
                  className={`rounded-full border px-2.5 py-0.5 text-[11px] ${
                    link.estilo === v
                      ? 'border-primary text-primary'
                      : 'border-border text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <button type="button" onClick={() => aoMudar(links.filter((_, j) => j !== i))}
                  title="Remover" aria-label="Remover"
                  className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-destructive">
            <Trash2 className="size-3.5" strokeWidth={1.5} />
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={() => aoMudar([...links, { titulo: '', url: '', capaUrl: null, estilo: 'grande' }])}
        className="flex w-fit items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
      >
        <Plus className="size-3.5" />
        Adicionar link
      </button>
    </div>
  )
}
