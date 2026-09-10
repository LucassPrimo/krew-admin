import { renderToBuffer } from '@react-pdf/renderer'
import { z } from 'zod'

import { exigirAtor } from '@/lib/auth'
import { dbRO } from '@/lib/db'
import type { PainelBio } from '@/app/actions/bio-analytics'
import { RelatorioPdf } from '@/lib/analytics/pdf/relatorio'
import { janelaRelatorio, nomeArquivoPdf, periodoPdf } from '@/lib/analytics/pdf/dados'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const privado = { 'Cache-Control': 'private, no-store, max-age=0' }

export async function GET(request: Request, { params }: { params: Promise<{ pageId: string }> }) {
  // A URL é explícita: duas abas ou uma oferta aberta não mudam o destinatário.
  await exigirAtor()
  const { pageId } = await params
  const periodo = periodoPdf(new URL(request.url).searchParams.get('periodo'))
  if (!z.uuid().safeParse(pageId).success || !periodo) {
    return Response.json({ erro: 'Página ou período inválido.' }, { status: 400, headers: privado })
  }
  try {
    // A conta provisória das ofertas também possui página e eventos.
    const [pagina] = await dbRO<{ slug: string; nome: string | null; org_id: string; user_id: string }[]>`
      select pp.slug, coalesce(nullif(trim(concat_ws(' ', p.full_name, p.sobrenome)), ''), pp.slug) as nome,
             pp.org_id, pp.user_id
      from public.proposal_pages pp
      left join public.profiles p on p.id = pp.user_id
      where pp.id = ${pageId}
    `
    if (!pagina) return Response.json({ erro: 'Página não encontrada.' }, { status: 404, headers: privado })
    const janela = janelaRelatorio(periodo)
    const [resultado] = await dbRO<{ painel: PainelBio }[]>`
      select public.get_bio_painel(
        ${pagina.org_id}::uuid, ${pagina.user_id}::uuid, ${janela.desde}::timestamptz,
        ${janela.ate}::timestamptz, 30, true, 'America/Sao_Paulo'
      ) as painel
    `
    if (!resultado?.painel) throw new Error('analytics_indisponivel')
    const buffer = await renderToBuffer(RelatorioPdf({
      dados: { nome: pagina.nome || pagina.slug, slug: pagina.slug, periodo, ...janela, painel: resultado.painel },
    }))
    return new Response(new Uint8Array(buffer), {
      headers: {
        ...privado,
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${nomeArquivoPdf(pagina.slug, periodo, janela.ate)}"`,
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch {
    return Response.json({ erro: 'Não foi possível gerar o relatório. Tente novamente.' }, { status: 503, headers: privado })
  }
}
