'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath, updateTag } from 'next/cache'
import { getCurrentOrgId } from '@/lib/org'
import { embedDoSpotify } from '@/lib/bio/spotify'
import { ehVideoCapa } from '@/lib/capa-link'
import { buscarPreviaDoSite } from '@/lib/link-preview'
import { BUCKET_CAPAS } from '@/lib/capa-link'
import { tagBio } from '@/lib/bio/consulta'
import { invalidarBioPublica } from '@/lib/bio/invalidar'
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
const TIPOS_ITEM: TipoItem[] = ['link', 'divisor', 'marca', 'spotify']
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
  /** Nome da marca sobre a logo, no carrossel de parcerias. */
  bio_marcas_nome: boolean
  /** Selo concedido pela Krew. Só de leitura aqui — é o que libera a capa em
   *  vídeo, e ninguém o concede a si mesmo. */
  bio_verificado: boolean
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
      'slug, bio_ativo, bio_bg_color, bio_capa_url, bio_headline, bio_texto, bio_mostrar_seguidores, bio_mostrar_propostas, bio_esconder_marca, bio_marcas_nome, bio_verificado'
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
    // Fora de `CAMPOS_PAGOS`: o carrossel de parcerias inteiro é gratuito.
    'bio_marcas_nome',
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

  /**
   * Capa em vídeo é privilégio de conta verificada — e a checagem é aqui porque
   * é aqui que a capa vira PÚBLICA.
   *
   * A policy `capas_insert` já barra o arquivo (ver a migration
   * `20260830120000_capa_em_video`). Esta segunda porta existe porque as duas
   * guardam coisas diferentes: um MP4 esquecido no bucket que nenhuma página
   * aponta é lixo; um MP4 no `bio_capa_url` é o que o mundo vê. Se um dia
   * alguém entrar no bucket por outro caminho — um script com chave de serviço,
   * um bug de policy —, a página continua sem tocar o vídeo.
   *
   * Pela EXTENSÃO da URL, e não pelo MIME: o que está guardado aqui é texto, e
   * é a mesma leitura que a página faz para decidir entre `<img>` e `<video>`.
   * As duas concordarem é o que impede a capa de ser recusada aqui e tocada lá,
   * ou o contrário.
   */
  if (campo === 'bio_capa_url' && ehVideoCapa(valor as string)) {
    const { data: pagina } = await supabase
      .from('proposal_pages')
      .select('bio_verificado')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!pagina?.bio_verificado) {
      return { error: 'Capa em vídeo é exclusiva de contas verificadas.' }
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
    // As marcas parceiras moram na mesma tabela (`tipo = 'marca'`) mas são
    // outro bloco da página: o carrossel acima da lista. Sem este `neq` elas
    // apareceriam aqui como links, arrastáveis para um lugar onde a página
    // nunca as desenha. Mesmo filtro do app (`app/actions/bio.ts` de lá).
    .neq('tipo', 'marca')
    .order('ordem')
    .order('created_at')

  return data ?? []
}

/**
 * As marcas parceiras, na ordem — o outro lado do `neq` acima.
 *
 * Consulta própria e não um filtro no cliente: são duas listas com dois
 * arrastes independentes, e trazer as duas juntas só para separá-las depois
 * faria a tela de links recarregar a cada logo adicionada.
 */
export async function getMarcasBio() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []

  const { data } = await supabase
    .from('creator_links')
    .select('id, titulo, url, capa_url, preview_url, tipo, estilo, ordem, ativo')
    .eq('user_id', user.id)
    .eq('tipo', 'marca')
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

  // Divisor não tem URL, e por isso também não tem capa nem busca de prévia:
  // ele é uma linha de texto entre dois blocos.
  const ehDivisor = tipo === 'divisor'
  const ehMarca = tipo === 'marca'
  const ehSpotify = tipo === 'spotify'

  // O player é o único item que nasce SEM nome, e o formulário nem pergunta:
  // quem se apresenta é o quadro do Spotify, com capa e nome da playlist
  // desenhados por ele. A coluna é `not null`, então o vazio é string vazia —
  // e é exatamente o que `SpotifyPlayer` lê para não desenhar linha nenhuma
  // acima do quadro. Os outros tipos continuam exigindo título: um link ou um
  // divisor sem texto seria uma linha em branco na página.
  const nome = titulo.trim().slice(0, 80)
  if (!nome && !ehSpotify) return { error: 'titulo_vazio' as const }
  const urlValida = ehDivisor ? null : validarUrl(url)
  if (!ehDivisor && !urlValida) return { error: 'url_invalida' as const }

  /**
   * O link do player é conferido ANTES de gravar, e recusado quando não vira
   * embed.
   *
   * Um link qualquer passaria pelo `validarUrl` (é http, é URL) e viraria um
   * item que a página não desenha — gravado no editor, invisível na bio. A
   * mesma armadilha da marca sem logo, e a mesma saída: barrar aqui, com
   * mensagem, em vez de deixar o defeito aparecer só na página publicada.
   */
  if (ehSpotify && !embedDoSpotify(urlValida)) return { error: 'spotify_invalido' as const }

  // Marca sem logo não é recusada pelo banco — é o SELECT da página que a
  // ignora (ver a migration `20260901120000`). Barrar aqui é o que impede a
  // linha invisível: gravada, contando no editor, e ausente do carrossel sem
  // que nada na tela explique por quê.
  if (ehMarca && !capaUrl) return { error: 'logo_obrigatoria' as const }

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
  // As marcas parceiras não têm teto no Free — mesma decisão do app (ver o
  // comentário em `criarLinkBio` de lá). Na oferta isso é inerte de qualquer
  // forma, porque `ehOfertaAberta` já derruba os tetos; a linha existe para as
  // duas cópias continuarem sendo a mesma função.
  if (!ehMarca && ehOfertaAberta !== true && !ehPro(assinatura)) {
    // Player conta junto com link, não numa cota própria: os dois ocupam uma
    // linha da lista e é isso que o teto do Free mede. Cotas separadas dariam
    // 3 links MAIS 3 players de graça, que não é o limite que a tela promete.
    const tiposDaCota = ehDivisor ? ['divisor'] : ['link', 'spotify']
    const { count } = await supabase
      .from('creator_links')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .in('tipo', tiposDaCota)

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
  // Marca fica de fora da busca de prévia junto com o divisor: a `og:image` do
  // site da marca é peça de campanha, não logotipo — usá-la como reserva
  // desenharia a foto errada com a confiança de quem acertou.
  const previa =
    capaUrl || ehDivisor || ehMarca || ehSpotify ? null : await guardarPrevia(user.id, urlValida!)

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
  await invalidarBioPublica({ userId: user.id })
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

    // Trocar o link de um player por algo que não é Spotify apagaria o item da
    // página sem apagá-lo do editor — a mesma trava da criação, do lado da
    // edição.
    const { data: alvoUrl } = await supabase
      .from('creator_links')
      .select('tipo')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (alvoUrl?.tipo === 'spotify' && !embedDoSpotify(urlValida)) {
      return { error: 'spotify_invalido' as const }
    }

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

  // A mesma trava de `criarLinkBio`, do lado da edição: tirar a logo de uma
  // marca a apagaria da página sem apagá-la do editor. Quem quer a marca fora
  // do carrossel a remove ou a desliga — as duas saídas são visíveis; esta
  // não era.
  if (campos.capaUrl !== undefined && !campos.capaUrl) {
    const { data: alvo } = await supabase
      .from('creator_links')
      .select('tipo')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (alvo?.tipo === 'marca') return { error: 'logo_obrigatoria' as const }
  }

  /**
   * Escolheu um formato que desenha imagem, e não há imagem nenhuma: puxa a do
   * próprio site.
   *
   * A prévia só era buscada ao CRIAR o link e ao trocar a URL. Quem criasse o
   * item como botão — ou num minuto em que o site não respondeu — ficava sem
   * ela para sempre: clicar em "Grande" depois gravava o estilo e a página
   * continuava desenhando o bloco tingido, porque `coalesce(capa_url,
   * preview_url)` não tinha o que devolver. O único jeito de sair disso era
   * apagar o link e recriar, levando junto os cliques já medidos.
   *
   * A condição é o par que a página lê, não o campo que mudou: o que importa é
   * como o item VAI FICAR depois deste update. Por isso vale tanto para quem
   * troca o formato quanto para quem remove a capa própria de um card — as
   * duas portas para o mesmo estado.
   *
   * `preview_url` já preenchido não é rebuscado: ele é exatamente esta imagem,
   * e ir à rede de novo a cada clique no seletor gastaria 2,5s por nada.
   */
  if (
    update.preview_url === undefined &&
    (campos.estilo !== undefined || campos.capaUrl !== undefined)
  ) {
    const { data: linha } = await supabase
      .from('creator_links')
      .select('url, tipo, estilo, capa_url, preview_url')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle()

    const estiloFinal = campos.estilo ?? (linha?.estilo as EstiloItem | undefined)
    const capaFinal =
      campos.capaUrl !== undefined ? campos.capaUrl || null : (linha?.capa_url ?? null)

    if (
      linha?.tipo === 'link' &&
      linha.url &&
      estiloFinal &&
      estiloFinal !== 'botao' &&
      !capaFinal &&
      !linha.preview_url
    ) {
      update.preview_url = await guardarPrevia(user.id, linha.url)
    }
  }

  if (Object.keys(update).length === 0) return { success: true }

  const { error } = await supabase
    .from('creator_links')
    .update(update)
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return { error: error.message }

  revalidatePath('/profile')
  await invalidarBioPublica({ userId: user.id })
  // A prévia volta junto porque a lista do card vive em estado local: sem ela,
  // a imagem recém-buscada só apareceria num reload manual — e a pessoa veria
  // o formato que acabou de escolher sem a foto que ele promete.
  return { success: true, previewUrl: (update.preview_url as string | null) ?? null }
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
  await invalidarBioPublica({ userId: user.id })
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
  await invalidarBioPublica({ userId: user.id })
  return { success: true }
}
