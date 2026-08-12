import type { NextConfig } from 'next'

/**
 * O CSP não mora aqui — ele precisa de um nonce por requisição, e header
 * estático não tem como gerar um. Fica em `proxy.ts`. O que sobra aqui são os
 * cabeçalhos que valem igual para toda resposta.
 */
const headers = [
  // Este painel não é conteúdo, é ferramenta. Nenhum buscador tem o que fazer
  // aqui, e "não aparecer em busca" é uma camada barata a mais.
  { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive, nosnippet' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  // Nem a URL do painel vaza para fora quando um link é clicado daqui.
  { key: 'Referrer-Policy', value: 'no-referrer' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  // Não existe motivo para este app pedir câmera, microfone ou localização.
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
  },
]

const nextConfig: NextConfig = {
  // Source map em produção entrega a estrutura interna do painel de graça a
  // quem abrir o DevTools.
  productionBrowserSourceMaps: false,
  poweredByHeader: false,

  // Um `any` esquecido numa query de escrita é exatamente o tipo de erro que
  // este projeto não pode se dar ao luxo de deployar. Build quebra.
  typescript: { ignoreBuildErrors: false },

  async headers() {
    return [{ source: '/:path*', headers }]
  },
}

export default nextConfig
