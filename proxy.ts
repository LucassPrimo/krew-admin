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

const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const dev = process.env.NODE_ENV !== 'production'

/**
 * O CSP do painel, montado por requisição.
 *
 * ---------------------------------------------------------------------------
 * Por que aqui e não em `next.config.ts`
 * ---------------------------------------------------------------------------
 * Ele já foi um cabeçalho fixo lá, com `script-src 'self'` em produção. Isso
 * derrubou o painel no ar: tela preta, nenhum erro na tela. O `<body>` que o
 * Next 16 entrega vem VAZIO — a página é montada por uma dezena de `<script>`
 * INLINE com o payload do React, e `'self'` bloqueia inline. Não é hidratação
 * que se perde, é o conteúdo inteiro.
 *
 * Em `next dev` nada disso aparecia, porque a política de desenvolvimento
 * abria `'unsafe-inline'` para o HMR do Turbopack funcionar. A frouxidão de
 * dev escondia o defeito de produção — que é o pior lugar possível para uma
 * diferença entre ambientes, porque só se descobre depois de publicar.
 *
 * ---------------------------------------------------------------------------
 * A saída não é afrouxar
 * ---------------------------------------------------------------------------
 * Pôr `'unsafe-inline'` em produção resolveria a tela preta e devolveria o
 * XSS: numa ferramenta que mostra CPF e dado bancário de terceiros, é troca
 * ruim. O nonce é o meio-termo que o Next suporta nativamente — um número
 * aleatório por resposta, que só os scripts DELE carregam.
 *
 * O Next descobre o nonce lendo o CSP das headers da REQUISIÇÃO (por isso ele
 * é escrito nos dois lados) e o carimba em cada `<script>` que emite.
 * `'strict-dynamic'` estende a permissão aos chunks que esses scripts
 * carregam, sem precisar listar caminho nenhum — e faz os navegadores que o
 * entendem ignorarem o `'self'`, que fica só de reserva para os que não.
 */
function montarCsp(nonce: string) {
  return [
    "default-src 'self'",
    // Recharts injeta estilo inline; sem 'unsafe-inline' em style-src os
    // gráficos saem sem eixo. É a única frouxidão aqui, e é em ESTILO.
    "style-src 'self' 'unsafe-inline'",
    // Em dev o Turbopack roda `eval` no HMR, e o nonce não alcança isso.
    dev
      ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
      : `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    "img-src 'self' data: https:",
    // A prévia da oferta é um iframe da página pública de verdade. Sem esta
    // linha, `frame-src` herda o `default-src 'self'` e o navegador recusa o
    // iframe em silêncio.
    'frame-src https://bekrew.com https://www.bekrew.com https://app.bekrew.com',
    "font-src 'self' data:",
    dev
      ? `connect-src 'self' ${supabaseHost} ws://localhost:* http://localhost:*`
      : `connect-src 'self' ${supabaseHost}`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ')
}

export async function proxy(request: NextRequest) {
  // `crypto.randomUUID` e não um contador: o nonce só vale se for
  // imprevisível. Repetido entre respostas, ele deixa de ser barreira.
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64')
  const csp = montarCsp(nonce)

  /**
   * Cada `NextResponse.next` daqui precisa levar o CSP na REQUISIÇÃO, senão o
   * Next não acha o nonce e emite os scripts sem ele — de volta à tela preta.
   *
   * As headers são lidas de `request.headers` na hora da chamada, e não de um
   * retrato tirado no começo: o cliente do Supabase mexe em `request.cookies`
   * ao renovar a sessão, e essa mudança só chega adiante se a cópia for feita
   * DEPOIS dela.
   */
  const proximo = (extras?: Record<string, string>) => {
    const cabecalhos = new Headers(request.headers)
    cabecalhos.set('Content-Security-Policy', csp)
    for (const [k, v] of Object.entries(extras ?? {})) cabecalhos.set(k, v)
    const r = NextResponse.next({ request: { headers: cabecalhos } })
    r.headers.set('Content-Security-Policy', csp)
    return r
  }

  /** Redirecionamento não monta página, mas sai com a mesma política. */
  const irPara = (destino: string) => {
    const r = NextResponse.redirect(new URL(destino, request.url))
    r.headers.set('Content-Security-Policy', csp)
    return r
  }

  let resposta = proximo()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (lista) => {
          for (const { name, value } of lista) request.cookies.set(name, value)
          resposta = proximo()
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
    return irPara('/login?motivo=sessao')
  }

  // Camada 3 na borda. A lista da Vercel é a checagem barata: uma requisição
  // não autorizada não deve nem chegar a consultar o Postgres.
  const permitidos = (process.env.ADMIN_USER_IDS ?? '').split(',').map((s) => s.trim())
  if (!permitidos.includes(data.user.id)) {
    return irPara('/negado')
  }

  // Camada 4 — o TOTP desta sessão. As próprias telas de MFA ficam de fora,
  // senão o redirecionamento entraria em laço.
  if (!caminho.startsWith('/mfa')) {
    const { data: nivel } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
    if (nivel?.nextLevel === 'aal1') {
      return irPara('/mfa/cadastrar')
    }
    if (nivel?.currentLevel !== 'aal2') {
      return irPara('/mfa')
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
    resposta = proximo({ 'x-krew-alvo': oferta })
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
