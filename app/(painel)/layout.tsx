import { Shell, type Contadores } from '@/components/shell'
import { exigirAtor } from '@/lib/auth'
import { dbRO } from '@/lib/db'
import { escritaLigada } from '@/lib/env'

export const dynamic = 'force-dynamic'

/**
 * O layout do painel: autoriza e entrega a casca.
 *
 * A checagem definitiva (camada 5, incluindo `platform_admins`) mora aqui,
 * antes de qualquer página renderizar — o proxy já barrou o óbvio na borda, mas
 * autorização vive junto de quem lê o dado.
 *
 * Os contadores dos badges são consultados aqui, uma vez por navegação, e
 * descem prontos para a casca. É de propósito que a barra lateral não busque
 * nada: ela é Client Component, e dado do produto não deve atravessar essa
 * fronteira só para pintar um número.
 */
export default async function LayoutPainel({ children }: { children: React.ReactNode }) {
  const ator = await exigirAtor()

  const [linha] = await dbRO<Contadores[]>`
    select
      (select count(*) from public.bio_ofertas where aceita_em is null)::int as "ofertasAbertas",
      (select count(*) from public.email_logs where status = 'failed')::int as "emailsComFalha"
  `

  return (
    <Shell email={ator.email} escritaLigada={escritaLigada} contadores={linha}>
      {children}
    </Shell>
  )
}
