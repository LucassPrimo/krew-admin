'use server'

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'

import type { TransactionSql } from 'postgres'

import { autorizarEscrita, autorizarEscritaSemStepUp, exigirAtor } from '@/lib/auth'
import type { EstiloItem } from '@/lib/bio/tipos'
import { dbRW } from '@/lib/db'
import { registrarAcao } from '@/lib/mutate'
import { buscarPerfil, type RedeImportada } from '@/lib/importar-linkme'
import { criarOferta, enviarConvite, excluirOferta, marcarAceita, slugDisponivel } from '@/lib/oferta'

/**
 * As ações da oferta de bio.
 *
 * Passam por `autorizarEscritaSemStepUp()`: sessão + as duas listas de admin +
 * kill switch, sem pedir o TOTP de novo. Montar uma oferta é criar dado numa
 * conta que ainda não é de ninguém — o código a cada 15 minutos fica onde ele
 * ganha alguma coisa, que é a edição do dado de um cliente real, em /dados.
 *
 * A checagem continua em CADA ação, e não só na tela: Server Action é um
 * endpoint HTTP como outro qualquer, e quem soubesse o nome poderia chamá-la
 * direto.
 */

async function contexto() {
  const h = await headers()
  return {
    // `x-forwarded-for` pode vir com uma cadeia de proxies; o primeiro é o
    // cliente. Guardar a cadeia inteira polui o log de auditoria sem ganho.
    ip: h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
    userAgent: h.get('user-agent'),
  }
}

export async function verificarSlug(slug: string) {
  return slugDisponivel(slug)
}

/**
 * Importa um perfil do link.me para preencher o formulário.
 *
 * Exige `exigirAtor()` e não `autorizarEscrita()`: importar não grava nada — é
 * uma leitura da web que devolve sugestão para a tela. Travar isso atrás do
 * kill switch de escrita impediria você de montar a oferta justamente enquanto
 * o painel está em modo leitura, que é quando dá para preparar sem risco.
 */
export async function acaoImportarLinkme(entrada: string) {
  await exigirAtor()
  return buscarPerfil(entrada)
}

export async function acaoCriarOferta(form: FormData) {
  const permissao = await autorizarEscritaSemStepUp()
  if (!permissao.ok) return { ok: false as const, erro: permissao.texto }

  const ctx = await contexto()

  // Os links chegam como JSON, não mais como linhas de texto: desde que a
  // importação passou a trazer a CAPA de cada card, um formato de uma linha só
  // não dava mais conta — e inventar um terceiro separador para a imagem seria
  // pedir para alguém colar uma URL com barra vertical dentro e quebrar tudo.
  // Os quatro valores que o CHECK de `creator_links` aceita. A lista mora
  // aqui, e não num `'grande' | 'pequeno'` inventado: o campo é do banco, e
  // um nome próprio deste lado só reaparece como erro de constraint no insert.
  const ESTILOS: EstiloItem[] = ['grande', 'metade', 'meio', 'botao']

  let links: {
    titulo: string; url: string; capa_url?: string | null; estilo?: EstiloItem
  }[] = []
  try {
    const bruto = String(form.get('links') ?? '')
    if (bruto) {
      links = (JSON.parse(bruto) as {
        titulo: string; url: string; capaUrl?: string | null; estilo?: EstiloItem
      }[])
        .map((l) => ({
          titulo: String(l.titulo ?? '').trim(),
          url: String(l.url ?? '').trim(),
          capa_url: l.capaUrl ?? null,
          // Só os quatro valores do CHECK passam. Qualquer outra coisa que
          // chegue no JSON vira 'grande' — o campo é do banco, não do form.
          estilo: ESTILOS.includes(l.estilo as EstiloItem) ? (l.estilo as EstiloItem) : 'grande',
        }))
        .filter((l) => l.titulo && l.url)
    }
  } catch {
    return { ok: false as const, erro: 'A lista de links veio malformada.' }
  }

  // As redes viajam como JSON num campo escondido: elas vêm do importador
  // inteiras (plataforma + handle + url) e não há nada para a pessoa digitar.
  let redes: RedeImportada[] = []
  try {
    const bruto = String(form.get('redes') ?? '')
    if (bruto) redes = JSON.parse(bruto) as RedeImportada[]
  } catch {
    return { ok: false as const, erro: 'As redes sociais importadas vieram malformadas.' }
  }

  const resultado = await criarOferta(
    {
      slug: String(form.get('slug') ?? '').trim().toLowerCase(),
      nomeCompleto: String(form.get('nome') ?? '').trim(),
      email: String(form.get('email') ?? '').trim() || null,
      headline: String(form.get('headline') ?? '').trim() || null,
      texto: String(form.get('texto') ?? '').trim() || null,
      avatarUrl: String(form.get('avatar_url') ?? '').trim() || null,
      capaUrl: String(form.get('capa_url') ?? '').trim() || null,
      nicho: String(form.get('nicho') ?? '').trim() || null,
      notas: String(form.get('notas') ?? '').trim() || null,
      links,
      redes,
      // O CHECK da coluna só aceita #RRGGBB; vazio vira null e a página usa a
      // cor do tema. Recusar aqui daria erro cru do Postgres na cara da pessoa.
      corFundo: /^#[0-9A-Fa-f]{6}$/.test(String(form.get('cor_fundo') ?? ''))
        ? String(form.get('cor_fundo'))
        : null,
    },
    { atorId: permissao.ator.id, ...ctx },
  )

  if (resultado.ok) revalidatePath('/ofertas')
  return resultado
}

export async function acaoEnviarConvite(pageId: string, email: string) {
  const permissao = await autorizarEscritaSemStepUp()
  if (!permissao.ok) return { ok: false as const, erro: permissao.texto }

  const ctx = await contexto()
  const r = await enviarConvite(pageId, email, { atorId: permissao.ator.id, ...ctx })
  if (r.ok) revalidatePath('/ofertas')
  return r
}

export async function acaoMarcarAceita(pageId: string) {
  const permissao = await autorizarEscritaSemStepUp()
  if (!permissao.ok) return { ok: false as const, erro: permissao.texto }

  const ctx = await contexto()
  try {
    await marcarAceita(pageId, { atorId: permissao.ator.id, ...ctx })
    revalidatePath('/ofertas')
    return { ok: true as const }
  } catch (e) {
    return { ok: false as const, erro: (e as Error).message }
  }
}

/**
 * Apaga a oferta e a conta-fantasma inteira. Ver `excluirOferta`.
 *
 * É a única ação daqui que passa por `autorizarEscrita()`, COM o TOTP, e não
 * pela versão sem step-up que as outras usam. O argumento das outras — "é dado
 * numa conta que ainda não é de ninguém, pedir o código a cada oferta só
 * produz atrito" — não sobrevive ao fato de esta ser irreversível: o que se
 * perde num clique errado não volta de lugar nenhum.
 */
export async function acaoExcluirOferta(pageId: string, slugConfirmado: string) {
  const permissao = await autorizarEscrita()
  if (!permissao.ok) return { ok: false as const, erro: permissao.texto }

  const ctx = await contexto()

  const r = await excluirOferta(pageId, slugConfirmado, {
    atorId: permissao.ator.id,
    ...ctx,
  })
  if (!r.ok) return r

  // A tela da oferta deixou de existir; quem volta para ela cai num 404. Só a
  // lista é revalidada — o redirecionamento é do cliente, que sabe se ainda
  // está nela.
  revalidatePath('/ofertas')
  return { ok: true as const, slug: r.slug }
}

/**
 * As notas de venda da oferta — com quem foi falado, o que ficou combinado.
 *
 * Vive em `bio_ofertas`, não em `proposal_pages`: é anotação sua sobre a
 * negociação, e não conteúdo da página. O criador nunca vê isso, nem depois de
 * assumir a conta.
 */
export async function acaoSalvarNotas(pageId: string, notas: string) {
  const permissao = await autorizarEscritaSemStepUp()
  if (!permissao.ok) return { ok: false as const, erro: permissao.texto }

  const ctx = await contexto()

  try {
    await dbRW.begin(async (tx: TransactionSql) => {
      const [linha] = await tx`
        update public.bio_ofertas set notas = ${notas.trim() || null}
        where page_id = ${pageId}
        returning page_id
      `
      if (!linha) throw new Error('Oferta não encontrada.')

      await registrarAcao(tx, {
        atorId: permissao.ator.id,
        tabela: 'bio_ofertas',
        registroId: pageId,
        detalhe: { acao: 'notas_editadas' },
        motivo: 'Notas de venda da oferta editadas pelo painel',
        ...ctx,
      })
    })
  } catch (e) {
    return { ok: false as const, erro: (e as Error).message }
  }

  revalidatePath(`/ofertas/${pageId}`)
  return { ok: true as const }
}
