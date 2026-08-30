/**
 * O handle da página (`proposal_pages.slug`), normalizado.
 *
 * Mora sozinho, e NÃO dentro de `lib/verificado.ts`, pelo mesmo motivo que
 * `lib/crm-tipos.ts` mora fora de `lib/crm.ts`: quem importa o banco importa
 * `lib/env.ts` junto, e `env.ts` derruba o processo quando falta variável.
 * Regra pura em arquivo puro é regra que dá para testar sem um Postgres e sem
 * meio ambiente de produção montado.
 */

/**
 * O que a pessoa digita → o slug que está no banco.
 *
 * Aceita `fulano`, `@fulano`, `bekrew.com/@fulano` e a URL inteira, porque na
 * prática você cola o que estiver na mão — normalmente a URL que o criador
 * mandou. Devolve `null` quando não sobra nada que possa ser um handle: a tela
 * transforma isso em "escreva o handle", em vez de sair procurando string
 * vazia no banco.
 */
export function normalizarSlug(entrada: string): string | null {
  let texto = entrada.trim().toLowerCase()
  if (!texto) return null

  // Tira protocolo e domínio, se vieram. O que interessa é o último pedaço.
  texto = texto.replace(/^https?:\/\//, '')
  if (texto.includes('/')) texto = texto.split('/').filter(Boolean).pop() ?? ''

  texto = texto.replace(/^@/, '').split('?')[0].trim()
  // O mesmo conjunto de caracteres que a criação de oferta aceita no handle.
  return /^[a-z0-9._-]+$/.test(texto) ? texto : null
}
