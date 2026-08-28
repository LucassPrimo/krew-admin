import createNextIntlPlugin from 'next-intl/plugin'
import type { NextConfig } from 'next'

// As telas de bio vieram do krew-app e usam `useTranslations`. Manter o
// next-intl é o que permite copiá-las sem tocar numa linha; sem cookie de
// idioma o `i18n/request.ts` já cai em pt-BR, que é o único idioma do painel.
const withNextIntl = createNextIntlPlugin('./i18n/request.ts')

/**
 * Cabeçalhos do painel.
 *
 * O CSP NÃO mora mais aqui — ele é montado por requisição em `proxy.ts`,
 * porque precisa de um nonce novo a cada resposta. O que ficou neste arquivo
 * são os cabeçalhos fixos, que não dependem da requisição.
 *
 * Por que a mudança: o CSP estático trazia `script-src 'self'` em produção, e
 * isso derrubava o painel inteiro no ar — tela preta, sem erro visível. O
 * `<body>` que o Next 16 entrega não tem conteúdo: a página é construída por
 * uma dezena de `<script>` INLINE, e `'self'` bloqueia todos eles. Em `next
 * dev` o problema não aparecia porque a política de desenvolvimento abria
 * `'unsafe-inline'` — a frouxidão de dev escondia o defeito de produção, que é
 * o pior lugar para uma diferença entre os dois ambientes.
 */

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
