import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { HEADER_ADMIN_AAL, HEADER_ADMIN_EMAIL, HEADER_ADMIN_UID } from '@/lib/auth-headers'

/**
 * Camadas 2 a 4 do §3 do plano, mais CSP e expiração de sessão.
 *
 * O que este arquivo NÃO faz: consultar `platform_admins` (camada 5). Middleware
 * roda no edge, sem conexão Postgres — e mesmo que rodasse, a camada 5 tem que
 * existir do lado do servidor de qualquer forma, porque Server Action não
 * atravessa este caminho. Aqui é o filtro grosso, rápido, que evita chegar a
 * renderizar página para quem não tem o que fazer aqui. O filtro fino é
 * `exigirAdmin()`.
 *
 * Nenhum import de `lib/db.ts` ou `lib/auth.ts`: os dois puxam o driver do
 * Postgres, que não existe no runtime do middleware — o import derrubaria toda
 * requisição.
 */

const PUBLICAS = ['/login', '/negado', '/auth/callback']

/** §3.4 — 15 min de ociosidade, 8 h absolutas. */
const OCIOSIDADE_MS = 15 * 60 * 1000
const ABSOLUTA_MS = 8 * 60 * 60 * 1000

const COOKIE_ATIVIDADE = 'krew_admin_atividade'
const COOKIE_INICIO = 'krew_admin_inicio'

function montarCsp(nonce: string, supabaseUrl: string) {
  const dev = process.env.NODE_ENV !== 'production'
  return [
    "default-src 'self'",
    // 'strict-dynamic' faz o navegador confiar no que o script com nonce
    // carregar, e ignorar a allowlist de hosts — é o que permite um CSP sem
    // 'unsafe-inline' funcionar com o carregamento por chunks do Next.
    // 'unsafe-eval' só em dev: o hot reload precisa, produção não.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' ${dev ? "'unsafe-eval'" : ''}`,
    // Estilo inline continua liberado: o Next injeta CSS crítico inline no
    // HTML, e não há nonce para ele. É a única frouxidão do CSP, e a de menor
    // consequência — CSS não executa código.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    // O painel só fala com ele mesmo e com o auth da Supabase. Um script
    // injetado não tem para onde mandar o que roubou.
    `connect-src 'self' ${supabaseUrl}${dev ? ' ws: wss:' : ''}`,
    "frame-ancestors 'none'",
    "form-action 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    'upgrade-insecure-requests',
  ]
    .filter(Boolean)
    .join('; ')
}

export default async function middleware(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64')
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const csp = montarCsp(nonce, supabaseUrl)

  const headersDaRequisicao = new Headers(request.headers)
  // O Next lê este header e repassa o nonce para os próprios scripts que injeta.
  headersDaRequisicao.set('x-nonce', nonce)
  headersDaRequisicao.set('Content-Security-Policy', csp)

  let resposta = NextResponse.next({ request: { headers: headersDaRequisicao } })
  resposta.headers.set('Content-Security-Policy', csp)

  const supabase = createServerClient(
    supabaseUrl,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (paraDefinir) => {
          paraDefinir.forEach(({ name, value }) => request.cookies.set(name, value))
          resposta = NextResponse.next({ request: { headers: headersDaRequisicao } })
          resposta.headers.set('Content-Security-Policy', csp)
          paraDefinir.forEach(({ name, value, options }) =>
            resposta.cookies.set(name, value, {
              ...options,
              httpOnly: true,
              secure: process.env.NODE_ENV === 'production',
              sameSite: 'strict',
            })
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl
  const ehPublica = PUBLICAS.some((p) => pathname === p || pathname.startsWith(p + '/'))

  if (!user) {
    if (ehPublica) return resposta
    // Sem `?next=`: este painel não tem link compartilhável, e um parâmetro de
    // redirecionamento é superfície de open redirect sem nenhum ganho aqui.
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // ---------------------------------------------------------------
  // Expiração de sessão (§3.4). Notebook aberto no café não vira acesso
  // permanente ao banco de todo mundo.
  // ---------------------------------------------------------------
  if (!ehPublica) {
    const agora = Date.now()
    const inicio = Number(request.cookies.get(COOKIE_INICIO)?.value) || agora
    const atividade = Number(request.cookies.get(COOKIE_ATIVIDADE)?.value) || agora

    const expirouPorTempo = agora - inicio > ABSOLUTA_MS
    const expirouPorOcio = agora - atividade > OCIOSIDADE_MS

    if (expirouPorTempo || expirouPorOcio) {
      // `signOut` de verdade, não só apagar cookie: o refresh token precisa
      // morrer no servidor, senão a sessão continua válida para quem tiver
      // copiado o cookie.
      await supabase.auth.signOut()
      const login = new URL('/login', request.url)
      login.searchParams.set('motivo', expirouPorTempo ? 'limite' : 'ocio')
      const saida = NextResponse.redirect(login)
      saida.cookies.delete(COOKIE_ATIVIDADE)
      saida.cookies.delete(COOKIE_INICIO)
      return saida
    }

    const opcoesCookie = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict' as const,
      path: '/',
    }
    resposta.cookies.set(COOKIE_ATIVIDADE, String(agora), opcoesCookie)
    if (!request.cookies.get(COOKIE_INICIO)) {
      resposta.cookies.set(COOKIE_INICIO, String(inicio), opcoesCookie)
    }
  }

  // ---------------------------------------------------------------
  // Camadas 3 e 4. A camada 5 (banco) é do `exigirAdmin()`.
  // ---------------------------------------------------------------
  const permitidos = (process.env.ADMIN_USER_IDS ?? '').split(',').map((s) => s.trim())
  if (!permitidos.includes(user.id)) {
    return NextResponse.redirect(new URL('/negado', request.url))
  }

  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  const precisaMfa = aal?.currentLevel !== 'aal2'
  const jaEstaNoFluxoMfa = pathname.startsWith('/mfa')

  if (precisaMfa && !jaEstaNoFluxoMfa) {
    return NextResponse.redirect(
      new URL(aal?.nextLevel === 'aal2' ? '/mfa' : '/mfa/cadastrar', request.url)
    )
  }
  // Com o segundo fator já verificado, ficar no fluxo de MFA não faz sentido.
  if (!precisaMfa && jaEstaNoFluxoMfa) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  // ---------------------------------------------------------------
  // Passa a identidade já validada para `exigirAdmin()`, para ele não
  // repetir as mesmas duas chamadas de rede ao servidor de auth que este
  // middleware acabou de fazer. Só chega até aqui quem passou nas camadas 2,
  // 3 e 4 — por isso este é o ÚNICO lugar do arquivo que escreve estes
  // headers, e sempre com `.set()`: qualquer valor que o cliente tenha
  // mandado com o mesmo nome é substituído, nunca somado.
  //
  // Isto reintroduz a dependência que o comentário de lib/auth.ts avisa
  // sobre — mas com uma rede de segurança: se o header não chegar (deploy
  // sem este middleware na frente, teste que pula o proxy, refatoração
  // futura que pare de setá-lo aqui), `exigirAdmin()` cai de volta a
  // revalidar tudo do zero. O atalho é só isso, um atalho — nenhuma garantia
  // de segurança depende dele existir.
  headersDaRequisicao.set(HEADER_ADMIN_UID, user.id)
  headersDaRequisicao.set(HEADER_ADMIN_EMAIL, user.email ?? '')
  headersDaRequisicao.set(HEADER_ADMIN_AAL, aal?.currentLevel ?? '')

  const respostaFinal = NextResponse.next({ request: { headers: headersDaRequisicao } })
  respostaFinal.headers.set('Content-Security-Policy', csp)
  for (const cookie of resposta.cookies.getAll()) {
    respostaFinal.cookies.set(cookie)
  }
  return respostaFinal
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|ico|webp)$).*)'],
}
