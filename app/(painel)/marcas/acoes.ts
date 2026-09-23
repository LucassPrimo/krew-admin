'use server'

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'

import { autorizarEscritaSemStepUp } from '@/lib/auth'
import { cancelarAcesso, criarAcesso } from '@/lib/marcas'

/**
 * `autorizarEscritaSemStepUp`, como o selo e a oferta: liberar um convite de
 * piloto é reversível (cancelar) e não toca dado de cliente. A checagem se
 * repete em cada ação porque Server Action é endpoint HTTP.
 */
async function contexto() {
  const h = await headers()
  return {
    ip: h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
    userAgent: h.get('user-agent'),
  }
}

export async function acaoCriarAcesso(email: string, nomeMarca: string) {
  const permissao = await autorizarEscritaSemStepUp()
  if (!permissao.ok) return { ok: false as const, erro: permissao.texto }
  const r = await criarAcesso(email, nomeMarca, { atorId: permissao.ator.id, ...(await contexto()) })
  if (r.ok) revalidatePath('/marcas')
  return r
}

export async function acaoCancelarAcesso(id: string) {
  const permissao = await autorizarEscritaSemStepUp()
  if (!permissao.ok) return { ok: false as const, erro: permissao.texto }
  const r = await cancelarAcesso(id, { atorId: permissao.ator.id, ...(await contexto()) })
  if (r.ok) revalidatePath('/marcas')
  return r
}
