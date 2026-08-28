import { z } from 'zod'

/**
 * As variáveis do painel, validadas na primeira importação.
 *
 * Falhar aqui é o objetivo: um `ADMIN_DATABASE_URL_RO` ausente não pode virar
 * `undefined` que só explode três telas adiante, com uma mensagem do driver que
 * não diz o que faltou. Painel que administra o banco inteiro não sobe pela
 * metade.
 *
 * Nada aqui é `NEXT_PUBLIC_` além da URL e da chave anônima do Supabase — que
 * são públicas por definição e servem só ao fluxo de login/MFA no navegador.
 * As duas URLs de banco abrem produção; se alguma delas ganhar o prefixo
 * público um dia, ela vai parar dentro do bundle que qualquer visitante baixa.
 */
const schema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),

  // Só SELECT. É esta que 90% do código usa.
  ADMIN_DATABASE_URL_RO: z.string().startsWith('postgres'),
  // INSERT/UPDATE nas tabelas do registry. Sem DELETE, sem DDL.
  ADMIN_DATABASE_URL_RW: z.string().startsWith('postgres'),

  // Camada 3: a lista que vive na Vercel, independente do banco.
  ADMIN_USER_IDS: z.string().min(36),

  // Kill switch (D-final do plano): derruba TODA escrita em um deploy, sem
  // precisar reverter código. Só a string exata 'true' liga.
  ADMIN_WRITES_ENABLED: z.string().optional(),

  // Só a bio de oferta usa isto: criar a conta-fantasma e disparar o convite
  // são chamadas da Admin API de Auth, que não existem em SQL.
  //
  // OPCIONAL de propósito. Se faltar, todo o resto do painel sobe normalmente e
  // apenas a criação de oferta recusa, dizendo o que falta. O contrário — travar
  // a subida inteira por causa de uma feature — deixaria você sem painel num dia
  // em que talvez só precisasse ler alguma coisa.
  ADMIN_SUPABASE_SERVICE_KEY: z.string().optional(),
})

const parsed = schema.safeParse(process.env)

if (!parsed.success) {
  const faltando = parsed.error.issues.map((i) => i.path.join('.')).join(', ')
  throw new Error(`Ambiente incompleto para o painel: ${faltando}`)
}

export const env = parsed.data

/** Ids autorizados pela Vercel (camada 3). Vazio nunca — o schema exige. */
export const adminUserIds: string[] = env.ADMIN_USER_IDS.split(',')
  .map((s) => s.trim())
  .filter(Boolean)

/**
 * Escrita ligada?
 *
 * Padrão é NÃO. Uma variável ausente, vazia ou escrita errado ('TRUE', '1',
 * 'sim') deixa o painel em modo leitura — o lado seguro do erro de digitação.
 */
export const escritaLigada = env.ADMIN_WRITES_ENABLED === 'true'

/** A criação de oferta depende da Admin API; sem a chave, ela fica indisponível. */
export const ofertasDisponiveis = Boolean(env.ADMIN_SUPABASE_SERVICE_KEY)
