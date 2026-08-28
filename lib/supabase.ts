import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

import { env } from './env'

/**
 * Cliente Supabase para AUTENTICAÇÃO apenas — login, MFA, sessão.
 *
 * Não é por aqui que o painel lê dado do produto: isso é `lib/db.ts`, com os
 * roles RO/RW. A separação importa porque este cliente carrega a sessão do
 * navegador, e sessão de navegador é a coisa que um XSS rouba. Ele nunca toca
 * numa tabela de negócio.
 */
export async function supabaseAuth() {
  const jar = await cookies()

  return createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => jar.getAll(),
      setAll: (lista) => {
        try {
          for (const { name, value, options } of lista) {
            // Sem `httpOnly`: o cliente de navegador precisa ler estes
            // cookies para o fluxo de MFA funcionar (ver a nota no proxy.ts).
            // `lax` em vez de `strict` porque o link do convite de e-mail entra
            // por navegação de outro domínio — com `strict` o cookie não
            // viajaria junto e a volta cairia no login.
            jar.set(name, value, {
              ...options,
              secure: process.env.NODE_ENV === 'production',
              sameSite: 'lax',
            })
          }
        } catch {
          // Server Component não pode escrever cookie. O refresh de token
          // acontece no proxy (middleware), que pode — aqui a falha é esperada
          // e silenciar é o comportamento correto.
        }
      },
    },
  })
}
