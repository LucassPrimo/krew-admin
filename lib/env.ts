import { z } from 'zod'

/**
 * Ambiente validado uma vez, no boot, e não a cada uso.
 *
 * O motivo de existir um schema aqui em vez de `process.env.X!` espalhado: uma
 * variável faltando ou vazia neste app não gera uma tela quebrada, gera uma
 * decisão de segurança tomada com valor errado. `ADMIN_USER_IDS` vazio com
 * `!` viraria uma lista vazia — e um `.includes()` numa lista vazia é `false`,
 * o que por acaso falha fechado. Mas `ADMIN_WRITES_ENABLED` indefinido, lido
 * como `!== 'false'`, falharia ABERTO. Não dá para depender de sorte em cada
 * leitura; melhor não subir o app.
 */
const schema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),

  ADMIN_DATABASE_URL_RO: z.string().min(20),
  ADMIN_DATABASE_URL_RW: z.string().min(20),

  // Lista de uuids separada por vírgula, com pelo menos um item válido.
  ADMIN_USER_IDS: z
    .string()
    .min(1)
    .transform((v) => v.split(',').map((s) => s.trim()).filter(Boolean))
    .pipe(z.array(z.uuid()).min(1)),

  // Sem default. Se a variável sumir, o app não sobe — em vez de subir com
  // escrita liberada porque ninguém lembrou de defini-la.
  ADMIN_WRITES_ENABLED: z.enum(['true', 'false']).transform((v) => v === 'true'),
})

const parsed = schema.safeParse(process.env)

if (!parsed.success) {
  const problemas = parsed.error.issues
    .map((i) => `  • ${i.path.join('.')}: ${i.message}`)
    .join('\n')
  throw new Error(
    `Ambiente inválido — o painel não sobe assim:\n${problemas}\n\n` +
      'Compare com .env.example e veja o README.'
  )
}

export const env = parsed.data

/**
 * Guarda contra o erro mais caro possível neste projeto: uma credencial de
 * banco marcada como pública, que o Next injetaria no bundle do navegador.
 * O `.env.example` avisa; isto verifica.
 */
for (const chave of Object.keys(process.env)) {
  if (chave.startsWith('NEXT_PUBLIC_') && /DATABASE|SERVICE_ROLE|SECRET|PASSWORD/i.test(chave)) {
    throw new Error(
      `A variável ${chave} é pública (NEXT_PUBLIC_) e parece conter credencial. ` +
        'Ela iria para o bundle do navegador. Renomeie antes de subir.'
    )
  }
}
