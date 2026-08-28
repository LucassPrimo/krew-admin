import { dbRO } from './db'

/**
 * Leitura do schema em tempo real, para as tabelas que o registry não mapeia.
 *
 * O explorador precisa mostrar o banco inteiro — as ~45 tabelas — mesmo que só
 * 14 sejam editáveis. Ver tudo e poder mudar pouco é exatamente a postura certa
 * para um painel que alcança produção.
 */

export type ColunaDoBanco = { nome: string; tipo: string; nulavel: boolean }

/** Tabelas e views de `public`, com a contagem aproximada de linhas. */
export async function listarTabelas(): Promise<{ nome: string; tipo: string; linhas: number }[]> {
  // `reltuples` é estimativa do planner, não `count(*)`: um count exato em cada
  // tabela transformaria a abertura desta tela em varredura do banco inteiro.
  // Para "quanto tem aqui", a estimativa basta.
  return dbRO<{ nome: string; tipo: string; linhas: number }[]>`
    select c.relname as nome,
           case c.relkind when 'r' then 'tabela' when 'v' then 'view' else 'outro' end as tipo,
           greatest(c.reltuples, 0)::bigint::int as linhas
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r','v')
    order by c.relname
  `
}

export async function colunasDe(tabela: string): Promise<ColunaDoBanco[]> {
  return dbRO<ColunaDoBanco[]>`
    select column_name as nome, data_type as tipo, is_nullable = 'YES' as nulavel
    from information_schema.columns
    where table_schema = 'public' and table_name = ${tabela}
    order by ordinal_position
  `
}

/** Confere que a tabela existe antes de qualquer interpolação de identificador. */
export async function tabelaExiste(nome: string): Promise<boolean> {
  const [linha] = await dbRO`
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = ${nome}
  `
  return Boolean(linha)
}
