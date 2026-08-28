import { describe, expect, it } from 'vitest'

import { extrairDeHtml, handleDaUrl, normalizarUrlLinkme, plataformaDaUrl } from '../importar-linkme'

/**
 * As fixtures reproduzem as duas formas de marcação que aparecem em perfis
 * reais do link.me — não são as páginas capturadas, e sim o esqueleto delas.
 *
 * A diferença entre as duas não é cosmética: num perfil o `href` vem primeiro
 * na âncora, no outro vem depois de um `style`. Um extrator ancorado em
 * `<a href="` passa no primeiro e devolve ZERO link no segundo. Foi o que
 * aconteceu de verdade, e é o que estes testes existem para impedir de voltar.
 */

const ld = (identifier: string, sameAs: string[]) =>
  `<script id="profile-schema-x" type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org/',
    '@type': 'ProfilePage',
    mainEntity: {
      '@type': 'Person',
      identifier,
      name: `@${identifier}`,
      image: `https://media.link.me/img/${identifier}.webp`,
      sameAs,
    },
  })}</script>`

// Perfil A: href antes da classe; bio com o sufixo de marketing; rótulo em span.
const PERFIL_A = `<!DOCTYPE html><html><head>
<meta property="og:title" content="Check out Fulano de Tal  (@fulano) on Linkme"/>
<meta property="og:description" content="Discover Fulano de Tal  on LinkMe: Contato em contato&#x27;s@exemplo.com: Connect and see what they&#x27;re passionate about."/>
${ld('fulano', [
  'https://www.instagram.com/fulano',
  'https://www.tiktok.com/@fulano?lang=en',
  'https://tidal.com/browse/artist/123',
  'https://music.youtube.com/channel/UC123',
])}
</head><body>
<a href="https://exemplo.com/turne" class="singlealbum smallfeaturelinks socialmedialink cursor-pointer" target="_blank"><div class="pointer-events-none imgbox bgColor-1"><img src="https://media.link.me/a.png" alt="LinkMe"/></div><div class="pointer-events-none albumtextbox"><div class="first colorWhite"><p><span style="color:#ffffffff">Turnê 2026</span></p></div></div></a>
</body></html>`

// Perfil B: style antes do href; bio sem sufixo; um card só de imagem.
const PERFIL_B = `<!DOCTYPE html><html><head>
<meta property="og:title" content="Check out Beltrana Silva (@beltrana) on Linkme"/>
<meta property="og:description" content="Discover Beltrana Silva on LinkMe: Estrategista &amp; palestrante"/>
${ld('beltrana', ['https://www.linkedin.com/in/beltrana'])}
</head><body>
<button type="button" class="total-followers-button"><span class="font-semibold mr-1 notranslate">224.5M</span>Total Followers</button>
<a style="background-color:#000000ff" href="https://revista.exemplo.com/materia" class="singlealbum singlebigitem socialmedialink cursor-pointer" target="_blank"><div class="pointer-events-none imgbox bgColor-1"><img src="https://media.link.me/b.png" alt="LinkMe"/></div><div class="pointer-events-none albumtextbox"><div class="first colorWhite"><p>Matéria na revista</p></div></div></a>
<section class="flex w-full mt-[6px] mb-4 items-center gap-2"><div class="relative w-full flex"><section style="text-align:center;justify-content:center;font-weight:900;background:transparent" class="flex w-full items-center justify-center"><span style="color:#ffffffff" class="truncate max-w-[calc(100%-2rem)] text-[17px] notranslate">MY LATEST VIDEOS</span></section></div></section>
<a style="background-color:#111111ff" href="https://www.exemplo.org/sem-rotulo" class="singlealbum singlebigitem socialmedialink cursor-pointer" target="_blank"><div class="pointer-events-none imgbox bgColor-1"><img src="https://media.link.me/c.png" alt="LinkMe"/></div><div class="pointer-events-none albumtextbox"><div class="first colorWhite"></div></div></a>
</body></html>`

describe('extrairDeHtml', () => {
  it('lê nome, handle, avatar e bio quando a descrição traz o sufixo de marketing', () => {
    const p = extrairDeHtml(PERFIL_A)
    expect(p.nome).toBe('Fulano de Tal')
    expect(p.handle).toBe('fulano')
    expect(p.avatarUrl).toContain('fulano.webp')
    expect(p.bio).toBe("Contato em contato's@exemplo.com")
  })

  it('lê a bio também quando o sufixo não existe', () => {
    expect(extrairDeHtml(PERFIL_B).bio).toBe('Estrategista & palestrante')
  })

  it('encontra o botão quando o href vem antes da classe', () => {
    const p = extrairDeHtml(PERFIL_A)
    expect(p.links).toContainEqual({
      tipo: 'link',
      titulo: 'Turnê 2026',
      url: 'https://exemplo.com/turne',
      capaUrl: 'https://media.link.me/a.png',
      estilo: 'metade',
    })
  })

  it('encontra o botão quando um style vem ANTES do href — a regressão que já mordeu', () => {
    const p = extrairDeHtml(PERFIL_B)
    expect(p.links.map((l) => l.url)).toContain('https://revista.exemplo.com/materia')
  })

  it('usa o domínio como título quando o card não tem rótulo', () => {
    const p = extrairDeHtml(PERFIL_B)
    expect(p.links).toContainEqual({
      tipo: 'link',
      titulo: 'exemplo.org',
      url: 'https://www.exemplo.org/sem-rotulo',
      capaUrl: 'https://media.link.me/c.png',
      estilo: 'grande',
    })
  })

  it('traz a arte do card como capa própria — é ela que faz o link virar card grande', () => {
    const p = extrairDeHtml(PERFIL_B)
    const materia = p.links.find((l) => l.url === 'https://revista.exemplo.com/materia')
    expect(materia?.capaUrl).toBe('https://media.link.me/b.png')
  })

  it('importa o formato do card: singlebigitem vira grande, smallfeaturelinks vira metade', () => {
    // Sem isto um perfil de 15 links compactos sairia como coluna de banners.
    //
    // `metade` e não `pequeno`: os valores são os do CHECK de `creator_links`.
    // Enquanto o importador usava nome próprio, o erro só aparecia no insert —
    // e derrubava a criação da oferta inteira.
    expect(extrairDeHtml(PERFIL_A).links[0].estilo).toBe('metade')
    expect(extrairDeHtml(PERFIL_B).links[0].estilo).toBe('grande')
  })

  it('importa o título da seção como divisor', () => {
    const p = extrairDeHtml(PERFIL_B)
    expect(p.links).toContainEqual({
      tipo: 'divisor',
      titulo: 'MY LATEST VIDEOS',
      url: null,
      capaUrl: null,
      estilo: 'grande',
    })
  })

  it('o divisor entra na POSIÇÃO em que aparece na página', () => {
    // O que um divisor significa é "daqui para baixo começa a seção tal".
    // Fora de ordem ele nomearia o bloco errado, que é pior do que faltar.
    const p = extrairDeHtml(PERFIL_B)
    const ordem = p.links.map((l) => `${l.tipo}:${l.titulo}`)
    expect(ordem.slice(0, 3)).toEqual([
      'link:Matéria na revista',
      'divisor:MY LATEST VIDEOS',
      'link:exemplo.org',
    ])
  })

  it('o contador de seguidores não vira seção', () => {
    // Ele também é um <span notranslate>, e por isso a extração exige o
    // <section> colado ao <span>: o contador vive dentro de um <button>.
    const p = extrairDeHtml(PERFIL_B)
    expect(p.links.map((l) => l.titulo)).not.toContain('224.5M')
  })

  it('rede social que virou link não inventa capa', () => {
    const p = extrairDeHtml(PERFIL_A)
    expect(p.links.find((l) => l.url?.includes('tidal.com'))?.capaUrl).toBeNull()
  })

  it('separa redes conhecidas de serviços que o app não modela', () => {
    const p = extrairDeHtml(PERFIL_A)
    expect(p.redes.map((r) => r.plataforma)).toEqual(['instagram', 'tiktok'])
    expect(p.redes.find((r) => r.plataforma === 'tiktok')?.handle).toBe('fulano')

    // Tidal e YouTube Music não têm plataforma no app — viram link, não somem.
    const urls = p.links.map((l) => l.url)
    expect(urls).toContain('https://tidal.com/browse/artist/123')
    expect(urls).toContain('https://music.youtube.com/channel/UC123')
  })

  it('avisa quando nenhum botão foi reconhecido, em vez de fingir perfil vazio', () => {
    const p = extrairDeHtml('<html><head><meta property="og:title" content="Check out X (@x) on Linkme"/></head><body></body></html>')
    expect(p.avisos.join(' ')).toMatch(/botão de link/i)
  })
})

describe('plataformaDaUrl', () => {
  it('reconhece os hosts das redes que o app modela', () => {
    expect(plataformaDaUrl('https://www.instagram.com/alguem')).toBe('instagram')
    expect(plataformaDaUrl('https://x.com/alguem')).toBe('twitter')
    expect(plataformaDaUrl('https://www.threads.net/@alguem')).toBe('threads')
    expect(plataformaDaUrl('https://open.spotify.com/artist/1')).toBe('spotify')
  })

  it('não confunde YouTube Music com o canal do YouTube', () => {
    // A tabela tem `unique (user_id, platform)`: tratar os dois como 'youtube'
    // faria um sobrescrever o outro silenciosamente.
    expect(plataformaDaUrl('https://music.youtube.com/channel/UC1')).toBeNull()
    expect(plataformaDaUrl('https://www.youtube.com/user/alguem')).toBe('youtube')
  })

  it('devolve null para o que não é rede conhecida', () => {
    expect(plataformaDaUrl('https://deezer.com/artist/1')).toBeNull()
    expect(plataformaDaUrl('nem-url')).toBeNull()
  })
})

describe('handleDaUrl', () => {
  it('tira a arroba e a query', () => {
    expect(handleDaUrl('https://www.tiktok.com/@alguem?lang=en')).toBe('alguem')
    expect(handleDaUrl('https://www.youtube.com/user/alguem')).toBe('alguem')
  })
})

describe('normalizarUrlLinkme', () => {
  it('aceita handle, @handle e a URL inteira', () => {
    expect(normalizarUrlLinkme('fulano')).toBe('https://link.me/fulano')
    expect(normalizarUrlLinkme('@fulano')).toBe('https://link.me/fulano')
    expect(normalizarUrlLinkme('https://link.me/fulano')).toBe('https://link.me/fulano')
  })

  it('recusa qualquer host que não seja link.me — é o que fecha o SSRF', () => {
    expect(normalizarUrlLinkme('https://exemplo.com/fulano')).toBeNull()
    expect(normalizarUrlLinkme('http://169.254.169.254/latest/meta-data/')).toBeNull()
    expect(normalizarUrlLinkme('https://link.me.evil.com/x')).toBeNull()
  })
})
