import { describe, expect, it } from 'vitest'
import { filtrarCidades, rotuloCidade } from '../analytics/cidades'

const estados = 'AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY'.split(' ')
const cidades = estados.map((region) => ({ city: `Cidade ${region}`, region, country: 'US', eventos: 3 }))
cidades.push({ city: 'São Paulo', region: 'SP', country: 'BR', eventos: 100 })

describe('Cidades internacionais', () => {
  it('aceita os 50 estados dos EUA sem misturar o Brasil', () => {
    expect(filtrarCidades(cidades, 'US', '')).toHaveLength(50)
    expect(filtrarCidades(cidades, '', '')).toHaveLength(51)
  })
  it('permite consultar um estado americano específico', () => {
    expect(filtrarCidades(cidades, 'US', 'CA')).toEqual([cidades[4]])
  })
  it('identifica país e estado para diferenciar cidades homônimas', () => {
    expect(rotuloCidade({ city: 'Portland', region: 'OR', country: 'US', eventos: 3 }, 'pt-BR')).toBe('Portland · OR · Estados Unidos')
  })
  it('normaliza o país e preserva cidades sem estado informado', () => {
    expect(filtrarCidades([{ city: 'New York', region: null, country: 'us', eventos: 4 }], 'US', '')).toHaveLength(1)
  })
})
