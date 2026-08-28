'use server'

import { exigirAtor } from '@/lib/auth'
import { dbRO } from '@/lib/db'

/**
 * Console SQL — somente leitura, e não por convenção.
 *
 * A conexão usada aqui é a `krew_admin_ro`, que não tem GRANT de INSERT,
 * UPDATE ou DELETE em tabela nenhuma. Mesmo que alguém digite um `delete from
 * profiles`, o Postgres recusa. A validação de texto abaixo existe para dar uma
 * mensagem decente antes disso — não é ela que segura a porta.
 *
 * Também vale o `statement_timeout` de 5s configurado na conexão: uma consulta
 * mal escrita trava a si mesma, não o banco que atende os clientes.
 */

const PROIBIDO = /\b(insert|update|delete|drop|alter|create|truncate|grant|revoke|copy|vacuum)\b/i

const TETO = 200

export type ResultadoSQL =
  | { ok: true; colunas: string[]; linhas: Record<string, unknown>[]; truncado: boolean; ms: number }
  | { ok: false; erro: string }

export async function rodarConsulta(sql: string): Promise<ResultadoSQL> {
  await exigirAtor()

  const texto = sql.trim().replace(/;\s*$/, '')
  if (!texto) return { ok: false, erro: 'Consulta vazia.' }

  if (PROIBIDO.test(texto)) {
    return {
      ok: false,
      erro: 'Só SELECT aqui. Para escrever, use o registry — ou o SQL Editor do Supabase, com você olhando.',
    }
  }

  // Duas instruções numa string é o vetor clássico de "select 1; drop table".
  // A conexão RO já impediria o efeito, mas recusar antes deixa claro o porquê.
  if (texto.includes(';')) {
    return { ok: false, erro: 'Uma instrução por vez.' }
  }

  const inicio = Date.now()
  try {
    const linhas = await dbRO.unsafe<Record<string, unknown>[]>(`${texto} limit ${TETO + 1}`)
    const truncado = linhas.length > TETO

    return {
      ok: true,
      colunas: linhas.length > 0 ? Object.keys(linhas[0]) : [],
      linhas: truncado ? linhas.slice(0, TETO) : linhas,
      truncado,
      ms: Date.now() - inicio,
    }
  } catch (e) {
    return { ok: false, erro: (e as Error).message }
  }
}
