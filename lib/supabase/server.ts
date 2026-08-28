import { createClient as criarCliente } from '@supabase/supabase-js'

import { alvoAtual } from '@/lib/alvo'
import { env } from '@/lib/env'

/**
 * O cliente que as telas e actions COPIADAS do krew-app recebem.
 *
 * Lá este arquivo devolve um cliente com a sessão do criador, e tudo que ele
 * faz passa pela RLS daquele usuário. Aqui não existe sessão do criador — a
 * conta da oferta não tem nem senha ainda. Então o cliente é o de serviço, que
 * ignora RLS, com UMA troca: `auth.getUser()` responde o dono da oferta.
 *
 * É essa troca que faz o código copiado funcionar sem ser reescrito. As
 * dezenas de `const { data: { user } } = await supabase.auth.getUser()`
 * espalhadas por `app/actions/bio.ts` e `lib/org.ts` continuam lendo "o dono
 * desta bio" — só que agora o dono é quem o cookie de alvo aponta, validado
 * contra `bio_ofertas`.
 *
 * O que se perde: a RLS deixa de ser a rede de proteção, porque a chave de
 * serviço passa por cima dela. O que segura o lugar dela é o `alvoAtual()`,
 * que só resolve para páginas de oferta — e o fato de o painel inteiro estar
 * atrás de duas listas de admin e do 2FA.
 */
export async function createClient() {
  const alvo = await alvoAtual()

  if (!env.ADMIN_SUPABASE_SERVICE_KEY) {
    throw new Error(
      'ADMIN_SUPABASE_SERVICE_KEY não está definida — a edição de bio no painel depende dela.',
    )
  }

  const cliente = criarCliente(env.NEXT_PUBLIC_SUPABASE_URL, env.ADMIN_SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // Proxy em vez de espalhar o id por parâmetro: assim `.from()`, `.storage` e
  // `.rpc` seguem sendo o cliente de verdade, e só a pergunta "quem é o
  // usuário" muda de resposta.
  return new Proxy(cliente, {
    get(alvoProxy, prop, receiver) {
      if (prop === 'auth') {
        return {
          getUser: async () => ({
            data: { user: alvo ? { id: alvo.userId } : null },
            error: null,
          }),
          getSession: async () => ({ data: { session: null }, error: null }),
        }
      }
      return Reflect.get(alvoProxy, prop, receiver)
    },
  }) as typeof cliente
}
