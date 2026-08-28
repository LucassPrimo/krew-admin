'use server'

import { createClient } from '@/lib/supabase/server'
import { getAssinatura } from '@/lib/assinatura-server'
import { ehPro } from '@/lib/plano'
import { janela, type Periodo } from '@/lib/bio/periodo'

/**
 * Leitura das métricas da bio, em TRÊS chamadas — não uma.
 *
 * Cada uma é `security invoker`: quem autoriza é a policy de
 * `link_bio_events` (`fn_can_read_operational`), a mesma de todo o resto
 * operacional. Não há checagem de org aqui em cima de propósito — uma segunda
 * cópia da regra é como se abre buraco entre organizações no dia em que uma
 * das duas muda.
 *
 * Por que três e não uma só: a página busca as três em paralelo, cada uma na
 * sua seção com seu próprio Suspense. `get_bio_resumo` é a mais barata (só
 * contagem, quase nunca falha); `get_bio_leve` é GROUP BY simples; `get_bio_geo`
 * é a mais cara (agrupa por cidade+coordenada e aplica o piso de
 * k-anonimato). Se a mais cara emperrar sob contenção de escrita, as outras
 * duas já estão na tela — antes, uma consulta só significava tudo ou nada.
 */

export type { Periodo } from '@/lib/bio/periodo'

export interface ResumoBio {
  pageViews: number
  cliques: number
  visitantes: number
}

export interface LeveBio {
  porDia: { dia: string; views: number; cliques: number }[]
  porBotao: {
    buttonId: string | null
    buttonKind: string | null
    /** Qual rede social, quando o alvo não é um link. */
    buttonRef: string | null
    cliques: number
  }[]
  porDispositivo: Record<string, number>
  porReferrer: { referrer: string; eventos: number }[]
}

export interface GeoBio {
  /** Ranking de cidades, com o mesmo piso de k-anonimato do mapa. */
  porCidade: { city: string; region: string | null; country: string | null; eventos: number }[]
  porIsp: { isp: string; eventos: number }[]
  /** Só cidades com 3+ visitantes distintos — ver k-anonimato no RPC. */
  mapa: {
    city: string | null
    region: string | null
    country: string | null
    lat: number
    lng: number
    eventos: number
  }[]
  /** Eventos que o piso de k-anonimato tirou do mapa. */
  mapaSuprimido: number
  /** Acessos sem geolocalização: cache frio, faixa não mapeada ou resolução
   *  que não completou. A tela mostra — mapa que silencia o desconhecido mente
   *  sobre a própria cobertura. */
  semGeo: number
}


/** Um lado da comparação — os totais de uma janela. */
export interface TotaisBio {
  views: number
  cliques: number
  total: number
  visitantes: number
}

export interface ComparacaoBio {
  atual: TotaisBio
  anterior: TotaisBio
  /** Sempre 24 posições, hora-do-dia 0..23, inclusive as zeradas. */
  porHora: { hora: number; atual: number; anterior: number }[]
  diasAtivos: number
  mediaDiaria: number
}

export interface TempoRealBio {
  /** Régua completa de minutos, inclusive os zerados. */
  porMinuto: { minuto: string; views: number; cliques: number }[]
  visitas: number
  cliques: number
  total: number
  minutos: number
  fontes: { referrer: string; eventos: number }[]
}

/**
 * Analytics é PRO — e o corte acontece AQUI, não na tela.
 *
 * A página do Free desenha o painel com os números borrados. Borrão é CSS:
 * quem abre o inspetor lê o valor por baixo dele, e a aba de rede mostra a
 * resposta da action inteira. Zerando na origem, o navegador do Free nunca
 * recebe um número real — o borrão passa a ser só o aviso visual de que ali
 * existe um dado, e não o cadeado.
 *
 * Zero com a MESMA FORMA (e não `null`): `null` é o caminho de erro dessas
 * actions, e a seção mostraria "não deu para carregar" — o Free acharia o
 * painel quebrado em vez de bloqueado.
 *
 * `getCliquesPorLink` fica de fora: ela alimenta a lista de links da tela de
 * edição, que nunca foi paga.
 */
async function semAcessoPago() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const { assinatura } = await getAssinatura(user?.id)
  return !ehPro(assinatura)
}

const RESUMO_ZERO: ResumoBio = { pageViews: 0, cliques: 0, visitantes: 0 }

const LEVE_ZERO: LeveBio = { porDia: [], porBotao: [], porDispositivo: {}, porReferrer: [] }

const GEO_ZERO: GeoBio = { porCidade: [], porIsp: [], mapa: [], mapaSuprimido: 0, semGeo: 0 }

const TOTAIS_ZERO: TotaisBio = { views: 0, cliques: 0, total: 0, visitantes: 0 }

const COMPARACAO_ZERO: ComparacaoBio = {
  atual: TOTAIS_ZERO,
  anterior: TOTAIS_ZERO,
  // A régua de 24 horas continua completa: é ela que desenha o eixo do
  // gráfico, e sem as posições o cartão viraria um retângulo vazio.
  porHora: Array.from({ length: 24 }, (_, hora) => ({ hora, atual: 0, anterior: 0 })),
  diasAtivos: 0,
  mediaDiaria: 0,
}

const TEMPO_REAL_ZERO: TempoRealBio = {
  porMinuto: [],
  visitas: 0,
  cliques: 0,
  total: 0,
  minutos: 0,
  fontes: [],
}

/** Só os totais do topo. A mais barata das três — ver o porquê no RPC. */
export async function getResumoBio(
  orgId: string,
  userId: string,
  periodo: Periodo
): Promise<ResumoBio | null> {
  if (await semAcessoPago()) return RESUMO_ZERO

  const supabase = await createClient()
  const { desde, ate } = janela(periodo)

  const { data, error } = await supabase.rpc('get_bio_resumo', {
    p_org: orgId,
    p_user: userId,
    p_desde: desde,
    p_ate: ate,
  })

  if (error || !data) return null
  return data as ResumoBio
}

/** Série por dia, ranking de botões, dispositivo e origem. */
export async function getLeveBio(
  orgId: string,
  userId: string,
  periodo: Periodo
): Promise<LeveBio | null> {
  if (await semAcessoPago()) return LEVE_ZERO

  const supabase = await createClient()
  const { desde, ate } = janela(periodo)

  const { data, error } = await supabase.rpc('get_bio_leve', {
    p_org: orgId,
    p_user: userId,
    p_desde: desde,
    p_ate: ate,
  })

  if (error || !data) return null
  return data as LeveBio
}

/** Cidade, mapa e operadora — a parte mais cara, isolada de propósito. */
export async function getGeoBio(
  orgId: string,
  userId: string,
  periodo: Periodo
): Promise<GeoBio | null> {
  if (await semAcessoPago()) return GEO_ZERO

  const supabase = await createClient()
  const { desde, ate } = janela(periodo)

  const { data, error } = await supabase.rpc('get_bio_geo', {
    p_org: orgId,
    p_user: userId,
    p_desde: desde,
    p_ate: ate,
  })

  if (error || !data) return null
  return data as GeoBio
}

/** Cliques por link, para a tela de edição. Substitui `creator_links.cliques`. */
export async function getCliquesPorLink(userId: string): Promise<Record<string, number>> {
  const supabase = await createClient()
  const { data } = await supabase.rpc('get_bio_link_clicks', { p_user: userId })

  const mapa: Record<string, number> = {}
  for (const linha of (data ?? []) as { button_id: string; cliques: number }[]) {
    mapa[linha.button_id] = Number(linha.cliques)
  }
  return mapa
}

/**
 * Período atual contra o anterior de mesma duração, mais o padrão por hora.
 *
 * Separada de `getResumoBio` de propósito: o resumo é o número grande do topo,
 * que precisa aparecer rápido; a comparação varre DUAS janelas e o dobro de
 * linhas. Juntas, a mais lenta seguraria a mais rápida na tela.
 */
export async function getComparacaoBio(
  orgId: string,
  userId: string,
  periodo: Periodo
): Promise<ComparacaoBio | null> {
  if (await semAcessoPago()) return COMPARACAO_ZERO

  const supabase = await createClient()
  const { desde, ate } = janela(periodo)

  const { data, error } = await supabase.rpc('get_bio_comparacao', {
    p_org: orgId,
    p_user: userId,
    p_desde: desde,
    p_ate: ate,
  })

  if (error || !data) return null
  return data as ComparacaoBio
}

/**
 * Os últimos N minutos, minuto a minuto.
 *
 * Não usa `periodo`: "ao vivo" é sempre a mesma janela curta, independente do
 * intervalo que a pessoa escolheu no resto da tela — trocar para 30 dias não
 * deveria mudar o que "agora" quer dizer.
 */
export async function getTempoRealBio(
  orgId: string,
  userId: string,
  minutos = 30
): Promise<TempoRealBio | null> {
  if (await semAcessoPago()) return TEMPO_REAL_ZERO

  const supabase = await createClient()

  const { data, error } = await supabase.rpc('get_bio_tempo_real', {
    p_org: orgId,
    p_user: userId,
    p_minutos: minutos,
  })

  if (error || !data) return null
  return data as TempoRealBio
}
