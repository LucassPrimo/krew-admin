'use server'

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'

import { autorizarEscrita } from '@/lib/auth'
import { aplicarEdicao } from '@/lib/mutate'

export async function salvarEdicao(
  tabela: string, registroId: string,
  alteracoes: Record<string, string>, motivo: string,
) {
  const permissao = await autorizarEscrita()
  if (!permissao.ok) return { ok: false as const, erro: permissao.texto }

  const h = await headers()
  const resultado = await aplicarEdicao({
    tabela, registroId, alteracoes, motivo,
    atorId: permissao.ator.id,
    ip: h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
    userAgent: h.get('user-agent'),
  })

  if (resultado.ok) revalidatePath(`/dados/${tabela}`)
  return resultado.ok ? { ok: true as const } : { ok: false as const, erro: resultado.erro }
}
