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
  // `motivo` vai junto do texto: a tela precisa distinguir "o código venceu"
  // (que se resolve em dez segundos, com link) de "a escrita está desligada"
  // (que não se resolve daqui). Sem isso, as duas recusas viravam a mesma
  // linha vermelha e a pessoa ficava sem saber o que fazer.
  if (!permissao.ok) {
    return { ok: false as const, erro: permissao.texto, motivo: permissao.motivo }
  }

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
