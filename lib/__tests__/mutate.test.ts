import { describe, expect, it } from 'vitest'

import { coagir } from '../coerce'
import type { Campo } from '../registry'
import { REGISTRY, camposEditaveis } from '../registry'

/**
 * O executor decide o que vira SQL. Os testes aqui cobrem a coerção — o ponto
 * em que uma string de formulário vira valor de coluna — e as invariantes do
 * registry que o resto do painel assume como verdade.
 */

describe('coagir', () => {
  it('transforma vazio em null, não em string vazia', () => {
    expect(coagir({ tipo: 'text', editavel: true }, '   ')).toBeNull()
  })

  it('aceita número no formato que a pessoa digita e no que ela cola', () => {
    const campo = { tipo: 'dinheiro', editavel: true } as const
    expect(coagir(campo, '1.234,56')).toBe(1234.56)
    expect(coagir(campo, '1234.56')).toBe(1234.56)
  })

  it('respeita min e max declarados', () => {
    const campo = { tipo: 'inteiro', editavel: true, min: 0, max: 10 } as const
    expect(coagir(campo, '5')).toBe(5)
    expect(() => coagir(campo, '-1')).toThrow()
    expect(() => coagir(campo, '11')).toThrow()
  })

  it('recusa valor fora das opções do enum', () => {
    // `Campo` e não `as const`: `as const` deixaria `opcoes` readonly, que não
    // é o tipo que a coerção recebe em produção.
    const campo: Campo = { tipo: 'enum', editavel: true, opcoes: ['ativa', 'cancelada'] }
    expect(coagir(campo, 'ativa')).toBe('ativa')
    expect(() => coagir(campo, 'qualquer')).toThrow()
  })

  it('recusa uuid malformado', () => {
    const campo = { tipo: 'uuid', editavel: true } as const
    expect(() => coagir(campo, 'nao-e-uuid')).toThrow()
    expect(coagir(campo, '3f2504e0-4f89-11d3-9a0c-0305e82c3301')).toBe('3f2504e0-4f89-11d3-9a0c-0305e82c3301')
  })

  it('recusa JSON inválido em vez de gravar texto solto numa coluna jsonb', () => {
    const campo = { tipo: 'json', editavel: true } as const
    expect(() => coagir(campo, '{quebrado')).toThrow()
    expect(coagir(campo, '{"a":1}')).toEqual({ a: 1 })
  })
})

describe('invariantes do registry', () => {
  it('toda tabela declara a própria chave entre as colunas', () => {
    for (const [nome, mapa] of Object.entries(REGISTRY)) {
      expect(Object.hasOwn(mapa.colunas, mapa.chave), `${nome} sem a coluna-chave`).toBe(true)
    }
  })

  it('a chave primária nunca é editável — trocá-la seria criar outro registro', () => {
    for (const [nome, mapa] of Object.entries(REGISTRY)) {
      expect(mapa.colunas[mapa.chave].editavel, `${nome}.${mapa.chave} editável`).toBe(false)
    }
  })

  it('todo campo de busca existe entre as colunas declaradas', () => {
    for (const [nome, mapa] of Object.entries(REGISTRY)) {
      for (const campo of mapa.busca) {
        expect(Object.hasOwn(mapa.colunas, campo), `${nome}.${campo} buscável mas não declarado`).toBe(true)
      }
    }
  })

  it('todo enum editável traz as opções — sem elas nada passaria na coerção', () => {
    for (const [nome, mapa] of Object.entries(REGISTRY)) {
      for (const campo of camposEditaveis(mapa)) {
        const c = mapa.colunas[campo]
        if (c.tipo === 'enum') {
          expect(c.opcoes?.length, `${nome}.${campo} enum sem opções`).toBeGreaterThan(0)
        }
      }
    }
  })

  it('colunas que mudam de dono estão marcadas como perigosas', () => {
    for (const [nome, mapa] of Object.entries(REGISTRY)) {
      for (const campo of camposEditaveis(mapa)) {
        if (campo === 'org_id' || campo === 'user_id' || campo === 'owner_user_id') {
          expect(mapa.colunas[campo].perigoso, `${nome}.${campo} sem marca de perigoso`).toBe(true)
        }
      }
    }
  })
})
