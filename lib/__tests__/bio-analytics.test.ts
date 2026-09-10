import { beforeEach, describe, expect, it, vi } from 'vitest'

const { exigirAtor, dbRO } = vi.hoisted(() => ({ exigirAtor: vi.fn(), dbRO: vi.fn() }))
vi.mock('@/lib/auth', () => ({ exigirAtor }))
vi.mock('@/lib/db', () => ({ dbRO }))
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/assinatura-server', () => ({ getAssinatura: vi.fn() }))
import { getPainelBio } from '@/app/actions/bio-analytics'

const org = '11111111-1111-4111-8111-111111111111'
const user = '22222222-2222-4222-8222-222222222222'
beforeEach(() => vi.resetAllMocks())

describe('Analytics administrativo', () => {
  it('exige admin antes de consultar dados', async () => {
    exigirAtor.mockRejectedValue(new Error('sem acesso'))
    await expect(getPainelBio(org, user, '7d', true)).rejects.toThrow('sem acesso')
    expect(dbRO).not.toHaveBeenCalled()
  })
  it('recusa identificadores inválidos', async () => {
    expect(await getPainelBio(org, 'invalido', '7d', true)).toBeNull()
    expect(dbRO).not.toHaveBeenCalled()
  })
  it('não consulta métricas de uma combinação de pessoa e organização inexistente', async () => {
    dbRO.mockResolvedValueOnce([])
    expect(await getPainelBio(org, user, '7d', true)).toBeNull()
    expect(dbRO).toHaveBeenCalledTimes(1)
  })
  it('carrega uma página existente sem exigir assinatura ou aceite de oferta', async () => {
    const painel = { leve: {}, geo: {}, comparacao: {}, tempoReal: {}, titulos: {} }
    dbRO.mockResolvedValueOnce([{ id: 'pagina' }]).mockResolvedValueOnce([{ painel }])
    expect(await getPainelBio(org, user, '7d', true)).toEqual(painel)
    expect(dbRO).toHaveBeenCalledTimes(2)
  })
  it('permite retentativa quando a consulta falha', async () => {
    dbRO.mockRejectedValueOnce(new Error('timeout'))
    expect(await getPainelBio(org, user, '30d', true)).toBeNull()
  })
})
