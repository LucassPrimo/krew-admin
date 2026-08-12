import 'server-only'
import { headers } from 'next/headers'
import postgres from 'postgres'
import { type Admin, stepUpValido } from './auth'
import { env } from './env'
import { mascarar } from './pii'
import { REGISTRY, type Coluna } from './registry'

/**
 * O único lugar do painel que escreve no banco.
 *
 * A conexão de escrita é criada aqui dentro e NÃO é exportada — não existe
 * import que dê acesso a ela a partir de uma tela. Somado ao fato de que o role
 * de leitura não tem GRANT de UPDATE, o resultado é que "escrever por engano"
 * não é um erro que este código consegue cometer: ou passa por
 * `aplicarMutacao()`, com motivo e auditoria, ou o Postgres recusa.
 *
 * A ordem das checagens abaixo é deliberada — a mais barata e mais definitiva
 * primeiro (kill switch), a que toca o banco por último.
 */

function criarRw() {
  return postgres(env.ADMIN_DATABASE_URL_RW, {
    prepare: false,
    max: 2,
    idle_timeout: 20,
    connect_timeout: 10,
  })
}

declare global {
  // eslint-disable-next-line no-var
  var __krewAdminRw: ReturnType<typeof criarRw> | undefined
}

const sqlRw = globalThis.__krewAdminRw ?? criarRw()
if (process.env.NODE_ENV !== 'production') globalThis.__krewAdminRw = sqlRw

export class MutacaoRecusada extends Error {
  constructor(
    message: string,
    readonly codigo:
      | 'escrita_desligada'
      | 'step_up_expirado'
      | 'campo_nao_editavel'
      | 'motivo_curto'
      | 'registro_inexistente'
      | 'sem_mudanca'
  ) {
    super(message)
    this.name = 'MutacaoRecusada'
  }
}

export interface PedidoDeMutacao {
  tabela: string
  id: string
  /** Só colunas; valores já convertidos para o tipo do banco. */
  alteracoes: Record<string, unknown>
  motivo: string
}

export interface ResultadoMutacao {
  antes: Record<string, unknown>
  depois: Record<string, unknown>
  camposAlterados: string[]
}

/**
 * Mascara o que for PII antes de o valor entrar no log.
 *
 * O log de auditoria responde "o que mudou e por quê" — ele não precisa, e não
 * deve, virar um segundo lugar onde o CPF de alguém existe em texto claro. Um
 * log que replica os dados que protege multiplica o problema em vez de
 * documentá-lo.
 */
function paraAuditoria(
  colunas: Record<string, Coluna>,
  linha: Record<string, unknown>
): postgres.JSONValue {
  const saida: Record<string, unknown> = {}
  for (const [chave, valor] of Object.entries(linha)) {
    const def = colunas[chave]
    saida[chave] = def?.pii ? mascarar(def.pii, valor) : valor
  }
  // Volta e meia por JSON antes de gravar. Não é cerimônia de tipo: o driver
  // devolve `date` e `timestamptz` como objetos `Date`, e um `Date` cru dentro
  // de um jsonb serializa de um jeito que não volta igual na leitura. Passar
  // por aqui garante que o que foi gravado é exatamente o que a tela vai
  // mostrar quando alguém consultar a auditoria daqui a um ano.
  return JSON.parse(JSON.stringify(saida)) as postgres.JSONValue
}

export async function aplicarMutacao(
  admin: Admin,
  pedido: PedidoDeMutacao
): Promise<ResultadoMutacao> {
  // 1. Kill switch. Uma variável de ambiente derruba toda escrita do painel sem
  //    precisar de deploy de código — é o primeiro botão a apertar quando algo
  //    cheira errado.
  if (!env.ADMIN_WRITES_ENABLED) {
    throw new MutacaoRecusada(
      'A escrita está desligada por ADMIN_WRITES_ENABLED=false.',
      'escrita_desligada'
    )
  }

  // 2. Step-up: o segundo fator precisa ter sido digitado há menos de 15 min.
  //    Ler nunca pede; escrever sempre pode pedir. É o que impede que uma
  //    sessão esquecida aberta vire uma sessão de escrita.
  if (!stepUpValido(admin)) {
    throw new MutacaoRecusada(
      'Confirme o código do autenticador antes de gravar.',
      'step_up_expirado'
    )
  }

  // 3. Motivo. A constraint no banco também exige — esta checagem existe para
  //    dar erro legível antes de gastar uma transação.
  const motivo = pedido.motivo.trim()
  if (motivo.length < 10) {
    throw new MutacaoRecusada(
      'Descreva o motivo da alteração (mínimo 10 caracteres).',
      'motivo_curto'
    )
  }

  // 4. Registry. Coluna não declarada, ou declarada como não editável, não
  //    passa daqui — mesmo que alguém forje o formulário.
  const definicao = REGISTRY[pedido.tabela]
  if (!definicao) {
    throw new MutacaoRecusada(
      `A tabela ${pedido.tabela} não está no registry: é somente leitura.`,
      'campo_nao_editavel'
    )
  }

  const campos = Object.keys(pedido.alteracoes)
  const proibido = campos.find((c) => definicao.colunas[c]?.editavel !== true)
  if (proibido) {
    throw new MutacaoRecusada(
      `A coluna ${pedido.tabela}.${proibido} não é editável pelo painel.`,
      'campo_nao_editavel'
    )
  }
  if (campos.length === 0) {
    throw new MutacaoRecusada('Nada para alterar.', 'sem_mudanca')
  }

  const cabecalhos = await headers()
  const ip =
    cabecalhos.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    cabecalhos.get('x-real-ip') ||
    null
  const userAgent = cabecalhos.get('user-agent') ?? null

  // 5. A transação. Auditoria e alteração no mesmo commit: se o log falhar, o
  //    UPDATE volta atrás. Não existe estado em que o dado mudou e o rastro
  //    não. É por isso que a auditoria não é "gravada depois" em lugar nenhum
  //    deste arquivo.
  return sqlRw.begin(async (tx) => {
    // `for update` segura a linha até o commit — sem isso, duas abas do painel
    // gravando ao mesmo tempo produziriam um "antes" que nunca existiu.
    const [antes] = await tx<Record<string, unknown>[]>`
      select * from ${tx(pedido.tabela)}
      where ${tx(definicao.chave)} = ${pedido.id}
      for update
    `
    if (!antes) {
      throw new MutacaoRecusada(
        `Registro ${pedido.id} não existe em ${pedido.tabela}.`,
        'registro_inexistente'
      )
    }

    // Só o que realmente muda entra no update — reenviar o formulário inteiro
    // sem alterar nada não deve gerar linha de auditoria dizendo que houve
    // alteração.
    const alteracoesReais: Record<string, unknown> = {}
    for (const campo of campos) {
      const novo = pedido.alteracoes[campo]
      if (JSON.stringify(antes[campo] ?? null) !== JSON.stringify(novo ?? null)) {
        alteracoesReais[campo] = novo
      }
    }
    const camposAlterados = Object.keys(alteracoesReais)
    if (camposAlterados.length === 0) {
      throw new MutacaoRecusada('Nenhum valor mudou.', 'sem_mudanca')
    }

    const [depois] = await tx<Record<string, unknown>[]>`
      update ${tx(pedido.tabela)}
      set ${tx(alteracoesReais, ...camposAlterados)}
      where ${tx(definicao.chave)} = ${pedido.id}
      returning *
    `

    // Só os campos tocados vão para o log: o diff é o que interessa, e guardar
    // a linha inteira a cada edição encheria a auditoria de ruído.
    const recorte = (linha: Record<string, unknown>) =>
      paraAuditoria(
        definicao.colunas,
        Object.fromEntries(camposAlterados.map((c) => [c, linha[c]]))
      )

    await tx`
      insert into admin_audit.mutations
        (ator_id, tabela, registro_id, acao, antes, depois, motivo, ip, user_agent)
      values (
        ${admin.id}, ${pedido.tabela}, ${pedido.id}, 'update',
        ${tx.json(recorte(antes))}, ${tx.json(recorte(depois))},
        ${motivo}, ${ip}, ${userAgent}
      )
    `

    return { antes, depois, camposAlterados }
  })
}

/**
 * Ação que não é edição de campo — regenerar um token, reenviar um e-mail,
 * confirmar um cadastro. Entra no mesmo log, com o mesmo motivo obrigatório,
 * porque do ponto de vista de "o que aconteceu com a conta desse cliente" não
 * há diferença entre mudar uma coluna e disparar um efeito.
 */
export async function registrarAcaoOperacional(
  admin: Admin,
  dados: { tabela: string; registroId: string; descricao: string; motivo: string }
) {
  const cabecalhos = await headers()
  await sqlRw`
    insert into admin_audit.mutations
      (ator_id, tabela, registro_id, acao, antes, depois, motivo, ip, user_agent)
    values (
      ${admin.id}, ${dados.tabela}, ${dados.registroId}, 'operacional',
      null, ${sqlRw.json({ acao: dados.descricao })}, ${dados.motivo},
      ${cabecalhos.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null},
      ${cabecalhos.get('user-agent') ?? null}
    )
  `
}

/**
 * Registro de revelação de PII (§9). Chamado no momento em que a máscara sai
 * da tela — não quando a página carrega.
 */
export async function registrarRevelacaoPii(
  admin: Admin,
  dados: {
    tabela: string
    registroId: string
    campo: string
    sujeitoUserId?: string | null
    motivo: string
  }
) {
  if (dados.motivo.trim().length < 10) {
    throw new MutacaoRecusada('Descreva por que precisa ver este dado.', 'motivo_curto')
  }
  const cabecalhos = await headers()
  await sqlRw`
    insert into admin_audit.pii_access
      (ator_id, sujeito_user_id, tabela, registro_id, campo, motivo, ip)
    values (
      ${admin.id}, ${dados.sujeitoUserId ?? null}, ${dados.tabela},
      ${dados.registroId}, ${dados.campo}, ${dados.motivo.trim()},
      ${cabecalhos.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null}
    )
  `
}

/** Abertura de sessão no painel (§5, tabela `sessions`). */
export async function registrarSessao(admin: Admin, aal: string) {
  const cabecalhos = await headers()
  await sqlRw`
    insert into admin_audit.sessions (ator_id, ip, user_agent, aal)
    values (
      ${admin.id},
      ${cabecalhos.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null},
      ${cabecalhos.get('user-agent') ?? null},
      ${aal}
    )
  `
}
