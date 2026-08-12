import 'server-only'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { env } from './env'

/**
 * O Supabase aqui serve para UMA coisa: dizer quem é você e se você passou pelo
 * segundo fator. Nenhum dado do produto é lido por este cliente.
 *
 * A leitura de dados vai por `lib/db.ts` (role `krew_admin_ro`), e a escrita
 * por `lib/mutate.ts` (role `krew_admin_rw`). Manter identidade e dados em
 * caminhos separados é o que permite dizer, com precisão, o que cada
 * credencial alcança se vazar: esta chave anon aqui não lê nada além do que
 * qualquer visitante do app já leria.
 */
export async function criarClienteAuth() {
  const cookieStore = await cookies()

  return createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (paraDefinir) => {
        try {
          paraDefinir.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, {
              ...options,
              httpOnly: true,
              secure: process.env.NODE_ENV === 'production',
              // `strict`, não `lax`: nenhuma navegação vinda de fora deve
              // chegar aqui já autenticada. Não existe link legítimo de outro
              // site para dentro deste painel.
              sameSite: 'strict',
            })
          )
        } catch {
          // Server Component não pode escrever cookie. O refresh de sessão
          // acontece no proxy.ts, que pode — então engolir aqui é correto.
        }
      },
    },
  })
}
