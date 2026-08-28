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

export type ErroCapa = 'tipo_invalido' | 'muito_grande'

/** Valida antes de subir. `null` = pode ir. */
export function validarCapa(file: File): ErroCapa | null {
  if (!TIPOS_CAPA.includes(file.type as (typeof TIPOS_CAPA)[number])) return 'tipo_invalido'
  if (file.size > TAMANHO_MAXIMO_CAPA) return 'muito_grande'
  return null
}

function extensaoDe(file: File): string {
  if (file.type === 'image/png') return 'png'
  if (file.type === 'image/webp') return 'webp'
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
