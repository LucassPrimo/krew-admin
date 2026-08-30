import { redirect } from 'next/navigation'

import { adminUserIds, escritaLigada } from './env'
import { dbRO } from './db'
import { momentoDoTotp, STEP_UP_MAX_MS } from './step-up'
import { supabaseAuth } from './supabase'

/**
 * As camadas 2 a 6 do plano. A 1 (perímetro) é a Vercel, antes do Next.js; a 7
 * é o GRANT no banco, depois de tudo.
 *
 * O ponto de ter várias: nenhuma delas sozinha basta, e elas se comprometem de
 * formas diferentes. Quem tem a Vercel controla a lista do env; quem tem o SQL
 * controla `platform_admins`. Exigir as duas significa que furar uma não abre a
 * porta.
 */

export type Ator = {
  id: string
  email: string
  /** Nível de garantia da sessão: 'aal2' = passou pelo TOTP nesta sessão. */
  aal: string
}

/**
 * Guard de LEITURA. Todo Server Component do painel começa por aqui.
 *
 * Redireciona em vez de lançar: o destino diz o que fazer (entrar, cadastrar o
 * fator, ou a tela de negado), e uma exceção genérica não diria.
 */
export async function exigirAtor(): Promise<Ator> {
  const supabase = await supabaseAuth()

  // Camada 2 — a sessão existe e é válida?
  const { data: sessao } = await supabase.auth.getUser()
  const user = sessao.user
  if (!user) redirect('/login?motivo=sessao')

  // Camada 3 — o id está na lista da Vercel?
  // Antes da consulta ao banco de propósito: é a checagem barata, e uma
  // requisição não autorizada não deve nem custar uma ida ao Postgres.
  if (!adminUserIds.includes(user.id)) redirect('/negado')

  // Camada 4 — esta sessão passou pelo segundo fator?
  // `currentLevel` é sobre a sessão de agora; `nextLevel` diz o que a conta
  // exige. Quem ainda não cadastrou o TOTP tem nextLevel 'aal1' e vai para o
  // cadastro — sem isso, uma conta sem fator entraria direto.
  const { data: nivel } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  if (nivel?.nextLevel === 'aal1') redirect('/mfa/cadastrar')
  if (nivel?.currentLevel !== 'aal2') redirect('/mfa')

  // Camada 5 — o banco concorda?
  const linhas = await dbRO<{ user_id: string }[]>`
    select user_id from public.platform_admins where user_id = ${user.id}
  `
  if (linhas.length === 0) redirect('/negado')

  return { id: user.id, email: user.email ?? '', aal: nivel.currentLevel ?? 'aal1' }
}

/**
 * Quando a janela de step-up desta sessão expira, em ms — ou `null` se o TOTP
 * nunca foi verificado neste token.
 *
 * Existe para a CASCA avisar antes do erro. Enquanto isso não existia, o
 * vencimento só aparecia depois de você preencher um formulário, clicar em
 * gravar e receber "confirme o código do autenticador" — o pior momento
 * possível, porque é quando o trabalho já foi feito. Saber que faltam dois
 * minutos muda o que você faz agora.
 */
export async function expiracaoDoStepUp(): Promise<number | null> {
  const supabase = await supabaseAuth()
  const { data } = await supabase.auth.getSession()
  const quando = momentoDoTotp(data.session?.access_token)
  return quando ? quando + STEP_UP_MAX_MS : null
}

/** Motivo pelo qual uma escrita foi recusada, para a tela explicar direito. */
export type RecusaDeEscrita =
  | { ok: true; ator: Ator }
  | { ok: false; motivo: 'kill_switch' | 'sem_step_up'; texto: string }

/**
 * Guard de ESCRITA (camada 6). Além de tudo que a leitura exige:
 *
 * - o kill switch tem que estar ligado;
 * - o TOTP tem que ter sido verificado há menos de 15 minutos.
 *
 * O step-up é o que separa "alguém pegou seu notebook aberto" de "alguém
 * conseguiu escrever no banco de todos os clientes". Ler nunca pede de novo;
 * escrever pode sempre pedir.
 */
export async function autorizarEscrita(): Promise<RecusaDeEscrita> {
  const ator = await exigirAtor()

  if (!escritaLigada) {
    return {
      ok: false,
      motivo: 'kill_switch',
      texto:
        'A escrita está desligada neste deploy (ADMIN_WRITES_ENABLED). ' +
        'O painel está em modo leitura — nada aqui altera o banco.',
    }
  }

  const supabase = await supabaseAuth()
  const { data } = await supabase.auth.getSession()

  const quando = momentoDoTotp(data.session?.access_token)

  if (!quando || Date.now() - quando > STEP_UP_MAX_MS) {
    return {
      ok: false,
      motivo: 'sem_step_up',
      texto: 'Confirme o código do autenticador para gravar esta alteração.',
    }
  }

  return { ok: true, ator }
}

/**
 * Autorização de escrita SEM step-up de TOTP.
 *
 * Para a oferta de bio. A diferença em relação a `autorizarEscrita()` não é
 * preguiça: montar uma oferta é CRIAR dado novo, numa conta que não é de
 * ninguém ainda — não é alterar o `org_id` de um cliente nem o status de um
 * recebível. O código a cada 15 minutos existe para a segunda categoria, onde
 * um clique errado mexe no que já é de alguém.
 *
 * O que continua valendo: sessão válida, as duas listas de admin, AAL2 na
 * entrada (o painel inteiro exige o TOTP para abrir) e o kill switch. Ou seja,
 * quem chega aqui já provou o segundo fator hoje — só não precisa reprová-lo a
 * cada quarto de hora enquanto monta uma oferta.
 */
export async function autorizarEscritaSemStepUp(): Promise<RecusaDeEscrita> {
  const ator = await exigirAtor()

  if (!escritaLigada) {
    return {
      ok: false,
      motivo: 'kill_switch',
      texto:
        'A escrita está desligada neste deploy (ADMIN_WRITES_ENABLED). ' +
        'O painel está em modo leitura — nada aqui altera o banco.',
    }
  }

  return { ok: true, ator }
}
