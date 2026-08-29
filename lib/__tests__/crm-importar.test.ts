import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { COLUNAS_MODELO, analisarPlanilha, limparHandle } from '../crm-importar'

/**
 * O parser é o contrato entre a planilha e o banco. Estes testes cobrem o que
 * uma planilha de verdade tem e um `split(',')` não sobreviveria.
 */

describe('analisarPlanilha', () => {
  it('lê o que é colado do Sheets, separado por TAB', () => {
    const { linhas } = analisarPlanilha(
      'Nome\tInstagram\tFonte\n' +
      'Maite Pizza\t@maiipizza\tLink School\n' +
      'Luka Choi\tlukachoi\tLink School',
    )
    expect(linhas).toHaveLength(2)
    expect(linhas[0]).toMatchObject({ nome: 'Maite Pizza', instagram: 'maiipizza', fonte: 'Link School' })
  })

  it('lê o CSV do Excel em português, com ponto e vírgula', () => {
    const { linhas } = analisarPlanilha('Nome;Instagram\nRomeu Zema;romeuzemaoficial')
    expect(linhas[0]).toMatchObject({ nome: 'Romeu Zema', instagram: 'romeuzemaoficial' })
  })

  it('não parte a nota que tem vírgula e aspas dentro', () => {
    const { linhas } = analisarPlanilha(
      'Nome,Notas\n' +
      'Lucas,"Falou que quer, mas pediu para chamar em março; disse ""depois do carnaval"""',
    )
    expect(linhas).toHaveLength(1)
    expect(linhas[0].nota).toBe(
      'Falou que quer, mas pediu para chamar em março; disse "depois do carnaval"',
    )
  })

  it('aceita cabeçalho em qualquer ordem, com acento e por apelido', () => {
    const { linhas } = analisarPlanilha('Origem,NOME,Telefone\nAdam,Romeu,31999990000')
    expect(linhas[0]).toMatchObject({ nome: 'Romeu', fonte: 'Adam', whatsapp: '31999990000' })
  })

  it('ignora Link criado / Enviado / Aceito, e diz por quê', () => {
    const { linhas, avisos } = analisarPlanilha(
      'Coluna 1,Nome,Bekrew.com/@,Link Criado?,Enviado,Aceito\n' +
      '1,Maite Pizza,bekrew.com/@maipizza,SIM,FALSE,SIM',
    )
    expect(linhas[0]).toMatchObject({ nome: 'Maite Pizza', handle: 'maipizza' })
    expect(avisos.join(' ')).toContain('lê esses três da oferta de bio')
  })

  it('marca a linha sem nome e a repetida em vez de descartá-las em silêncio', () => {
    const { linhas } = analisarPlanilha(
      'Nome,Instagram\nAna,ana\n,semnome\nOutra Ana,ana',
    )
    expect(linhas[1].erro).toBe('sem nome')
    expect(linhas[2].erro).toContain('repetido na planilha')
  })

  it('entende data brasileira e devolve ISO', () => {
    const { linhas } = analisarPlanilha('Nome,Próximo contato\nAna,05/03/2026')
    expect(linhas[0].proximoContato).toBe('2026-03-05')
  })

  it('recusa a planilha sem cabeçalho em vez de importar o título como lead', () => {
    const r = analisarPlanilha('Maite Pizza,maiipizza\nLuka Choi,lukachoi')
    expect(r.linhas).toHaveLength(0)
    expect(r.avisos[0]).toContain('cabeçalho')
  })
})

describe('limparHandle', () => {
  it('tira o domínio, o protocolo e o arroba', () => {
    expect(limparHandle('bekrew.com/@maipizza')).toBe('maipizza')
    expect(limparHandle('https://bekrew.com/@lukachoi')).toBe('lukachoi')
    expect(limparHandle('@Zema')).toBe('zema')
    expect(limparHandle('')).toBeNull()
  })
})

describe('o modelo', () => {
  it('tem exatamente o cabeçalho que o parser entende', () => {
    // O arquivo que você baixa e o parser que lê o que você devolve nascem do
    // mesmo lugar. Sem este teste, renomear uma coluna aqui deixaria o modelo
    // apontando para um formato que o painel não lê mais.
    const modelo = readFileSync(join(process.cwd(), 'public/modelo-leads.csv'), 'utf8')
    const cabecalho = modelo.split('\n')[0].trim()
    expect(cabecalho).toBe(COLUNAS_MODELO.join(','))

    const { linhas, avisos } = analisarPlanilha(modelo)
    expect(avisos).toHaveLength(0)
    expect(linhas.every((l) => !l.erro)).toBe(true)
    expect(linhas).toHaveLength(4)
  })
})
