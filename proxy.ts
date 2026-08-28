import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Camadas 2 a 4, na borda — antes de qualquer página renderizar.
 *
 * Este arquivo não substitui o `exigirAtor()` de cada página: ele é a primeira
 * porta, não a única. A checagem definitiva (incluindo a consulta a
 * `platform_admins`) mora no servidor de cada rota, porque middleware pode ser
 * contornado por caminhos que ninguém previu — e a regra de ouro é que a
 * autorização vive onde o dado é lido.
 *
 * O que ele faz que a página não faz: renova o token da sessão e escreve o
 * cookie. Server Component não consegue escrever cookie; aqui dá.
 */

const PUBLICAS = ['/login', '/negado', '/auth']

export async function proxy(request: NextRequest) {
  let resposta = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (lista) => {
          for (const { name, value } of lista) request.cookies.set(name, value)
          resposta = NextResponse.next({ request })
          for (const { name, value, options } of lista) {
            // NÃO force `httpOnly` aqui. O cliente de navegador do
            // @supabase/ssr guarda a sessão em cookie que o JAVASCRIPT precisa
            // ler — é assim que o fluxo de MFA (listFactors/challenge/verify)
            // enxerga a sessão. Marcá-los httpOnly faz o servidor continuar
            // vendo a sessão enquanto o navegador a perde: o login "funciona",
            // a tela do TOTP não acha fator nenhum e você volta para /login sem
            // nenhum erro aparecer. As opções que o Supabase manda em `options`
            // já são as corretas; só reforçamos o transporte.
            resposta.cookies.set(name, value, {
              ...options,
              secure: process.env.NODE_ENV === 'production',
              sameSite: 'lax',
            })
          }
        },
      },
    },
  )

  // `getUser()` e não `getSession()`: só o primeiro valida o token contra o
  // servidor de auth. `getSession` confia no cookie, que é justamente o que um
  // atacante controlaria.
  const { data } = await supabase.auth.getUser()
  const caminho = request.nextUrl.pathname

  if (PUBLICAS.some((p) => caminho.startsWith(p))) return resposta

  if (!data.user) {
    // O motivo viaja na URL para que voltar ao login pare de ser um mistério.
    // Sem isto, "sessão expirou", "sua conta não é admin" e "faltou o segundo
    // fator" produzem exatamente a mesma tela em branco.
    return NextResponse.redirect(new URL('/login?motivo=sessao', request.url))
  }

  // Camada 3 na borda. A lista da Vercel é a checagem barata: uma requisição
  // não autorizada não deve nem chegar a consultar o Postgres.
  const permitidos = (process.env.ADMIN_USER_IDS ?? '').split(',').map((s) => s.trim())
  if (!permitidos.includes(data.user.id)) {
    return NextResponse.redirect(new URL('/negado', request.url))
  }

  // Camada 4 — o TOTP desta sessão. As próprias telas de MFA ficam de fora,
  // senão o redirecionamento entraria em laço.
  if (!caminho.startsWith('/mfa')) {
    const { data: nivel } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
    if (nivel?.nextLevel === 'aal1') {
      return NextResponse.redirect(new URL('/mfa/cadastrar', request.url))
    }
    if (nivel?.currentLevel !== 'aal2') {
      return NextResponse.redirect(new URL('/mfa', request.url))
    }
  }

  // Abrir uma oferta marca qual é o alvo das telas de bio copiadas do produto.
  //
  // Três caminhos porque cada um cobre um momento: o CABEÇALHO vale no render
  // desta requisição (o cookie que acabou de ser criado só chega no próximo);
  // o COOKIE cobre navegações seguintes; e o `Referer` cobre as Server Actions,
  // que são requisições próprias e sabem de qual tela vieram.
  const oferta = caminho.match(/^\/ofertas\/([0-9a-f-]{36})$/i)?.[1]
  if (oferta) {
    const cabecalhos = new Headers(request.headers)
    cabecalhos.set('x-krew-alvo', oferta)
    resposta = NextResponse.next({ request: { headers: cabecalhos } })
    resposta.cookies.set('krew_admin_alvo', oferta, { path: '/', sameSite: 'lax' })
  }

  return resposta
}

export const config = {
  // Tudo o que é PÁGINA, inclusive a raiz — e nada que seja arquivo.
  //
  // A exclusão de extensões não é otimização: sem ela o matcher pegava
  // `/icon.svg` e `/krew-icon.svg` e devolvia um 307 para o login, então o
  // favicon e a marca da barra simplesmente não carregavam para quem ainda não
  // entrou. Um redirecionamento de autenticação em cima de um SVG público não
  // protege nada e quebra a própria tela de login.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt)$).*)',
  ],
}
