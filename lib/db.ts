import 'server-only'
import postgres from 'postgres'
import { env } from './env'

/**
 * A conexão de LEITURA do painel — e a única exportada deste módulo.
 *
 * O role `krew_admin_ro` não tem GRANT de INSERT, UPDATE nem DELETE em lugar
 * nenhum (migration 20260812032200). Isso não é um acordo entre programadores:
 * um `update` que chegue por aqui recebe "permission denied" do Postgres e
 * morre. Como leitura é a maior parte do código do painel — e portanto onde
 * moram os bugs —, essa é a defesa que mais trabalha.
 *
 * Escrita vive em `lib/mutate.ts`, que abre a própria conexão e não a exporta.
 * Não existe caminho para importar a credencial de escrita a partir daqui.
 */

// `postgres.js` em vez de `pg`: uma dependência, sem build nativo, com template
// tag que parametriza por padrão — `sql\`... ${valor}\`` vira bind parameter,
// não concatenação. Em um app cujo trabalho é montar consulta sobre dado de
// cliente, o default seguro importa mais que a API bonita.
function criar(url: string) {
  return postgres(url, {
    // O pooler da Supabase em modo transação (porta 6543) não mantém prepared
    // statements entre requisições; deixar ligado gera erro intermitente que só
    // aparece sob concorrência — o pior tipo de bug para descobrir em produção.
    prepare: false,
    max: 5,
    idle_timeout: 20,
    connect_timeout: 10,
    // `statement_timeout` já vem do role (5s), definido na migration. Aqui é só
    // rede: uma consulta pendurada não segura a requisição para sempre.
    types: {
      // `bigint` do Postgres chega como string por padrão no JS. Como os ids da
      // auditoria são bigint e só existem para exibição e ordenação, string
      // serve — e evita perda silenciosa de precisão em Number.
    },
  })
}

declare global {
  // eslint-disable-next-line no-var
  var __krewAdminRo: ReturnType<typeof criar> | undefined
}

// Em dev o hot reload reexecuta o módulo a cada mudança; sem o cache global,
// cada salvamento abriria mais um pool e o banco fecharia a porta em poucos
// minutos de trabalho.
export const sqlRo = globalThis.__krewAdminRo ?? criar(env.ADMIN_DATABASE_URL_RO)
if (process.env.NODE_ENV !== 'production') globalThis.__krewAdminRo = sqlRo
