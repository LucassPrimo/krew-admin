import { describe, expect, it } from 'vitest'

import { normalizarSlug } from '../handle'

/**
 * O handle é o que ENDEREÇA a ação — e, como o selo dispensa o código do
 * autenticador, também é o que confirma a pessoa. Então o que esta função
 * aceita e o que ela recusa é a regra que importa testar aqui.
 */
describe('normalizarSlug', () => {
  it('aceita o handle do jeito que ele chega na mão', () => {
    expect(normalizarSlug('fulano')).toBe('fulano')
    expect(normalizarSlug('@fulano')).toBe('fulano')
    expect(normalizarSlug('  @Fulano  ')).toBe('fulano')
    expect(normalizarSlug('bekrew.com/@fulano')).toBe('fulano')
    expect(normalizarSlug('https://bekrew.com/@fulano')).toBe('fulano')
    expect(normalizarSlug('https://bekrew.com/@fulano?utm=x')).toBe('fulano')
  })

  it('recusa o que não é handle, em vez de procurar lixo no banco', () => {
    expect(normalizarSlug('')).toBeNull()
    expect(normalizarSlug('   ')).toBeNull()
    expect(normalizarSlug('@')).toBeNull()
    expect(normalizarSlug('fulano da silva')).toBeNull()
    expect(normalizarSlug("fulano'; drop table --")).toBeNull()
  })
})
