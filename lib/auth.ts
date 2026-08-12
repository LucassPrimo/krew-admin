import 'server-only'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { cache } from 'react'
import { HEADER_ADMIN_AAL, HEADER_ADMIN_EMAIL, HEADER_ADMIN_UID } from './auth-headers'
import { sqlRo } from './db'
import { env } from './env'
import { criarClienteAuth } from './supabase'

export interface Admin {
  id: string
  email: string
  /** Quando o segundo fator foi verificado nesta sessão. Base do step-up. */
  mfaVerificadoEm: Date | null
}

/**
 * As camadas 2, 3, 4 e 5 do §3 do plano, em um lugar só.
 *
 * O proxy.ts já barra quem não passa nas camadas 2–4 antes da página existir —
 * mas este é o guard que vale, porque Server Action não passa por middleware da
 * mesma forma que navegação, e porque uma checagem de autorização que só existe
 * no middleware é uma checagem que uma refatoração futura remove sem ninguém
 * notar. Aqui é o chão.
 *
 * `cache()` do React: várias chamadas na mesma requisição (layout + página +
 * componentes) resolvem uma vez só.
 */
export const exigirAdmin = cache(async function exigirAdmin(): Promise<Admin> {
  // Camadas 2 e 4 — atalho. proxy.ts já validou as duas, NA MESMA
  // requisição, milissegundos atrás: se o header chegou com um uid e
  // `aal2`, reusar isso poupa duas idas de rede ao servidor de auth que
  // seriam idênticas às que o middleware já fez.
  //
  // O atalho só existe enquanto o header existir. Sem ele — middleware
  // ausente num teste, um deploy que não passa por ele, uma refatoração
  // futura que pare de setá-lo — cai no `else`, que revalida as duas
  // camadas do zero, exatamente como antes desta otimização. Nenhuma
  // garantia de segurança deste guard depende do atalho: ele só evita
  // trabalho repetido quando o trabalho já foi feito.
  const cabecalhos = await headers()
  const uidDoProxy = cabecalhos.get(HEADER_ADMIN_UID)
  const aalDoProxy = cabecalhos.get(HEADER_ADMIN_AAL)

  let userId: string
  let userEmail: string

  if (uidDoProxy && aalDoProxy === 'aal2') {
    userId = uidDoProxy
    userEmail = cabecalhos.get(HEADER_ADMIN_EMAIL) ?? ''
  } else {
    const supabase = await criarClienteAuth()

    // Camada 2 — sessão de verdade. `getUser()` e não `getSession()`: o
    // primeiro valida o token contra o servidor de auth; o segundo só lê o
    // cookie, que é exatamente o que um atacante controla.
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) redirect('/login')

    // Camada 4 — segundo fator verificado NESTA sessão, não "algum dia".
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
    if (aal?.currentLevel !== 'aal2') {
      // `nextLevel === 'aal2'` significa que existe fator cadastrado e falta
      // digitar o código. Se não existe fator, o destino é o cadastro.
      redirect(aal?.nextLevel === 'aal2' ? '/mfa' : '/mfa/cadastrar')
    }

    userId = user.id
    userEmail = user.email ?? ''
  }

  // Camada 3 — allowlist do ambiente. Quem controla a Vercel controla isto.
  // Redundante com o que o proxy.ts já checou no caminho rápido, mas custa
  // um `.includes()` em memória — sem rede, sem motivo pra pular.
  if (!env.ADMIN_USER_IDS.includes(userId)) {
    redirect('/negado')
  }

  // Camada 5 — a segunda lista, a que vive no banco. Precisa passar nas DUAS:
  // um invasor que consiga inserir em `platform_admins` ainda esbarra na
  // camada 3, e um que consiga editar o env da Vercel esbarra aqui. As duas
  // listas se comprometem por caminhos diferentes, que é o ponto. Nunca
  // pulada, nem no caminho rápido: o proxy.ts não tem conexão Postgres pra
  // fazer essa checagem, então ela só existe aqui.
  const [linha] = await sqlRo<{ existe: boolean }[]>`
    select exists (
      select 1 from public.platform_admins where user_id = ${userId}
    ) as existe
  `
  if (!linha?.existe) {
    redirect('/negado')
  }

  return {
    id: userId,
    email: userEmail,
    mfaVerificadoEm: await ultimaVerificacaoMfa(),
  }
})

/**
 * Quando o TOTP foi digitado pela última vez.
 *
 * Vem do claim `amr` (authentication methods references) do access token, que o
 * Supabase preenche com um registro por método e o horário de cada um. O token
 * é decodificado sem verificar assinatura — o que seria um erro grave se ele
 * fosse a base da autenticação, mas não é: `getUser()` acima já validou a
 * sessão contra o servidor de auth. Aqui só se lê um detalhe de uma sessão que
 * já foi provada legítima.
 */
async function ultimaVerificacaoMfa(): Promise<Date | null> {
  const supabase = await criarClienteAuth()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session?.access_token) return null

  try {
    const payload = JSON.parse(
      Buffer.from(session.access_token.split('.')[1], 'base64url').toString('utf8')
    ) as { amr?: { method: string; timestamp: number }[] }

    const totp = payload.amr
      ?.filter((m) => m.method === 'totp' || m.method === 'mfa/totp')
      .sort((a, b) => b.timestamp - a.timestamp)[0]

    return totp ? new Date(totp.timestamp * 1000) : null
  } catch {
    // Token em formato inesperado não deve derrubar a página — mas também não
    // deve passar por "verificado agora". Sem data, o step-up (§3.4) vai pedir
    // o código de novo, que é o lado seguro do erro.
    return null
  }
}

/** Janela do step-up: escrever exige TOTP digitado há menos de 15 minutos. */
export const JANELA_STEP_UP_MS = 15 * 60 * 1000

export function stepUpValido(admin: Admin): boolean {
  if (!admin.mfaVerificadoEm) return false
  return Date.now() - admin.mfaVerificadoEm.getTime() < JANELA_STEP_UP_MS
}
