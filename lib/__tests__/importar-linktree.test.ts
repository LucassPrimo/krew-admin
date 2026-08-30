import { describe, expect, it } from 'vitest'

import { extrairDeHtmlLinktree, normalizarUrlLinktree } from '../importar-linktree'
import { origemDaEntrada } from '../importar-perfil'

/**
 * O fixture é o ESQUELETO do `__NEXT_DATA__` de uma página real do Linktree —
 * os campos que a extração lê, com os mesmos nomes e formatos vistos em
 * `linktr.ee/manualdomundo`, mais os casos que aquele perfil não tinha
 * (cabeçalho de seção, arte de upload, ícone genérico, layout em grade).
 *
 * Fixture e não a página inteira: 250 KB de HTML no repositório envelheceriam
 * sem ninguém reparar, e o que precisa de teste de regressão aqui é a FORMA
 * do dado, não o perfil de ninguém.
 */
function pagina(pageProps: unknown): string {
  return `<html><head></head><body><div id="__next"></div><script id="__NEXT_DATA__" type="application/json" crossorigin="anonymous">${JSON.stringify(
    { props: { pageProps } },
  )}</script></body></html>`
}

const CONTA = {
  username: 'fulano',
  pageTitle: 'Fulano de Tal',
  description: 'Incrivelmente simples.',
  customAvatar: 'https://ugc.production.linktr.ee/avatar.png',
  profilePictureUrl: 'https://ugc.production.linktr.ee/antigo.png',
  socialLinks: [
    { type: 'INSTAGRAM', url: 'https://instagram.com/fulano', position: 1 },
    { type: 'YOUTUBE', url: 'https://www.youtube.com/@fulano', position: 2 },
    { type: 'EMAIL', url: 'mailto:contato@exemplo.com', position: 3 },
  ],
}

const LINKS = [
  {
    id: '1', type: 'CLASSIC', title: 'Site oficial', url: 'https://exemplo.com',
    position: 11, layoutOption: 'stack', parent: null,
    thumbnail: 'https://assets.production.linktr.ee/tabler-icons/outline/bulb.svg',
  },
  { id: '2', type: 'HEADER', title: 'MEUS VÍDEOS', url: null, position: 12, parent: null },
  {
    id: '3', type: 'CLASSIC', title: 'Novo vídeo', url: 'https://youtu.be/abc',
    position: 13, layoutOption: 'grid', parent: null,
    thumbnail: 'https://ugc.production.linktr.ee/capa-do-video.jpg',
  },
  { id: '4', type: 'CLASSIC', title: 'Arquivo A', url: 'https://exemplo.com/a', position: 1, parent: { id: 99 } },
  { id: '5', type: 'CLASSIC', title: 'Arquivo B', url: 'https://exemplo.com/b', position: 0, parent: { id: 99 } },
]

const PERFIL = pagina({ username: 'fulano', links: LINKS, account: { ...CONTA, links: LINKS } })

describe('extrairDeHtmlLinktree', () => {
  it('lê identidade, nome, bio e foto do bloco de dados', () => {
    const p = extrairDeHtmlLinktree(PERFIL)
    expect(p.handle).toBe('fulano')
    expect(p.nome).toBe('Fulano de Tal')
    expect(p.bio).toBe('Incrivelmente simples.')
    // `customAvatar` ganha do `profilePictureUrl`: é a foto que está no ar.
    expect(p.avatarUrl).toBe('https://ugc.production.linktr.ee/avatar.png')
  })

  it('reconhece rede pela URL, e não pelo rótulo do Linktree', () => {
    // O `type` deles é vocabulário próprio (INSTAGRAM, YOUTUBE, EMAIL…).
    // Traduzi-lo aqui seria uma segunda tabela de plataformas para manter.
    const p = extrairDeHtmlLinktree(PERFIL)
    expect(p.redes.map((r) => r.plataforma).sort()).toEqual(['instagram', 'youtube'])
    expect(p.redes.find((r) => r.plataforma === 'youtube')?.handle).toBe('fulano')
  })

  it('contato que não é rede vira botão em vez de sumir', () => {
    const p = extrairDeHtmlLinktree(PERFIL)
    expect(p.links.find((l) => l.url === 'mailto:contato@exemplo.com')).toBeTruthy()
  })

  it('cabeçalho de seção vira divisor, na posição em que aparece', () => {
    const p = extrairDeHtmlLinktree(PERFIL)
    expect(p.links.slice(0, 3).map((l) => `${l.tipo}:${l.titulo}`)).toEqual([
      'link:Site oficial',
      'divisor:MEUS VÍDEOS',
      'link:Novo vídeo',
    ])
    expect(p.links[1]).toMatchObject({ url: null, capaUrl: null })
  })

  it('só a arte de upload do criador vira capa — ícone do produto, não', () => {
    // Os SVGs de `assets.` são clip-art do Linktree (lâmpada, sacola). Virar
    // `capa_url` faria o perfil nascer como coluna de banners com ícone.
    const p = extrairDeHtmlLinktree(PERFIL)
    expect(p.links.find((l) => l.titulo === 'Site oficial')?.capaUrl).toBeNull()
    expect(p.links.find((l) => l.titulo === 'Novo vídeo')?.capaUrl).toBe(
      'https://ugc.production.linktr.ee/capa-do-video.jpg',
    )
  })

  it('traduz o layout para os estilos do banco', () => {
    // 'metade'/'botao' são os valores do CHECK de `creator_links` — nome
    // inventado deste lado só reaparece como erro de constraint no insert.
    const p = extrairDeHtmlLinktree(PERFIL)
    expect(p.links.find((l) => l.titulo === 'Novo vídeo')?.estilo).toBe('metade')
    expect(p.links.find((l) => l.titulo === 'Site oficial')?.estilo).toBe('botao')
  })

  it('os filhos de um grupo saem juntos e no fim, não espalhados pelo topo', () => {
    // `position` é relativa ao PAI: os filhos vêm como 0 e 1 enquanto os
    // botões soltos estão em 11, 12, 13. Ordenar tudo junto por `position`
    // jogaria o grupo para cima, longe de onde a página o desenha.
    const p = extrairDeHtmlLinktree(PERFIL)
    expect(p.links.map((l) => l.titulo).slice(3, 5)).toEqual(['Arquivo B', 'Arquivo A'])
  })

  it('avisa quando a página não traz o bloco de dados', () => {
    const p = extrairDeHtmlLinktree('<html><body>nada aqui</body></html>')
    expect(p.handle).toBeNull()
    expect(p.avisos.join(' ')).toMatch(/bloco de dados/i)
  })

  it('avisa quando nenhum botão foi encontrado, em vez de fingir perfil vazio', () => {
    const p = extrairDeHtmlLinktree(pagina({ account: { ...CONTA, socialLinks: [], links: [] } }))
    expect(p.avisos.join(' ')).toMatch(/nenhum botão/i)
  })
})

describe('normalizarUrlLinktree', () => {
  it('aceita a URL com e sem protocolo, e normaliza linktree.com para linktr.ee', () => {
    expect(normalizarUrlLinktree('https://linktr.ee/fulano')).toBe('https://linktr.ee/fulano')
    expect(normalizarUrlLinktree('linktr.ee/fulano')).toBe('https://linktr.ee/fulano')
    expect(normalizarUrlLinktree('https://www.linktr.ee/fulano?x=1')).toBe('https://linktr.ee/fulano')
  })

  it('recusa qualquer host que não seja do Linktree — é o que fecha o SSRF', () => {
    expect(normalizarUrlLinktree('https://exemplo.com/fulano')).toBeNull()
    expect(normalizarUrlLinktree('http://169.254.169.254/latest/meta-data/')).toBeNull()
    expect(normalizarUrlLinktree('https://linktr.ee.evil.com/x')).toBeNull()
  })

  it('recusa o que não é caminho de perfil', () => {
    // `linktr.ee/s/features` é página de produto, não perfil.
    expect(normalizarUrlLinktree('https://linktr.ee/s/features')).toBeNull()
    expect(normalizarUrlLinktree('https://linktr.ee/')).toBeNull()
  })
})

describe('origemDaEntrada', () => {
  it('manda para o Linktree só quando o endereço é dele', () => {
    expect(origemDaEntrada('https://linktr.ee/manualdomundo')).toBe('linktree')
    expect(origemDaEntrada('linktr.ee/manualdomundo')).toBe('linktree')
  })

  it('handle solto continua sendo link.me, como sempre foi', () => {
    expect(origemDaEntrada('jasonderulo')).toBe('linkme')
    expect(origemDaEntrada('@jasonderulo')).toBe('linkme')
    expect(origemDaEntrada('https://link.me/jasonderulo')).toBe('linkme')
  })
})
