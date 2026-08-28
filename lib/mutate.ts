import type { TransactionSql } from 'postgres'

import { coagir } from './coerce'
import { dbRW } from './db'
import { escritaLigada } from './env'
import { mascararObjeto } from './pii'
import { REGISTRY, type TabelaAdmin, tabelaDoRegistry } from './registry'

/**
 * O executor de mutações. É o ÚNICO caminho de escrita do painel.
 *
 * Três invariantes, e cada uma existe por um motivo específico:
 *
 * 1. **Nada fora do registry.** Tabela e coluna são procuradas no mapa antes de
 *    virarem SQL. Isso não é só validação: é o que permite interpolar o nome da
 *    tabela com segurança, porque o nome que chega no SQL é a CHAVE do registry,
 *    nunca a string que veio do formulário.
 *
 * 2. **Auditoria no mesmo commit.** O `insert` em `admin_audit.mutations` roda
 *    dentro da mesma transação do `update`. Se o log falhar, a alteração faz
 *    rollback junto. Uma mudança sem rastro não deve conseguir existir.
 *
 * 3. **Uma linha por vez.** O `where` é sempre a chave primária. Não existe
 *    update em massa aqui — a operação que apaga a tarde de trabalho de alguém
 *    é justamente a que não tem `WHERE` suficiente.
 */

export type ResultadoMutacao =
  | { ok: true; antes: Record<string, unknown>; depois: Record<string, unknown> }
  | { ok: false; erro: string }

export async function aplicarEdicao(args: {
  tabela: string
  registroId: string
  alteracoes: Record<string, string>
  motivo: string
  atorId: string
  ip: string | null
  userAgent: string | null
}): Promise<ResultadoMutacao> {
  // Kill switch antes de qualquer coisa. Um deploy com a variável desligada
  // derruba toda escrita, sem reverter código.
  if (!escritaLigada) {
    return { ok: false, erro: 'Escrita desligada neste deploy (ADMIN_WRITES_ENABLED).' }
  }

  const motivo = args.motivo.trim()
  if (motivo.length < 10) {
    return { ok: false, erro: 'O motivo precisa de pelo menos 10 caracteres. "teste" não passa.' }
  }

  const mapa: TabelaAdmin | null = tabelaDoRegistry(args.tabela)
  if (!mapa) return { ok: false, erro: `Tabela fora do registry: ${args.tabela}` }

  // Validação e coerção ANTES de abrir a transação: erro de digitação não
  // precisa consumir uma conexão de escrita nem segurar lock em produção.
  const valores: Record<string, unknown> = {}
  for (const [coluna, bruto] of Object.entries(args.alteracoes)) {
    const campo = Object.hasOwn(mapa.colunas, coluna) ? mapa.colunas[coluna] : undefined
    if (!campo) return { ok: false, erro: `Coluna fora do registry: ${coluna}` }
    if (!campo.editavel) return { ok: false, erro: `Coluna não editável: ${coluna}` }
    try {
      valores[coluna] = coagir(campo, bruto)
    } catch (e) {
      return { ok: false, erro: `${coluna}: ${(e as Error).message}` }
    }
  }

  if (Object.keys(valores).length === 0) {
    return { ok: false, erro: 'Nenhuma alteração enviada.' }
  }

  try {
    return await dbRW.begin(async (tx: TransactionSql) => {
      // `dbRW(nome)` marca o valor como IDENTIFICADOR, não como literal — e o
      // nome vem do registry, não do request. As duas coisas juntas são o que
      // torna a interpolação segura aqui.
      const [antes] = await tx<Record<string, unknown>[]>`
        select * from public.${dbRW(mapa.tabela)}
        where ${dbRW(mapa.chave)} = ${args.registroId}
        for update
      `
      if (!antes) throw new Error('Registro não encontrado.')

      const [depois] = await tx<Record<string, unknown>[]>`
        update public.${dbRW(mapa.tabela)}
        set ${dbRW(valores)}
        where ${dbRW(mapa.chave)} = ${args.registroId}
        returning *
      `

      // Só o que MUDOU vai para o log, e mascarado. O log responde "o que essa
      // pessoa alterou", não guarda uma segunda cópia do CPF de ninguém.
      const antesDiff: Record<string, unknown> = {}
      const depoisDiff: Record<string, unknown> = {}
      for (const coluna of Object.keys(valores)) {
        antesDiff[coluna] = antes[coluna]
        depoisDiff[coluna] = depois[coluna]
      }

      await tx`
        insert into admin_audit.mutations
          (ator_id, tabela, registro_id, acao, antes, depois, motivo, ip, user_agent)
        values (
          ${args.atorId}, ${mapa.tabela}, ${args.registroId}, 'update',
          ${tx.json(mascararObjeto(antesDiff) as never)},
          ${tx.json(mascararObjeto(depoisDiff) as never)},
          ${motivo}, ${args.ip}, ${args.userAgent}
        )
      `

      return { ok: true as const, antes, depois }
    })
  } catch (e) {
    return { ok: false, erro: (e as Error).message }
  }
}

/**
 * Registra uma ação operacional (criar oferta, confirmar e-mail, estender
 * trial) que não é um simples update de campo.
 *
 * Existe separado porque o `acao` do schema distingue `update` de
 * `operacional`: na hora de auditar, "mudou o status para pago" e "reenviou o
 * convite" são perguntas diferentes.
 *
 * O valor é `'operacional'` — conferido na constraint real do banco, não no
 * KREW_ADMIN_PLANO.md, que documenta `'acao_operacional'` e está
 * desatualizado. Escrever contra o documento em vez do schema custou um
 * `violates check constraint` em produção.
 */
export async function registrarAcao(
  tx: TransactionSql,
  args: {
    atorId: string
    tabela: string
    registroId: string
    detalhe: Record<string, unknown>
    motivo: string
    ip: string | null
    userAgent: string | null
  },
): Promise<void> {
  await tx`
    insert into admin_audit.mutations
      (ator_id, tabela, registro_id, acao, antes, depois, motivo, ip, user_agent)
    values (
      ${args.atorId}, ${args.tabela}, ${args.registroId}, 'operacional',
      null, ${tx.json(mascararObjeto(args.detalhe) as never)},
      ${args.motivo.trim()}, ${args.ip}, ${args.userAgent}
    )
  `
}

/** Tabelas do registry, para o menu de /dados. */
export const TABELAS_EDITAVEIS = Object.keys(REGISTRY)
