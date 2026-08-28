import createNextIntlPlugin from 'next-intl/plugin'
import type { NextConfig } from 'next'

// As telas de bio vieram do krew-app e usam `useTranslations`. Manter o
// next-intl é o que permite copiá-las sem tocar numa linha; sem cookie de
// idioma o `i18n/request.ts` já cai em pt-BR, que é o único idioma do painel.
const withNextIntl = createNextIntlPlugin('./i18n/request.ts')

/**
 * Cabeçalhos do painel.
 *
 * O `connect-src` lista só o host do Supabase porque é o único destino
 * legítimo de rede: se um dia algum código tentar mandar dado para outro
 * domínio, o navegador recusa. Numa tela que exibe CPF e dado bancário de
 * terceiros, isso vale mais do que parece.
 */
const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''

const dev = process.env.NODE_ENV !== 'production'

const csp = [
  "default-src 'self'",
  // Recharts injeta estilo inline; sem 'unsafe-inline' em style-src os gráficos
  // saem sem eixo. É a única frouxidão aqui, e é em ESTILO, não em script.
  "style-src 'self' 'unsafe-inline'",
  // Script fica estrito EM PRODUÇÃO: nenhum terceiro, nenhum inline.
  //
  // Em `next dev` a mesma política derruba o painel antes dele hidratar: o
  // bootstrap do Next é um punhado de scripts INLINE — um deles define o
  // `self.__next_r` que o runtime exige, e sem ele o app quebra com
  // "Expected a request ID to be defined for the document" — e o HMR do
  // Turbopack roda `eval`. A frouxidão vale só na máquina de quem desenvolve;
  // o header que vai para o ar continua o estrito.
  dev ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'" : "script-src 'self'",
  "img-src 'self' data: https:",
  // A prévia da oferta é um iframe da página pública de verdade. Sem esta
  // linha, `frame-src` herda o `default-src 'self'` e o navegador recusa o
  // iframe em silêncio — a moldura do celular apareceria vazia e nada no build
  // ou no servidor acusaria o problema.
  'frame-src https://bekrew.com https://www.bekrew.com https://app.bekrew.com',
  "font-src 'self' data:",
  // O websocket do HMR também é destino de rede, e só existe em dev.
  dev
    ? `connect-src 'self' ${supabaseHost} ws://localhost:* http://localhost:*`
    : `connect-src 'self' ${supabaseHost}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ')

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // O padrão do Next é 1MB. O bucket `capas` aceita 3MB, e o upload do
      // painel passa por server action (não vai direto do navegador, porque
      // aqui não existe sessão do app para a policy do bucket autorizar).
      // Sem esta linha, toda foto acima de 1MB falharia com um erro que não
      // diz o que aconteceu.
      bodySizeLimit: '6mb',
    },
  },

  // Source map de produção entregaria o código do painel inteiro a quem abrisse
  // o devtools. Não há motivo para isso existir aqui.
  productionBrowserSourceMaps: false,

  // Sem analytics de terceiro, nem o da Vercel: mediria comportamento sobre
  // telas com PII.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'no-referrer' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
        ],
      },
    ]
  },
}

export default withNextIntl(nextConfig)
