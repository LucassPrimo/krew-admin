/**
 * Nome da rede a partir do referrer cru.
 *
 * O que chega em `link_bio_events.referrer` é o `document.referrer` inteiro, e
 * as redes não mandam o domínio que a pessoa reconhece: o Instagram sai como
 * `https://l.instagram.com/?u=...`, o LinkedIn como `lnkd.in`, o X como
 * `t.co`, o Facebook como `l.facebook.com` ou `m.facebook.com`. Sem tratar,
 * a mesma rede vira quatro fatias diferentes na rosca — nenhuma delas com o
 * nome que o criador procura.
 *
 * Aqui o host vira o nome da marca. O que não é rede conhecida devolve o host
 * sem `www.` — continua legível e não some do painel.
 */

/** Domínio raiz (ou sufixo de host) -> nome exibido. */
const REDES: [string, string][] = [
  ['instagram.com', 'Instagram'],
  ['youtube.com', 'YouTube'],
  ['youtu.be', 'YouTube'],
  ['tiktok.com', 'TikTok'],
  ['linkedin.com', 'LinkedIn'],
  ['lnkd.in', 'LinkedIn'],
  ['facebook.com', 'Facebook'],
  ['fb.me', 'Facebook'],
  ['fb.com', 'Facebook'],
  ['messenger.com', 'Messenger'],
  ['twitter.com', 'X'],
  ['x.com', 'X'],
  ['t.co', 'X'],
  ['threads.net', 'Threads'],
  ['threads.com', 'Threads'],
  ['whatsapp.com', 'WhatsApp'],
  ['wa.me', 'WhatsApp'],
  ['telegram.org', 'Telegram'],
  ['telegram.me', 'Telegram'],
  ['t.me', 'Telegram'],
  ['pinterest.com', 'Pinterest'],
  ['pin.it', 'Pinterest'],
  ['reddit.com', 'Reddit'],
  ['twitch.tv', 'Twitch'],
  ['discord.com', 'Discord'],
  ['discord.gg', 'Discord'],
  ['snapchat.com', 'Snapchat'],
  ['kwai.com', 'Kwai'],
  ['bsky.app', 'Bluesky'],
  ['spotify.com', 'Spotify'],
  ['substack.com', 'Substack'],
  ['medium.com', 'Medium'],
  ['google.com', 'Google'],
  ['bing.com', 'Bing'],
  ['duckduckgo.com', 'DuckDuckGo'],
  ['yahoo.com', 'Yahoo'],
]

/** Prefixos de redirecionador que as redes penduram no host. */
const PREFIXOS = ['l.', 'lm.', 'm.', 'www.', 'out.', 'away.', 'link.', 'go.']

function hostDoReferrer(referrer: string): string | null {
  const bruto = referrer.trim()
  if (!bruto) return null

  try {
    const url = new URL(bruto.includes('://') ? bruto : `https://${bruto}`)
    return url.hostname.toLowerCase()
  } catch {
    return null
  }
}

function semPrefixo(host: string): string {
  let atual = host
  let mudou = true

  while (mudou) {
    mudou = false
    for (const p of PREFIXOS) {
      if (atual.startsWith(p) && atual.length > p.length) {
        atual = atual.slice(p.length)
        mudou = true
      }
    }
  }

  return atual
}

/**
 * Nome exibível de um referrer. `direto` (o balde de quem chegou sem referrer)
 * passa intacto — quem traduz é o componente, que tem o idioma.
 */
export function nomeDaFonte(referrer: string): string {
  if (referrer === 'direto') return referrer

  const host = hostDoReferrer(referrer)
  if (!host) return referrer

  // `google.com.br`, `google.co.uk` e afins caem no mesmo nome, por isso o
  // teste é por segmento do host e não por igualdade.
  for (const [dominio, nome] of REDES) {
    if (host === dominio || host.endsWith(`.${dominio}`) || host.includes(`.${dominio}.`)) {
      return nome
    }
  }

  return semPrefixo(host)
}

/**
 * Soma os eventos por nome de rede e reordena. Precisa acontecer depois do
 * `nomeDaFonte`: o banco agrupa pela string crua, então `l.instagram.com` e
 * `www.instagram.com` chegam aqui como duas linhas que viram uma só.
 */
export function agruparFontes<T extends { referrer: string; eventos: number }>(
  itens: T[]
): { referrer: string; eventos: number }[] {
  const soma = new Map<string, number>()

  for (const item of itens) {
    const nome = nomeDaFonte(item.referrer)
    soma.set(nome, (soma.get(nome) ?? 0) + item.eventos)
  }

  return [...soma.entries()]
    .map(([referrer, eventos]) => ({ referrer, eventos }))
    .sort((a, b) => b.eventos - a.eventos)
}
