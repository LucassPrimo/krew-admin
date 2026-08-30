import type { TransactionSql } from 'postgres'

import { dbRO, dbRW } from './db'
import { escritaLigada } from './env'
import { normalizarSlug } from './handle'
import { registrarAcao } from './mutate'

/**
 * O selo de verificado da bio (`proposal_pages.bio_verificado`).
 *
 * ---------------------------------------------------------------------------
 * Por que isto existe fora de /dados
 * ---------------------------------------------------------------------------
 * Ligar o selo já era possível: `/dados/proposal_pages/{id}` edita a coluna
 * como qualquer outra. Só que o caminho genérico cobra o preço do caso mais
 * perigoso — achar o id da linha, passar pelo TOTP dos últimos 15 minutos e
 * escrever um motivo de dez caracteres — e conceder selo não é mexer no
 * `org_id` de um cliente nem no status de um recebível: é um booleano
 * reversível, que não apaga nada e que a operação usa toda semana.
 *
 * Aqui o gesto é o que ele deveria ser: você escreve o handle e confirma.
 *
 * ---------------------------------------------------------------------------
 * O que continua valendo
 * ---------------------------------------------------------------------------
 * Tirar o step-up NÃO é tirar controle. Continuam de pé: sessão válida, as
 * duas listas de admin (env + `platform_admins`), o AAL2 exigido para o painel
 * abrir, o kill switch de escrita e — o que mais importa depois — a linha em
 * `admin_audit.mutations`, gravada no MESMO commit do update. Quem chega aqui
 * já provou o segundo fator hoje; só não o reprova a cada quarto de hora.
 *
 * É o mesmo raciocínio de `autorizarEscritaSemStepUp()` para as ofertas e o
 * CRM, e a linha divisória é a mesma: alterar dado que já é de alguém pede o
 * código; um selo que se liga e desliga, não.
 *
 * ---------------------------------------------------------------------------
 * O handle é o endereço, e é ele que confirma
 * ---------------------------------------------------------------------------
 * Toda função daqui é endereçada por SLUG, nunca por id de linha. Não é
 * conveniência: o slug é a única coisa que você tem na mão quando alguém pede o
 * selo ("verifica o @fulano"), e escrevê-lo é a própria confirmação — não dá
 * para errar de pessoa sem errar o nome dela. Um id de linha, colado de uma
 * lista, é justamente o que se acerta sem olhar.
 */

/** Reexportado para quem já importa o selo não precisar de dois imports. */
export { normalizarSlug }

export type BioParaSelo = {
  id: string
  slug: string
  user_id: string
  nome: string | null
  email: string | null
  bio_verificado: boolean
  bio_ativo: boolean
}

const SELECAO = dbRO`
  pp.id, pp.slug, pp.user_id, pp.bio_verificado, pp.bio_ativo,
  nullif(trim(concat_ws(' ', p.full_name, p.sobrenome)), '') as nome,
  u.email
`

/** A página de um handle, com o nome de quem é — para a tela confirmar a pessoa. */
export async function buscarBioPorSlug(entrada: string): Promise<BioParaSelo | null> {
  const slug = normalizarSlug(entrada)
  if (!slug) return null

  const [linha] = await dbRO<BioParaSelo[]>`
    select ${SELECAO}
    from public.proposal_pages pp
    left join public.profiles p on p.id = pp.user_id
    left join public.admin_auth_users u on u.id = pp.user_id
    where lower(pp.slug) = ${slug}
  `
  return linha ?? null
}

/** Quem já tem o selo. É a lista da tela, e o lugar de tirar de volta. */
export async function listarVerificadas(): Promise<BioParaSelo[]> {
  return dbRO<BioParaSelo[]>`
    select ${SELECAO}
    from public.proposal_pages pp
    left join public.profiles p on p.id = pp.user_id
    left join public.admin_auth_users u on u.id = pp.user_id
    where pp.bio_verificado
    order by pp.slug
  `
}

export type ResultadoSelo =
  | { ok: true; pagina: BioParaSelo; mudou: boolean }
  | { ok: false; erro: string }

/**
 * Liga ou desliga o selo de um handle.
 *
 * Idempotente por escolha: pedir o que já está valendo devolve `mudou: false`
 * e NÃO grava nada — nem update, nem linha de auditoria. Um log cheio de
 * "ligou o que já estava ligado" é ruído em cima da única pergunta que a
 * auditoria precisa responder aqui, que é quando o selo mudou de estado.
 */
export async function definirVerificado(
  entrada: string,
  ligar: boolean,
  ctx: { atorId: string; ip: string | null; userAgent: string | null },
): Promise<ResultadoSelo> {
  // O kill switch já foi conferido na action; repetir aqui custa nada e fecha
  // o caminho para quem chamar esta função de outro lugar amanhã.
  if (!escritaLigada) {
    return { ok: false, erro: 'Escrita desligada neste deploy (ADMIN_WRITES_ENABLED).' }
  }

  const slug = normalizarSlug(entrada)
  if (!slug) return { ok: false, erro: 'Escreva o handle da pessoa (ex.: @fulano).' }

  try {
    return await dbRW.begin(async (tx: TransactionSql) => {
      const [antes] = await tx<BioParaSelo[]>`
        select pp.id, pp.slug, pp.user_id, pp.bio_verificado, pp.bio_ativo,
               nullif(trim(concat_ws(' ', p.full_name, p.sobrenome)), '') as nome,
               u.email
        from public.proposal_pages pp
        left join public.profiles p on p.id = pp.user_id
        left join public.admin_auth_users u on u.id = pp.user_id
        where lower(pp.slug) = ${slug}
        for update of pp
      `
      if (!antes) throw new Error(`Nenhuma página com o handle @${slug}.`)
      if (antes.bio_verificado === ligar) {
        return { ok: true as const, pagina: antes, mudou: false }
      }

      await tx`
        update public.proposal_pages set bio_verificado = ${ligar} where id = ${antes.id}
      `

      await registrarAcao(tx, {
        atorId: ctx.atorId,
        tabela: 'proposal_pages',
        registroId: antes.id,
        detalhe: { acao: ligar ? 'selo_concedido' : 'selo_removido', slug: antes.slug, bio_verificado: ligar },
        motivo: ligar
          ? `Selo de verificado concedido a @${antes.slug} pelo painel`
          : `Selo de verificado removido de @${antes.slug} pelo painel`,
        ip: ctx.ip,
        userAgent: ctx.userAgent,
      })

      return { ok: true as const, pagina: { ...antes, bio_verificado: ligar }, mudou: true }
    })
  } catch (e) {
    return { ok: false, erro: (e as Error).message }
  }
}
