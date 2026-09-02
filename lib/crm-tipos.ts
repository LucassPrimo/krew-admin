/**
 * Os nomes do CRM — estágios, rótulos e a limpeza do @.
 *
 * Separado de `lib/crm.ts` porque aquele arquivo abre conexão com o banco na
 * importação, e a tabela e a ficha são Client Components: sem esta divisão, um
 * `import { ROTULO }` arrastaria o driver do Postgres para dentro do bundle
 * que o navegador baixa. `lib/crm.ts` reexporta tudo daqui, então o servidor
 * continua importando de um lugar só.
 */

export type EstagioManual = 'novo' | 'contatado' | 'negociando'

/** Estágio efetivo: os três manuais, os três derivados da oferta, e perdido. */
export type Estagio =
  | EstagioManual
  | 'oferta_criada'
  | 'convite_enviado'
  | 'aceito'
  | 'perdido'

export const ESTAGIOS_MANUAIS: EstagioManual[] = ['novo', 'contatado', 'negociando']

/** A ordem do funil. `perdido` fica fora: é saída, não etapa. */
export const FUNIL: Estagio[] = [
  'novo', 'contatado', 'negociando', 'oferta_criada', 'convite_enviado', 'aceito',
]

export const ROTULO: Record<Estagio, string> = {
  novo: 'Novo',
  contatado: 'Contatado',
  negociando: 'Negociando',
  oferta_criada: 'Oferta criada',
  convite_enviado: 'Convite enviado',
  aceito: 'Aceito',
  perdido: 'Perdido',
}

/**
 * A busca da lista: um termo, os campos por onde uma pessoa procura alguém.
 *
 * Mora aqui porque a caixa de busca passou a filtrar ENQUANTO você digita, do
 * lado do cliente — e a regra do que conta como "casou" não pode virar uma
 * linha solta dentro de um componente. É a mesma lista de campos que a versão
 * com Enter usava; o que mudou foi só quem a executa e quando.
 *
 * Sem acento nem normalização de propósito: os campos são @, nome de fonte e
 * handle, que na prática já vêm sem acento. Normalizar aqui daria a impressão
 * de uma busca esperta que o resto (nome próprio digitado de dois jeitos) não
 * cumpriria.
 */
export function casaBusca(l: Lead, termo: string): boolean {
  const t = termo.trim().toLowerCase()
  if (!t) return true
  return [l.nome, l.instagram, l.fonte, l.slug, l.handle_pretendido, l.email]
    .some((v) => v?.toLowerCase().includes(t))
}

/** `@fulano`, `instagram.com/fulano/` ou `fulano` viram `fulano`. */
export function limparInstagram(bruto: string | null | undefined): string | null {
  const texto = (bruto ?? '').trim()
  if (!texto) return null
  const url = texto.match(/instagram\.com\/([^/?#]+)/i)
  return (url ? url[1] : texto).replace(/^@/, '').trim().toLowerCase() || null
}

export type LinhaLead = {
  id: string
  nome: string
  instagram: string | null
  fonte: string | null
  email: string | null
  whatsapp: string | null
  handle_pretendido: string | null
  page_id: string | null
  estagio: EstagioManual
  perdido_em: string | null
  motivo_perda: string | null
  proximo_contato: string | null
  criado_em: string
  atualizado_em: string
  /** Vindos do join com a oferta. Nulos quando não há oferta vinculada. */
  slug: string | null
  oferta_criada_em: string | null
  convite_enviado_em: string | null
  aceita_em: string | null
  cliques: number | null
  notas: number
}

export type Lead = LinhaLead & { estagioEfetivo: Estagio }

/**
 * O follow-up venceu?
 *
 * Mora aqui, e não na página, porque a lista virou Client Component quando
 * ganhou seleção em lote — e a mesma regra é usada pelo servidor (para contar
 * "falar hoje") e pelo cliente (para pintar a linha). Duas cópias divergiriam
 * no primeiro ajuste, e o número do badge deixaria de bater com o que a tela
 * mostra.
 *
 * Aceito e perdido nunca vencem: não há próximo toque a dar.
 */
export function vencido(l: Lead): boolean {
  if (!l.proximo_contato || l.estagioEfetivo === 'aceito' || l.estagioEfetivo === 'perdido') {
    return false
  }
  return new Date(l.proximo_contato) <= new Date(new Date().toDateString())
}

/**
 * O estágio efetivo de um lead.
 *
 * A ordem das perguntas é a regra de negócio inteira: perdido vence tudo (dá
 * para perder um lead depois de mandar o convite, e é esse caso que interessa
 * medir), depois o que a oferta diz, e só no fim o que foi marcado à mão.
 */
export function estagioDe(l: LinhaLead): Estagio {
  if (l.perdido_em) return 'perdido'
  if (l.aceita_em) return 'aceito'
  if (l.convite_enviado_em) return 'convite_enviado'
  // `oferta_criada_em` e não `page_id`: a oferta pode ter sido apagada e o
  // ponteiro ficado para trás — sem FK, é o join que responde se ela existe.
  if (l.oferta_criada_em) return 'oferta_criada'
  return l.estagio
}

/** Lead que não é mais trabalho: aceito ou perdido. */
export function encerrado(e: Estagio): boolean {
  return e === 'aceito' || e === 'perdido'
}

/**
 * O funil: quantos leads passaram por cada etapa, e o que cada fonte entrega.
 *
 * "Passaram por", e não "estão em": um lead aceito também foi contatado um dia.
 * Contar só quem está parado na etapa daria conversões acima de 100% entre
 * degraus e esconderia o que a tela existe para responder — de onde vem lead
 * que aceita.
 */
export type Funil = {
  total: number
  etapas: { estagio: Estagio; alcancaram: number; parados: number }[]
  perdidos: number
  fontes: { fonte: string; total: number; ofertas: number; aceitos: number; perdidos: number }[]
}

export function montarFunil(leads: Lead[]): Funil {
  const posicao = (e: Estagio) => FUNIL.indexOf(e)

  const etapas = FUNIL.map((estagio) => ({
    estagio,
    // Perdido não some do funil: ele parou onde parou, e o degrau que ele
    // alcançou é o que diz onde a prospecção perde gente.
    alcancaram: leads.filter((l) => {
      const alvo = l.estagioEfetivo === 'perdido' ? maiorAlcancado(l) : l.estagioEfetivo
      return posicao(alvo) >= posicao(estagio)
    }).length,
    parados: leads.filter((l) => l.estagioEfetivo === estagio).length,
  }))

  const porFonte = new Map<string, { total: number; ofertas: number; aceitos: number; perdidos: number }>()
  for (const l of leads) {
    const fonte = l.fonte?.trim() || 'sem fonte'
    const atual = porFonte.get(fonte) ?? { total: 0, ofertas: 0, aceitos: 0, perdidos: 0 }
    atual.total += 1
    if (l.oferta_criada_em) atual.ofertas += 1
    if (l.aceita_em) atual.aceitos += 1
    if (l.perdido_em) atual.perdidos += 1
    porFonte.set(fonte, atual)
  }

  return {
    total: leads.length,
    etapas,
    perdidos: leads.filter((l) => l.estagioEfetivo === 'perdido').length,
    fontes: [...porFonte.entries()]
      .map(([fonte, v]) => ({ fonte, ...v }))
      .sort((a, b) => b.total - a.total),
  }
}

/**
 * Até onde um lead perdido tinha chegado.
 *
 * A oferta continua no banco depois da perda — é dela que sai a resposta, sem
 * precisar de histórico de estágio.
 */
function maiorAlcancado(l: Lead): Estagio {
  if (l.aceita_em) return 'aceito'
  if (l.convite_enviado_em) return 'convite_enviado'
  if (l.oferta_criada_em) return 'oferta_criada'
  return l.estagio
}
