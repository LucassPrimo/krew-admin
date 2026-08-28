import { describe, expect, it } from 'vitest'

import { momentoDoTotp, STEP_UP_MAX_MS } from '../step-up'

/**
 * Testar autenticação é obrigatório; testar tela não é.
 *
 * O step-up é a peça que decide se uma sessão aberta há horas pode gravar no
 * banco de todos os clientes. Um bug aqui não aparece na tela — aparece no dia
 * em que alguém usa um notebook destravado.
 */

function tokenCom(claims: object): string {
  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url')
  return `cabecalho.${payload}.assinatura`
}

describe('momentoDoTotp', () => {
  it('lê o instante do TOTP da claim amr', () => {
    const agoraSeg = Math.floor(Date.now() / 1000)
    const token = tokenCom({ amr: [{ method: 'totp', timestamp: agoraSeg }] })

    expect(momentoDoTotp(token)).toBe(agoraSeg * 1000)
  })

  it('ignora outros métodos e devolve 0 quando não houve TOTP', () => {
    const token = tokenCom({ amr: [{ method: 'password', timestamp: 1_700_000_000 }] })
    expect(momentoDoTotp(token)).toBe(0)
  })

  it('devolve 0 sem token, com token quebrado ou com payload que não é JSON', () => {
    expect(momentoDoTotp(undefined)).toBe(0)
    expect(momentoDoTotp('nao-e-um-jwt')).toBe(0)
    expect(momentoDoTotp('a.###.c')).toBe(0)
  })

  it('devolve 0 quando amr não existe — o lado seguro do erro é pedir o código de novo', () => {
    expect(momentoDoTotp(tokenCom({ sub: 'alguem' }))).toBe(0)
  })

  it('uma verificação velha cai fora da janela de step-up', () => {
    const velho = Math.floor((Date.now() - STEP_UP_MAX_MS - 60_000) / 1000)
    const quando = momentoDoTotp(tokenCom({ amr: [{ method: 'totp', timestamp: velho }] }))

    expect(Date.now() - quando).toBeGreaterThan(STEP_UP_MAX_MS)
  })
})
