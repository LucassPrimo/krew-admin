/**
 * Extração do id de vídeo do YouTube.
 *
 * Cópia do módulo de mesmo nome no `krew-app`, e deliberadamente idêntica: o
 * editor de bio daqui é o mesmo componente de lá, e a única forma de os dois
 * não divergirem em silêncio é o arquivo ser o mesmo. Se um dia mudar, mude
 * nos dois — não há import entre repositórios.
 */

/**
 * O id do vídeo, das formas que uma URL do YouTube aparece na vida real:
 * `watch?v=`, `youtu.be/`, `/shorts/`, `/embed/` e `/live/`.
 *
 * Devolve `null` para qualquer outra coisa — e é isso que faz um link que não é
 * do YouTube, colado na seção de vídeos, cair no card de link comum em vez de
 * virar um player quebrado.
 */
export function idDoVideoYoutube(url: string): string | null {
  let u: URL
  try {
    u = new URL(url)
  } catch {
    return null
  }

  const host = u.hostname.replace(/^www\./, '').toLowerCase()
  // 11 caracteres é o formato do id do YouTube. A checagem existe para o embed
  // nunca receber texto arbitrário vindo de uma URL colada.
  const valido = (id: string | undefined | null) => (id && /^[\w-]{11}$/.test(id) ? id : null)

  if (host === 'youtu.be') return valido(u.pathname.slice(1).split('/')[0])
  if (host !== 'youtube.com' && host !== 'm.youtube.com' && host !== 'youtube-nocookie.com') {
    return null
  }
  if (u.pathname === '/watch') return valido(u.searchParams.get('v'))

  const [, prefixo, id] = u.pathname.split('/')
  if (prefixo === 'shorts' || prefixo === 'embed' || prefixo === 'live') return valido(id)
  return null
}

/**
 * A capa que o próprio link fornece, quando o criador não subiu nenhuma.
 *
 * Só YouTube, e derivada do id em vez de buscada: o endereço da miniatura do
 * YouTube é estável e público (`i.ytimg.com/vi/<id>/…`), então dá para saber a
 * capa SEM ida à rede — o que é o que permite a prévia do editor mostrar o card
 * certo enquanto a pessoa ainda está digitando a URL, antes de existir link
 * gravado.
 *
 * `hqdefault` e não `maxresdefault`: a versão de alta resolução não existe para
 * todo vídeo (vídeo antigo, Short, upload de baixa qualidade) e o YouTube
 * responde com um 404 que o navegador desenha como imagem quebrada. `hqdefault`
 * existe sempre.
 *
 * No servidor isto é RESERVA, não caminho principal: `buscarPreviaDoSite` tenta
 * o oEmbed primeiro, que devolve a miniatura oficial. Aqui é o que sobra quando
 * aquele caminho falha — e ali a imagem ainda é baixada para o nosso bucket.
 *
 * Esta URL nunca vai para a `/@handle`: a página pública só exibe capa já
 * guardada por nós, senão o navegador de cada VISITANTE bateria no Google para
 * carregar a miniatura, entregando o IP dele — exatamente o que o resto desta
 * feature evita. Aqui ela serve à prévia do EDITOR, que é a tela do próprio
 * dono, que acabou de colar aquele link.
 */
export function capaDoLink(url: string | null | undefined): string | null {
  if (!url) return null
  const id = idDoVideoYoutube(url)
  return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null
}
