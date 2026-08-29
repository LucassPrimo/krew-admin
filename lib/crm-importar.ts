import { ESTAGIOS_MANUAIS, limparInstagram, type EstagioManual } from './crm-tipos'

/**
 * O leitor da planilha de leads.
 *
 * Puro e sem banco de propósito: a MESMA função roda no navegador, para
 * desenhar a prévia enquanto você cola, e no servidor, para gravar. Se a
 * conferência da tela e a gravação usassem parsers diferentes, a prévia
 * passaria a ser uma promessa que o import não cumpre — e o lugar onde isso
 * apareceria seria depois de importar duzentas linhas.
 *
 * O que ele aceita, porque é o que sai de uma planilha de verdade:
 *
 * - **colado direto do Sheets** (separado por TAB), CSV (vírgula) ou o CSV que
 *   o Excel em português gera (ponto e vírgula) — o separador é detectado;
 * - **campos entre aspas** com vírgula e quebra de linha dentro, que é o que
 *   acontece com a coluna de notas;
 * - **cabeçalho em qualquer ordem**, com ou sem acento, maiúscula ou nome
 *   aproximado ("Origem" vale por "Fonte", "Telefone" por "WhatsApp").
 *
 * E o que ele IGNORA de propósito: as colunas "Link criado?", "Enviado" e
 * "Aceito". Elas são lidas de `bio_ofertas` a cada consulta — importá-las
 * recriaria dentro do painel a divergência que tirou a planilha de serviço.
 */

export type LinhaPlanilha = {
  /** Número da linha no arquivo, contando o cabeçalho — é o que a tela mostra. */
  linha: number
  nome: string
  instagram: string | null
  fonte: string | null
  handle: string | null
  email: string | null
  whatsapp: string | null
  estagio: EstagioManual
  proximoContato: string | null
  nota: string | null
  /** Preenchido quando a linha não pode virar lead. Ela aparece na prévia
   *  assim mesmo, marcada — sumir em silêncio é como se perde gente numa
   *  importação de duzentas linhas. */
  erro?: string
}

export type Analise = {
  linhas: LinhaPlanilha[]
  /** Recados sobre o arquivo inteiro, não sobre uma linha. */
  avisos: string[]
  /** Cabeçalhos que o painel não usa. Mostrados para você conferir que não
   *  esqueceu de mapear nada seu. */
  ignoradas: string[]
}

/** As colunas do modelo, na ordem — `public/modelo-leads.csv` nasce daqui. */
export const COLUNAS_MODELO = [
  'Nome', 'Instagram', 'Fonte', 'Handle da bio', 'E-mail', 'WhatsApp',
  'Estágio', 'Próximo contato', 'Notas',
] as const

/** Cabeçalho → campo. A chave é o nome já normalizado (sem acento nem espaço). */
const APELIDOS: Record<string, keyof LinhaPlanilha> = {
  nome: 'nome', name: 'nome', criador: 'nome', lead: 'nome', pessoa: 'nome',

  instagram: 'instagram', insta: 'instagram', ig: 'instagram',
  arroba: 'instagram', perfil: 'instagram', usuario: 'instagram',

  fonte: 'fonte', origem: 'fonte', canal: 'fonte', comoconheceu: 'fonte',

  // "Bekrew.com/@" normaliza para `bekrewcom`; é o cabeçalho da planilha atual.
  handledabio: 'handle', handle: 'handle', bekrewcom: 'handle', bekrew: 'handle',
  slug: 'handle', bio: 'handle', linkdabio: 'handle', link: 'handle',

  email: 'email', mail: 'email', ementredereletronico: 'email',

  whatsapp: 'whatsapp', whats: 'whatsapp', zap: 'whatsapp',
  telefone: 'whatsapp', celular: 'whatsapp', fone: 'whatsapp',

  estagio: 'estagio', etapa: 'estagio', status: 'estagio', situacao: 'estagio',

  proximocontato: 'proximoContato', proximo: 'proximoContato',
  followup: 'proximoContato', retorno: 'proximoContato', quandofalar: 'proximoContato',

  notas: 'nota', nota: 'nota', observacoes: 'nota', observacao: 'nota',
  obs: 'nota', comentarios: 'nota', anotacoes: 'nota',
}

/** Colunas conhecidas que NÃO viram campo, com o motivo quando ele importa. */
const DESCARTADAS: Record<string, string | null> = {
  linkcriado: 'derivada',
  enviado: 'derivada',
  aceito: 'derivada',
  coluna1: null,
  '': null,
  n: null,
  id: null,
  numero: null,
}

function normalizar(cabecalho: string): string {
  return cabecalho
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

/**
 * Quebra o texto em células.
 *
 * Escrito à mão, e não `split(delim)`: a coluna de notas leva vírgula e
 * quebra de linha dentro de aspas, e um `split` cortaria a nota ao meio,
 * empurrando o resto dela para a coluna seguinte de uma linha que não existe.
 */
function separar(texto: string, delimitador: string): string[][] {
  const linhas: string[][] = []
  let atual: string[] = []
  let campo = ''
  let dentroDeAspas = false

  for (let i = 0; i < texto.length; i++) {
    const c = texto[i]

    if (dentroDeAspas) {
      // `""` dentro de aspas é uma aspa literal — a convenção do CSV.
      if (c === '"' && texto[i + 1] === '"') {
        campo += '"'
        i++
      } else if (c === '"') {
        dentroDeAspas = false
      } else {
        campo += c
      }
      continue
    }

    if (c === '"') dentroDeAspas = true
    else if (c === delimitador) {
      atual.push(campo)
      campo = ''
    } else if (c === '\n') {
      atual.push(campo)
      linhas.push(atual)
      atual = []
      campo = ''
    } else if (c !== '\r') {
      campo += c
    }
  }

  atual.push(campo)
  linhas.push(atual)

  // Linha em branco não é lead. Sobram sempre: o Sheets manda a última quebra.
  return linhas.filter((l) => l.some((c) => c.trim() !== ''))
}

/**
 * O separador, decidido pela primeira linha.
 *
 * TAB primeiro porque colar do Sheets é o caminho mais curto e é o que produz
 * TAB. Ponto e vírgula antes da vírgula porque o Excel em português exporta
 * assim, e nesse arquivo a vírgula é decimal — testá-la antes acertaria o
 * separador errado em toda planilha brasileira.
 */
function detectarDelimitador(primeiraLinha: string): string {
  if (primeiraLinha.includes('\t')) return '\t'
  if (primeiraLinha.includes(';')) return ';'
  return ','
}

/** `31/12/2026`, `31-12-2026` e `2026-12-31` viram `2026-12-31`. */
function lerData(bruto: string): string | null {
  const texto = bruto.trim()
  if (!texto) return null

  const iso = texto.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (iso) return texto

  const br = texto.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/)
  if (br) {
    const [, d, m, a] = br
    const ano = a.length === 2 ? `20${a}` : a
    return `${ano}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }

  return null
}

/** `bekrew.com/@fulano`, a URL inteira ou `@fulano` viram `fulano`. */
export function limparHandle(bruto: string | null | undefined): string | null {
  const texto = (bruto ?? '').trim()
  if (!texto) return null
  const depoisDoArroba = texto.includes('@') ? texto.slice(texto.lastIndexOf('@') + 1) : texto
  return (
    depoisDoArroba
      .replace(/^https?:\/\//i, '')
      .replace(/^(www\.)?bekrew\.com\//i, '')
      .replace(/[/?#].*$/, '')
      .toLowerCase()
      .replace(/[^a-z0-9._-]/g, '') || null
  )
}

export function analisarPlanilha(texto: string): Analise {
  const limpo = texto.trim()
  if (!limpo) return { linhas: [], avisos: [], ignoradas: [] }

  const grade = separar(limpo, detectarDelimitador(limpo.split('\n')[0]))
  const avisos: string[] = []
  const ignoradas: string[] = []

  const cabecalho = grade[0].map(normalizar)
  const mapa = cabecalho.map((c) => APELIDOS[c] ?? null)

  if (!mapa.includes('nome')) {
    return {
      linhas: [],
      avisos: [
        'Não achei a coluna Nome. A primeira linha precisa ser o cabeçalho — ' +
        'se você colou só os dados, cole junto a linha de títulos da planilha.',
      ],
      ignoradas: [],
    }
  }

  let derivadaIgnorada = false
  cabecalho.forEach((c, i) => {
    if (mapa[i]) return
    if (Object.hasOwn(DESCARTADAS, c)) {
      if (DESCARTADAS[c] === 'derivada') derivadaIgnorada = true
      return
    }
    if (grade[0][i].trim()) ignoradas.push(grade[0][i].trim())
  })

  if (derivadaIgnorada) {
    avisos.push(
      'As colunas "Link criado?", "Enviado" e "Aceito" foram ignoradas: o painel ' +
      'lê esses três da oferta de bio a cada consulta. É o que impede a lista de ' +
      'divergir do produto, como acontecia na planilha.',
    )
  }
  if (ignoradas.length > 0) {
    avisos.push(`Colunas sem correspondente no CRM, ignoradas: ${ignoradas.join(', ')}.`)
  }

  const vistos = new Set<string>()
  const linhas: LinhaPlanilha[] = []
  let estagioDesconhecido = false
  let dataInvalida = false

  for (let i = 1; i < grade.length; i++) {
    const celulas = grade[i]
    const valor = (campo: keyof LinhaPlanilha): string => {
      const coluna = mapa.indexOf(campo)
      return coluna === -1 ? '' : (celulas[coluna] ?? '').trim()
    }

    const nome = valor('nome')
    const instagram = limparInstagram(valor('instagram'))

    const estagioBruto = normalizar(valor('estagio'))
    const estagio = ESTAGIOS_MANUAIS.find((e) => e === estagioBruto)
    if (estagioBruto && !estagio) estagioDesconhecido = true

    const dataBruta = valor('proximoContato')
    const proximoContato = lerData(dataBruta)
    if (dataBruta && !proximoContato) dataInvalida = true

    const linha: LinhaPlanilha = {
      linha: i + 1,
      nome,
      instagram,
      fonte: valor('fonte') || null,
      handle: limparHandle(valor('handle')),
      email: valor('email') || null,
      whatsapp: valor('whatsapp') || null,
      estagio: estagio ?? 'novo',
      proximoContato,
      nota: valor('nota') || null,
    }

    if (!nome) linha.erro = 'sem nome'
    else if (instagram && vistos.has(instagram)) linha.erro = `@${instagram} repetido na planilha`

    if (instagram) vistos.add(instagram)
    linhas.push(linha)
  }

  if (estagioDesconhecido) {
    avisos.push(
      `Estágio fora de ${ESTAGIOS_MANUAIS.join(' / ')} entra como Novo. ` +
      'Oferta criada, convite enviado e aceito não se digitam: vêm da oferta.',
    )
  }
  if (dataInvalida) {
    avisos.push('Alguma data de próximo contato não foi entendida e ficou em branco. Use 31/12/2026.')
  }

  return { linhas, avisos, ignoradas }
}

/**
 * O plano da importação: cada linha com o que vai acontecer com ela.
 *
 * Mora aqui, no módulo sem banco, porque quem desenha a prévia é a tela — e um
 * `import` de `lib/crm.ts` num Client Component arrastaria o driver do
 * Postgres para o bundle do navegador.
 */
export type PlanoLinha = LinhaPlanilha & {
  acao: 'criar' | 'duplicado' | 'erro'
  /** Handle da oferta que este lead vai encostar, se ela já existir. */
  vincula?: string | null
}

export type Plano = {
  linhas: PlanoLinha[]
  avisos: string[]
  criar: number
  duplicados: number
  erros: number
}
