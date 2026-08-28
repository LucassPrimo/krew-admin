import { createClient } from '@supabase/supabase-js'

import { env } from './env'

/**
 * Cliente com a chave de serviço. Ignora RLS e as policies do Storage.
 *
 * É a credencial mais poderosa que o painel toca, então mora num arquivo só e
 * lança uma mensagem clara quando a chave falta — em vez de falhar lá adiante
 * com um erro do SDK que não diz o que fazer.
 */
export function clienteAdmin() {
  if (!env.ADMIN_SUPABASE_SERVICE_KEY) {
    throw new Error(
      'ADMIN_SUPABASE_SERVICE_KEY não está definida. ' +
        'Criar conta, enviar convite e subir imagem passam pela Admin API, que não existe em SQL.',
    )
  }
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.ADMIN_SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
