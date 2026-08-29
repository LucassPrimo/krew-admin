import type { TransactionSql } from 'postgres'

import { analisarPlanilha, type Plano, type PlanoLinha } from './crm-importar'
import {
  ESTAGIOS_MANUAIS, estagioDe, limparInstagram, type EstagioManual, type Lead, type LinhaLead,
} from './crm-tipos'
import { dbRO, dbRW } from './db'
import { registrarAcao } from './mutate'

export * from './crm-tipos'
export * from './crm-importar'

/**
 * O CRM de prospecção: a fila de criadores antes de eles serem clientes.
 *
 * ---------------------------------------------------------------------------
 * O que ele substitui
 * ---------------------------------------------------------------------------
 * Uma planilha com Nome, Instagram, Fonte, o handle da bio e três colunas de
 * SIM/FALSE — "Link criado?", "Enviado", "Aceito". As três respondem sobre
 * algo que o banco JÁ sabe: uma linha em `public.bio_ofertas` é o link criado,
 * `convite_enviado_em` é o enviado, `aceita_em` é o aceito. Marcadas à mão,
 * elas divergem do produto no primeiro dia corrido — e foi por isso que a
 * planilha "não estava muito funcional".
 *
 * Então aqui elas não existem como campo. O lead guarda só o que é dele (quem
 * é, de onde veio, o que ficou combinado, quando falar de novo) e aponta para
 * a oferta; o estágio dali para a frente é LIDO da oferta, a cada consulta.
 *
 * ---------------------------------------------------------------------------
 * Onde o dado mora
 * ---------------------------------------------------------------------------
 * No schema `admin_crm` (ver `sql/admin_crm.sql`), fora de `public`, porque
 * este repositório não cria nada em `public`. Enquanto o SQL não roda, as
 * consultas devolvem vazio e as telas explicam o que falta em vez de estourar
 * — `crmInstalado()` é o que decide isso.
 */

/**
 * O schema existe?
 *
 * Sem ele o painel inteiro continuaria de pé, e é por isso que a checagem é
 * explícita em vez de um try/catch em volta de cada consulta: a tela precisa
 * distinguir "não instalado" de "instalado e vazio" para dizer a coisa certa.
 *
 * O `true` fica em cache no processo — instalar é um evento único, e repetir a
 * consulta a cada navegação seria uma ida ao banco para saber algo que não
 * muda. O `false` NÃO fica: depois de rodar o SQL, a próxima navegação já
 * enxerga, sem redeploy.
 */
let instalado = false
export async function crmInstalado(): Promise<boolean> {
  if (instalado) return true
  const [linha] = await dbRO<{ existe: boolean }[]>`
    select exists (
      select 1 from information_schema.tables
      where table_schema = 'admin_crm' and table_name = 'leads'
    ) as existe
  `
  instalado = Boolean(linha?.existe)
  return instalado
}

const SELECT_LEADS = `
  select l.*,
         p.slug,
         o.criada_em as oferta_criada_em,
         o.convite_enviado_em,
         o.aceita_em,
         (select sum(cl.cliques) from public.creator_links cl
          where cl.user_id = p.user_id)::int as cliques,
         (select count(*) from admin_crm.lead_notas n where n.lead_id = l.id)::int as notas
  from admin_crm.leads l
  left join public.bio_ofertas o on o.page_id = l.page_id
  left join public.proposal_pages p on p.id = l.page_id
`

/**
 * Todos os leads, já com o estágio resolvido.
 *
 * Sem filtro no SQL de propósito: o estágio efetivo é calculado em TypeScript
 * (a regra do `perdido_em` que vence a derivação não cabe num `where` sem se
 * repetir em cada consulta), e filtrar por ele exigiria duplicar essa regra
 * dentro do banco. A prospecção é da ordem de centenas de linhas — o custo de
 * trazer tudo é menor que o de manter a mesma regra escrita duas vezes.
 */
export async function listarLeads(): Promise<Lead[]> {
  if (!(await crmInstalado())) return []
  const linhas = await dbRO.unsafe<LinhaLead[]>(
    `${SELECT_LEADS} order by l.criado_em desc`,
  )
  return linhas.map((l) => ({ ...l, estagioEfetivo: estagioDe(l) }))
}

export async function lerLead(id: string): Promise<Lead | null> {
  if (!(await crmInstalado())) return null
  const [linha] = await dbRO.unsafe<LinhaLead[]>(`${SELECT_LEADS} where l.id = $1`, [id])
  return linha ? { ...linha, estagioEfetivo: estagioDe(linha) } : null
}

export type Nota = { id: string; texto: string; criada_em: string; autor_id: string }

export async function notasDoLead(leadId: string): Promise<Nota[]> {
  if (!(await crmInstalado())) return []
  return dbRO<Nota[]>`
    select id, texto, criada_em, autor_id
    from admin_crm.lead_notas
    where lead_id = ${leadId}
    order by criada_em desc
  `
}

/** Ofertas que ainda não são de nenhum lead, para o seletor de vínculo. */
export async function ofertasSemLead(): Promise<
  { page_id: string; slug: string; nome: string | null }[]
> {
  if (!(await crmInstalado())) return []
  return dbRO`
    select o.page_id, p.slug, pr.full_name as nome
    from public.bio_ofertas o
    join public.proposal_pages p on p.id = o.page_id
    left join public.profiles pr on pr.id = p.user_id
    where not exists (select 1 from admin_crm.leads l where l.page_id = o.page_id)
    order by o.criada_em desc
  `
}

/**
 * Quantos leads têm follow-up vencido — o número do badge na barra lateral.
 *
 * Consulta própria, e não `listarLeads().filter()`, porque quem chama é o
 * layout: ele roda em TODA navegação do painel, inclusive nas telas que não
 * têm nada com o CRM, e não deve carregar a lista inteira para pintar um
 * número.
 */
export async function leadsParaHoje(): Promise<number> {
  if (!(await crmInstalado())) return 0
  const [linha] = await dbRO<{ n: number }[]>`
    select count(*)::int as n
    from admin_crm.leads l
    left join public.bio_ofertas o on o.page_id = l.page_id
    where l.perdido_em is null
      and o.aceita_em is null
      and l.proximo_contato is not null
      and l.proximo_contato <= current_date
  `
  return linha?.n ?? 0
}

// ---------------------------------------------------------------------------
// Escrita
// ---------------------------------------------------------------------------
// Toda função abaixo grava e AUDITA no mesmo commit, como o resto do painel:
// `admin_audit.mutations` com `tabela = 'crm_leads'`. O CRM não é exceção à
// regra de que nada muda aqui dentro sem deixar rastro.

export type Contexto = { atorId: string; ip: string | null; userAgent: string | null }

export type NovoLead = {
  nome: string
  instagram?: string | null
  fonte?: string | null
  email?: string | null
  whatsapp?: string | null
  handlePretendido?: string | null
  proximoContato?: string | null
  estagio?: EstagioManual
  /** Primeira anotação, opcional — como você chegou nessa pessoa. */
  nota?: string | null
}

export async function criarLead(
  dados: NovoLead,
  ctx: Contexto,
): Promise<{ ok: true; id: string } | { ok: false; erro: string }> {
  if (!(await crmInstalado())) return { ok: false, erro: ERRO_NAO_INSTALADO }

  const nome = dados.nome.trim()
  if (!nome) return { ok: false, erro: 'O nome é obrigatório.' }

  const instagram = limparInstagram(dados.instagram)
  const handle = (dados.handlePretendido ?? '').trim().toLowerCase() || null

  try {
    const id = await dbRW.begin(async (tx: TransactionSql) => {
      // Se a oferta com esse handle já existe, o lead nasce vinculado. É o
      // caso comum de quem está migrando a planilha: a bio foi montada antes
      // de o CRM existir.
      const [oferta] = handle
        ? await tx<{ page_id: string }[]>`
            select o.page_id from public.bio_ofertas o
            join public.proposal_pages p on p.id = o.page_id
            where p.slug = ${handle}
              and not exists (select 1 from admin_crm.leads l where l.page_id = o.page_id)
          `
        : []

      const [lead] = await tx<{ id: string }[]>`
        insert into admin_crm.leads
          (nome, instagram, fonte, email, whatsapp, handle_pretendido, page_id,
           estagio, proximo_contato, criado_por)
        values (${nome}, ${instagram}, ${dados.fonte?.trim() || null},
                ${dados.email?.trim() || null}, ${dados.whatsapp?.trim() || null},
                ${handle}, ${oferta?.page_id ?? null},
                ${dados.estagio ?? 'novo'}, ${dados.proximoContato || null},
                ${ctx.atorId})
        returning id
      `

      if (dados.nota?.trim()) {
        await tx`
          insert into admin_crm.lead_notas (lead_id, autor_id, texto)
          values (${lead.id}, ${ctx.atorId}, ${dados.nota.trim()})
        `
      }

      await registrarAcao(tx, {
        atorId: ctx.atorId,
        tabela: 'crm_leads',
        registroId: lead.id,
        detalhe: { acao: 'lead_criado', nome, instagram, fonte: dados.fonte ?? null,
                   oferta_vinculada: oferta?.page_id ?? null },
        motivo: `Lead ${nome} criado no CRM do painel`,
        ip: ctx.ip,
        userAgent: ctx.userAgent,
      })

      return lead.id
    })

    return { ok: true, id }
  } catch (e) {
    return { ok: false, erro: traduzir(e as Error) }
  }
}

export type EdicaoLead = {
  nome?: string
  instagram?: string | null
  fonte?: string | null
  email?: string | null
  whatsapp?: string | null
  handlePretendido?: string | null
  estagio?: EstagioManual
  proximoContato?: string | null
}

export async function atualizarLead(
  id: string,
  campos: EdicaoLead,
  ctx: Contexto,
): Promise<{ ok: true } | { ok: false; erro: string }> {
  if (!(await crmInstalado())) return { ok: false, erro: ERRO_NAO_INSTALADO }

  const valores: Record<string, unknown> = {}
  if (campos.nome !== undefined) {
    if (!campos.nome.trim()) return { ok: false, erro: 'O nome é obrigatório.' }
    valores.nome = campos.nome.trim()
  }
  if (campos.instagram !== undefined) valores.instagram = limparInstagram(campos.instagram)
  if (campos.fonte !== undefined) valores.fonte = campos.fonte?.trim() || null
  if (campos.email !== undefined) valores.email = campos.email?.trim() || null
  if (campos.whatsapp !== undefined) valores.whatsapp = campos.whatsapp?.trim() || null
  if (campos.handlePretendido !== undefined) {
    valores.handle_pretendido = campos.handlePretendido?.trim().toLowerCase() || null
  }
  if (campos.estagio !== undefined) {
    if (!ESTAGIOS_MANUAIS.includes(campos.estagio)) {
      return { ok: false, erro: `Estágio inválido: ${campos.estagio}` }
    }
    valores.estagio = campos.estagio
  }
  if (campos.proximoContato !== undefined) valores.proximo_contato = campos.proximoContato || null

  if (Object.keys(valores).length === 0) return { ok: false, erro: 'Nenhuma alteração enviada.' }
  valores.atualizado_em = new Date()

  try {
    await dbRW.begin(async (tx: TransactionSql) => {
      const [antes] = await tx<Record<string, unknown>[]>`
        select * from admin_crm.leads where id = ${id} for update
      `
      if (!antes) throw new Error('Lead não encontrado.')

      await tx`update admin_crm.leads set ${dbRW(valores)} where id = ${id}`

      const antesDiff: Record<string, unknown> = {}
      for (const coluna of Object.keys(valores)) antesDiff[coluna] = antes[coluna]

      await registrarAcao(tx, {
        atorId: ctx.atorId,
        tabela: 'crm_leads',
        registroId: id,
        detalhe: { acao: 'lead_editado', antes: antesDiff, depois: valores },
        motivo: `Lead do CRM editado pelo painel: ${Object.keys(valores).join(', ')}`,
        ip: ctx.ip,
        userAgent: ctx.userAgent,
      })
    })
    return { ok: true }
  } catch (e) {
    return { ok: false, erro: traduzir(e as Error) }
  }
}

/** Liga (ou desliga) o lead de uma oferta de bio. */
export async function vincularOferta(
  id: string,
  pageId: string | null,
  ctx: Contexto,
): Promise<{ ok: true } | { ok: false; erro: string }> {
  if (!(await crmInstalado())) return { ok: false, erro: ERRO_NAO_INSTALADO }

  try {
    await dbRW.begin(async (tx: TransactionSql) => {
      if (pageId) {
        const [existe] = await tx`select page_id from public.bio_ofertas where page_id = ${pageId}`
        if (!existe) throw new Error('Oferta não encontrada.')

        const [ocupada] = await tx`
          select id from admin_crm.leads where page_id = ${pageId} and id <> ${id}
        `
        if (ocupada) throw new Error('Essa oferta já pertence a outro lead.')
      }

      const [linha] = await tx`
        update admin_crm.leads set page_id = ${pageId}, atualizado_em = now()
        where id = ${id} returning id
      `
      if (!linha) throw new Error('Lead não encontrado.')

      await registrarAcao(tx, {
        atorId: ctx.atorId,
        tabela: 'crm_leads',
        registroId: id,
        detalhe: { acao: pageId ? 'oferta_vinculada' : 'oferta_desvinculada', page_id: pageId },
        motivo: pageId
          ? 'Oferta de bio vinculada ao lead no CRM do painel'
          : 'Oferta de bio desvinculada do lead no CRM do painel',
        ip: ctx.ip,
        userAgent: ctx.userAgent,
      })
    })
    return { ok: true }
  } catch (e) {
    return { ok: false, erro: traduzir(e as Error) }
  }
}

export async function adicionarNota(
  id: string,
  texto: string,
  ctx: Contexto,
): Promise<{ ok: true } | { ok: false; erro: string }> {
  if (!(await crmInstalado())) return { ok: false, erro: ERRO_NAO_INSTALADO }

  const limpo = texto.trim()
  if (!limpo) return { ok: false, erro: 'A anotação está vazia.' }

  try {
    await dbRW.begin(async (tx: TransactionSql) => {
      const [lead] = await tx`select id from admin_crm.leads where id = ${id}`
      if (!lead) throw new Error('Lead não encontrado.')

      await tx`
        insert into admin_crm.lead_notas (lead_id, autor_id, texto)
        values (${id}, ${ctx.atorId}, ${limpo})
      `
      // O TEXTO não vai para a auditoria, só o fato. A anotação é a versão
      // integral e fica no lead; duplicá-la no log criaria uma segunda cópia
      // de conversa com criador em outra tabela, sem ninguém para lê-la.
      await registrarAcao(tx, {
        atorId: ctx.atorId,
        tabela: 'crm_leads',
        registroId: id,
        detalhe: { acao: 'nota_adicionada', caracteres: limpo.length },
        motivo: 'Anotação registrada no lead pelo CRM do painel',
        ip: ctx.ip,
        userAgent: ctx.userAgent,
      })
    })
    return { ok: true }
  } catch (e) {
    return { ok: false, erro: traduzir(e as Error) }
  }
}

/**
 * Perder e reabrir.
 *
 * Não existe apagar: o papel de escrita do painel não tem GRANT de DELETE em
 * lugar nenhum, e um lead que some leva junto a resposta de por que aquela
 * fonte não converte. Perder é reversível, e a data da perda é dado do funil.
 */
export async function marcarPerdido(
  id: string,
  motivo: string,
  ctx: Contexto,
): Promise<{ ok: true } | { ok: false; erro: string }> {
  if (!(await crmInstalado())) return { ok: false, erro: ERRO_NAO_INSTALADO }

  const porque = motivo.trim()
  if (!porque) return { ok: false, erro: 'Diga o motivo da perda — é o que o funil por fonte lê.' }

  try {
    await dbRW.begin(async (tx: TransactionSql) => {
      const [linha] = await tx`
        update admin_crm.leads
        set perdido_em = now(), motivo_perda = ${porque},
            proximo_contato = null, atualizado_em = now()
        where id = ${id} and perdido_em is null
        returning nome
      `
      if (!linha) throw new Error('Lead não encontrado ou já marcado como perdido.')

      await registrarAcao(tx, {
        atorId: ctx.atorId,
        tabela: 'crm_leads',
        registroId: id,
        detalhe: { acao: 'lead_perdido', motivo: porque },
        motivo: `Lead marcado como perdido no CRM: ${porque}`,
        ip: ctx.ip,
        userAgent: ctx.userAgent,
      })
    })
    return { ok: true }
  } catch (e) {
    return { ok: false, erro: traduzir(e as Error) }
  }
}

export async function reabrirLead(
  id: string,
  ctx: Contexto,
): Promise<{ ok: true } | { ok: false; erro: string }> {
  if (!(await crmInstalado())) return { ok: false, erro: ERRO_NAO_INSTALADO }

  try {
    await dbRW.begin(async (tx: TransactionSql) => {
      const [linha] = await tx`
        update admin_crm.leads
        set perdido_em = null, motivo_perda = null, atualizado_em = now()
        where id = ${id} and perdido_em is not null
        returning nome
      `
      if (!linha) throw new Error('Lead não encontrado ou já está aberto.')

      await registrarAcao(tx, {
        atorId: ctx.atorId,
        tabela: 'crm_leads',
        registroId: id,
        detalhe: { acao: 'lead_reaberto' },
        motivo: 'Lead reaberto no CRM do painel',
        ip: ctx.ip,
        userAgent: ctx.userAgent,
      })
    })
    return { ok: true }
  } catch (e) {
    return { ok: false, erro: traduzir(e as Error) }
  }
}

export const ERRO_NAO_INSTALADO =
  'O schema admin_crm ainda não existe neste banco. Rode sql/admin_crm.sql no SQL Editor do Supabase.'

/**
 * Erros do Postgres que a pessoa pode resolver, ditos em português.
 *
 * Só o do índice único, que é o que acontece de verdade: dois leads para o
 * mesmo @ é exatamente o engano que a planilha deixava passar, e "duplicate
 * key value violates unique constraint" não diz o que fazer.
 */
function traduzir(e: Error): string {
  if (e.message.includes('leads_instagram_unico')) {
    return 'Já existe um lead com esse Instagram. Abra o que já está lá em vez de criar outro.'
  }
  return e.message
}

// ---------------------------------------------------------------------------
// Importação de planilha
// ---------------------------------------------------------------------------

/**
 * Quantas linhas uma importação aceita de uma vez.
 *
 * Não é limite de banco: é o tamanho a partir do qual uma transação começa a
 * segurar conexão de escrita em produção por tempo que ninguém está olhando.
 * Uma planilha maior que isso se importa em duas — e quem tem 600 leads
 * provavelmente quer conferir os 500 primeiros antes de mandar o resto.
 */
export const LIMITE_IMPORTACAO = 500

/**
 * O que a importação FARIA — a prévia da tela.
 *
 * Existe separada da gravação porque importar planilha é o gesto em que o
 * engano é mais barato de cometer e mais caro de desfazer: coluna trocada,
 * arquivo errado, a mesma lista colada duas vezes. Ver antes de gravar é o que
 * transforma isso num passo reversível — e é a prévia que mostra os
 * duplicados, que a planilha sozinha não sabe.
 */
export async function preverImportacao(texto: string): Promise<Plano> {
  const analise = analisarPlanilha(texto)
  const avisos = [...analise.avisos]

  let linhas = analise.linhas
  if (linhas.length > LIMITE_IMPORTACAO) {
    avisos.push(
      `A planilha tem ${linhas.length} linhas e o painel importa ${LIMITE_IMPORTACAO} ` +
      'por vez. As excedentes ficaram de fora — importe o resto numa segunda leva.',
    )
    linhas = linhas.slice(0, LIMITE_IMPORTACAO)
  }

  if (!(await crmInstalado())) {
    return {
      linhas: linhas.map((l) => ({ ...l, acao: 'erro' as const, erro: ERRO_NAO_INSTALADO })),
      avisos, criar: 0, duplicados: 0, erros: linhas.length,
    }
  }

  const instagrams = linhas.map((l) => l.instagram).filter((v): v is string => Boolean(v))
  const handles = linhas.map((l) => l.handle).filter((v): v is string => Boolean(v))

  // Duas consultas para a planilha inteira, e não duas por linha: uma
  // importação de 500 linhas viraria mil idas ao banco só para desenhar a
  // prévia.
  const [jaNoCrm, ofertasLivres] = await Promise.all([
    instagrams.length > 0
      ? dbRO<{ instagram: string }[]>`
          select lower(instagram) as instagram from admin_crm.leads
          where lower(instagram) = any(${instagrams})
        `
      : [],
    handles.length > 0
      ? dbRO<{ slug: string }[]>`
          select p.slug from public.bio_ofertas o
          join public.proposal_pages p on p.id = o.page_id
          where p.slug = any(${handles})
            and not exists (select 1 from admin_crm.leads l where l.page_id = o.page_id)
        `
      : [],
  ])

  const ocupados = new Set(jaNoCrm.map((l) => l.instagram))
  const comOferta = new Set(ofertasLivres.map((o) => o.slug))

  const plano = linhas.map<PlanoLinha>((l) => {
    if (l.erro) return { ...l, acao: 'erro' }
    if (l.instagram && ocupados.has(l.instagram)) {
      return { ...l, acao: 'duplicado', erro: `@${l.instagram} já está no CRM` }
    }
    return { ...l, acao: 'criar', vincula: l.handle && comOferta.has(l.handle) ? l.handle : null }
  })

  return {
    linhas: plano,
    avisos,
    criar: plano.filter((l) => l.acao === 'criar').length,
    duplicados: plano.filter((l) => l.acao === 'duplicado').length,
    erros: plano.filter((l) => l.acao === 'erro').length,
  }
}

/**
 * Grava a planilha.
 *
 * Recebe o TEXTO e o analisa de novo, em vez de receber as linhas prontas da
 * tela: uma Server Action é um endpoint HTTP, e o que a prévia mostrou não é
 * prova do que chega aqui. Analisar duas vezes custa milissegundos e mantém a
 * única fonte da verdade do formato dentro do servidor.
 *
 * Tudo numa transação só: uma importação que grava metade e falha deixa você
 * sem saber onde parar a planilha para tentar de novo.
 */
export async function importarLeads(
  texto: string,
  ctx: Contexto,
): Promise<{ ok: true; criados: number; ignorados: number } | { ok: false; erro: string }> {
  if (!(await crmInstalado())) return { ok: false, erro: ERRO_NAO_INSTALADO }

  const plano = await preverImportacao(texto)
  const criar = plano.linhas.filter((l) => l.acao === 'criar')
  if (criar.length === 0) {
    return { ok: false, erro: 'Nenhuma linha desta planilha pode virar lead.' }
  }

  try {
    const criados = await dbRW.begin(async (tx: TransactionSql) => {
      const ids: string[] = []

      for (const l of criar) {
        // O vínculo é conferido AQUI dentro, e não reaproveitado da prévia: a
        // oferta pode ter sido criada, apagada ou pega por outro lead entre o
        // desenho da tela e o clique.
        const [oferta] = l.handle
          ? await tx<{ page_id: string }[]>`
              select o.page_id from public.bio_ofertas o
              join public.proposal_pages p on p.id = o.page_id
              where p.slug = ${l.handle}
                and not exists (select 1 from admin_crm.leads x where x.page_id = o.page_id)
            `
          : []

        const [lead] = await tx<{ id: string }[]>`
          insert into admin_crm.leads
            (nome, instagram, fonte, email, whatsapp, handle_pretendido, page_id,
             estagio, proximo_contato, criado_por)
          values (${l.nome}, ${l.instagram}, ${l.fonte}, ${l.email}, ${l.whatsapp},
                  ${l.handle}, ${oferta?.page_id ?? null}, ${l.estagio},
                  ${l.proximoContato}, ${ctx.atorId})
          returning id
        `
        ids.push(lead.id)

        if (l.nota) {
          await tx`
            insert into admin_crm.lead_notas (lead_id, autor_id, texto)
            values (${lead.id}, ${ctx.atorId}, ${l.nota})
          `
        }
      }

      // UM registro de auditoria para a leva inteira, com os ids criados. Uma
      // linha por lead encheria o log de 500 entradas iguais e esconderia o
      // fato que interessa reconstituir depois: esta importação, deste
      // tamanho, nesta hora.
      await registrarAcao(tx, {
        atorId: ctx.atorId,
        tabela: 'crm_leads',
        registroId: ids[0],
        detalhe: {
          acao: 'planilha_importada',
          criados: ids.length,
          ignorados: plano.duplicados + plano.erros,
          ids,
        },
        motivo: `Importação de planilha no CRM: ${ids.length} lead(s) criados pelo painel`,
        ip: ctx.ip,
        userAgent: ctx.userAgent,
      })

      return ids.length
    })

    return { ok: true, criados, ignorados: plano.duplicados + plano.erros }
  } catch (e) {
    return { ok: false, erro: traduzir(e as Error) }
  }
}
