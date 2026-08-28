'use server'

import { alvoAtual } from '@/lib/alvo'
import { autorizarEscritaSemStepUp } from '@/lib/auth'
import { BUCKET_AVATARES, montarPathAvatar, validarAvatar } from '@/lib/avatar'
import { BUCKET_CAPAS, montarPathCapa, pathDaCapa, validarCapa } from '@/lib/capa-link'
import { clienteAdmin } from '@/lib/supabase-admin'

/**
 * Upload de imagem da oferta, pelo servidor.
 *
 * No app o arquivo vai do navegador direto para o Storage, porque a policy do
 * bucket autoriza pelo PATH: a primeira pasta tem que ser o `auth.uid()` de
 * quem sobe. Aqui isso não funciona — quem está logado é você, e a pasta é a do
 * criador. A policy negaria, e com razão.
 *
 * Então sobe pelo servidor, com a chave de serviço. E grava no MESMO path que o
 * app usaria (`{user_id_do_criador}/{aleatório}.{ext}`), o que tem uma
 * consequência que importa: quando a pessoa assumir a conta, os arquivos já
 * estão na pasta dela, e a sessão dela troca e apaga cada um sem migração.
 *
 * De quem é a pasta vem do cookie de alvo, validado contra `bio_ofertas` — não
 * do formulário. Só página de oferta recebe upload por aqui.
 */
export async function subirImagemDaOferta(
  tipo: 'avatar' | 'capa',
  form: FormData,
  antigaUrl?: string | null,
): Promise<{ ok: true; url: string } | { ok: false; erro: string }> {
  const permissao = await autorizarEscritaSemStepUp()
  if (!permissao.ok) return { ok: false, erro: permissao.texto }

  const alvo = await alvoAtual()
  if (!alvo) return { ok: false, erro: 'Nenhuma oferta aberta para receber a imagem.' }

  const arquivo = form.get('arquivo')
  if (!(arquivo instanceof File) || arquivo.size === 0) {
    return { ok: false, erro: 'Nenhum arquivo recebido.' }
  }

  // Mesma validação do app, pelos mesmos módulos: os limites do bucket e os do
  // código têm que andar juntos, e a única forma de garantir isso é ser o
  // mesmo arquivo de regras nos dois repositórios.
  const problema = tipo === 'avatar' ? validarAvatar(arquivo) : validarCapa(arquivo)
  if (problema === 'tipo_invalido') return { ok: false, erro: 'Use JPG, PNG ou WebP.' }
  if (problema === 'muito_grande') {
    return { ok: false, erro: tipo === 'avatar' ? 'A foto passa de 2 MB.' : 'A imagem passa de 3 MB.' }
  }

  const bucket = tipo === 'avatar' ? BUCKET_AVATARES : BUCKET_CAPAS
  const path = tipo === 'avatar'
    ? montarPathAvatar(alvo.userId, arquivo)
    : montarPathCapa(alvo.userId, arquivo)

  const supabase = clienteAdmin()
  const { error } = await supabase.storage.from(bucket).upload(path, arquivo, {
    contentType: arquivo.type,
    // O path é sorteado a cada envio, então não há o que sobrescrever —
    // `upsert: false` transforma uma colisão improvável em erro visível em vez
    // de apagar o arquivo de outra pessoa em silêncio.
    upsert: false,
  })
  if (error) return { ok: false, erro: error.message }

  // O arquivo antigo sai depois do novo entrar: se a remoção falhar, sobra um
  // órfão no bucket — que é muito melhor do que a página ficar sem imagem
  // porque a ordem foi invertida.
  const antigo = pathDaCapa(antigaUrl)
  if (antigo && tipo === 'capa') {
    await supabase.storage.from(BUCKET_CAPAS).remove([antigo])
  }

  return { ok: true, url: supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl }
}

/** Apaga uma capa do bucket. Mesma razão de existir do upload: a policy do
 *  Storage autoriza pelo path, e o painel não satisfaz esse path. */
export async function removerCapaDaOferta(url: string | null | undefined): Promise<void> {
  const permissao = await autorizarEscritaSemStepUp()
  if (!permissao.ok) return

  const alvo = await alvoAtual()
  const path = pathDaCapa(url)
  if (!alvo || !path) return

  // O path começa com o id do dono. Conferir isso antes de apagar impede que
  // uma URL de outra conta, colada à mão no campo, faça o painel remover um
  // arquivo que não é desta oferta.
  if (!path.startsWith(`${alvo.userId}/`)) return

  await clienteAdmin().storage.from(BUCKET_CAPAS).remove([path])
}
