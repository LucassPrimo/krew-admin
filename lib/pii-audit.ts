import { dbRW } from './db'

/**
 * A revelação de PII — o lado servidor de `pii.ts`.
 *
 * Separado porque este arquivo TEM que ficar no servidor: ele abre a conexão de
 * escrita para gravar o acesso. As funções de máscara, que rodam nos dois
 * lados, ficam em `pii.ts`.
 */

/**
 * Registra uma revelação e devolve o valor inteiro.
 *
 * Grava ANTES de devolver, e usa a conexão RW porque `admin_audit` é
 * append-only por GRANT (INSERT sem UPDATE): se o log falhar, a função lança e
 * o valor não chega à tela. Um "revelar" sem rastro não deve existir.
 */
export async function revelar(args: {
  atorId: string
  sujeitoUserId: string | null
  tabela: string
  registroId: string
  campo: string
  motivo: string
  ip: string | null
}): Promise<void> {
  if (args.motivo.trim().length < 10) {
    throw new Error('O motivo precisa de pelo menos 10 caracteres.')
  }

  await dbRW`
    insert into admin_audit.pii_access
      (ator_id, sujeito_user_id, tabela, registro_id, campo, motivo, ip)
    values
      (${args.atorId}, ${args.sujeitoUserId}, ${args.tabela},
       ${args.registroId}, ${args.campo}, ${args.motivo.trim()}, ${args.ip})
  `
}
