/**
 * Leitura de um link do Spotify para o endereço do player embutido.
 *
 * Módulo próprio pelo mesmo motivo de `lib/bio/youtube.ts`: quem chama é
 * Server Component (a página) e também código de cliente (o editor), e uma
 * função exportada de um módulo `'use client'` chega ao servidor como
 * referência, não como função.
 *
 * O Spotify publica o player em `open.spotify.com/embed/<tipo>/<id>` e não
 * exige chave nem SDK — um `<iframe>` basta. O que ele exige é que o par
 * (tipo, id) esteja certo: qualquer outra coisa vira um quadro cinza escrito
 * "content not available", que é pior do que não desenhar nada.
 */

/** Os tipos que o player do Spotify sabe tocar. */
const TIPOS = ['track', 'album', 'playlist', 'artist', 'episode', 'show'] as const
type TipoSpotify = (typeof TIPOS)[number]

/**
 * Altura do player, por tipo.
 *
 * Não é gosto: o Spotify desenha DOIS players diferentes conforme a altura que
 * o iframe tem. Abaixo de ~200px vem o compacto (uma linha: capa pequena,
 * título, play), acima vem o alto, com a arte grande e — nas coleções — a
 * lista de faixas rolável dentro do próprio quadro.
 *
 * Faixa e episódio ganham o compacto: é UMA música, e 352px de altura para uma
 * linha de conteúdo empurram o resto da página para baixo sem acrescentar
 * informação. Álbum, playlist, artista e show ganham o alto, porque ali a
 * lista de faixas É o conteúdo — é o que deixa a pessoa escolher a música sem
 * sair da bio.
 */
const ALTURA: Record<TipoSpotify, number> = {
  track: 152,
  episode: 152,
  album: 352,
  playlist: 352,
  artist: 352,
  show: 352,
}

export interface EmbedSpotify {
  /** URL do iframe, já pronta. */
  src: string
  altura: number
  tipo: TipoSpotify
}

/**
 * O player a partir do link colado, ou `null` se aquilo não for Spotify.
 *
 * Aceita as formas que aparecem na vida real ao copiar um link do app ou do
 * site:
 *
 *   https://open.spotify.com/playlist/37i9dQ...
 *   https://open.spotify.com/intl-pt/track/4cOd...     (o app põe o idioma)
 *   https://open.spotify.com/embed/album/1DFi...       (já é embed)
 *   spotify:track:4cOdX3G...                           (URI do app de desktop)
 *
 * NÃO aceita `spotify.link/...`, o encurtador do botão "compartilhar" do
 * celular: resolver aquilo exige uma ida à rede, e o editor precisa responder
 * enquanto a pessoa digita. O aviso no editor pede o link completo — é a única
 * forma honesta, porque um encurtador aceito e não resolvido viraria um player
 * quebrado na página publicada.
 */
export function embedDoSpotify(url: string | null | undefined): EmbedSpotify | null {
  if (!url) return null
  const texto = url.trim()
  if (!texto) return null

  // O URI do app (`spotify:track:ID`) não é uma URL que o `URL` saiba ler.
  const uri = texto.match(/^spotify:([a-z]+):([A-Za-z0-9]+)$/i)
  if (uri) return montar(uri[1], uri[2])

  let u: URL
  try {
    u = new URL(texto)
  } catch {
    return null
  }

  if (u.hostname.replace(/^www\./, '').toLowerCase() !== 'open.spotify.com') return null

  // `intl-pt`, `embed` e `embed-podcast` são prefixos que o próprio Spotify
  // põe na frente do tipo. Descartá-los é o que faz o link copiado do app
  // brasileiro valer igual ao copiado do site.
  const partes = u.pathname.split('/').filter(Boolean)
  while (partes.length > 2 && /^(intl-[a-z]{2}|embed|embed-podcast)$/i.test(partes[0])) {
    partes.shift()
  }
  if (partes[0] === 'embed' || partes[0] === 'embed-podcast') partes.shift()

  return montar(partes[0], partes[1])
}

function montar(tipo: string | undefined, id: string | undefined): EmbedSpotify | null {
  const t = (tipo ?? '').toLowerCase() as TipoSpotify
  if (!TIPOS.includes(t)) return null
  // O id do Spotify é base62 de 22 caracteres. A checagem existe para o iframe
  // nunca receber texto arbitrário vindo de uma URL colada — é a mesma razão
  // do `/^[\w-]{11}$/` no módulo do YouTube.
  if (!id || !/^[A-Za-z0-9]{16,40}$/.test(id)) return null

  return {
    // `utm_source=generator` é o que o próprio Spotify usa no código que ele
    // dá em "Copiar link do embed"; mandar o mesmo mantém o player no caminho
    // suportado. Sem `theme=0`: o padrão já é o escuro, e a página tem cor
    // própria — forçar tema aqui brigaria com a bio de fundo claro.
    src: `https://open.spotify.com/embed/${t}/${id}?utm_source=generator`,
    altura: ALTURA[t],
    tipo: t,
  }
}
