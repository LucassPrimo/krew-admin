'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath, updateTag } from 'next/cache'
import { getCurrentOrgId } from '@/lib/org'
import { buscarPreviaDoSite } from '@/lib/link-preview'
import { BUCKET_CAPAS } from '@/lib/capa-link'
import { tagBio } from '@/lib/bio/consulta'
import { getAssinatura } from '@/lib/assinatura-server'
import { estadoAssinatura, temAcesso } from '@/lib/assinatura'
import { ehPro, LIMITE_LINKS_FREE, LIMITE_SECOES_FREE } from '@/lib/plano'
// Os tipos da bio pública moram em `lib/bio/tipos.ts` — ver o porquê lá.
//
// E NÃO são reexportados daqui: `export type { X } from '...'` num arquivo
// `'use server'` faz o Next tratar cada tipo como server action e o build cai
// com "The export TipoItem was not found in module". Quem precisa dos tipos
// importa direto de `lib/bio/tipos`.
import type { TipoItem, EstiloItem } from '@/lib/bio/tipos'

/**
 * NÃO exportados, e isso é uma regra do Next, não escolha de estilo: um arquivo
 * `'use server'` só pode exportar funções async. Exportar um array derruba o
 * build com "can only export async functions, found object".
 */
const TIPOS_ITEM: TipoItem[] = ['link', 'divisor']
const ESTILOS_ITEM: EstiloItem[] = ['grande', 'metade', 'metade_alta', 'meio', 'botao']

/**
 * Página de bio (`/@handle`) — o link que o criador cola na bio do Instagram.
 *
 * Leitura pública passa por `get_bio_by_slug`, SECURITY DEFINER, pelo mesmo
 * motivo do mídia kit (`app/actions/kit.ts`): redes, métricas e links têm RLS
 * por org e a página roda como `anon`. Ler direto das tabelas devolve vazio.
 *
 * A configuração mora em `proposal_pages` — mesma linha, mesmo slug das outras
 * duas vitrines. Um segundo slug por criador seria confuso de explicar e pior
 * de manter.
 */

/**
 * A leitura pública da bio mora em `lib/bio/consulta.ts`, cacheada por slug.
 * Não pode viver aqui: este arquivo é `'use server'` e só exporta funções
 * async, e a versão cacheada não é uma. Os tipos acima continuam aqui porque
 * tipo é apagado na compilação.
 */

// ---------------------------------------------------------------------------
// Configuração (dono da página)
// ---------------------------------------------------------------------------

/** Claro/escuro só da bio — editado em `/config/aparencia`, junto do resto do tema.
 *  Continua separado de `proposal_pages.theme` (ver migration 20260817181701):
 *  a bio é foto de tela cheia falando com o fã, o /publi é formulário falando
 *  com a marca. */
export type TemaBio = 'dark' | 'light'

export interface ConfigBio {
  bio_ativo: boolean
  /** Capa do topo, no bucket `capas`. Null = a foto de perfil. */
  bio_capa_url: string | null
  /** Fundo da página, em hex. Null = o preto padrão (`COR_FUNDO_PADRAO`). */
  bio_bg_color: string | null
  bio_headline: string | null
  bio_texto: string | null
  bio_mostrar_seguidores: boolean
  bio_mostrar_propostas: boolean
  bio_esconder_marca: boolean
}

export async function getConfigBio() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('proposal_pages')
    .select(
      'slug, bio_ativo, bio_bg_color, bio_capa_url, bio_headline, bio_texto, bio_mostrar_seguidores, bio_mostrar_propostas, bio_esconder_marca'
    )
    .eq('user_id', user.id)
    .maybeSingle()

  return data as (ConfigBio & { slug: string }) | null
}

/**
 * Hex válido em maiúsculas, ou `null`.
 *
 * `null` não é erro: é "volta ao padrão". Um hex quebrado (colado torto, vindo
 * de um input antigo) escrito direto na coluna seria recusado pelo CHECK e a
 * pessoa levaria uma mensagem de Postgres na tela — devolver ao preto é o
 * resultado que ela consegue entender e desfazer.
 */
function normalizarCorFundo(valor: boolean | string | null): string | null {
  if (typeof valor !== 'string') return null
  const limpo = valor.trim().toUpperCase()
  return /^#[0-9A-F]{6}$/.test(limpo) ? limpo : null
}

/**
 * Salva um campo de config por vez.
 *
 * A UI são toggles soltos — salvar o objeto inteiro a cada clique faria dois
 * switches disputarem o mesmo `update` e o último a responder venceria,
 * desfazendo o outro. Campo a campo, cada toggle escreve só o que mexeu.
 */
/**
 * Derruba o cache da bio pública deste creator.
 *
 * Complemento do `revalidatePath('/profile')`, não substituto: aquele atualiza a
 * TELA DE EDIÇÃO no dashboard; este, a página pública `/@slug`, que tem cache
 * próprio. Esquecer este faz o creator salvar, abrir o link e ver a versão
 * velha — o que ele lê como "não salvou", nunca como cache.
 *
 * `updateTag` e não `revalidateTag`: no Next 16 é ele que dá
 * read-your-own-writes. `revalidateTag` apenas marca a entrada como vencida, e
 * a primeira leitura seguinte ainda serve o valor antigo — que seria
 * exatamente a conferida do creator. Só pode ser chamado de Server Action.
 *
 * A consulta do slug existe porque as actions trabalham por `user.id`. Ela só
 * roda quando alguém EDITA; o caminho do visitante não passa por aqui.
 */
async function invalidarBioPublica(userId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('proposal_pages')
    .select('slug')
    .eq('user_id', userId)
    .maybeSingle()

  if (data?.slug) updateTag(tagBio(data.slug))
}

/** Os campos que só o plano pago liga. Ver a checagem em `atualizarConfigBio`. */
const CAMPOS_PAGOS: (keyof ConfigBio)[] = [
  'bio_mostrar_seguidores',
  'bio_mostrar_propostas',
  'bio_esconder_marca',
]

export async function atualizarConfigBio(campo: keyof ConfigBio, valor: boolean | string | null) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  const CAMPOS: (keyof ConfigBio)[] = [
    'bio_ativo',
    'bio_bg_color',
    'bio_capa_url',
    'bio_headline',
    'bio_texto',
    'bio_mostrar_seguidores',
    'bio_mostrar_propostas',
    'bio_esconder_marca',
  ]
  if (!CAMPOS.includes(campo)) return { error: 'Campo inválido.' }

  // Os três interruptores pagos da bio — mesmo a bio inteira sendo grátis.
  // Quem já tem `false` continua podendo desligar (ninguém precisa pagar pra
  // desligar algo), só LIGAR exige plano de pé. Checado aqui, não só no switch
  // do cliente: o switch desabilitado é UX, não segurança — sem isto, chamar a
  // action direto contornaria o gate.
  //
  // Seguidores e marca do rodapé seguem `ehPro` (o tiering da bio); o botão de
  // proposta segue `temAcesso` (o gate geral do app, porque proposta é o resto
  // do produto entrando na página). Hoje os dois olham os mesmos três estados,
  // mas são interruptores diferentes de propósito — ver `lib/plano.ts`.
  //
  // Isto barra ligar sem plano. Quem ligou pagando e parou de pagar não é
  // barrado aqui: a coluna continua `true` e é a LEITURA que rebaixa a página
  // (`rebaixarBioParaFree`), o que devolve tudo intacto quando o pagamento
  // volta.
  if (valor === true && CAMPOS_PAGOS.includes(campo)) {
    // Bio de oferta em aberto não passa pelo gate. Ela é vitrine da Krew — a
    // conta-fantasma não tem plano porque não tem ninguém —, e barrá-la fazia
    // o switch do painel voltar sozinho, sem mensagem, porque o `ToggleBio`
    // desfaz em silêncio. É a mesma regra de `rebaixarBioParaFree`, e a
    // definição de "aberta" mora numa função só (ver a migration
    // `20260828150000_oferta_aberta_helper`): não aceita E com a conta nunca
    // acessada. Quem entrou na conta tem conta, e volta a pagar como todo
    // mundo mesmo antes de o painel marcar o aceite.
    const { data: ehOfertaAberta } = await supabase.rpc('oferta_aberta_do_usuario', {
      p_user_id: user.id,
    })

    const { assinatura } = await getAssinatura(user.id)
    const liberado =
      ehOfertaAberta === true ||
      (campo === 'bio_mostrar_propostas'
        ? temAcesso(estadoAssinatura(assinatura))
        : ehPro(assinatura))

    if (!liberado) {
      return {
        error:
          campo === 'bio_mostrar_propostas'
            ? 'Recurso pago: assine para ativar o botão de propostas.'
            : 'Recurso PRO: assine para ativar.',
      }
    }
  }

  // A cor não passa pelo corte de 500 caracteres dos campos de texto: ela tem
  // um formato, e um valor fora dele seria recusado pelo CHECK da coluna com
  // uma mensagem de Postgres na cara da pessoa. Hex inválido vira null — que
  // é "volta ao padrão", o mesmo efeito do botão de limpar.
  const limpo =
    campo === 'bio_bg_color'
      ? normalizarCorFundo(valor)
      : typeof valor === 'string'
        ? valor.trim().slice(0, 500) || null
        : valor

  // `select('slug')` no próprio update: esta action já mira `proposal_pages`,
  // então o slug volta de graça e dispensa a consulta do `invalidarBioPublica`.
  const { data: pagina, error } = await supabase
    .from('proposal_pages')
    .update({ [campo]: limpo })
    .eq('user_id', user.id)
    .select('slug')
    .maybeSingle()

  if (error) return { error: error.message }

  revalidatePath('/profile')
  if (pagina?.slug) updateTag(tagBio(pagina.slug))
  return { success: true }
}

/**
 * Nome exibido na bio.
 *
 * Mora em `profiles`, não em `proposal_pages`: é o nome da PESSOA, o mesmo que
 * aparece no menu do app e nas propostas — a bio só o exibe. Por isso a action
 * é separada de `atualizarConfigBio`, que só toca a página.
 *
 * Sempre o próprio usuário (`user.id`), nunca o creator operado: a RLS de
 * `profiles` só deixa cada um editar a própria linha, e uma agência renomeando
 * o creator seria edição de identidade alheia, não operação da bio. A tela
 * esconde o campo nesse caso — isto aqui é a rede de segurança.
 */
export async function atualizarNomeDoPerfil(nome: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  const limpo = nome.trim().slice(0, 80)
  if (!limpo) return { error: 'O nome não pode ficar vazio.' }

  const { error } = await supabase.from('profiles').update({ full_name: limpo }).eq('id', user.id)
  if (error) return { error: error.message }

  // A bio pública mostra o nome, então o cache dela também sai do ar.
  const { data: pagina } = await supabase
    .from('proposal_pages')
    .select('slug')
    .eq('user_id', user.id)
    .maybeSingle()

  revalidatePath('/profile')
  if (pagina?.slug) updateTag(tagBio(pagina.slug))
  return { success: true }
}

// ---------------------------------------------------------------------------
// Links personalizados
// ---------------------------------------------------------------------------

/**
 * A URL vai direto para o `href` de uma página pública. Sem esta validação,
 * `javascript:...` salvo aqui viraria XSS em cima do visitante de outra pessoa.
 */
function validarUrl(url: string): string | null {
  const limpo = url.trim()
  if (!limpo) return null
  const comProtocolo = /^https?:\/\//i.test(limpo) ? limpo : `https://${limpo}`
  try {
    const parsed = new URL(comProtocolo)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
    return parsed.toString()
  } catch {
    return null
  }
}

/**
 * Busca a `og:image` do site e guarda no nosso bucket.
 *
 * Roda no caminho de salvar o link, com orçamento de tempo curto (ver
 * `buscarPreviaDoSite`): é enfeite, e enfeite não pode segurar o salvamento de
 * ninguém. Falhou, devolve `null` e o card cai no bloco tingido de sempre.
 *
 * Upload com a sessão do próprio usuário, no path `{user_id}/…`: é o que a
 * policy do bucket autoriza, e mantém a prévia sujeita às mesmas regras de uma
 * capa que ele tivesse subido à mão.
 */
async function guardarPrevia(userId: string, url: string): Promise<string | null> {
  const previa = await buscarPreviaDoSite(url)
  if (!previa) return null

  const extensao = previa.contentType.split('/')[1] ?? 'jpg'
  const caminho = `${userId}/previa-${crypto.randomUUID()}.${extensao}`

  const supabase = await createClient()
  const { error } = await supabase.storage
    .from(BUCKET_CAPAS)
    .upload(caminho, previa.bytes, { contentType: previa.contentType })

  if (error) return null

  return supabase.storage.from(BUCKET_CAPAS).getPublicUrl(caminho).data.publicUrl
}

/**
 * A lista inteira, na ordem — links e divisores juntos.
 *
 * Uma lista só, e não uma por seção: a ordem É o produto desta tela, e o
 * arrasto move um item entre divisores. Separar em listas tornaria impossível
 * arrastar um link de uma seção para outra, que é a operação mais comum.
 */
export async function getLinksBio() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []

  const { data } = await supabase
    .from('creator_links')
    .select('id, titulo, url, capa_url, preview_url, tipo, estilo, ordem, ativo')
    .eq('user_id', user.id)
    .order('ordem')
    .order('created_at')

  return data ?? []
}

/**
 * Cria um link ou um divisor.
 *
 * Uma função para os dois porque a diferença é uma coluna: divisor é um item
 * com título e sem URL. Uma `criarDivisorBio` separada duplicaria o cálculo de
 * `ordem`, a checagem de org e o `revalidatePath` para não mudar mais nada.
 */
export async function criarLinkBio(
  titulo: string,
  url: string,
  capaUrl?: string | null,
  tipo: TipoItem = 'link',
  estilo: EstiloItem = 'grande'
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  const orgId = await getCurrentOrgId()
  if (!orgId) return { error: 'Sem organização ativa' }

  if (!TIPOS_ITEM.includes(tipo)) return { error: 'tipo_invalido' as const }
  if (!ESTILOS_ITEM.includes(estilo)) return { error: 'estilo_invalido' as const }

  const nome = titulo.trim().slice(0, 80)
  if (!nome) return { error: 'titulo_vazio' as const }

  // Divisor não tem URL, e por isso também não tem capa nem busca de prévia:
  // ele é uma linha de texto entre dois blocos.
  const ehDivisor = tipo === 'divisor'
  const urlValida = ehDivisor ? null : validarUrl(url)
  if (!ehDivisor && !urlValida) return { error: 'url_invalida' as const }

  // Free trava em 1 seção e 3 links — Pro é ilimitado. Checado no servidor e
  // não só na UI porque a action é o único portão real; o botão desabilitado
  // no card é só o aviso antecipado.
  //
  // Bio de oferta em aberto não tem teto, pela mesma razão dos interruptores
  // pagos em `atualizarConfigBio` e do `bio.oferta` em `rebaixarBioParaFree`:
  // a conta-fantasma não tem plano porque não tem ninguém, e a oferta é a
  // vitrine que existe para VENDER o plano — montá-la com 3 links e 1 seção
  // não venderia nada. O editor do painel já manda `pro` para o card, mas a
  // UI liberada sozinha só troca o botão desabilitado por uma mensagem de
  // erro depois do clique: o portão é aqui.
  const { data: ehOfertaAberta } = await supabase.rpc('oferta_aberta_do_usuario', {
    p_user_id: user.id,
  })

  const { assinatura } = await getAssinatura(user.id)
  if (ehOfertaAberta !== true && !ehPro(assinatura)) {
    const { count } = await supabase
      .from('creator_links')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('tipo', tipo)

    const limite = ehDivisor ? LIMITE_SECOES_FREE : LIMITE_LINKS_FREE
    if ((count ?? 0) >= limite) {
      return { error: ehDivisor ? ('limite_secoes' as const) : ('limite_links' as const) }
    }
  }

  // Entra no fim da lista. `max + 1` em vez de `count` porque remover um item
  // do meio deixa buracos na numeração — contar geraria ordem duplicada.
  const { data: ultimo } = await supabase
    .from('creator_links')
    .select('ordem')
    .eq('user_id', user.id)
    .order('ordem', { ascending: false })
    .limit(1)
    .maybeSingle()

  // Devolve a linha criada, e isso não é conveniência: a lista no card vive em
  // estado local (para o arrasto responder na hora), e `revalidatePath` sozinho
  // não reinicializa `useState` — sem a linha de volta, o link só apareceria
  // depois de um reload manual.
  // Só busca prévia quando não há capa própria: quem já escolheu a imagem não
  // precisa esperar por um palpite que não vai ser usado.
  const previa = capaUrl || ehDivisor ? null : await guardarPrevia(user.id, urlValida!)

  const { data: criado, error } = await supabase
    .from('creator_links')
    .insert({
      user_id: user.id,
      org_id: orgId,
      titulo: nome,
      url: urlValida,
      capa_url: ehDivisor ? null : capaUrl || null,
      preview_url: previa,
      tipo,
      estilo,
      ordem: (ultimo?.ordem ?? -1) + 1,
    })
    .select('id, titulo, url, capa_url, preview_url, tipo, estilo, ordem, ativo')
    .single()

  if (error) return { error: error.message }

  revalidatePath('/profile')
  await invalidarBioPublica(user.id)
  return { success: true, link: criado }
}

export async function atualizarLinkBio(
  id: string,
  campos: {
    titulo?: string
    url?: string
    ativo?: boolean
    capaUrl?: string | null
    estilo?: EstiloItem
  }
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  const update: Record<string, unknown> = {}

  if (campos.titulo !== undefined) {
    const nome = campos.titulo.trim().slice(0, 80)
    if (!nome) return { error: 'titulo_vazio' as const }
    update.titulo = nome
  }

  if (campos.url !== undefined) {
    const urlValida = validarUrl(campos.url)
    if (!urlValida) return { error: 'url_invalida' as const }
    update.url = urlValida
    // URL nova, prévia nova: a antiga é de outra página. `null` quando não se
    // acha nada, senão o card ficaria com a imagem do site anterior.
    update.preview_url = await guardarPrevia(user.id, urlValida)
  }

  if (campos.ativo !== undefined) update.ativo = campos.ativo

  if (campos.estilo !== undefined) {
    if (!ESTILOS_ITEM.includes(campos.estilo)) return { error: 'estilo_invalido' as const }
    update.estilo = campos.estilo
  }

  // `null` explícito remove a capa; `undefined` deixa como está. Sem essa
  // distinção não haveria como voltar um card para o bloco tingido.
  if (campos.capaUrl !== undefined) update.capa_url = campos.capaUrl || null

  if (Object.keys(update).length === 0) return { success: true }

  const { error } = await supabase
    .from('creator_links')
    .update(update)
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return { error: error.message }

  revalidatePath('/profile')
  await invalidarBioPublica(user.id)
  return { success: true }
}

export async function removerLinkBio(id: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  const { error } = await supabase
    .from('creator_links')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return { error: error.message }

  revalidatePath('/profile')
  await invalidarBioPublica(user.id)
  return { success: true }
}

/**
 * Reordena a lista inteira. A UI arrasta e já sabe a ordem final — mandar o
 * array completo evita ter que calcular deslocamentos de vizinhos aqui.
 */
export async function reordenarLinksBio(ids: string[]) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  for (const [ordem, id] of ids.entries()) {
    const { error } = await supabase
      .from('creator_links')
      .update({ ordem })
      .eq('id', id)
      .eq('user_id', user.id)
    if (error) return { error: error.message }
  }

  revalidatePath('/profile')
  await invalidarBioPublica(user.id)
  return { success: true }
}
