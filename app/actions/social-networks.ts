'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getCurrentOrgId } from '@/lib/org'

export interface RedeSocial {
  platform: string
  handle: string
  url?: string | null
  ordem?: number
  ativo?: boolean
}

export async function getSocialNetworks(userId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('creator_social_networks')
    .select('*')
    .eq('user_id', userId)
    .order('ordem')
    .order('created_at')
  if (error) throw error
  return data
}

// Substitui todas as redes do usuário pelas informadas (a UI sempre manda o
// conjunto completo — mais simples que diffar item a item).
//
// `url`, `ordem` e `ativo` chegaram com a página de bio: lá o criador escolhe
// o que aparece e em que sequência, e redes sem handle (site próprio, Spotify)
// guardam a URL crua. Os campos são opcionais porque o onboarding e o perfil
// continuam mandando só `{ platform, handle }` — para eles a ordem é a de
// digitação e tudo nasce ativo.
export async function saveSocialNetworks(redes: RedeSocial[]) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  const orgId = await getCurrentOrgId()
  if (!orgId) return { error: 'Sem organização ativa' }

  const { error: deleteError } = await supabase
    .from('creator_social_networks')
    .delete()
    .eq('user_id', user.id)
  if (deleteError) return { error: deleteError.message }

  // Uma rede vale se tem handle OU url — o site próprio só tem url.
  const rows = redes
    .filter((r) => r.handle.trim() || r.url?.trim())
    .map((r, i) => ({
      user_id: user.id,
      org_id: orgId,
      platform: r.platform,
      handle: r.handle.trim(),
      url: r.url?.trim() || null,
      ordem: r.ordem ?? i,
      ativo: r.ativo ?? true,
    }))

  if (rows.length > 0) {
    const { error: insertError } = await supabase.from('creator_social_networks').insert(rows)
    if (insertError) return { error: insertError.message }
  }

  revalidatePath('/config')
  revalidatePath('/profile')
  return { success: true }
}
