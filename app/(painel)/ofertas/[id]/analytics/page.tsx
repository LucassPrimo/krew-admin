import Link from 'next/link'
import { notFound } from 'next/navigation'
import { z } from 'zod'
import { exigirAtor } from '@/lib/auth'
import { dbRO } from '@/lib/db'
import { AnalyticsAdmin } from '@/components/bio/analytics/admin'

export const dynamic = 'force-dynamic'

export default async function Analytics({ params, searchParams }: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ periodo?: string; dias?: string }>
}) {
  await exigirAtor()
  const { id } = await params
  if (!z.uuid().safeParse(id).success) notFound()
  const busca = await searchParams
  const periodo = busca.periodo === 'hoje' ? 'hoje'
    : busca.periodo === '7d' || (!busca.periodo && busca.dias === '7') ? '7d' : '30d'
  const [pagina] = await dbRO<{ id: string; org_id: string; user_id: string; slug: string }[]>`
    select pp.id, pp.org_id, pp.user_id, pp.slug from public.proposal_pages pp join public.bio_ofertas o on o.page_id = pp.id where pp.id = ${id}
  `
  if (!pagina) notFound()
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-medium">Analytics · @{pagina.slug}</h1>
        <Link href={`/ofertas/${id}`} className="text-sm text-texto-fraco hover:text-texto">voltar</Link>
      </div>
      <AnalyticsAdmin creator={pagina} periodo={periodo} mostrarTodasCidades={true} />
    </>
  )
}
