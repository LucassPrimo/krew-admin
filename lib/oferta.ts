import type { TransactionSql } from 'postgres'

import { dbRO, dbRW } from './db'
import { env } from './env'
import type { EstiloItem } from './bio/tipos'
import type { RedeImportada } from './importar-linkme'
import { trazerImagem } from './importar-midia'
import { registrarAcao } from './mutate'
import { clienteAdmin } from './supabase-admin'

/**
 * Bio de oferta: uma /@handle pronta, montada pela Krew, para mostrar ao
 * criador ANTES de ele ter conta.
 *
 * ---------------------------------------------------------------------------
 * Por que uma conta de verdade, e não um rascunho
 * ---------------------------------------------------------------------------
 * A oferta precisa parecer o produto, porque É o argumento de venda: a pessoa
 * abre o link e vê a própria página no ar. Um rascunho renderizado por um
 * caminho paralelo divergiria do real na primeira mudança do produto — e a
 * demonstração passaria a mostrar algo que não existe.
 *
 * Então a página de oferta é uma `proposal_pages` comum, de uma conta comum. O
 * que a distingue mora só em `public.bio_ofertas`, que o produto não lê.
 *
 * ---------------------------------------------------------------------------
 * O que o trigger do banco já faz por nós
 * ---------------------------------------------------------------------------
 * `fn_create_profile_on_signup` dispara ao criar o usuário e monta profile,
 * organization, membership e a assinatura. Ou seja: criar o auth.user é o
 * suficiente para a conta existir inteira. O que fazemos depois é só preencher
 * o que é da oferta — nome, foto, a página e os links.
 */

export type LinkDaOferta = {
  /** `divisor` é o título de seção da página. Ver `LinkImportado`. */
  tipo?: 'link' | 'divisor'
  titulo: string
  /** Nulo no divisor — exigência do CHECK `creator_links_url_por_tipo`. */
  url: string | null
  capa_url?: string | null
  estilo?: EstiloItem
}

export type NovaOferta = {
  slug: string
  nomeCompleto: string
  /** E-mail real do criador, se você já tem. Sem ele a conta nasce com um
   *  endereço interno e você preenche na hora de convidar. */
  email?: string | null
  headline?: string | null
  texto?: string | null
  avatarUrl?: string | null
  capaUrl?: string | null
  nicho?: string | null
  links: LinkDaOferta[]
  /** Redes sociais — vêm prontas do importador do link.me. */
  redes?: RedeImportada[]
  /** Cor de fundo da página, no formato #RRGGBB. Vazio usa o padrão do tema. */
  corFundo?: string | null
  notas?: string | null
}

const SLUG_VALIDO = /^[a-z0-9][a-z0-9._-]{1,29}$/

/** Confere se o handle está livre antes de criar qualquer coisa. */
export async function slugDisponivel(slug: string): Promise<{ livre: boolean; porque?: string }> {
  if (!SLUG_VALIDO.test(slug)) {
    return { livre: false, porque: 'Use 2 a 30 caracteres: letras minúsculas, números, ponto, hífen ou _.' }
  }
  const [reservado] = await dbRO`select slug from public.reserved_slugs where slug = ${slug}`
  if (reservado) return { livre: false, porque: 'Slug reservado pela plataforma.' }

  const [existe] = await dbRO`select id from public.proposal_pages where slug = ${slug}`
  if (existe) return { livre: false, porque: 'Já existe uma página com esse handle.' }

  return { livre: true }
}

export async function criarOferta(
  dados: NovaOferta,
  contexto: { atorId: string; ip: string | null; userAgent: string | null },
): Promise<{ ok: true; pageId: string; userId: string } | { ok: false; erro: string }> {
  const disponivel = await slugDisponivel(dados.slug)
  if (!disponivel.livre) return { ok: false, erro: disponivel.porque ?? 'Handle indisponível.' }
  const supabase = clienteAdmin()

  // Sem e-mail do criador ainda? A conta nasce com um endereço interno que só
  // serve de chave — ele é substituído pelo real no momento do convite. Um
  // endereço inventado no domínio de outra pessoa mandaria e-mail para alguém
  // que não pediu nada.
  const emailConta = dados.email?.trim() || `oferta+${dados.slug}@bekrew.com`

  const { data: criado, error: erroAuth } = await supabase.auth.admin.createUser({
    email: emailConta,
    // Sem senha e sem confirmar: a conta não é utilizável até a pessoa aceitar
    // o convite e definir a própria senha. Uma conta-fantasma com senha seria
    // uma credencial válida que ninguém escolheu.
    email_confirm: false,
    user_metadata: { full_name: dados.nomeCompleto, account_type: 'creator' },
  })

  if (erroAuth || !criado.user) {
    return { ok: false, erro: erroAuth?.message ?? 'Falha ao criar a conta.' }
  }

  const userId = criado.user.id

  /**
   * As imagens vêm para o nosso bucket ANTES da transação.
   *
   * Antes de gravar, e não durante: `trazerImagem` faz rede, e rede dentro de
   * uma transação de banco segura uma conexão do pool pelo tempo do download
   * mais lento. Com vinte capas isso vira uma transação de dezenas de
   * segundos — e o `statement_timeout` do painel a mataria no meio.
   *
   * Em paralelo porque são independentes entre si; falhar não interrompe as
   * outras (`trazerImagem` devolve `null` em vez de lançar). O que não vier
   * simplesmente não tem imagem, e a página desenha o card sem arte — que é o
   * botão, um formato que ela já sabe fazer.
   */
  const [avatarNosso, capaNossa, capasDosLinks] = await Promise.all([
    trazerImagem(dados.avatarUrl, userId, 'avatar'),
    trazerImagem(dados.capaUrl, userId, 'capa'),
    Promise.all(dados.links.map((l) => trazerImagem(l.capa_url, userId, 'capa'))),
  ])

  try {
    const pageId = await dbRW.begin(async (tx: TransactionSql) => {
      // O trigger já criou org e membership; pegamos a org que ele fez.
      const [org] = await tx<{ id: string }[]>`
        select id from public.organizations where owner_user_id = ${userId} limit 1
      `
      if (!org) throw new Error('O trigger de signup não criou a organização.')

      await tx`
        update public.profiles
        set full_name = ${dados.nomeCompleto},
            avatar_url = ${avatarNosso},
            nicho = ${dados.nicho ?? null}
        where id = ${userId}
      `

      // O trigger dá 5 dias de teste a partir de AGORA. Numa oferta que pode
      // ficar semanas parada, esse prazo queimaria antes de a pessoa sequer
      // ver a página. Zeramos aqui; o relógio começa quando ela aceitar.
      await tx`
        update public.subscriptions set trial_ends_at = null where user_id = ${userId}
      `

      // `bio_ativo = true`: a oferta nasce no ar, em `/@handle`.
      //
      // Já esteve atrás de um link secreto, para não publicar nome e imagem de
      // alguém antes do aceite. A oferta passou a ser criada só para criadores
      // com quem o aceite já foi combinado, então o consentimento acontece
      // ANTES daqui e o segredo não tinha mais o que proteger. Ver a migration
      // `20260828190000`.
      //
      // O que isso implica continua valendo: quem cria a oferta responde pelo
      // consentimento, porque o sistema não o exige mais em lugar nenhum.
      const [pagina] = await tx<{ id: string }[]>`
        insert into public.proposal_pages
          (user_id, org_id, slug, bio_ativo, bio_headline, bio_texto, bio_capa_url, bio_bg_color)
        values (${userId}, ${org.id}, ${dados.slug}, true,
                ${dados.headline ?? null}, ${dados.texto ?? null}, ${capaNossa},
                ${dados.corFundo ?? null})
        returning id
      `

      for (const [i, link] of dados.links.entries()) {
        await tx`
          insert into public.creator_links (user_id, org_id, titulo, url, capa_url, ordem, tipo, estilo)
          values (${userId}, ${org.id}, ${link.titulo}, ${link.url ?? null},
                  ${capasDosLinks[i] ?? null}, ${i}, ${link.tipo ?? 'link'},
                  ${link.estilo ?? 'grande'})
        `
      }

      // `creator_social_networks` tem `unique (user_id, platform)`. O
      // importador já entrega uma rede por plataforma, mas o `on conflict`
      // fica como rede de segurança: uma oferta refeita para o mesmo handle
      // não deve estourar por causa de um Instagram repetido.
      // `ordem` explícita: o default da coluna é 0, então sem isto todas as
      // redes empatariam e a página perderia a ordem em que elas aparecem no
      // perfil de origem — que é uma escolha do criador, não acaso.
      for (const [i, rede] of (dados.redes ?? []).entries()) {
        await tx`
          insert into public.creator_social_networks (user_id, org_id, platform, handle, url, ordem)
          values (${userId}, ${org.id}, ${rede.plataforma}, ${rede.handle}, ${rede.url}, ${i})
          on conflict (user_id, platform) do nothing
        `
      }

      await tx`
        insert into public.bio_ofertas (page_id, criada_por, email_convite, notas)
        values (${pagina.id}, ${contexto.atorId}, ${dados.email?.trim() ?? null}, ${dados.notas ?? null})
      `

      await registrarAcao(tx, {
        atorId: contexto.atorId,
        tabela: 'bio_ofertas',
        registroId: pagina.id,
        detalhe: {
          slug: dados.slug, user_id: userId,
          links: dados.links.length, redes: (dados.redes ?? []).length,
        },
        // Gerado no servidor, e não digitado: a coluna exige 10+ caracteres,
        // e pedir uma justificativa a cada oferta criada só produziria "teste"
        // repetido. A frase automática diz mais do que isso diria, e o QUE
        // mudou já está no `detalhe`.
        motivo: `Oferta de bio criada pelo painel para @${dados.slug}`,
        ip: contexto.ip,
        userAgent: contexto.userAgent,
      })

      return pagina.id
    })

    return { ok: true, pageId, userId }
  } catch (e) {
    // A conta de auth já existe mas a página não: sem a limpeza, sobraria um
    // usuário órfão e o slug pareceria ocupado numa segunda tentativa.
    await supabase.auth.admin.deleteUser(userId).catch(() => {})
    return { ok: false, erro: (e as Error).message }
  }
}

/**
 * Dispara o convite. A pessoa define a senha e assume a conta que já é dela —
 * com a página, os links e as métricas que já rodaram.
 */
export async function enviarConvite(
  pageId: string,
  email: string,
  contexto: { atorId: string; ip: string | null; userAgent: string | null },
): Promise<{ ok: true } | { ok: false; erro: string }> {
  const supabase = clienteAdmin()

  const [oferta] = await dbRO<{ user_id: string; slug: string; aceita_em: string | null }[]>`
    select p.user_id, p.slug, o.aceita_em
    from public.bio_ofertas o
    join public.proposal_pages p on p.id = o.page_id
    where o.page_id = ${pageId}
  `
  if (!oferta) return { ok: false, erro: 'Oferta não encontrada.' }
  if (oferta.aceita_em) return { ok: false, erro: 'Esta oferta já foi aceita.' }

  // O e-mail da conta pode ter nascido interno (oferta+slug@). Trocar antes de
  // convidar é o que faz o link chegar na pessoa certa.
  const { error: erroEmail } = await supabase.auth.admin.updateUserById(oferta.user_id, { email })
  if (erroEmail) return { ok: false, erro: erroEmail.message }

  const { error: erroConvite } = await supabase.auth.admin.inviteUserByEmail(email)
  if (erroConvite) return { ok: false, erro: erroConvite.message }

  await dbRW.begin(async (tx: TransactionSql) => {
    await tx`
      update public.bio_ofertas
      set email_convite = ${email}, convite_enviado_em = now()
      where page_id = ${pageId}
    `
    await registrarAcao(tx, {
      atorId: contexto.atorId,
      tabela: 'bio_ofertas',
      registroId: pageId,
      detalhe: { acao: 'convite_enviado', email, slug: oferta.slug },
      motivo: `Convite da oferta @${oferta.slug} enviado para ${email}`,
      ip: contexto.ip,
      userAgent: contexto.userAgent,
    })
  })

  return { ok: true }
}

/**
 * Marca a oferta como aceita e dá o trial que foi guardado na criação.
 *
 * Fica no painel, e não automático no login, de propósito: automatizar isso
 * exigiria um gancho no fluxo de auth do produto — outro repo, outra superfície
 * — para um evento que hoje acontece poucas vezes por semana e que você
 * acompanha de perto.
 */
export async function marcarAceita(
  pageId: string,
  contexto: { atorId: string; ip: string | null; userAgent: string | null },
): Promise<void> {
  await dbRW.begin(async (tx: TransactionSql) => {
    const [linha] = await tx<{ user_id: string }[]>`
      update public.bio_ofertas set aceita_em = now()
      where page_id = ${pageId} and aceita_em is null
      returning (select user_id from public.proposal_pages where id = page_id) as user_id
    `
    if (!linha) throw new Error('Oferta não encontrada ou já aceita.')

    await tx`
      update public.subscriptions
      set trial_ends_at = now() + interval '5 days'
      where user_id = ${linha.user_id} and trial_ends_at is null
    `

    await registrarAcao(tx, {
      atorId: contexto.atorId,
      tabela: 'bio_ofertas',
      registroId: pageId,
      detalhe: { acao: 'oferta_aceita', trial_dias: 5 },
      motivo: 'Oferta marcada como aceita pelo painel; trial de 5 dias concedido',
      ip: contexto.ip,
      userAgent: contexto.userAgent,
    })
  })
}

/**
 * Apaga uma oferta inteira: a página, os links, as redes, a conta.
 *
 * ---------------------------------------------------------------------------
 * Por que a conta, e não só a página
 * ---------------------------------------------------------------------------
 * A oferta É uma conta — `criarOferta` cria um usuário de auth de verdade, e
 * a org, o perfil, a página e os links penduram nele. Apagar só a
 * `proposal_pages` deixaria uma conta órfã com o e-mail interno preso: o
 * handle voltaria a ficar livre, mas refazer a oferta para o mesmo criador
 * esbarraria numa conta fantasma que ninguém mais vê. Uma limpeza que deixa
 * lixo invisível é pior que nenhuma, porque some do painel e continua no
 * banco.
 *
 * A remoção é UMA chamada — `auth.admin.deleteUser` — e o resto vai por
 * cascata declarada no schema: `organizations.owner_user_id`, `profiles.id`,
 * `proposal_pages.user_id`, `creator_links`, `creator_social_networks`,
 * `link_bio_events`, `subscriptions`. Não escrevemos um `delete` por tabela
 * justamente para não termos uma segunda lista para manter sincronizada com a
 * primeira.
 *
 * ---------------------------------------------------------------------------
 * O que NÃO se apaga
 * ---------------------------------------------------------------------------
 * Oferta aceita. A partir do aceite a conta é de uma pessoa de verdade, que
 * definiu senha e pode ter entrado — apagá-la aqui seria destruir o cliente
 * pelo botão de arrumar a vitrine. O painel recusa, e o caminho passa a ser o
 * mesmo de qualquer outra conta.
 *
 * A auditoria também fica. `admin_audit` é append-only e `registro_id` não é
 * chave estrangeira, então o registro de que ESTA oferta existiu e foi
 * apagada sobrevive à cascata — que é o ponto de auditar.
 *
 * ---------------------------------------------------------------------------
 * A ordem: auditar, depois apagar
 * ---------------------------------------------------------------------------
 * A auditoria vai numa transação que COMMITA antes da exclusão. É de propósito
 * e não é grátis: se a chamada ao auth falhar, sobra um registro de exclusão
 * que não aconteceu. O contrário — apagar e então auditar — arrisca o dado
 * sumir sem registro nenhum, e entre um registro a mais e um sumiço sem
 * rastro, o erro que dá para investigar é o primeiro. O retrato do que sumiu é
 * tirado antes, pela mesma razão: depois não haveria de onde tirá-lo.
 */
export async function excluirOferta(
  pageId: string,
  slugConfirmado: string,
  contexto: { atorId: string; ip: string | null; userAgent: string | null },
): Promise<{ ok: true; slug: string } | { ok: false; erro: string }> {
  const [oferta] = await dbRO<
    { user_id: string; slug: string; aceita_em: string | null; links: number; redes: number }[]
  >`
    select p.user_id, p.slug, o.aceita_em,
           (select count(*) from public.creator_links l where l.user_id = p.user_id)::int as links,
           (select count(*) from public.creator_social_networks n where n.user_id = p.user_id)::int as redes
    from public.bio_ofertas o
    join public.proposal_pages p on p.id = o.page_id
    where o.page_id = ${pageId}
  `

  // A consulta parte de `bio_ofertas`: uma página que não é oferta não chega
  // aqui, e é isso que impede esta função de virar um apagador de contas de
  // criador pelo id da página.
  if (!oferta) return { ok: false, erro: 'Oferta não encontrada.' }
  if (oferta.aceita_em) {
    return {
      ok: false,
      erro: 'Esta oferta já foi aceita: a conta é do criador e não se apaga por aqui.',
    }
  }

  // O handle digitado é a confirmação. Não é teatro de segurança: a ação é
  // irreversível e a tela mostra várias ofertas parecidas — digitar o handle é
  // a diferença entre confirmar ESTA e confirmar a que estava aberta antes.
  if (slugConfirmado.trim().toLowerCase() !== oferta.slug.toLowerCase()) {
    return { ok: false, erro: 'O handle digitado não confere com o desta oferta.' }
  }

  await dbRW.begin(async (tx: TransactionSql) => {
    await registrarAcao(tx, {
      atorId: contexto.atorId,
      tabela: 'bio_ofertas',
      registroId: pageId,
      detalhe: {
        acao: 'oferta_excluida',
        slug: oferta.slug,
        user_id: oferta.user_id,
        links: oferta.links,
        redes: oferta.redes,
      },
      motivo: `Oferta @${oferta.slug} excluída pelo painel, com a conta-fantasma inteira`,
      ip: contexto.ip,
      userAgent: contexto.userAgent,
    })
  })

  const { error } = await clienteAdmin().auth.admin.deleteUser(oferta.user_id)
  if (error) {
    return {
      ok: false,
      erro: `A auditoria foi registrada, mas a conta não foi apagada: ${error.message}`,
    }
  }

  return { ok: true, slug: oferta.slug }
}

export type OfertaListada = {
  page_id: string
  slug: string
  nome: string | null
  criada_em: string
  email_convite: string | null
  convite_enviado_em: string | null
  aceita_em: string | null
  cliques: number
}

export async function listarOfertas(): Promise<OfertaListada[]> {
  return dbRO<OfertaListada[]>`
    select o.page_id, p.slug, pr.full_name as nome, o.criada_em,
           o.email_convite, o.convite_enviado_em, o.aceita_em,
           coalesce((select sum(l.cliques) from public.creator_links l
                     where l.user_id = p.user_id), 0)::int as cliques
    from public.bio_ofertas o
    join public.proposal_pages p on p.id = o.page_id
    left join public.profiles pr on pr.id = p.user_id
    order by o.aceita_em nulls first, o.criada_em desc
  `
}
