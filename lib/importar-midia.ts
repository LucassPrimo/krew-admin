import { BUCKET_AVATARES, TAMANHO_MAXIMO_AVATAR, montarPathAvatar } from '@/lib/avatar'
import { BUCKET_CAPAS, TAMANHO_MAXIMO_CAPA, montarPathCapa } from '@/lib/capa-link'
import { clienteAdmin } from '@/lib/supabase-admin'

/**
 * Traz a imagem do link.me para o NOSSO bucket.
 *
 * ---------------------------------------------------------------------------
 * Por que copiar em vez de apontar
 * ---------------------------------------------------------------------------
 * O importador guardava a URL do CDN de origem (`media.link.me/...`) direto em
 * `capa_url` e `avatar_url`. Funcionava, e tinha três defeitos que só aparecem
 * depois:
 *
 *   - a página da Krew servia arte hospedada por outra empresa, consumindo
 *     banda dela — o que transforma um problema de termos de uso em algo
 *     visível e fácil de detectar do outro lado;
 *   - a oferta quebrava sozinha no dia em que eles trocassem a URL ou
 *     bloqueassem hotlink, e ninguém seria avisado;
 *   - quando o criador assumisse a conta, a página dele continuaria dependendo
 *     do serviço que ele acabou de deixar.
 *
 * ---------------------------------------------------------------------------
 * O path é o mesmo que o app usaria
 * ---------------------------------------------------------------------------
 * `{user_id_do_criador}/{aleatório}.{ext}`, pelos MESMOS módulos de regra
 * (`lib/avatar.ts`, `lib/capa-link.ts`) que o `subirImagemDaOferta` usa. É o
 * que faz o arquivo já nascer na pasta certa: quando a pessoa assumir a conta,
 * a sessão dela troca e apaga cada imagem sem migração nenhuma.
 */

/**
 * De onde aceitamos buscar.
 *
 * Esta função faz o SERVIDOR baixar uma URL que veio de uma página raspada —
 * ou seja, de fora. Sem allowlist seria um proxy para qualquer endereço
 * alcançável de dentro da infraestrutura, IPs internos e endpoint de metadata
 * da nuvem incluídos. É o mesmo SSRF que `buscarPerfil` já barra, e o fato de
 * a URL ter vindo de um HTML "confiável" não muda nada: quem escreve o HTML é
 * o dono do perfil.
 *
 * Só link.me e linktr.ee porque são os únicos lugares de onde importamos —
 * um host por importador, e nada além. Capa hospedada em outro domínio não é
 * baixada nem apontada — some, e o aviso diz isso.
 *
 * No Linktree a arte que interessa vem de `ugc.production.linktr.ee` (o
 * bucket de upload do criador); os SVGs de ícone de `assets.` também casam
 * com o padrão, mas morrem no filtro de `content-type` logo abaixo, que só
 * aceita jpeg/png/webp.
 */
const HOSTS_DE_MIDIA = /^([a-z0-9-]+\.)*(link\.me|linktr\.ee)$/i

const TIPOS_ACEITOS = ['image/jpeg', 'image/png', 'image/webp']

function extensaoDoTipo(tipo: string): string {
  if (tipo === 'image/png') return 'png'
  if (tipo === 'image/webp') return 'webp'
  return 'jpg'
}

/**
 * Baixa e guarda. Devolve a URL pública nossa, ou `null` quando não deu — e
 * `null` significa "sem imagem", nunca "fica a do link.me".
 *
 * Nada aqui derruba a criação da oferta: uma capa que não veio é um card sem
 * arte, que a página já sabe desenhar (vira botão). Abortar a importação
 * inteira por causa de uma imagem seria trocar um problema pequeno por um
 * grande.
 */
export async function trazerImagem(
  urlOrigem: string | null | undefined,
  userId: string,
  tipo: 'avatar' | 'capa',
): Promise<string | null> {
  if (!urlOrigem) return null

  let alvo: URL
  try {
    alvo = new URL(urlOrigem)
  } catch {
    return null
  }
  if (alvo.protocol !== 'https:') return null
  if (!HOSTS_DE_MIDIA.test(alvo.hostname)) return null

  const limite = tipo === 'avatar' ? TAMANHO_MAXIMO_AVATAR : TAMANHO_MAXIMO_CAPA

  try {
    const resposta = await fetch(alvo.toString(), {
      signal: AbortSignal.timeout(15_000),
      cache: 'no-store',
    })
    if (!resposta.ok) return null

    const contentType = (resposta.headers.get('content-type') ?? '').split(';')[0].trim()
    if (!TIPOS_ACEITOS.includes(contentType)) return null

    // O `content-length` é uma dica, não uma garantia — um servidor pode
    // mentir ou omitir. Por isso o tamanho é conferido DEPOIS de ler, contra o
    // mesmo limite do bucket: o corte de verdade acontece sobre o byte real.
    const bytes = await resposta.arrayBuffer()
    if (bytes.byteLength === 0 || bytes.byteLength > limite) return null

    const arquivo = new File([bytes], `importado.${extensaoDoTipo(contentType)}`, {
      type: contentType,
    })
    const bucket = tipo === 'avatar' ? BUCKET_AVATARES : BUCKET_CAPAS
    const path =
      tipo === 'avatar' ? montarPathAvatar(userId, arquivo) : montarPathCapa(userId, arquivo)

    const supabase = clienteAdmin()
    const { error } = await supabase.storage.from(bucket).upload(path, arquivo, {
      contentType,
      upsert: false,
    })
    if (error) return null

    return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl
  } catch {
    return null
  }
}
