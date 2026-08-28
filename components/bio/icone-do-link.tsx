import type { IconType } from 'react-icons'
import { FaLinkedinIn } from 'react-icons/fa6'
import {
  SiApplemusic,
  SiApplepodcasts,
  SiCastbox,
  SiDeezer,
  SiFacebook,
  SiInstagram,
  SiOvercast,
  SiPocketcasts,
  SiReddit,
  SiSnapchat,
  SiSoundcloud,
  SiSpotify,
  SiThreads,
  SiTiktok,
  SiTwitch,
  SiX,
  SiYoutube,
} from 'react-icons/si'
import { Globe, Link2 } from 'lucide-react'

/**
 * O selo redondo no canto do card, resolvido pelo HOST da URL.
 *
 * A referência põe um ícone em TODO card: o do Spotify no link do podcast, o do
 * YouTube no vídeo, o do Instagram no "FOLLOW ME", e um ícone genérico de elo
 * de corrente em qualquer link comum. O criador nunca escolhe — a URL diz.
 *
 * É por isso que este arquivo substituiu `podcast-plataformas.tsx`: com
 * divisores livres, "podcast" deixou de ser uma seção com regra própria e
 * virou um link como os outros. Um registry só, para todos os cards.
 *
 * O host casa por sufixo além de igualdade, porque quase todo link real vem de
 * um subdomínio: `open.spotify.com`, `podcasts.apple.com`, `music.youtube.com`.
 * A ordem importa em um caso: `music.apple.com` e `podcasts.apple.com` são a
 * mesma marca com desenhos diferentes, e o mais específico tem que vir antes.
 */
export interface IconeLink {
  id: string
  label: string
  /** Cor de marca. Vira o DESENHO do selo, sobre tile branco — ver
   *  `corSobreBranco`, que é a mesma regra da fileira de redes. */
  cor: string
  icone: IconType
}

/** O id do elo de corrente. Exportado porque o card o trata à parte: link
 *  genérico não é marca nenhuma, então não ganha tile — ver `CardCapa`. */
export const GENERICO_ID = 'link'

const GENERICO: IconeLink = {
  id: GENERICO_ID,
  label: 'Link',
  cor: '#3f3f46',
  icone: Link2 as IconType,
}

const POR_HOST: { hosts: string[]; def: IconeLink }[] = [
  { hosts: ['music.apple.com'], def: { id: 'applemusic', label: 'Apple Music', cor: '#FA243C', icone: SiApplemusic } },
  { hosts: ['podcasts.apple.com'], def: { id: 'applepodcasts', label: 'Apple Podcasts', cor: '#9933CC', icone: SiApplepodcasts } },
  { hosts: ['youtube.com', 'youtu.be'], def: { id: 'youtube', label: 'YouTube', cor: '#FF0000', icone: SiYoutube } },
  { hosts: ['spotify.com', 'spotify.link'], def: { id: 'spotify', label: 'Spotify', cor: '#1DB954', icone: SiSpotify } },
  { hosts: ['instagram.com'], def: { id: 'instagram', label: 'Instagram', cor: '#E1306C', icone: SiInstagram } },
  { hosts: ['tiktok.com'], def: { id: 'tiktok', label: 'TikTok', cor: '#010101', icone: SiTiktok } },
  { hosts: ['facebook.com', 'fb.com'], def: { id: 'facebook', label: 'Facebook', cor: '#1877F2', icone: SiFacebook } },
  { hosts: ['x.com', 'twitter.com'], def: { id: 'twitter', label: 'X', cor: '#000000', icone: SiX } },
  { hosts: ['threads.net', 'threads.com'], def: { id: 'threads', label: 'Threads', cor: '#000000', icone: SiThreads } },
  { hosts: ['linkedin.com'], def: { id: 'linkedin', label: 'LinkedIn', cor: '#0A66C2', icone: FaLinkedinIn } },
  { hosts: ['twitch.tv'], def: { id: 'twitch', label: 'Twitch', cor: '#9146FF', icone: SiTwitch } },
  { hosts: ['reddit.com'], def: { id: 'reddit', label: 'Reddit', cor: '#FF4500', icone: SiReddit } },
  { hosts: ['snapchat.com'], def: { id: 'snapchat', label: 'Snapchat', cor: '#FFFC00', icone: SiSnapchat } },
  { hosts: ['soundcloud.com'], def: { id: 'soundcloud', label: 'SoundCloud', cor: '#FF5500', icone: SiSoundcloud } },
  { hosts: ['deezer.com', 'deezer.page.link'], def: { id: 'deezer', label: 'Deezer', cor: '#A238FF', icone: SiDeezer } },
  { hosts: ['pocketcasts.com', 'pca.st'], def: { id: 'pocketcasts', label: 'Pocket Casts', cor: '#F43E37', icone: SiPocketcasts } },
  { hosts: ['overcast.fm'], def: { id: 'overcast', label: 'Overcast', cor: '#FC7E0F', icone: SiOvercast } },
  { hosts: ['castbox.fm'], def: { id: 'castbox', label: 'Castbox', cor: '#F55B23', icone: SiCastbox } },
]

export function iconeDoLink(url: string | null): IconeLink {
  if (!url) return GENERICO
  let host: string
  try {
    host = new URL(url).hostname.replace(/^www\./, '').toLowerCase()
  } catch {
    return GENERICO
  }
  for (const { hosts, def } of POR_HOST) {
    if (hosts.some((h) => host === h || host.endsWith(`.${h}`))) return def
  }
  return GENERICO
}

/**
 * Glifo de marca por PLATAFORMA (e não por host), para a fileira de redes.
 *
 * Separado de `POR_HOST` porque a pergunta é outra: ali a entrada é uma URL
 * colada e a saída é "de onde veio este link"; aqui a entrada é uma rede que o
 * criador cadastrou no perfil, e o id dela já é conhecido. Resolver a fileira
 * pelo host obrigaria a montar a URL antes só para desmontá-la em seguida.
 *
 * LinkedIn vem do Font Awesome: o Simple Icons removeu a marca na v5.
 */
export const GLIFO_POR_PLATAFORMA: Record<string, IconType> = {
  instagram: SiInstagram,
  tiktok: SiTiktok,
  youtube: SiYoutube,
  twitter: SiX,
  twitch: SiTwitch,
  linkedin: FaLinkedinIn,
  facebook: SiFacebook,
  spotify: SiSpotify,
  threads: SiThreads,
  reddit: SiReddit,
  snapchat: SiSnapchat,
  applemusic: SiApplemusic,
  soundcloud: SiSoundcloud,
  // O Simple Icons não tem "site genérico" — nem poderia, não é uma marca.
  // Sem esta entrada o Website caía no `PlatformIcon`, que desenha o tile
  // inteiro e destoava dos vizinhos, que aqui são glifo sobre branco.
  website: Globe as IconType,
}

/**
 * Cor do glifo sobre o tile BRANCO da fileira de redes.
 *
 * Para quase toda marca é a cor crua: rosa do Instagram, vermelho do YouTube,
 * preto do TikTok e do X — todas legíveis sobre branco.
 *
 * Marca clara não abre exceção: o Snapchat também é tile branco com o fantasma
 * no amarelo dele (`#FFFC00`). Antes o amarelo virava o FUNDO e o desenho ia a
 * preto, para ganhar contraste — mas isso punha um disco amarelo cheio no meio
 * de uma fileira de tiles brancos. Uma regra só para todas as redes.
 */
export function corSobreBranco(hex: string): { fundo: string; glifo: string } {
  const n = parseInt(hex.slice(1), 16)
  if (Number.isNaN(n)) return { fundo: '#FFFFFF', glifo: '#111111' }
  return { fundo: '#FFFFFF', glifo: hex }
}
