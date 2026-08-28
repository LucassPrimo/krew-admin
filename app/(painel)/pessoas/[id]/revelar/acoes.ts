'use server'

import { headers } from 'next/headers'

import { exigirAtor } from '@/lib/auth'
import { dbRO } from '@/lib/db'
import { revelar } from '@/lib/pii-audit'
import { ehPII } from '@/lib/pii'

/**
 * Revelar um dado sensível.
 *
 * Note que isto exige `exigirAtor()` (leitura), não `autorizarEscrita()`:
 * revelar não altera dado do produto, então não faz sentido exigir step-up nem
 * ficar bloqueado pelo kill switch de escrita. Mas ESCREVE no log de auditoria,
 * e é por isso que a gravação vem antes de devolver o valor.
 */
export async function revelarCampo(userId: string, campo: string, motivo: string) {
  const ator = await exigirAtor()

  // Só campos declarados como PII passam. Sem isto, este endpoint viraria um
  // leitor genérico de qualquer coluna de profiles, sem passar pelo registry.
  if (!ehPII(campo)) return { ok: false as const, erro: 'Campo não é PII declarada.' }
  if (motivo.trim().length < 10) {
    return { ok: false as const, erro: 'O motivo precisa de pelo menos 10 caracteres.' }
  }

  const h = await headers()

  try {
    await revelar({
      atorId: ator.id,
      sujeitoUserId: userId,
      tabela: 'profiles',
      registroId: userId,
      campo,
      motivo,
      ip: h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
    })
  } catch (e) {
    return { ok: false as const, erro: (e as Error).message }
  }

  // A leitura só acontece DEPOIS de o log ter gravado. Se a auditoria falhar, a
  // função já saiu acima e o valor não chega à tela.
  const [linha] = await dbRO<Record<string, unknown>[]>`
    select ${dbRO(campo)} from public.profiles where id = ${userId}
  `

  return { ok: true as const, valor: linha ? String(linha[campo] ?? '') : '' }
}
