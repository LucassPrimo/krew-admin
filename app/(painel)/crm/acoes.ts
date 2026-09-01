'use server'

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'

import { autorizarEscritaSemStepUp, exigirAtor } from '@/lib/auth'
import {
  adicionarNota, atualizarLead, criarLead, excluirLeads, importarLeads, marcarPerdido,
  marcarPerdidosEmLote, moverEstagioEmLote, preverImportacao, reabrirLead, vincularOferta,
  type EdicaoLead, type EstagioManual, type NovoLead,
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

/**
 * As três ações de LOTE da lista.
 *
 * Elas recebem os ids da seleção da tela, e é por isso que a checagem de
 * autorização e o limite de tamanho vivem do lado do servidor: a lista de ids
 * é o payload de um endpoint HTTP, não um estado de interface protegido. Uma
 * seleção de mil ids montada à mão bate aqui e é recusada por
 * `conferirLote()`, não pela tabela que a produziu.
 */
export async function acaoMoverEstagioEmLote(ids: string[], estagio: EstagioManual) {
  const permissao = await autorizarEscritaSemStepUp()
  if (!permissao.ok) return { ok: false as const, erro: permissao.texto }

  const r = await moverEstagioEmLote(ids, estagio, { atorId: permissao.ator.id, ...(await contexto()) })
  if (r.ok) revalidatePath('/crm')
  return r
}

export async function acaoMarcarPerdidosEmLote(ids: string[], motivo: string) {
  const permissao = await autorizarEscritaSemStepUp()
  if (!permissao.ok) return { ok: false as const, erro: permissao.texto }

  const r = await marcarPerdidosEmLote(ids, motivo, { atorId: permissao.ator.id, ...(await contexto()) })
  if (r.ok) revalidatePath('/crm')
  return r
}

/**
 * A única ação do painel que DESTRÓI dado.
 *
 * Continua sem step-up de TOTP, como o resto do CRM, e a razão é a mesma:
 * lead de prospecção é dado NOSSO sobre uma negociação, não o cadastro de um
 * cliente. O que a protege é outra coisa — a linha inteira vai para
 * `admin_audit.mutations` antes de sumir, o banco só permite se o grant tiver
 * sido rodado à mão, e a tela pede confirmação digitada.
 */
export async function acaoExcluirLeads(ids: string[]) {
  const permissao = await autorizarEscritaSemStepUp()
  if (!permissao.ok) return { ok: false as const, erro: permissao.texto }

  const r = await excluirLeads(ids, { atorId: permissao.ator.id, ...(await contexto()) })
  if (r.ok) revalidatePath('/crm')
  return r
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

/**
 * A prévia da importação.
 *
 * `exigirAtor()` e não `autorizarEscrita…`: conferir não grava nada. Travá-la
 * atrás do kill switch impediria você de preparar e revisar a planilha
 * justamente enquanto o painel está em modo leitura — que é quando dá para
 * fazer isso sem risco nenhum.
 */
export async function acaoPreverImportacao(texto: string) {
  await exigirAtor()
  return preverImportacao(texto)
}

export async function acaoImportarLeads(texto: string) {
  const permissao = await autorizarEscritaSemStepUp()
  if (!permissao.ok) return { ok: false as const, erro: permissao.texto }

  const r = await importarLeads(texto, { atorId: permissao.ator.id, ...(await contexto()) })
  if (r.ok) revalidatePath('/crm')
  return r
}
