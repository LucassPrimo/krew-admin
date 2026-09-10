import { beforeEach, describe, expect, it, vi } from 'vitest'
const { exigirAtor, dbRO, renderToBuffer, RelatorioPdf } = vi.hoisted(() => ({
  exigirAtor: vi.fn(), dbRO: vi.fn(), renderToBuffer: vi.fn(), RelatorioPdf: vi.fn(),
}))
vi.mock('@/lib/auth', () => ({ exigirAtor }))
vi.mock('@/lib/db', () => ({ dbRO }))
vi.mock('@react-pdf/renderer', () => ({ renderToBuffer }))
vi.mock('@/lib/analytics/pdf/relatorio', () => ({ RelatorioPdf }))
import { GET } from '@/app/api/analytics/[pageId]/pdf/route'
const pageId = '11111111-1111-4111-8111-111111111111'
const get = (query = '', id = pageId) => GET(new Request(`https://admin.example/api/analytics/${id}/pdf${query}`), { params: Promise.resolve({ pageId: id }) })
beforeEach(() => vi.resetAllMocks())
describe('Download de PDF', () => {
  it('não lê dados nem gera arquivos sem autorização administrativa', async () => {
    exigirAtor.mockRejectedValue(new Error('sem acesso'))
    await expect(get()).rejects.toThrow('sem acesso')
    expect(dbRO).not.toHaveBeenCalled()
    expect(renderToBuffer).not.toHaveBeenCalled()
  })
  it('rejeita período e página inválidos', async () => {
    expect((await get('?periodo=9999d')).status).toBe(400)
    expect((await get('', 'invalido')).status).toBe(400)
    expect(dbRO).not.toHaveBeenCalled()
  })
  it('retorna 404 para página inexistente', async () => {
    dbRO.mockResolvedValueOnce([])
    expect((await get()).status).toBe(404)
    expect(renderToBuffer).not.toHaveBeenCalled()
  })
  it('gera download privado com 30 dias para a página solicitada, inclusive conta provisória', async () => {
    dbRO.mockResolvedValueOnce([{ nome: 'Criador', slug: 'criador', org_id: 'org-provisoria', user_id: 'conta-provisoria' }])
      .mockResolvedValueOnce([{ painel: { dados: true } }])
    renderToBuffer.mockResolvedValue(Buffer.from('%PDF-1.7 exemplo'))
    const response = await get()
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('application/pdf')
    expect(response.headers.get('cache-control')).toContain('no-store')
    expect(response.headers.get('content-disposition')).toContain('krew-analytics-criador-30d-')
    const dados = RelatorioPdf.mock.calls[0][0].dados
    expect(dados.periodo).toBe('30d')
    expect(new Date(dados.ate).getTime() - new Date(dados.desde).getTime()).toBe(30 * 86400000)
    expect(dbRO.mock.calls[0].slice(1)).toEqual([pageId])
    expect(dbRO.mock.calls[1].slice(1, 3)).toEqual(['org-provisoria', 'conta-provisoria'])
  })
  it('não entrega um arquivo vazio nem detalhes internos se o banco falhar', async () => {
    dbRO.mockRejectedValue(new Error('segredo interno'))
    const response = await get()
    expect(response.status).toBe(503)
    expect(await response.text()).not.toContain('segredo interno')
    expect(renderToBuffer).not.toHaveBeenCalled()
  })
})
