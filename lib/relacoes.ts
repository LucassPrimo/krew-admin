import { dbRO } from './db'

/**
 * O grafo de relacionamentos do banco, lido do próprio banco.
 *
 * ---------------------------------------------------------------------------
 * Por que introspecção e não um mapa escrito à mão
 * ---------------------------------------------------------------------------
 * A pergunta que o explorador de dados precisa responder é "de quem é esta
 * linha", e a resposta já está declarada em produção: são as FOREIGN KEYS.
 * Escrever a lista aqui à mão criaria uma segunda verdade que envelhece calada
 * — a coluna nova de amanhã ficaria sem dono na tela, e ninguém seria avisado.
 * `pg_constraint` não tem esse problema: uma FK criada numa migration aparece
 * aqui no próximo carregamento.
 *
 * É a mesma escolha de `lib/introspect.ts`, e o mesmo motivo do importador não
 * espelhar a lista de plataformas: espelho de lista não se mantém.
 *
 * ---------------------------------------------------------------------------
 * O cache é de processo, e é de propósito
 * ---------------------------------------------------------------------------
 * O schema muda em deploy, não em requisição. Guardar em memória do processo
 * significa que uma instância quente responde sem ir ao Postgres, e que um
 * deploy (processo novo) já lê a versão nova — sem invalidação para manter e
 * sem risco de servir um grafo velho por dias.
 */

export type Ligacao = {
  /** Coluna nesta tabela. */
  coluna: string
  /** Tabela apontada, qualificada quando não é `public` (ex.: `auth.users`). */
  alvo: string
  /** Coluna apontada do outro lado — quase sempre `id`, mas não sempre. */
  colunaAlvo: string
}

/** Quem aponta PARA a tabela: a pergunta "o que depende desta linha". */
export type Dependente = { tabela: string; coluna: string; colunaAlvo: string }

let cacheSaida: Map<string, Ligacao[]> | null = null
let cacheEntrada: Map<string, Dependente[]> | null = null

async function carregar(): Promise<void> {
  if (cacheSaida && cacheEntrada) return

  // Uma consulta só para o grafo inteiro: são ~70 FKs, e uma varredura por
  // tabela transformaria cada tela numa sequência de idas ao catálogo.
  //
  // `unnest(conkey) with ordinality` casado com `confkey` na MESMA posição é o
  // que mantém coluna e coluna-alvo pareadas em FK composta. Sem a ordinalidade
  // o produto cartesiano faria `(a,b) -> (x,y)` virar quatro pares, e três
  // deles seriam mentira.
  const linhas = await dbRO<{
    tabela: string; coluna: string; alvo: string; colunaAlvo: string
  }[]>`
    select
      con.conrelid::regclass::text as tabela,
      att.attname as coluna,
      con.confrelid::regclass::text as alvo,
      alvo.attname as "colunaAlvo"
    from pg_constraint con
    join lateral unnest(con.conkey) with ordinality as origem(attnum, pos) on true
    join lateral unnest(con.confkey) with ordinality as destino(attnum, pos)
      on destino.pos = origem.pos
    join pg_attribute att on att.attrelid = con.conrelid and att.attnum = origem.attnum
    join pg_attribute alvo on alvo.attrelid = con.confrelid and alvo.attnum = destino.attnum
    where con.contype = 'f' and con.connamespace = 'public'::regnamespace
    order by 1, 2
  `

  const saida = new Map<string, Ligacao[]>()
  const entrada = new Map<string, Dependente[]>()

  for (const l of linhas) {
    // `conrelid::regclass` devolve o nome sem schema quando ele está no
    // search_path (`public`) e com schema quando não (`auth.users`). O painel
    // trabalha em `public`, então normalizamos a chave para o nome simples.
    const tabela = l.tabela.replace(/^public\./, '')
    saida.set(tabela, [
      ...(saida.get(tabela) ?? []),
      { coluna: l.coluna, alvo: l.alvo, colunaAlvo: l.colunaAlvo },
    ])
    const alvo = l.alvo.replace(/^public\./, '')
    entrada.set(alvo, [
      ...(entrada.get(alvo) ?? []),
      { tabela, coluna: l.coluna, colunaAlvo: l.colunaAlvo },
    ])
  }

  cacheSaida = saida
  cacheEntrada = entrada
}

/** As FKs que saem da tabela — as colunas que apontam para outra linha. */
export async function ligacoesDe(tabela: string): Promise<Ligacao[]> {
  await carregar()
  return cacheSaida?.get(tabela) ?? []
}

/** As FKs que chegam na tabela — quem some junto se esta linha sumir. */
export async function dependentesDe(tabela: string): Promise<Dependente[]> {
  await carregar()
  return cacheEntrada?.get(tabela) ?? []
}

/**
 * A coluna que serve de NOME numa tabela qualquer.
 *
 * Um uuid não diz de quem é a linha; `nome`/`titulo`/`slug` dizem. A ordem é a
 * do que identifica melhor para um humano, e o primeiro que a tabela tiver
 * vence. Sem nenhum deles, a tela mostra o uuid encurtado — que é honesto:
 * a tabela realmente não tem nome para dar.
 */
const CANDIDATAS_DE_ROTULO = [
  'nome', 'name', 'full_name', 'titulo', 'title', 'slug', 'brand_name',
  'numero', 'descricao', 'email', 'status', 'role',
]

let cacheRotulo: Map<string, string | null> | null = null

async function colunasDeRotulo(): Promise<Map<string, string | null>> {
  if (cacheRotulo) return cacheRotulo

  const linhas = await dbRO<{ tabela: string; colunas: string[] }[]>`
    select table_name as tabela, array_agg(column_name::text) as colunas
    from information_schema.columns
    where table_schema = 'public'
    group by table_name
  `

  cacheRotulo = new Map(
    linhas.map((l) => [
      l.tabela,
      CANDIDATAS_DE_ROTULO.find((c) => l.colunas.includes(c)) ?? null,
    ]),
  )
  return cacheRotulo
}

/** Uuid encurtado: o suficiente para conferir, curto o bastante para caber. */
export function idCurto(id: string): string {
  return id.length > 12 ? `${id.slice(0, 8)}…` : id
}

/**
 * Troca uuids por nomes, em lote.
 *
 * Uma consulta POR TABELA-ALVO, e não por linha: uma listagem de 50 linhas com
 * quatro colunas de FK são 4 consultas, não 200. A tela que resolvia isso
 * linha a linha é a tela que fica lenta justamente na tabela grande, que é
 * onde ela mais precisava funcionar.
 *
 * `auth.users` fica de fora: os nomes de gente vêm de `lib/identidade.ts`, que
 * junta perfil, e-mail e handle numa identidade só.
 *
 * A coluna do outro lado vem da FK (`colunaAlvo`) e não é assumida como `id`:
 * `subscriptions` é chaveada por `user_id`, `bio_ofertas` por `page_id`.
 * Assumir `id` faria justamente essas duas devolverem erro de coluna
 * inexistente — e elas são das mais consultadas do painel.
 */
export async function rotularIds(
  alvo: string,
  colunaAlvo: string,
  ids: string[],
): Promise<Map<string, string>> {
  const unicos = [...new Set(ids.filter(Boolean))]
  const vazio = new Map<string, string>()
  if (unicos.length === 0) return vazio

  const tabela = alvo.replace(/^public\./, '')
  if (alvo !== tabela) return vazio // fora de `public` (auth.users) — ver acima

  const rotulos = await colunasDeRotulo()
  const coluna = rotulos.get(tabela)
  if (!coluna) return vazio

  const linhas = await dbRO<{ id: string; rotulo: string | null }[]>`
    select ${dbRO(colunaAlvo)}::text as id, ${dbRO(coluna)}::text as rotulo
    from public.${dbRO(tabela)}
    where ${dbRO(colunaAlvo)}::text = any(${unicos})
  `
  return new Map(linhas.filter((l) => l.rotulo).map((l) => [l.id, l.rotulo as string]))
}
