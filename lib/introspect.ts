import 'server-only'
import { sqlRo } from './db'
import { REGISTRY } from './registry'

/**
 * Introspecção do schema.
 *
 * Serve a dois propósitos. O primeiro é cobertura: o registry mapeia as tabelas
 * que importam para edição, mas o painel precisa conseguir MOSTRAR qualquer
 * tabela do banco, inclusive uma criada semana que vem. Leitura sai daqui;
 * escrita continua saindo só do registry.
 *
 * O segundo é a validação de nome. Toda rota que recebe `[tabela]` da URL passa
 * por `tabelaExiste()` antes de o nome chegar perto de uma query. `postgres.js`
 * já escapa identificadores via `sql(nome)`, mas "escapado" não é o mesmo que
 * "existe": sem esta checagem, a URL vira uma sonda para descobrir o schema
 * pela mensagem de erro.
 */

export interface ColunaDoBanco {
  nome: string
  tipo: string
  nulavel: boolean
}

export async function tabelaExiste(nome: string): Promise<boolean> {
  const [linha] = await sqlRo<{ existe: boolean }[]>`
    select exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = ${nome} and table_type = 'BASE TABLE'
    ) as existe
  `
  return linha?.existe === true
}

export async function colunasDe(tabela: string): Promise<ColunaDoBanco[]> {
  return sqlRo<ColunaDoBanco[]>`
    select column_name as nome, data_type as tipo,
           (is_nullable = 'YES') as nulavel
    from information_schema.columns
    where table_schema = 'public' and table_name = ${tabela}
    order by ordinal_position
  `
}

export interface TabelaListada {
  nome: string
  linhas: number
  noRegistry: boolean
  rotulo: string
  /** Colunas que existem no banco e o registry não conhece. */
  colunasNaoMapeadas: number
}

/**
 * Todas as tabelas do schema, com a contagem viva.
 *
 * `count(*)` de verdade, e não a estimativa de `pg_class.reltuples`: nesta
 * escala o custo é irrelevante e a estimativa mente logo depois de um insert em
 * lote, o que é exatamente quando alguém está olhando.
 */
export async function listarTabelas(): Promise<TabelaListada[]> {
  const tabelas = await sqlRo<{ nome: string }[]>`
    select table_name as nome
    from information_schema.tables
    where table_schema = 'public' and table_type = 'BASE TABLE'
    order by table_name
  `

  // Sequencial, não `Promise.all`. Testado e confirmado: várias queries
  // concorrentes com identificador dinâmico (`sqlRo(nome)`) contra este pool
  // (max: 5) travam de vez a partir da 6ª — nem erro, nem timeout, o
  // `Promise.all` simplesmente nunca resolve. É o que fazia `/dados` não
  // abrir. Sequencial custa ~1,5s para as ~35 tabelas de hoje, contra um
  // travamento permanente da versão concorrente.
  const contagens: { nome: string; total: number }[] = []
  for (const { nome } of tabelas) {
    const [linha] = await sqlRo<{ total: string }[]>`
      select count(*)::text as total from ${sqlRo(nome)}
    `
    contagens.push({ nome, total: Number(linha?.total ?? 0) })
  }

  const colunasPorTabela = await sqlRo<{ tabela: string; colunas: string[] }[]>`
    select table_name as tabela, array_agg(column_name::text) as colunas
    from information_schema.columns
    where table_schema = 'public'
    group by table_name
  `
  const mapaColunas = new Map(colunasPorTabela.map((c) => [c.tabela, c.colunas]))

  return contagens.map(({ nome, total }) => {
    const registro = REGISTRY[nome]
    const doBanco = mapaColunas.get(nome) ?? []
    return {
      nome,
      linhas: total,
      noRegistry: !!registro,
      rotulo: registro?.rotulo ?? nome,
      colunasNaoMapeadas: registro
        ? doBanco.filter((c) => !registro.colunas[c]).length
        : doBanco.length,
    }
  })
}

/** A chave primária real da tabela, para as rotas de detalhe. */
export async function chavePrimaria(tabela: string): Promise<string | null> {
  if (REGISTRY[tabela]) return REGISTRY[tabela].chave
  const [linha] = await sqlRo<{ coluna: string }[]>`
    select a.attname as coluna
    from pg_index i
    join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any(i.indkey)
    where i.indrelid = ${`public.${tabela}`}::regclass and i.indisprimary
    limit 1
  `
  return linha?.coluna ?? null
}
