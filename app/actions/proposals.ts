'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getCurrentOrgId, getOrgFilterId } from '@/lib/org'
import type { ProposalStatus } from '@/lib/types'
import { LOCALES } from '@/i18n/request'

export async function getOrCreateCreator() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const orgId = await getCurrentOrgId()
  if (!orgId) return null

  // Pela ORG: quem assessora o criador X abre a página de X, não a própria.
  const { data: existing } = await supabase
    .from('proposal_pages')
    .select('*')
    .eq('org_id', orgId)
    .maybeSingle()
  if (existing) return existing

  // A org ainda não tem página. Só criamos se o usuário também não tiver a
  // dele em lugar nenhum — `proposal_pages.user_id` é UNIQUE, então um
  // assessor que já tem página na org pessoal não pode ganhar outra aqui. Sem
  // página, a tela aparece vazia em vez de estourar erro de constraint.
  const { data: minhaPagina } = await supabase
    .from('proposal_pages')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()
  if (minhaPagina) return null

  const baseSlug = (user.email?.split('@')[0] || 'creator').toLowerCase().replace(/[^a-z0-9]/g, '')
  let slug = baseSlug || 'creator'
  let attempt = 0

  while (attempt < 5) {
    const { data: created, error } = await supabase
      .from('proposal_pages')
      .insert({ user_id: user.id, org_id: orgId, slug })
      .select('*')
      .single()
    if (!error) return created
    // slug em uso ou reservado — tenta com sufixo numérico.
    attempt += 1
    slug = `${baseSlug || 'creator'}${attempt}`
  }
  return null
}

export async function updateCreatorSlug(newSlug: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  const slug = newSlug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '')
  if (slug.length < 3) return { error: 'too_short' as const }

  const { error } = await supabase.from('proposal_pages').update({ slug }).eq('user_id', user.id)

  if (error) {
    if (error.code === '23505') return { error: 'in_use' as const }
    // Slug reservado (bloqueado pelo trigger no banco) ou outro erro
    // inesperado — mensagem crua, só nesses casos raros fica em português.
    return { error: error.message }
  }

  // `/bio` também: a página de bio usa o mesmo slug, e sem isto o card lá
  // continuaria mostrando o endereço antigo até um refresh manual.
  revalidatePath('/propostas')
  revalidatePath('/profile')
  return { success: true, slug }
}

export async function updateCreatorWelcomeMessage(message: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  const { error } = await supabase
    .from('proposal_pages')
    .update({ welcome_message: message.trim() || null })
    .eq('user_id', user.id)

  if (error) return { error: error.message }
  revalidatePath('/propostas')
  return { success: true }
}

export async function updateCreatorLocale(locale: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  if (!(LOCALES as readonly string[]).includes(locale)) return { error: 'Idioma inválido.' }

  const { error } = await supabase.from('proposal_pages').update({ locale }).eq('user_id', user.id)

  if (error) return { error: error.message }
  revalidatePath('/propostas')
  return { success: true }
}

/** Só o TEXTO. Fonte, cor e claro/escuro moram em `app/actions/aparencia.ts` —
 *  valem para /publi, /kit e /@handle juntos, e ter dois donos gravando os
 *  mesmos campos era o que fazia mexer numa tela mudar a outra sem aviso. */
export async function updateCreatorTitle(titleText: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  const { error } = await supabase
    .from('proposal_pages')
    .update({ title_text: titleText.trim() || null })
    .eq('user_id', user.id)

  if (error) return { error: error.message }
  revalidatePath('/propostas')
  return { success: true }
}

export async function updateCreatorAvailability(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  const { error } = await supabase
    .from('proposal_pages')
    .update({
      availability_status: formData.get('availability_status') as string,
      availability_note: (formData.get('availability_note') as string) || null,
      min_budget_cents: formData.get('min_budget_cents')
        ? Math.round(Number(formData.get('min_budget_cents')) * 100)
        : null,
    })
    .eq('user_id', user.id)

  if (error) return { error: error.message }
  revalidatePath('/propostas')
  return { success: true }
}

export async function getProposals() {
  const supabase = await createClient()
  const orgId = await getOrgFilterId()
  if (!orgId) return []

  // Pela ORG, não pelo `user.id`. Um assessor que abriu a operação do criador
  // X precisa ver as propostas de X — buscar pelo próprio user_id mostraria as
  // dele, que estão na org pessoal dele e não têm nada a ver com a tela aberta.
  const { data: creator } = await supabase
    .from('proposal_pages')
    .select('id')
    .eq('org_id', orgId)
    .maybeSingle()
  if (!creator) return []

  return getProposalsForCreator(creator.id)
}

// Evita repetir a busca de user/creator quando o creator já foi resolvido
// (ex.: junto com getOrCreateCreator na mesma página).
export async function getProposalsForCreator(creatorId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('partnership_proposals')
    .select('*')
    .eq('creator_id', creatorId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function markProposalViewed(id: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('partnership_proposals')
    .update({ viewed_at: new Date().toISOString() })
    .eq('id', id)
    .is('viewed_at', null)
  if (error) return { error: error.message }
  // Sem revalidatePath aqui de propósito: isso roda toda vez que um card é
  // só aberto (não é uma ação intencional do usuário como mover/aceitar/
  // recusar), então forçar a página inteira a revalidar nesse momento causava
  // um refetch em segundo plano bem no meio da interação de abrir o modal —
  // o indicador de "não lido" só some no próximo carregamento normal da página.
  return { success: true }
}

export async function updateProposalStatus(id: string, status: ProposalStatus) {
  const supabase = await createClient()
  const { error } = await supabase.from('partnership_proposals').update({ status }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/propostas')
  return { success: true }
}

// Aceitar proposta: as infos de marca/contato (mesmas pedidas ao cadastrar
// marca manualmente) viram um registro em Marcas + o contato; o resto
// (orçamento, tipo, pitch) vira uma Campanha vinculada a essa marca.
export async function acceptProposal(proposalId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  // O `org_id` vem da página de proposta que recebeu o contato, não da org
  // ativa no cookie: a marca e a campanha que nascem daqui pertencem a quem é
  // dono daquela página, e não a quem por acaso estava com outra org aberta.
  const { data: proposal, error: proposalError } = await supabase
    .from('partnership_proposals')
    .select('*, proposal_pages(org_id)')
    .eq('id', proposalId)
    .single()
  if (proposalError || !proposal) return { error: 'Proposta não encontrada.' }

  const orgId = (proposal.proposal_pages as unknown as { org_id: string } | null)?.org_id
  if (!orgId) return { error: 'Proposta sem organização.' }

  const { data: brand, error: brandError } = await supabase
    .from('brands')
    .insert({
      user_id: user.id,
      org_id: orgId,
      nome: proposal.brand_name || proposal.brand_instagram_handle || 'Marca sem nome',
      cnpj: proposal.brand_cnpj || null,
      website: proposal.brand_website || null,
      sector: proposal.brand_sector || null,
    })
    .select('id')
    .single()
  if (brandError || !brand) return { error: brandError?.message || 'Não foi possível criar a marca.' }

  const contactNome = proposal.contact_name || null
  const contactTelefone = proposal.contact_phone || null
  if (contactNome || contactTelefone || proposal.brand_email) {
    const { error: contactError } = await supabase.from('brand_contacts').insert({
      brand_id: brand.id,
      nome: contactNome,
      email: proposal.brand_email || null,
      telefone: contactTelefone,
    })
    if (contactError) return { error: contactError.message }
  }

  const notasParts = []
  if (proposal.brand_instagram_handle) notasParts.push(`Instagram: ${proposal.brand_instagram_handle}`)
  if (proposal.pitch_text) notasParts.push(proposal.pitch_text)
  if (proposal.pitch_media_url) notasParts.push(`Mídia/briefing: ${proposal.pitch_media_url}`)

  const { data: campanhaCriada, error: campaignError } = await supabase.from('campaigns').insert({
    user_id: user.id,
    org_id: orgId,
    brand_id: brand.id,
    nome: `${proposal.brand_name || proposal.brand_instagram_handle || 'Parceria'} — ${proposal.type === 'paid' ? 'Paga' : 'Permuta'}`,
    valor_total: proposal.type === 'paid' && proposal.budget_cents ? proposal.budget_cents / 100 : 0,
    status: 'ativa',
    notas: notasParts.join('\n\n') || null,
  })
    .select('id')
    .single()
  if (campaignError) return { error: campaignError.message }

  // Contrato em RASCUNHO com o que a marca já declarou no formulário público
  // (Bloco 7.4). Nasce rascunho de propósito: o criador revisa e só então
  // manda assinar. Falha aqui não desfaz a campanha — o contrato pode ser
  // criado à mão depois, e perder a campanha por causa dele seria pior.
  if (campanhaCriada?.id) {
    const { error: contratoError } = await supabase.from('contracts').insert({
      org_id: orgId,
      campaign_id: campanhaCriada.id,
      brand_id: brand.id,
      titulo: proposal.brand_name || proposal.brand_instagram_handle || null,
      usage_rights: proposal.usage_rights ?? [],
      usage_period_months: proposal.usage_period_months ?? null,
      status: 'rascunho',
    })
    if (contratoError) console.error('acceptProposal: contrato não criado:', contratoError)
  }

  const { error: updateError } = await supabase
    .from('partnership_proposals')
    .update({ status: 'closed', response_sent_at: new Date().toISOString() })
    .eq('id', proposalId)
  if (updateError) return { error: updateError.message }

  revalidatePath('/propostas')
  revalidatePath('/marcas')
  revalidatePath('/campanhas')
  return { success: true }
}

// O corpo do e-mail de recusa em si é montado e enviado pela edge function
// send-status-update (disparada pelo webhook de UPDATE); aqui só move o
// status, grava o motivo digitado pelo criador e marca a resposta como
// enviada.
export async function declineProposal(proposalId: string, reason: string) {
  const supabase = await createClient()

  const trimmed = reason.trim()
  if (!trimmed) return { error: 'Escreva o motivo da recusa.' }

  const { error } = await supabase
    .from('partnership_proposals')
    .update({ status: 'declined', decline_reason: trimmed, response_sent_at: new Date().toISOString() })
    .eq('id', proposalId)

  if (error) return { error: error.message }
  revalidatePath('/propostas')
  return { success: true }
}
