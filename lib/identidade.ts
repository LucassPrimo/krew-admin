import { dbRO } from './db'
import { ligacoesDe, type Ligacao } from './relacoes'

/**
 * "De quem é esta linha?" — a pergunta que o explorador de dados existia sem
 * responder.
 *
 * ---------------------------------------------------------------------------
 * O problema, dito sem rodeio
 * ---------------------------------------------------------------------------
 * Uma grade de tabela com `user_id = 8f3a1c7e-…` é exatamente o que o painel
 * do Supabase já faz, e de graça. Ela não responde a pergunta que o suporte
 * traz — "essas 40 linhas são de quem?" —, porque um uuid não é o nome de
 * ninguém. Quem usa acaba copiando o uuid, abrindo outra aba, procurando em
 * `profiles`, e voltando. Três telas para uma pergunta.
 *
 * Aqui a identidade é resolvida ANTES de a linha ser desenhada: nome, e-mail e
 * o @handle da bio, com link para a visão 360. É o que torna esta tela
 * diferente de um editor de tabelas genérico — e é a única razão de ela
 * existir em vez de um atalho para o Supabase.
 *
 * ---------------------------------------------------------------------------
 * Como o dono é descoberto
 * ---------------------------------------------------------------------------
 * Pelas FOREIGN KEYS (ver `lib/relacoes.ts`), nunca por nome de coluna
 * adivinhado. Três caminhos, nesta ordem:
 *
 * 1. **Direto** — a tabela aponta para `auth.users`/`profiles`. É o caso de
 *    quase tudo (`campaigns.user_id`, `creator_links.user_id`).
 * 2. **Pela página** — a tabela aponta para `proposal_pages`, que aponta para
 *    a pessoa. É como `partnership_proposals.creator_id` e `bio_ofertas`
 *    ganham dono: a proposta é de uma PÁGINA, e a página é de alguém. Sem esse
 *    salto, as duas tabelas mais usadas do funil ficariam anônimas.
 * 3. **A organização** — não substitui a pessoa, acompanha. Uma linha de
 *    agência pertence à org e é isso que explica por que o criador não a vê.
 *
 * O custo é fixo: no máximo quatro consultas para uma página inteira de
 * resultados, todas em lote. Resolver linha a linha seria N+1 na tabela grande,
 * que é justamente onde a tela precisa aguentar.
 */

export type Pessoa = {
  id: string
  nome: string | null
  email: string | null
  /** O @handle da bio, quando a pessoa tem página. É como o time chama todo mundo. */
  slug: string | null
}

export type Dono = {
  pessoa: Pessoa | null
  org: { id: string; nome: string } | null
  pagina: { id: string; slug: string } | null
}

const VAZIO: Dono = { pessoa: null, org: null, pagina: null }

/** Alvos de FK que significam "isto é uma pessoa". */
const ALVOS_DE_PESSOA = new Set(['auth.users', 'profiles', 'public.profiles'])

/**
 * A ordem importa quando a tabela tem mais de uma coluna de gente.
 *
 * `documents` tem `created_by`; `org_invites` tem `invited_by` e
 * `accepted_user_id`. Dono é quem a linha É, não quem a mexeu por último — por
 * isso as colunas de autoria ficam no fim da fila.
 */
const PRIORIDADE_PESSOA = [
  'user_id', 'owner_user_id', 'creator_id', 'id',
  'autor_id', 'created_by', 'updated_by', 'invited_by', 'accepted_user_id',
]
const PRIORIDADE_ORG = ['org_id', 'creator_org_id', 'agency_org_id', 'accepted_org_id']
const PRIORIDADE_PAGINA = ['page_id', 'creator_id', 'link_page_id']

function escolher(ligacoes: Ligacao[], prioridade: string[]): string | null {
  for (const nome of prioridade) {
    if (ligacoes.some((l) => l.coluna === nome)) return nome
  }
  return ligacoes[0]?.coluna ?? null
}

/** As colunas por onde o dono de uma linha desta tabela é alcançado. */
export async function caminhosDeDono(tabela: string): Promise<{
  pessoa: string | null
  org: string | null
  pagina: string | null
}> {
  const ligacoes = await ligacoesDe(tabela)
  return {
    pessoa: escolher(ligacoes.filter((l) => ALVOS_DE_PESSOA.has(l.alvo)), PRIORIDADE_PESSOA),
    org: escolher(ligacoes.filter((l) => l.alvo.replace(/^public\./, '') === 'organizations'), PRIORIDADE_ORG),
    pagina: escolher(
      ligacoes.filter((l) => l.alvo.replace(/^public\./, '') === 'proposal_pages'),
      PRIORIDADE_PAGINA,
    ),
  }
}

/**
 * Identidade de um punhado de user_ids, em uma consulta.
 *
 * Base em `admin_auth_users` e não em `profiles`: existe conta sem perfil
 * (cadastro que parou no meio, conta de oferta recém-criada), e essas são
 * justamente as que geram dúvida no suporte. Partir de `profiles` faria a
 * linha aparecer sem dono — o pior resultado possível, porque parece bug do
 * painel e não estado real do cadastro.
 */
export async function pessoasPorId(ids: string[]): Promise<Map<string, Pessoa>> {
  const unicos = [...new Set(ids.filter(Boolean))]
  if (unicos.length === 0) return new Map()

  const linhas = await dbRO<Pessoa[]>`
    select u.id::text as id,
           nullif(trim(concat_ws(' ', p.full_name, p.sobrenome)), '') as nome,
           u.email,
           pp.slug
    from public.admin_auth_users u
    left join public.profiles p on p.id = u.id
    left join public.proposal_pages pp on pp.user_id = u.id
    where u.id::text = any(${unicos})
  `
  return new Map(linhas.map((p) => [p.id, p]))
}

/** Como a pessoa é chamada numa linha só: nome, ou @handle, ou e-mail, ou o id. */
export function nomeDe(pessoa: Pessoa): string {
  return pessoa.nome ?? (pessoa.slug ? `@${pessoa.slug}` : null) ?? pessoa.email ?? pessoa.id
}

/**
 * O dono de cada linha, na MESMA ordem das linhas recebidas.
 *
 * Paralelo à entrada, e não indexado por chave primária, porque a listagem
 * genérica nem sempre tem chave — tabela sem registry é lida com `select *` e
 * desenhada por posição.
 */
export async function donosDasLinhas(
  tabela: string,
  linhas: Record<string, unknown>[],
): Promise<Dono[]> {
  if (linhas.length === 0) return []

  const caminho = await caminhosDeDono(tabela)
  if (!caminho.pessoa && !caminho.org && !caminho.pagina) return linhas.map(() => VAZIO)

  const texto = (v: unknown): string | null =>
    v === null || v === undefined ? null : String(v)

  const idsPagina = caminho.pagina
    ? linhas.map((l) => texto(l[caminho.pagina as string])).filter((v): v is string => Boolean(v))
    : []

  const paginas = idsPagina.length
    ? new Map(
        (
          await dbRO<{ id: string; slug: string; user_id: string }[]>`
            select id::text as id, slug, user_id::text as user_id
            from public.proposal_pages where id::text = any(${[...new Set(idsPagina)]})
          `
        ).map((p) => [p.id, p]),
      )
    : new Map<string, { id: string; slug: string; user_id: string }>()

  const idsPessoa = [
    ...(caminho.pessoa
      ? linhas.map((l) => texto(l[caminho.pessoa as string])).filter((v): v is string => Boolean(v))
      : []),
    // O salto da página: quem é dono da página é dono da linha que aponta
    // para ela.
    ...[...paginas.values()].map((p) => p.user_id),
  ]

  const pessoas = await pessoasPorId(idsPessoa)

  const idsOrg = caminho.org
    ? [...new Set(linhas.map((l) => texto(l[caminho.org as string])).filter((v): v is string => Boolean(v)))]
    : []

  const orgs = idsOrg.length
    ? new Map(
        (
          await dbRO<{ id: string; nome: string }[]>`
            select id::text as id, name as nome
            from public.organizations where id::text = any(${idsOrg})
          `
        ).map((o) => [o.id, o]),
      )
    : new Map<string, { id: string; nome: string }>()

  return linhas.map((linha) => {
    const pagina = caminho.pagina ? paginas.get(texto(linha[caminho.pagina]) ?? '') : undefined
    const idPessoa = (caminho.pessoa ? texto(linha[caminho.pessoa]) : null) ?? pagina?.user_id ?? null
    return {
      pessoa: idPessoa ? pessoas.get(idPessoa) ?? null : null,
      org: caminho.org ? orgs.get(texto(linha[caminho.org]) ?? '') ?? null : null,
      pagina: pagina ? { id: pagina.id, slug: pagina.slug } : null,
    }
  })
}

/**
 * Onde os dados de UMA pessoa moram — a pergunta pelo outro lado.
 *
 * Devolve as tabelas com coluna de gente, para a visão 360 oferecer o atalho
 * "ver as linhas dela aqui". Sem contagem de propósito: `count(*)` em vinte
 * tabelas (uma delas é o log de eventos da bio) transformaria a abertura da
 * ficha numa varredura. O número se paga quando você clica, não antes.
 */
export async function tabelasComPessoa(): Promise<{ tabela: string; coluna: string }[]> {
  const nomes = await dbRO<{ nome: string }[]>`
    select c.relname as nome
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
    order by c.relname
  `

  const saida: { tabela: string; coluna: string }[] = []
  for (const { nome } of nomes) {
    const caminho = await caminhosDeDono(nome)
    // Só o vínculo DIRETO: o salto pela página é ótimo para explicar uma linha
    // que você já está olhando, mas viraria promessa falsa num atalho ("as
    // linhas desta pessoa") que o filtro da listagem não sabe cumprir.
    if (caminho.pessoa) saida.push({ tabela: nome, coluna: caminho.pessoa })
  }
  return saida
}
