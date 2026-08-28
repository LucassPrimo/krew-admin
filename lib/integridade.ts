import { dbRO } from './db'
import { REGISTRY } from './registry'

/**
 * Health checks — a tela que evita chamado.
 *
 * Cada item é uma consulta de consistência com duas coisas obrigatórias: o que
 * o problema causa para o cliente, e o que fazer. Um check sem "como consertar"
 * vira um número vermelho que ninguém sabe resolver e todo mundo aprende a
 * ignorar.
 *
 * Todos rodam na conexão RO. Nenhum conserta nada sozinho: a correção passa
 * pelo registry, uma linha por vez, auditada.
 */

export type Check = {
  nome: string
  dor: string
  conserto: string
  total: number
  amostra: Record<string, unknown>[]
}

async function contar(
  nome: string, dor: string, conserto: string,
  consulta: Promise<Record<string, unknown>[]>,
): Promise<Check> {
  const linhas = await consulta
  return { nome, dor, conserto, total: linhas.length, amostra: linhas.slice(0, 5) }
}

export async function rodarChecks(): Promise<Check[]> {
  // Um dos checks abaixo olha para o próprio painel: `grant ... on all tables`
  // alcança só o que existia quando rodou, então toda tabela nova nasce
  // invisível para os roles do admin. Isso já aconteceu de verdade com o
  // link-na-bio (ver 20260827150000 no repo krew-app), e a única forma de não
  // repetir é a máquina avisar.
  const checks = await Promise.all([
    contar(
      'Perfis sem organização',
      'O trigger de signup falhou: a conta nasceu quebrada e não enxerga nada no app.',
      'Criar a organização e o membership à mão, ou apagar a conta se foi teste.',
      dbRO`select p.id, p.full_name, p.created_at from public.profiles p
           where not exists (select 1 from public.memberships m where m.user_id = p.id)
           limit 50`,
    ),
    contar(
      'Cadastros travados há mais de 7 dias',
      'Uma pessoa parada na porta: começou o cadastro e não terminou.',
      'Ver em que passo parou na visão 360 e destravar, ou ligar.',
      dbRO`select id, full_name, onboarding_step, created_at from public.profiles
           where coalesce(onboarding_step,0) < 3
             and created_at < now() - interval '7 days'
           order by created_at desc limit 50`,
    ),
    contar(
      'E-mail não confirmado há mais de 48h',
      'Não recebeu ou não achou o e-mail — não consegue usar a conta.',
      'Reenviar a confirmação, ou confirmar manualmente se você reconhece a pessoa.',
      dbRO`select id, email, created_at from public.admin_auth_users
           where email_confirmed_at is null
             and created_at < now() - interval '48 hours'
           order by created_at desc limit 50`,
    ),
    contar(
      'Recebíveis vencidos ainda pendentes',
      'Dinheiro parado do cliente. É oportunidade de cobrança, não erro de dado.',
      'Nada a corrigir aqui — é sinal para o cliente cobrar a marca.',
      dbRO`select id, descricao, valor, data_prevista from public.receivables
           where status <> 'pago' and data_prevista < current_date
           order by data_prevista limit 50`,
    ),
    contar(
      'Soma dos recebíveis diferente do valor da campanha',
      'O financeiro do cliente mostra um número que não fecha com a campanha.',
      'Conferir os recebíveis da campanha e ajustar o que estiver errado.',
      dbRO`select c.id, c.nome, c.valor_total, sum(r.valor) as soma_recebiveis
           from public.campaigns c join public.receivables r on r.campaign_id = c.id
           where c.valor_total is not null
           group by c.id, c.nome, c.valor_total
           having abs(coalesce(sum(r.valor),0) - c.valor_total) > 0.01
           limit 50`,
    ),
    contar(
      'Entregáveis órfãos',
      'Somem da tela do cliente sem nenhum erro aparecer.',
      'Religar à campanha certa ou apagar pelo SQL Editor.',
      dbRO`select d.id, d.titulo, d.campaign_id from public.deliverables d
           where not exists (select 1 from public.campaigns c where c.id = d.campaign_id)
           limit 50`,
    ),
    contar(
      'E-mails com falha de entrega',
      'A marca não recebeu a confirmação da proposta que mandou.',
      'Ver o erro do provedor em /emails e reenviar.',
      dbRO`select id, type, status, created_at from public.email_logs
           where status = 'failed' order by created_at desc limit 50`,
    ),
    contar(
      'Slug de página colidindo com slug reservado',
      'Página pública inacessível ou disputando URL com rota do sistema.',
      'Trocar o slug da página pelo registry (campo perigoso: quebra links divulgados).',
      dbRO`select p.id, p.slug from public.proposal_pages p
           join public.reserved_slugs r on r.slug = p.slug limit 50`,
    ),
    contar(
      'Carteira de agência apontando para org inexistente',
      'A agência vê a carteira quebrada.',
      'Corrigir o creator_org_id ou remover o vínculo.',
      dbRO`select ac.id, ac.agency_org_id, ac.creator_org_id from public.agency_creators ac
           where not exists (select 1 from public.organizations o where o.id = ac.creator_org_id)
           limit 50`,
    ),
    contar(
      'Tabelas que o painel não consegue ler',
      'Qualquer tela que toque nelas quebra com "permission denied" — e só se descobre usando.',
      'Conceder select (e update, se for entrar no registry) aos roles krew_admin_*, por migration no repo krew-app.',
      dbRO`select c.relname as tabela from pg_class c
           join pg_namespace n on n.oid = c.relnamespace
           where n.nspname = 'public' and c.relkind in ('r','v')
             and not has_table_privilege('krew_admin_ro', c.oid, 'select')
           limit 50`,
    ),
    contar(
      'Tabelas de public sem RLS habilitada',
      'Regressão de segurança no produto: a tabela ficaria legível por qualquer conta.',
      'Ligar RLS e escrever a policy no repo krew-app, nunca daqui.',
      dbRO`select c.relname as tabela from pg_class c
           join pg_namespace n on n.oid = c.relnamespace
           where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
           limit 50`,
    ),
  ])

  // O check do próprio painel: colunas que existem no banco e ninguém mapeou.
  // Sem isto, o registry envelhece em silêncio e um campo novo fica invisível
  // exatamente quando alguém precisa corrigi-lo.
  const naoMapeadas = await colunasNaoMapeadas()
  checks.push({
    nome: 'Colunas fora do registry',
    dor: 'O painel envelheceu em relação ao schema: estes campos não podem ser vistos nem corrigidos aqui.',
    conserto: 'Declarar a coluna em lib/registry.ts, decidindo se é editável e se é perigosa.',
    total: naoMapeadas.length,
    amostra: naoMapeadas.slice(0, 5),
  })

  return checks
}

async function colunasNaoMapeadas(): Promise<Record<string, unknown>[]> {
  const tabelas = Object.keys(REGISTRY)
  if (tabelas.length === 0) return []

  const colunas = await dbRO<{ table_name: string; column_name: string }[]>`
    select table_name, column_name from information_schema.columns
    where table_schema = 'public' and table_name in ${dbRO(tabelas)}
  `

  return colunas
    .filter(({ table_name, column_name }) => {
      const mapa = REGISTRY[table_name]
      return mapa && !Object.hasOwn(mapa.colunas, column_name)
    })
    .map(({ table_name, column_name }) => ({ tabela: table_name, coluna: column_name }))
}
