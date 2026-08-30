/**
 * Capa dos links da bio — regras compartilhadas entre cliente e servidor.
 *
 * Espelha `lib/avatar.ts`, e pela mesma razão: sem import de `next/*` nem de
 * cliente Supabase. Quem sobe o arquivo é o card no navegador, quem lê é a
 * página pública no servidor, e o que os dois precisam concordar é o formato do
 * path — porque o path É a autorização (a policy de `storage.objects` compara a
 * primeira pasta com o dono; ver `20260817160000_capa_do_link.sql`).
 */

export const BUCKET_CAPAS = 'capas'

/** Espelha `file_size_limit` do bucket. Aqui é UX (erro antes de subir), lá é
 *  a regra de verdade — os dois números têm que andar juntos. */
export const TAMANHO_MAXIMO_CAPA = 3 * 1024 * 1024

/** Idem `allowed_mime_types`. Serve também para o `accept` do input. */
export const TIPOS_CAPA = ['image/jpeg', 'image/png', 'image/webp'] as const

/**
 * Capa em VÍDEO — privilégio de conta verificada.
 *
 * Dois contêineres e não um: o MP4 (H.264) toca em tudo, inclusive no Safari
 * antigo, e o WebM é o que sai da maioria dos editores web. Formato de fora
 * disso obrigaria a transcodificar no servidor, que é outra ordem de projeto.
 *
 * A trava de verificado NÃO mora aqui — esta lista é conveniência de UI, e um
 * `fetch` direto ao Storage não passa por ela. Quem barra de verdade são duas
 * camadas: a policy `capas_insert` (que confere `bio_verificado` para extensão
 * de vídeo) e `atualizarConfigBio`, que recusa gravar a URL. Ver a migration
 * `20260830120000_capa_em_video`.
 */
export const TIPOS_CAPA_VIDEO = ['video/mp4', 'video/webm'] as const

/**
 * Teto do vídeo. Bem acima do da imagem porque um clipe de poucos segundos já
 * passa de 3 MiB — e ele é a primeira coisa que carrega na página, então o
 * limite é o que impede a capa de virar uma tela preta no 4G.
 */
export const TAMANHO_MAXIMO_CAPA_VIDEO = 15 * 1024 * 1024

export type ErroCapa = 'tipo_invalido' | 'muito_grande'

/** É um vídeo, pela extensão da URL pública. Vale no servidor e no cliente —
 *  é a única leitura possível a partir de uma URL guardada em texto. */
export function ehVideoCapa(url: string | null | undefined): boolean {
  if (!url) return false
  return /\.(mp4|webm)(?:[?#]|$)/i.test(url)
}

/** Valida antes de subir. `null` = pode ir. */
export function validarCapa(file: File, permiteVideo = false): ErroCapa | null {
  const ehVideo = TIPOS_CAPA_VIDEO.includes(file.type as (typeof TIPOS_CAPA_VIDEO)[number])

  if (ehVideo) {
    // Vídeo de quem não pode mandar vídeo é TIPO inválido, não permissão
    // negada: sem o privilégio, vídeo simplesmente não é um formato de capa, e
    // "arquivo não suportado" é a verdade que a pessoa precisa ler.
    if (!permiteVideo) return 'tipo_invalido'
    return file.size > TAMANHO_MAXIMO_CAPA_VIDEO ? 'muito_grande' : null
  }

  if (!TIPOS_CAPA.includes(file.type as (typeof TIPOS_CAPA)[number])) return 'tipo_invalido'
  if (file.size > TAMANHO_MAXIMO_CAPA) return 'muito_grande'
  return null
}

function extensaoDe(file: File): string {
  if (file.type === 'image/png') return 'png'
  if (file.type === 'image/webp') return 'webp'
  if (file.type === 'video/mp4') return 'mp4'
  if (file.type === 'video/webm') return 'webm'
  return 'jpg'
}

/**
 * `{user_id}/{aleatório}.{ext}`.
 *
 * Nome sorteado, não fixo, por causa de cache: a URL pública de um arquivo
 * sobrescrito continua servindo a imagem antiga em CDN e no navegador por um
 * tempo. Path novo a cada troca é URL nova, e o problema não existe.
 */
export function montarPathCapa(userId: string, file: File): string {
  return `${userId}/${crypto.randomUUID()}.${extensaoDe(file)}`
}

/** O path dentro do bucket, extraído da URL pública — é o que a remoção do
 *  arquivo antigo precisa. `null` para URL de outro lugar. */
export function pathDaCapa(url: string | null | undefined): string | null {
  if (!url) return null
  const marca = `/${BUCKET_CAPAS}/`
  const i = url.indexOf(marca)
  return i === -1 ? null : url.slice(i + marca.length) || null
}
