import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AtSign, ChevronLeft, Mail, MessageCircle } from 'lucide-react'

import { Aviso } from '@/components/ui'
import { escritaLigada } from '@/lib/env'
import { lerLead, notasDoLead, ofertasSemLead } from '@/lib/crm'
import { Etapa } from '../etapa'
import { Ficha } from './ficha'

export const dynamic = 'force-dynamic'

/**
 * A ficha do lead: quem é, em que pé está e tudo que já foi conversado.
 *
 * O cabeçalho traz os três canais como LINK, e não como texto para copiar: a
 * ficha é aberta no meio de um follow-up, e o gesto seguinte a abri-la é
 * quase sempre falar com a pessoa.
 */

/** `(31) 99999-0000` vira `5531999990000` — o formato que o wa.me aceita. */
function linkWhatsapp(bruto: string): string {
  const digitos = bruto.replace(/\D/g, '')
  return `https://wa.me/${digitos.length <= 11 ? `55${digitos}` : digitos}`
}

export default async function FichaDoLead({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const lead = await lerLead(id)
  if (!lead) notFound()

  const [notas, ofertas] = await Promise.all([notasDoLead(id), ofertasSemLead()])

  const canal = 'flex items-center gap-1 text-xs text-texto-fraco hover:text-texto'

  return (
    <div className="max-w-5xl">
      <Link
        href="/crm"
        className="mb-3 inline-flex items-center gap-1 text-xs text-texto-fraco hover:text-texto"
      >
        <ChevronLeft className="size-3.5" strokeWidth={1.5} />
        CRM
      </Link>

      <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2">
        <h1 className="text-lg font-medium">{lead.nome}</h1>
        <Etapa estagio={lead.estagioEfetivo} />

        <span aria-hidden className="h-4 w-px bg-borda" />

        {lead.instagram && (
          <a href={`https://instagram.com/${lead.instagram}`} target="_blank" rel="noreferrer" className={canal}>
            <AtSign className="size-3.5" strokeWidth={1.5} />
            <span className="font-mono">{lead.instagram}</span>
          </a>
        )}
        {lead.whatsapp && (
          <a href={linkWhatsapp(lead.whatsapp)} target="_blank" rel="noreferrer" className={canal}>
            <MessageCircle className="size-3.5" strokeWidth={1.5} />
            {lead.whatsapp}
          </a>
        )}
        {lead.email && (
          <a href={`mailto:${lead.email}`} className={canal}>
            <Mail className="size-3.5" strokeWidth={1.5} />
            {lead.email}
          </a>
        )}
        {lead.fonte && (
          <span className="text-xs text-texto-fraco">via {lead.fonte}</span>
        )}
      </div>

      {!escritaLigada && (
        <div className="mb-4">
          <Aviso>
            A escrita está desligada neste deploy: dá para ler a ficha, não para
            alterá-la.
          </Aviso>
        </div>
      )}

      <Ficha lead={lead} notas={notas} ofertasLivres={ofertas} podeEscrever={escritaLigada} />
    </div>
  )
}
