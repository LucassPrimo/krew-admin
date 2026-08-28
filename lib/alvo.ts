import { cookies, headers } from 'next/headers'

import { dbRO } from './db'

/**
 * De quem é a bio que o painel está editando.
 *
 * As telas copiadas do krew-app (`bio-links-card`, `bio-perfil-card`, as
 * actions de `app/actions/bio.ts`) foram escritas para o app do criador, onde a
 * resposta é sempre "de quem está logado". Aqui quem está logado é você, e a
 * bio é de outra pessoa — então alguém precisa dizer de quem.
 *
 * Vai num COOKIE, e não em memória de requisição, por um motivo específico:
 * cada Server Action é uma requisição HTTP própria. Um `AsyncLocalStorage`
 * preenchido durante o render da página não existiria mais quando o card de
 * links chamasse `criarLinkBio` três cliques depois.
 *
 * O valor é validado contra `bio_ofertas` a cada leitura. Isso não é
 * paranoia: sem a validação, um cookie forjado apontaria as actions para a
 * conta de um cliente real — e elas escreveriam lá com a chave de serviço, sem
 * passar por nenhuma RLS. Só páginas de OFERTA são alcançáveis por este
 * caminho.
 */
export const COOKIE_ALVO = 'krew_admin_alvo'

export type Alvo = { userId: string; orgId: string; pageId: string; slug: string }

/**
 * Qual oferta está sendo editada nesta requisição.
 *
 * Ordem: cabeçalho do proxy (vale no render), `Referer` (vale nas Server
 * Actions) e cookie por último. A diferença aparece com
 * duas abas abertas: o cookie é um por navegador, então editar duas ofertas ao
 * mesmo tempo faria a segunda aba mandar as alterações para a primeira. O
 * `Referer` de uma Server Action é a URL da tela que a chamou, então cada aba
 * fala pela sua.
 *
 * Não confiar no `Referer` não é problema: seja qual for a origem do id, ele é
 * validado contra `bio_ofertas` logo abaixo.
 */
export async function alvoAtual(): Promise<Alvo | null> {
  const h = await headers()
  const doProxy = h.get('x-krew-alvo')
  const naUrl = (h.get('referer') ?? '').match(/\/ofertas\/([0-9a-f-]{36})/i)?.[1]
  const pageId = doProxy ?? naUrl ?? (await cookies()).get(COOKIE_ALVO)?.value
  if (!pageId) return null
  return alvoDaOferta(pageId)
}

/** O alvo de uma oferta específica — a mesma validação, por id explícito. */
export async function alvoDaOferta(pageId: string): Promise<Alvo | null> {
  if (!/^[0-9a-f-]{36}$/i.test(pageId)) return null

  const [linha] = await dbRO<{ user_id: string; org_id: string; slug: string }[]>`
    select p.user_id, p.org_id, p.slug
    from public.proposal_pages p
    join public.bio_ofertas o on o.page_id = p.id
    where p.id = ${pageId}
  `
  if (!linha) return null

  return { userId: linha.user_id, orgId: linha.org_id, pageId, slug: linha.slug }
}
