import { describe, expect, it } from 'vitest'

import {
  casaBusca, estagioDe, limparInstagram, montarFunil, type Lead, type LinhaLead,
} from '../crm-tipos'

/**
 * O CRM não tem executor de mutações próprio — ele reusa o de `lib/mutate.ts`.
 * O que é dele, e o que estes testes cobrem, é a regra que substitui as três
 * colunas de SIM/FALSE da planilha: o estágio derivado da oferta.
 */

function lead(campos: Partial<LinhaLead> = {}): Lead {
  const base: LinhaLead = {
    id: 'l1', nome: 'Fulano', instagram: null, fonte: null, email: null, whatsapp: null,
    handle_pretendido: null, page_id: null, estagio: 'novo', perdido_em: null,
    motivo_perda: null, proximo_contato: null, criado_em: '2026-01-01', atualizado_em: '2026-01-01',
    slug: null, oferta_criada_em: null, convite_enviado_em: null, aceita_em: null,
    cliques: null, notas: 0, ...campos,
  }
  return { ...base, estagioEfetivo: estagioDe(base) }
}

describe('estágio efetivo', () => {
  it('usa o estágio manual enquanto não existe oferta', () => {
    expect(estagioDe(lead({ estagio: 'contatado' }))).toBe('contatado')
  })

  it('deriva da oferta assim que ela existe, ignorando o manual', () => {
    expect(estagioDe(lead({ estagio: 'novo', oferta_criada_em: '2026-02-01' })))
      .toBe('oferta_criada')
    expect(estagioDe(lead({ oferta_criada_em: '2026-02-01', convite_enviado_em: '2026-02-02' })))
      .toBe('convite_enviado')
    expect(estagioDe(lead({
      oferta_criada_em: '2026-02-01', convite_enviado_em: '2026-02-02', aceita_em: '2026-02-03',
    }))).toBe('aceito')
  })

  it('perdido vence tudo, inclusive convite já enviado', () => {
    expect(estagioDe(lead({ convite_enviado_em: '2026-02-02', perdido_em: '2026-02-05' })))
      .toBe('perdido')
  })

  it('volta ao manual quando a oferta apontada não existe mais', () => {
    // `page_id` sem FK: a oferta pode ter sido excluída e o ponteiro ficado
    // para trás. Quem responde é o join, não a coluna.
    expect(estagioDe(lead({ page_id: 'sumiu', estagio: 'negociando' }))).toBe('negociando')
  })
})

describe('funil', () => {
  const leads = [
    lead({ id: '1', fonte: 'Link School', estagio: 'novo' }),
    lead({ id: '2', fonte: 'Link School', oferta_criada_em: 'x', convite_enviado_em: 'y', aceita_em: 'z' }),
    lead({ id: '3', fonte: 'Adam', oferta_criada_em: 'x', perdido_em: 'p' }),
  ]

  it('conta quem ALCANÇOU a etapa, não quem está parado nela', () => {
    const f = montarFunil(leads)
    const em = (e: string) => f.etapas.find((x) => x.estagio === e)!

    expect(em('novo').alcancaram).toBe(3)
    expect(em('novo').parados).toBe(1)
    // O perdido chegou a ter oferta criada: ele conta no degrau que alcançou.
    expect(em('oferta_criada').alcancaram).toBe(2)
    expect(em('aceito').alcancaram).toBe(1)
  })

  it('separa por fonte com oferta, aceite e perda', () => {
    const f = montarFunil(leads)
    expect(f.fontes.find((x) => x.fonte === 'Link School'))
      .toMatchObject({ total: 2, ofertas: 1, aceitos: 1, perdidos: 0 })
    expect(f.fontes.find((x) => x.fonte === 'Adam'))
      .toMatchObject({ total: 1, ofertas: 1, aceitos: 0, perdidos: 1 })
  })
})

describe('limparInstagram', () => {
  it('aceita @, url e handle solto, e normaliza para um só formato', () => {
    expect(limparInstagram('@maiipizza')).toBe('maiipizza')
    expect(limparInstagram('https://instagram.com/llucaspaiva__/')).toBe('llucaspaiva__')
    expect(limparInstagram('  RomeuZemaOficial ')).toBe('romeuzemaoficial')
    expect(limparInstagram('   ')).toBeNull()
  })
})

describe('busca da lista', () => {
  // A busca passou a filtrar a cada tecla, no cliente. O que ela olha é a
  // regra que decide se a pessoa acha quem procura — e é a mesma para quem
  // chega por link com `?q=`.
  const l = lead({
    nome: 'Manual do Mundo', instagram: 'manualdomundo', fonte: 'Link School',
    slug: 'manualdomundo', email: 'contato@exemplo.com', handle_pretendido: 'mdm',
  })

  it('termo vazio não filtra nada', () => {
    expect(casaBusca(l, '')).toBe(true)
    expect(casaBusca(l, '   ')).toBe(true)
  })

  it('acha por pedaço do nome, sem depender de maiúscula', () => {
    expect(casaBusca(l, 'manual')).toBe(true)
    expect(casaBusca(l, 'MUNDO')).toBe(true)
  })

  it('acha pelos outros campos por onde se procura alguém', () => {
    expect(casaBusca(l, 'link school')).toBe(true)
    expect(casaBusca(l, 'mdm')).toBe(true)
    expect(casaBusca(l, 'contato@')).toBe(true)
  })

  it('não casa o que não está lá', () => {
    expect(casaBusca(l, 'nubank')).toBe(false)
  })

  it('lead com campos nulos não explode', () => {
    const vazio = lead({ nome: 'Fulano', instagram: null, fonte: null, email: null, slug: null })
    expect(casaBusca(vazio, 'fulano')).toBe(true)
    expect(casaBusca(vazio, 'x')).toBe(false)
  })
})
