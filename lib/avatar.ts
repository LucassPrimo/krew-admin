/**
 * Foto de perfil — regras compartilhadas entre cliente e servidor.
 *
 * Sem import de `next/*` nem de cliente Supabase: quem faz o upload é o
 * componente do perfil (browser), e quem lê é o layout (servidor). O que os
 * dois precisam concordar é o formato do path, porque ele É a autorização —
 * a policy de `storage.objects` lê a primeira pasta e compara com o dono
 * (ver `20260814120000_avatar_do_perfil.sql`).
 */

export const BUCKET_AVATARES = 'avatares'

/** Espelha `file_size_limit` do bucket. Aqui é UX (erro antes de subir), lá é
 *  a regra de verdade — os dois números têm que andar juntos. */
export const TAMANHO_MAXIMO_AVATAR = 2 * 1024 * 1024

/** Idem `allowed_mime_types`. Serve também para o `accept` do input. */
export const TIPOS_AVATAR = ['image/jpeg', 'image/png', 'image/webp'] as const

export type ErroAvatar = 'tipo_invalido' | 'muito_grande'

/** Valida antes de subir. `null` = pode ir. */
export function validarAvatar(file: File): ErroAvatar | null {
  if (!TIPOS_AVATAR.includes(file.type as (typeof TIPOS_AVATAR)[number])) return 'tipo_invalido'
  if (file.size > TAMANHO_MAXIMO_AVATAR) return 'muito_grande'
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
 * O nome é sorteado, e não fixo tipo `avatar.jpg`, por causa de cache: a URL
 * pública de um arquivo sobrescrito continua servindo a imagem antiga em CDN e
 * no navegador por um tempo — a pessoa troca a foto e continua vendo a de
 * antes. Path novo a cada troca é uma URL nova, e o problema não existe.
 */
export function montarPathAvatar(userId: string, file: File): string {
  return `${userId}/${crypto.randomUUID()}.${extensaoDe(file)}`
}

/**
 * O path dentro do bucket, extraído de uma URL pública — é o que a remoção do
 * arquivo antigo precisa. `null` para qualquer URL que não seja deste bucket
 * (foto vinda de outro lugar, URL manual), porque aí não há o que apagar.
 */
export function pathDoAvatar(url: string | null | undefined): string | null {
  if (!url) return null
  const marca = `/${BUCKET_AVATARES}/`
  const i = url.indexOf(marca)
  return i === -1 ? null : url.slice(i + marca.length) || null
}
