import postgres from 'postgres'

import { env } from './env'

/**
 * Duas conexões, com poderes diferentes de propósito (decisão D4 do plano).
 *
 * O erro fácil num painel destes é abrir uma conexão de superusuário e confiar
 * na própria atenção para não escrever no lugar errado. Aqui a separação é do
 * banco: `krew_admin_ro` não tem GRANT de INSERT/UPDATE/DELETE em tabela
 * nenhuma. Um bug no caminho de leitura — que é onde está quase todo o código —
 * não consegue corromper dado. Não é convenção, é permissão.
 *
 * Os dois roles têm BYPASSRLS: o painel precisa ver a base inteira, e é
 * exatamente por isso que ele mora em repo, deploy e domínio separados.
 */

/** Só SELECT. Toda tela de leitura, listagem, análise e o console SQL. */
export const dbRO = postgres(env.ADMIN_DATABASE_URL_RO, {
  max: 5,
  idle_timeout: 20,
  // Teto por consulta: uma query mal escrita no console trava a si mesma, não o
  // banco de produção que atende os clientes.
  connection: { statement_timeout: 5000 },
  // O painel nunca tem sessão de usuário; `prepare: false` evita prepared
  // statements presos no pooler entre requisições serverless.
  prepare: false,
})

/**
 * INSERT/UPDATE nas tabelas do registry. Sem DELETE, sem DDL.
 *
 * Só o executor de mutações (`lib/mutate.ts`) importa isto. Qualquer outro
 * arquivo que importar esta conexão está, por definição, fora do caminho
 * auditado — é o que o teste em `lib/__tests__/mutate.test.ts` verifica.
 */
export const dbRW = postgres(env.ADMIN_DATABASE_URL_RW, {
  max: 3,
  idle_timeout: 20,
  // Mais folga que a leitura: uma transação de mutação escreve o log de
  // auditoria no mesmo commit, e 5s aqui seria apertado sem ganho nenhum.
  connection: { statement_timeout: 15000 },
  prepare: false,
})
