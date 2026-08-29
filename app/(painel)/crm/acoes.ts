'use server'

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'

import { autorizarEscritaSemStepUp } from '@/lib/auth'
import {
  adicionarNota, atualizarLead, criarLead, marcarPerdido, reabrirLead,
  vincularOferta, type EdicaoLead, type EstagioManual, type NovoLead,
} from '@/lib/crm'

/**
 * As ações do CRM.
 *
 * `autorizarEscritaSemStepUp`, como as da oferta de bio e pela mesma razão:
 * anotar um lead é criar dado nosso sobre uma negociação, não alterar o
 * cadastro de um cliente. O TOTP a cada 15 minutos continua guardando /dados,
 * que é onde um clique errado mexe no que já é de alguém. Sessão válida, as
 * duas listas de admin e o kill switch continuam valendo aqui.
 *
 * A checagem se repete em CADA ação: Server Action é endpoint HTTP, e a tela
 * não é o que protege nenhuma delas.
 */

async function contexto() {
  const h = await headers()
  return {
    ip: h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
    userAgent: h.get('user-agent'),
  }
}

export async function acaoCriarLead(dados: NovoLead) {
  const permissao = await autorizarEscritaSemStepUp()
  if (!permissao.ok) return { ok: false as const, erro: permissao.texto }

  const r = await criarLead(dados, { atorId: permissao.ator.id, ...(await contexto()) })
  if (r.ok) revalidatePath('/crm')
  return r
}

export async function acaoAtualizarLead(id: string, campos: EdicaoLead) {
  const permissao = await autorizarEscritaSemStepUp()
  if (!permissao.ok) return { ok: false as const, erro: permissao.texto }

  const r = await atualizarLead(id, campos, { atorId: permissao.ator.id, ...(await contexto()) })
  if (r.ok) {
    revalidatePath('/crm')
    revalidatePath(`/crm/${id}`)
  }
  return r
}

/** Atalho da lista: mover o estágio sem abrir a ficha. */
export async function acaoMoverEstagio(id: string, estagio: EstagioManual) {
  return acaoAtualizarLead(id, { estagio })
}

export async function acaoVincularOferta(id: string, pageId: string | null) {
  const permissao = await autorizarEscritaSemStepUp()
  if (!permissao.ok) return { ok: false as const, erro: permissao.texto }

  const r = await vincularOferta(id, pageId, { atorId: permissao.ator.id, ...(await contexto()) })
  if (r.ok) {
    revalidatePath('/crm')
    revalidatePath(`/crm/${id}`)
  }
  return r
}

export async function acaoAdicionarNota(id: string, texto: string) {
  const permissao = await autorizarEscritaSemStepUp()
  if (!permissao.ok) return { ok: false as const, erro: permissao.texto }

  const r = await adicionarNota(id, texto, { atorId: permissao.ator.id, ...(await contexto()) })
  if (r.ok) revalidatePath(`/crm/${id}`)
  return r
}

export async function acaoMarcarPerdido(id: string, motivo: string) {
  const permissao = await autorizarEscritaSemStepUp()
  if (!permissao.ok) return { ok: false as const, erro: permissao.texto }

  const r = await marcarPerdido(id, motivo, { atorId: permissao.ator.id, ...(await contexto()) })
  if (r.ok) {
    revalidatePath('/crm')
    revalidatePath(`/crm/${id}`)
  }
  return r
}

export async function acaoReabrirLead(id: string) {
  const permissao = await autorizarEscritaSemStepUp()
  if (!permissao.ok) return { ok: false as const, erro: permissao.texto }

  const r = await reabrirLead(id, { atorId: permissao.ator.id, ...(await contexto()) })
  if (r.ok) {
    revalidatePath('/crm')
    revalidatePath(`/crm/${id}`)
  }
  return r
}
