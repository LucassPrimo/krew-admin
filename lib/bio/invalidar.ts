import 'server-only'

import { updateTag } from 'next/cache'

import { createClient } from '@/lib/supabase/server'
import { tagBio } from '@/lib/bio/consulta'

/**
 * Derruba o cache da bio pública de quem acabou de ser editado.
 *
 * A `/@handle` é ISR com `revalidate = 60` e a leitura é `unstable_cache` com a
 * tag `bio:{slug}` (ver `getBioBySlug`). Sem esta chamada, uma mudança leva ATÉ
 * UM MINUTO para aparecer — e a pessoa que acabou de salvar, abre o link e vê a
 * versão velha não lê isso como cache: lê como "não salvou". É por isso que
 * este módulo existe fora de `app/actions/bio.ts`, onde a função nasceu
 * privada: quem mexe na bio não é só aquele arquivo.
 *
 * ---------------------------------------------------------------------------
 * `updateTag` e não `revalidateTag`
 * ---------------------------------------------------------------------------
 * No Next 16 é `updateTag` que dá read-your-own-writes: ele expira a entrada na
 * hora. `revalidateTag` só marca como vencida, e a PRIMEIRA leitura seguinte
 * ainda serve o valor antigo — que seria exatamente a conferida de quem
 * salvou. Em compensação ele só pode ser chamado de dentro de uma Server
 * Action; de um route handler (o webhook da Chargefy, por exemplo) o certo
 * continua sendo `revalidateTag`.
 *
 * ---------------------------------------------------------------------------
 * Por usuário OU por org
 * ---------------------------------------------------------------------------
 * As duas chaves existem porque as actions não concordam sobre qual usar, e com
 * razão: a bio é editada por `user_id`, mas a APARÊNCIA é gravada por `org_id`
 * (uma agência que opera a conta do criador precisa editar a página DELE — ver
 * `salvarAparencia`). Passar a chave errada aqui não daria erro, daria uma
 * invalidação silenciosamente sem efeito, que é o pior tipo.
 *
 * Falha em silêncio de propósito: invalidar cache não pode derrubar o
 * salvamento que já deu certo. O custo de não invalidar é o minuto do ISR.
 */
export async function invalidarBioPublica(
  alvo: { userId: string } | { orgId: string }
): Promise<void> {
  const supabase = await createClient()

  const consulta = supabase.from('proposal_pages').select('slug')
  const { data } = await ('userId' in alvo
    ? consulta.eq('user_id', alvo.userId)
    : consulta.eq('org_id', alvo.orgId)
  ).maybeSingle()

  if (data?.slug) updateTag(tagBio(data.slug))
}
