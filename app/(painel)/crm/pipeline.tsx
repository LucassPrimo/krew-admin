'use client'

import { DndContext, useDraggable, useDroppable, type DragEndEvent } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { data, relativo } from '@/lib/format'
import {
  ESTAGIOS_MANUAIS, FUNIL, ROTULO, vencido, type Estagio, type EstagioManual, type Lead,
} from '@/lib/crm-tipos'
import { acaoMoverEstagioEmLote } from './acoes'

function CardLead({ lead }: { lead: Lead }) {
  const movel = ESTAGIOS_MANUAIS.includes(lead.estagioEfetivo as EstagioManual) && !lead.page_id
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: lead.id,
    data: { lead },
    disabled: !movel,
  })

  return (
    <article
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={`rounded-md border border-borda bg-painel p-3 transition-colors hover:border-borda-forte ${isDragging ? 'z-20 opacity-60 shadow-xl' : ''}`}
      {...attributes}
      {...listeners}
    >
      <Link
        href={`/crm/${lead.id}`}
        onPointerDown={(e) => e.stopPropagation()}
        className="block truncate text-sm font-medium hover:text-acento"
      >
        {lead.nome}
      </Link>
      <div className="mt-0.5 truncate font-mono text-[11px] text-texto-fraco">
        {lead.instagram ? `@${lead.instagram}` : lead.email ?? 'sem contato'}
      </div>
      {lead.fonte && <div className="mt-2 truncate text-[11px] text-texto-fraco">via {lead.fonte}</div>}
      <div
        className={`mt-2 text-[11px] ${vencido(lead) || !lead.proximo_contato ? 'text-aviso' : 'text-texto-fraco'}`}
        title={data(lead.proximo_contato)}
      >
        {lead.proximo_contato ? `Contato ${relativo(lead.proximo_contato)}` : 'Sem próxima ação'}
      </div>
      {!movel && <div className="mt-2 text-[10px] text-texto-fraco">etapa automática da oferta</div>}
    </article>
  )
}

function Coluna({ estagio, leads }: { estagio: Estagio; leads: Lead[] }) {
  const manual = ESTAGIOS_MANUAIS.includes(estagio as EstagioManual)
  const { setNodeRef, isOver } = useDroppable({ id: estagio, disabled: !manual })

  return (
    <section
      ref={setNodeRef}
      className={`rounded-lg border bg-fundo p-2 transition-colors ${isOver ? 'border-acento bg-acento/5' : 'border-borda'}`}
    >
      <div className="mb-2 flex items-center justify-between px-1">
        <h2 className="text-xs font-medium">{ROTULO[estagio]}</h2>
        <span className="text-[11px] tabular-nums text-texto-fraco">{leads.length}</span>
      </div>
      <div className="min-h-24 space-y-2">
        {leads.length === 0 && <p className="px-1 py-5 text-center text-[11px] text-texto-fraco">{manual ? 'solte aqui' : 'vazio'}</p>}
        {leads.map((lead) => <CardLead key={lead.id} lead={lead} />)}
      </div>
    </section>
  )
}

/**
 * Kanban operacional. Só as etapas manuais aceitam drop; oferta criada e
 * convite enviado continuam derivados do produto e não podem ser forjados.
 */
export function Pipeline({ leads, podeAgir = true }: { leads: Lead[]; podeAgir?: boolean }) {
  const router = useRouter()
  const [pendente, iniciar] = useTransition()
  const [mensagem, setMensagem] = useState<string | null>(null)
  const abertos = leads.filter((l) => l.estagioEfetivo !== 'perdido' && l.estagioEfetivo !== 'aceito')
  const colunas = FUNIL.filter((e) => e !== 'aceito')

  function soltar(evento: DragEndEvent) {
    const destino = evento.over?.id as EstagioManual | undefined
    const lead = evento.active.data.current?.lead as Lead | undefined
    if (!podeAgir || !lead || !destino || !ESTAGIOS_MANUAIS.includes(destino) || lead.estagioEfetivo === destino) return

    setMensagem(null)
    iniciar(async () => {
      const resultado = await acaoMoverEstagioEmLote([lead.id], destino)
      if (!resultado.ok) {
        setMensagem(resultado.erro)
        return
      }
      setMensagem(`${lead.nome} movido para ${ROTULO[destino]}.`)
      router.refresh()
    })
  }

  return (
    <DndContext onDragEnd={soltar}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-xs text-texto-fraco">
          Arraste entre as três primeiras etapas. Oferta criada e convite enviado avançam automaticamente.
        </p>
        {pendente && <span className="text-xs text-acento">salvando…</span>}
      </div>
      {mensagem && <p className="mb-3 rounded-md border border-borda bg-painel-2 px-3 py-2 text-xs">{mensagem}</p>}
      <div className="overflow-x-auto pb-2">
        <div className="grid min-w-[1080px] grid-cols-5 gap-3">
          {colunas.map((estagio) => (
            <Coluna key={estagio} estagio={estagio} leads={abertos.filter((l) => l.estagioEfetivo === estagio)} />
          ))}
        </div>
      </div>
    </DndContext>
  )
}
