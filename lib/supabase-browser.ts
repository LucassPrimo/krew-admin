'use client'

import { createBrowserClient } from '@supabase/ssr'

/**
 * Cliente do navegador — só para login e MFA.
 *
 * É o único ponto do painel em que código de cliente fala com a rede, e ele
 * fala apenas com o Supabase Auth. Nenhuma tabela de negócio passa por aqui:
 * todo dado do produto é lido no servidor, pelos roles RO/RW.
 */
export function supabaseBrowser() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}
