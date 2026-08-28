/**
 * Hosts públicos do produto, em um lugar só.
 *
 * O literal `app.bekrew.com` estava copiado em três componentes diferentes
 * (`public-link-card`, `copy-link-button`, `tour-provider`). Trocar de domínio
 * significava caçar strings — e a página de bio (`/@handle`) vai justamente
 * morar num host diferente das outras.
 *
 * `BIO_HOST` é o domínio RAIZ de propósito: é o link que o criador digita em
 * voz alta e cola no Instagram, e `app.` no meio disso só atrapalha.
 *
 * `bekrew.com` é outro projeto na Vercel (a landing, repo `krew-landing`).
 * Quem serve `/@handle` continua sendo ESTE app — a landing só reescreve
 * `/@:handle` para cá, sem redirecionar, para a URL na barra de endereços
 * continuar sendo `bekrew.com`. Duas coisas fazem esse proxy funcionar e as
 * duas moram em `next.config.mjs`: `assetPrefix` (senão o navegador procura o
 * CSS em `bekrew.com/_next` e não acha nada) e `serverActions.allowedOrigins`
 * (senão o Next rejeita a action por Origin diferente do Host).
 */

export const APP_HOST = 'app.bekrew.com'

export const BIO_HOST = 'bekrew.com'

/** URL absoluta da página de bio. Sempre https — este link vai para fora. */
export function bioUrl(slug: string) {
  return `https://${BIO_HOST}/@${slug}`
}

/** Como o link de bio é EXIBIDO na UI (sem protocolo, mais curto de ler). */
export function bioUrlDisplay(slug: string) {
  return `${BIO_HOST}/@${slug}`
}

/** URL absoluta da página de propostas. */
export function publiUrl(slug: string) {
  return `https://${APP_HOST}/publi/${slug}`
}
