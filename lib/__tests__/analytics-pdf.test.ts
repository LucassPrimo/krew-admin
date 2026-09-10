import { describe, expect, it } from 'vitest'
import { janelaRelatorio, nomeArquivoPdf, periodoPdf, rankingPdf, variacaoPdf } from '../analytics/pdf/dados'

describe('Período e cálculos do relatório PDF', () => {
  it('usa 30 dias por padrão e rejeita intervalos não suportados', () => {
    expect(periodoPdf(null)).toBe('30d')
    expect(periodoPdf('7d')).toBe('7d')
    expect(periodoPdf('hoje')).toBe('hoje')
    expect(periodoPdf('100000d')).toBeNull()
  })
  it('congela exatamente 30 dias no momento da geração', () => {
    const agora = new Date('2026-09-10T18:45:00Z')
    const janela = janelaRelatorio('30d', agora)
    expect(janela).toEqual({ desde: '2026-08-11T18:45:00.000Z', ate: '2026-09-10T18:45:00.000Z' })
    expect(janelaRelatorio('7d', agora).desde).toBe('2026-09-03T18:45:00.000Z')
  })
  it('Hoje começa à meia-noite em São Paulo mesmo se o servidor estiver em UTC', () => {
    expect(janelaRelatorio('hoje', new Date('2026-09-10T01:30:00Z'))).toEqual({
      desde: '2026-09-09T03:00:00.000Z', ate: '2026-09-10T01:30:00.000Z',
    })
  })
  it('não inventa crescimento percentual quando não há base anterior', () => {
    expect(variacaoPdf(10, 0)).toBe('Sem base anterior')
    expect(variacaoPdf(0, 0)).toBe('Sem variação')
    expect(variacaoPdf(150, 100)).toBe('+50% vs. anterior')
    expect(variacaoPdf(0, 100)).toBe('-100% vs. anterior')
  })
  it('preserva o denominador ao exibir só os primeiros itens do ranking', () => {
    expect(rankingPdf([{ nome: 'A', valor: 20 }, { nome: 'B', valor: 80 }], 1)).toEqual({
      linhas: [{ nome: 'B', valor: 80 }], total: 100, restantes: 1,
    })
  })
  it('gera nome de arquivo sem caracteres de cabeçalho ou de caminho', () => {
    const nome = nomeArquivoPdf('criador/"\r\nfoo', '30d', '2026-09-10T18:45:00.000Z')
    expect(nome).toBe('krew-analytics-criadorfoo-30d-2026-09-10.pdf')
  })
})
