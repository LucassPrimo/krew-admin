import Link from 'next/link'
import { notFound } from 'next/navigation'

import { Aviso, Badge } from '@/components/ui'
import { escritaLigada } from '@/lib/env'
import { ROTULO, lerLead, notasDoLead, ofertasSemLead, type Estagio } from '@/lib/crm'
import { Ficha } from './ficha'

export const dynamic = 'force-dynamic'

const TOM: Record<Estagio, 'neutro' | 'ok' | 'aviso' | 'perigo'> = {
  novo: 'neutro', contatado: 'neutro', negociando: 'aviso',
  oferta_criada: 'aviso', convite_enviado: 'aviso', aceito: 'ok', perdido: 'perigo',
}

/**
 * A ficha do lead: quem é, em que pé está e tudo que já foi conversado.
 *
 * As três consultas vão juntas porque a tela não desenha sem as três — a lista
 * de ofertas livres inclusive, que é o que permite vincular uma bio montada
 * antes de o lead existir.
 */
export default async function FichaDoLead({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const lead = await lerLead(id)
  if (!lead) notFound()

  const [notas, ofertas] = await Promise.all([notasDoLead(id), ofertasSemLead()])

  return (
    <div className="max-w-3xl">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-medium">{lead.nome}</h1>
          <Badge tom={TOM[lead.estagioEfetivo]}>{ROTULO[lead.estagioEfetivo]}</Badge>
        </div>
        <Link href="/crm" className="text-sm text-texto-fraco hover:text-texto">
          voltar
        </Link>
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
