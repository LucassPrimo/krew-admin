import type { TransactionSql } from 'postgres'

import { dbRO, dbRW } from './db'
import { env } from './env'
import type { EstiloItem } from './bio/tipos'
import type { RedeImportada } from './importar-linkme'
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
  titulo: string
  url: string
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
            avatar_url = ${dados.avatarUrl ?? null},
            nicho = ${dados.nicho ?? null}
        where id = ${userId}
      `

      // O trigger dá 5 dias de teste a partir de AGORA. Numa oferta que pode
      // ficar semanas parada, esse prazo queimaria antes de a pessoa sequer
      // ver a página. Zeramos aqui; o relógio começa quando ela aceitar.
      await tx`
        update public.subscriptions set trial_ends_at = null where user_id = ${userId}
      `

      const [pagina] = await tx<{ id: string }[]>`
        insert into public.proposal_pages
          (user_id, org_id, slug, bio_ativo, bio_headline, bio_texto, bio_capa_url, bio_bg_color)
        values (${userId}, ${org.id}, ${dados.slug}, true,
                ${dados.headline ?? null}, ${dados.texto ?? null}, ${dados.capaUrl ?? null},
                ${dados.corFundo ?? null})
        returning id
      `

      for (const [i, link] of dados.links.entries()) {
        await tx`
          insert into public.creator_links (user_id, org_id, titulo, url, capa_url, ordem, tipo, estilo)
          values (${userId}, ${org.id}, ${link.titulo}, ${link.url},
                  ${link.capa_url ?? null}, ${i}, 'link', ${link.estilo ?? 'grande'})
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
