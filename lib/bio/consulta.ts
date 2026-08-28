import { unstable_cache } from 'next/cache'
import { createClient } from '@supabase/supabase-js'

import type { BioData } from '@/lib/bio/tipos'
import { rebaixarBioParaFree } from '@/lib/plano'

/** Tag de invalidação da bio pública de um slug. Ver `getBioBySlug`. */
export function tagBio(slug: string) {
  return `bio:${slug}`
}

/**
 * Leitura pública da bio, cacheada por slug.
 *
 * Dois problemas, um mecanismo.
 *
 * O primeiro é medido: 100 visitas a `/@primo` disparavam 300 execuções de
 * `get_bio_by_slug` — três por visita, porque `generateViewport`,
 * `generateMetadata` e o componente da página rodam em passes de render
 * SEPARADOS. O `cache()` do React não resolve, ele vive dentro de um passe; e a
 * dedup automática do Next cobre `fetch`, por onde o supabase-js não passa.
 *
 * O segundo é o que importa no dia do lançamento: sem cache, cada visitante é
 * uma consulta. Com ele, a multidão inteira compartilha a mesma leitura e o
 * Postgres vê no máximo uma consulta por minuto por bio.
 *
 * Cliente próprio, SEM COOKIES, e isso é requisito e não estilo:
 * `lib/supabase/server.ts` chama `cookies()`, que é API dinâmica — usá-lo aqui
 * marcaria a página como dinâmica e mataria o ISR, que é justamente o que põe a
 * página na CDN. A chave anônima (e não a service role) mantém a leitura
 * honesta: esta função não consegue ler nada que um visitante não pudesse.
 *
 * `revalidate: 60` é a janela máxima de defasagem. Quem edita a bio não espera
 * por ela: as actions chamam `updateTag(tagBio(slug))` e a mudança aparece na
 * leitura seguinte.
 */
export function getBioBySlug(slug: string): Promise<BioData | null> {
  return unstable_cache(
    async (): Promise<BioData | null> => {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
      )
      const { data, error } = await supabase.rpc('get_bio_by_slug', { p_slug: slug })
      if (error || !data) return null
      // Dentro do cache, e não depois dele: o `pro` que decide o rebaixamento
      // vem da MESMA leitura, então guardar a bio já rebaixada não guarda
      // decisão nenhuma que a entrada não contenha. A volta do pagamento não
      // espera o minuto do `revalidate` — o webhook da Chargefy derruba esta tag
      // ao gravar a assinatura (ver `app/api/chargefy/webhook/route.ts`).
      return rebaixarBioParaFree(data as BioData)
    },
    ['bio-por-slug', slug],
    { tags: [tagBio(slug)], revalidate: 60 }
  )()
}
